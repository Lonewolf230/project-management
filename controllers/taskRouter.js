import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import express from "express";
import { catchAsync, upload, validateDateRange } from "../utils/helper.js";
import {
  deleteFilesFromS3,
  getPresignedUrls,
  uploadFilesToS3,
} from "../utils/s3Utils.js";
import mongoose from "mongoose";
import { validateAdminOrProjectManager, validateForTaskDeletion, validateObjectId } from "../utils/validationUtils.js";
import { errors } from "../utils/appError.js";

const taskRouter = express.Router();

taskRouter.post("/create", async (req, res) => {
  const { creatorId, projectId } = req.query;
  const { assignees, fileKeys } = req.body;

  await validateAdminOrProjectManager(creatorId, projectId);
  req.body.project = projectId;

  if(req.body.startDate) req.body.startDate = new Date(req.body.startDate);
  else throw errors.badRequest("Start date is required");

  if(req.body.dueDate) req.body.dueDate = new Date(req.body.dueDate);
  else throw errors.badRequest("Due date is required");

  validateDateRange(req.body.startDate, req.body.dueDate);


  if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length == 0) {
    req.body.files = [];
  } else if (typeof fileKeys === "string") {
    req.body.files = [fileKeys];
  }
  else if (Array.isArray(fileKeys)) req.body.files = fileKeys;

  if(!assignees) req.body.assignees = [];
  else if(typeof assignees === "string") req.body.assignees = [assignees];
  else if(Array.isArray(assignees)) req.body.assignees = assignees;
  else req.body.assignees = [];

  if(req.body.assignees.length>0){
    req.body.assignees.forEach((assignee)=>validateObjectId(assignee, "Assignee ID"));
  }

  const task = await Task.create(req.body);

  return res.status(201).json({
    status: "success",
    task,
  });
});

taskRouter.get("/allTasks", async (req, res) => {
  const { projectId } = req.query;

  try {
    if (!projectId) {
      return res.status(400).json({
        status: "fail",
        message: "Project ID is required",
      });
    }
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        status: "fail",
        message: "The project does not exist",
      });
    }
    const tasks = await Task.find({ project: projectId }).select("-files");

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
  } catch (error) {
    return res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

taskRouter.get("/getTaskById", async (req, res) => {
  const { taskId } = req.query;
  try {
    if (!taskId) {
      return res.status(400).json({
        status: "fail",
        message: "Task ID is required",
      });
    }
    let task = await Task.findById(taskId).lean();
    if (!task) {
      return res.status(404).json({
        status: "fail",
        message: "The task does not exist",
      });
    }
    let presignedUrls = [];
    if (task.files && task.files.length > 0) {
      presignedUrls = await getPresignedUrls(task.files);
    }
    let keyUrlMap = [];
    if (task.files && task.files.length > 0) {
      keyUrlMap = task.files.map((fileKey, index) => {
        return {
          fileKey,
          presignedUrl: presignedUrls[index],
        };
      });
    }

    task.files = keyUrlMap;
    return res.status(200).json({
      status: "success",
      task,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

taskRouter.delete("/delete", async (req, res) => {
  const { taskId, userId } = req.query;
  const task=await validateForTaskDeletion(userId, taskId)
    if (task.files && task.files.length > 0) {
      await deleteFilesFromS3(task.files);
    }
    await Task.findByIdAndDelete(taskId);

    return res.status(200).json({
      status: "success",
      message: "Task deleted successfully",
    });

});

taskRouter.patch("/update", async (req, res) => {
  const { taskId, userId } = req.query;
  const { action, assignees, ...updateBody } = req.body;

  try {
    if (!taskId) {
      return res.status(400).json({
        status: "fail",
        message: "Task ID is required",
      });
    }
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        status: "fail",
        message: "The task does not exist",
      });
    }
    if (!userId) {
      return res.status(400).json({
        status: "fail",
        message: "User ID is required",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "The user does not exist",
      });
    }
    const project = await Project.findById(task.project);
    if (updateBody.dueDate || assignees) {
      if (
        user.role !== "admin" &&
        project.projectManager.toString() !== userId
      ) {
        return res.status(403).json({
          status: "fail",
          message:
            "Only admins or respective project manager can add or remove assignees",
        });
      }
    } else {
      if (!task.assignees.includes(userId)) {
        return res.status(403).json({
          status: "fail",
          message: "Only the assigned user can update the task",
        });
      }
    }

    const existingAssignees = task.assignees;
    let updateOp;
    let updatedTask;
    if (assignees && !action) {
      return res.status(400).json({
        status: "fail",
        message: "Action is required to add or remove assignees",
      });
    }
    if (action && assignees) {
      if (action === "add") {
        const newAssignees = assignees.filter(
          (assignee) =>
            project.teamMembers.includes(assignee) &&
            !existingAssignees.includes(assignee)
        );
        updateOp = {
          $push: {
            assignees: {
              $each: newAssignees,
            },
          },
        };
      } else if (action === "remove") {
        const assigneesToRemove = assignees.filter((assignee) =>
          existingAssignees.includes(assignee)
        );
        updateOp = {
          $pull: {
            assignees: {
              $in: assigneesToRemove,
            },
          },
        };
      } else {
        return res.status(400).json({
          status: "fail",
          message: "Invalid action",
        });
      }
      updatedTask = await Task.findByIdAndUpdate(taskId, updateOp, {
        new: true,
      });
    }
    if (Object.keys(updateBody).length > 0) {
      updatedTask = await Task.findByIdAndUpdate(taskId, updateBody, {
        new: true,
      });
    }
    return res.status(200).json({
      status: "success",
      task: updatedTask,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

taskRouter.post("/uploadFiles", upload, catchAsync(async (req, res) => {
  const files = req.files;
  const { userId, projectId } = req.query;

  await validateAdminOrProjectManager(userId, projectId);

  const fileKeys = await uploadFilesToS3(files, `${projectId}/`);
    return res.status(200).json({
      status: "success",
      message: "Files uploaded successfully",
      fileKeys,
    });
}));

taskRouter.patch("/uploadTaskFiles", upload, async (req, res) => {
  const files = req.files;
  const { taskId, userId } = req.query;
  try {
    if (!taskId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Task ID and User ID are required",
      });
    }
    const task = await Task.findById(taskId).select("project assignees");
    const user = await User.exists({ _id: userId, role: { $eq: "admin" } });
    const pm = await Project.exists({
      _id: task.project,
      projectManager: userId,
    });
    const assignee = task.assignees.includes(userId);
    console.log(user, pm, assignee);
    if (!user && !pm && !assignee) {
      return res.status(403).json({
        status: "fail",
        message:
          "Only admins, project managers or assigned users can upload files",
      });
    }

    if (files && files.length > 0) {
      const fileKeys = await uploadFilesToS3(files, `tasks/`);
      return res.status(200).json({
        status: "success",
        message: "Files uploaded successfully",
        fileKeys,
      });
    }
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

taskRouter.patch("/updateFiles", async (req, res) => {
  const { taskId, userId } = req.query;
  const { action, fileKeys } = req.body;
  try {
    if (!userId) {
      return res.status(400).json({
        status: "fail",
        message: "User ID is required",
      });
    }
    const taskPrev = await Task.findById(taskId).select("project assignees");
    const user = await User.exists({
      _id: userId,
      role: { $ne: "client", $eq: "admin" },
    });
    const pm = await Project.exists({
      _id: taskPrev.project,
      projectManager: userId,
    });
    const assignee = taskPrev.assignees.includes(userId);

    if (!user && !pm && !assignee) {
      return res.status(404).json({
        status: "fail",
        message:
          "Only admins, project managers or assigned users can update files",
      });
    }

    if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "File keys are required",
      });
    }
    if (!action) {
      return res.status(400).json({
        status: "fail",
        message: "Action is required",
      });
    }
    if (!taskId) {
      return res.status(400).json({
        status: "fail",
        message: "Task ID is required",
      });
    }
    const task = await Task.exists({ _id: taskId });
    if (!task) {
      return res.status(404).json({
        status: "fail",
        message: "The task does not exist",
      });
    }
    let updatedTask;
    if (action == "add") {
      updatedTask = await Task.findByIdAndUpdate(
        taskId,
        {
          $push: {
            files: {
              $each: fileKeys,
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
              $in: fileKeys,
            },
          },
        },
        { new: true }
      );
    }

    return res.status(200).json({
      status: "success",
      message: `Files ${action} successfully`,
      task: updatedTask,
    });
  } catch (error) {
    return res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

export { taskRouter };
