import Task from "../models/task.js";
import express from "express";
import {
  catchAsync,
  processFileKeys,
  processRequiredSkills,
  upload,
  validateAssignees,
  validateTaskDates,
} from "../utils/helper.js";
import {
  deleteFilesFromS3,
  getPresignedUrls,
  uploadFilesToS3,
} from "../utils/s3Utils.js";
import {
  validateAdminOrProjectManager,
  validateAssigneeSkills,
  validateForTaskDeletion,
  validateIndividualTaskViewAccess,
  validateObjectId,
  validateProjectExists,
  validateTaskUpdateAccess,
  validateUploadTaskFiles,
} from "../utils/validationUtils.js";
import { errors } from "../utils/appError.js";
import Tag from "../models/tag.js";
import TaskComment from "../models/taskComment.js";

const taskRouter = express.Router();

taskRouter.post("/create",catchAsync(async (req, res) => {
  const { projectId } = req.query;
  const creatorId = req.user;
  const {
    assignees = [],
    fileKeys = [],
    requiredSkills = [],
    tags = [],
    ...taskData
  } = req.body;

  const { project } = await validateAdminOrProjectManager(creatorId, projectId);

  if (!taskData.startDate) throw errors.badRequest("Start date is required");
  if (!taskData.dueDate) throw errors.badRequest("Due date is required");

  const startDate = new Date(taskData.startDate);
  const dueDate = new Date(taskData.dueDate);
  const projectStartDate = new Date(project.startDate);
  const projectEndDate = new Date(project.endDate);

  validateTaskDates(startDate, dueDate, projectStartDate, projectEndDate);
  const files = processFileKeys(fileKeys);
  const requiredSkillsArray = processRequiredSkills(requiredSkills);
  const validatedAssignees = await validateAssignees(assignees, project);

  if (requiredSkills.length > 0) {
    await validateAssigneeSkills(validatedAssignees, requiredSkillsArray);
  }

  const newTask = {
    ...taskData,
    project: projectId,
    startDate,
    dueDate,
    files,
    assignees: validatedAssignees,
    requiredSkills: requiredSkillsArray,
  };

  let task = await Task.create(newTask);

  if (tags && tags.length > 0) {
    const uniqueTags=[...new Set(tags.map(tag=>tag.trim().toLowerCase()))];
    const tagIds = await Promise.all(
      uniqueTags.map(async (tagName) => {
        const tag = await Tag.findOneAndUpdate(
          { name: tagName },
          { $setOnInsert: { name: tagName } },
          { upsert: true, new: true, }
        );
        return tag.id;
      })
    );
    task.tags = tagIds;
  }
  await task.save()

  await TaskComment.create({
    taskId: task.id,
  })

  return res.status(201).json({
    status: "success",
    task,
  });
}));

taskRouter.get("/allTasks", catchAsync(async (req, res) => {
  const { projectId } = req.query;
  const userId=req.user;
  await validateIndividualTaskViewAccess(userId, projectId);
  const tasks = await Task.find({ project: projectId,isValid:true }).select("-files");

  if (tasks.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "No tasks found for this project",
    });
  }

  return res.status(200).json({
    status: "success",
    tasks,
  });
}));

taskRouter.get("/getTaskById", catchAsync(async (req, res) => {
  const { taskId } = req.query;
  const userId=req.user;
  await validateTaskUpdateAccess(userId, taskId);
  const task= await Task.find({_id:taskId,isValid:true})
  await task.populate([{
    path:"tags",
    select:"name id ",
  },{
    path:"assignees",
    select:"name email id",
  }])
  let resTask=task.toJSON()
  let presignedUrls = [];
  let keyUrlMap = [];

  if (resTask.files && resTask.files.length > 0) {
    presignedUrls = await getPresignedUrls(resTask.files);
    keyUrlMap = resTask.files.map((fileKey, index) => {
      return {
        fileKey,
        presignedUrl: presignedUrls[index],
      };
    });
  }
  resTask.files = keyUrlMap;
  return res.status(200).json({
    status: "success",
    task: resTask,
  });
}));

taskRouter.delete("/delete", catchAsync(async (req, res) => {
  const { taskId } = req.query;
  const userId=req.user;
  const task = await validateForTaskDeletion(userId, taskId);
  if (task.files && task.files.length > 0) {
    await deleteFilesFromS3(task.files);
  }
  await Task.findByIdAndDelete(taskId)

  await TaskComment.findOneAndDelete({ taskId })

  return res.status(200).json({
    status: "success",
    message: "Task deleted successfully",
  });
}));

taskRouter.patch("/update", catchAsync(async (req, res) => {
  const { taskId } = req.query;
  const userId=req.user;

  const { action, assignees, ...updateBody } = req.body;

  validateObjectId(taskId, "Task ID");
  validateObjectId(userId, "User ID");

  const { task, project } = await validateTaskUpdateAccess(userId, taskId, {
    ...req.body,
    ...(assignees && { assignees: true }),
  });
  let updatedTask;

  if (assignees) {
    if (!action) {
      return res.status(400).json({
        status: "fail",
        message: "Action is required to add or remove assignees",
      });
    }
    const existingAssignees = task.assignees.map((assignee) =>
      assignee.toString()
    );
    const teamMembers = project.teamMembers.map((member) => member.toString());
    if (action === "add") {
      let newAssignees = await validateAssignees(assignees, project);
      newAssignees = assignees.filter(
        (assignee) =>
          teamMembers.includes(assignee) &&
          !existingAssignees.includes(assignee)
      );
      updatedTask = await Task.findByIdAndUpdate(
        taskId,
        { $addToSet: { assignees: { $each: newAssignees } } },
        { new: true }
      );
    } else if (action === "remove") {
      updatedTask = await Task.findByIdAndUpdate(
        taskId,
        { $pull: { assignees: { $in: assignees } } },
        { new: true }
      );
    }
  }
  if (Object.keys(updateBody).length > 0) {
    if (updateBody.startDate || updateBody.dueDate) {
      const projectStartDate = project.startDate;
      const projectEndDate = project.endDate;
      const startDate = updateBody.startDate
        ? new Date(updateBody.startDate)
        : task.startDate;
      const dueDate = updateBody.dueDate
        ? new Date(updateBody.dueDate)
        : task.dueDate;

      validateTaskDates(startDate, dueDate, projectStartDate, projectEndDate);
    }
  }
  updatedTask = await Task.findByIdAndUpdate(taskId, updateBody, { new: true });

  return res.status(200).json({
    status: "success",
    task: updatedTask,
  });
}));

taskRouter.post(
  "/uploadFiles",
  upload,
  catchAsync(async (req, res) => {
    const files = req.files;
    const { projectId } = req.query;
    const userId=req.user;

    await validateAdminOrProjectManager(userId, projectId);

    const fileKeys = await uploadFilesToS3(files, `${projectId}/`);
    return res.status(200).json({
      status: "success",
      message: "Files uploaded successfully",
      fileKeys,
    });
  })
);

taskRouter.patch("/uploadTaskFiles", upload,catchAsync( async (req, res) => {
  const files = req.files;
  const { taskId, projectId } = req.query;
  const userId=req.user;

  await validateUploadTaskFiles(userId, taskId, projectId);

  const fileKeys = await uploadFilesToS3(files, `${projectId}/`);
  return res.status(200).json({
    status: "success",
    message: "Files uploaded successfully",
    fileKeys,
  });
}));

taskRouter.patch("/updateFiles",catchAsync( async (req, res) => {
  const { taskId, userId, projectId } = req.query;
  const { action, fileKeys = [] } = req.body;

  await validateUploadTaskFiles(userId, taskId, projectId);
  const files = processFileKeys(fileKeys);

  let updatedTask;
  if (!action || !["add", "remove"].includes(action)) {
    return res.status(400).json({
      status: "fail",
      message: "Action must be either 'add' or 'remove'",
    });
  }
  if (action == "add") {
    updatedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        $push: {
          files: {
            $each: files,
          },
        },
      },
      { new: true }
    );
  } else if (action === "remove") {
    await deleteFilesFromS3(fileKeys);
    updatedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        $pull: {
          files: {
            $in: files,
          },
        },
      },
      { new: true }
    );
  }

  return res.status(200).json({
    status: "success",
    message: `Files ${action}ed successfully`,
    task: updatedTask,
  });
}));

export { taskRouter };
