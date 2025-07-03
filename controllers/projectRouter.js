import express from "express";
import Project from "../models/project.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import {
  validateAdminExists,
  validateAdminOrProjectManager,
  validateClientExists,
  validateExists,
  validateObjectId,
  validateProjectExists,
} from "../utils/validationUtils.js";
import {
  catchAsync,
  cleanEmptyStrings,
  upload,
  validateDateRange,
} from "../utils/helper.js";
import { errors } from "../utils/appError.js";
import { getPresignedUrls, uploadFilesToS3 } from "../utils/s3Utils.js";
const projectRouter = express.Router();

projectRouter.post(
  "/create",
  catchAsync(async (req, res) => {
    req.body = cleanEmptyStrings(req.body);
    const { startDate, teamMembers } = req.body;
    const creatorId = req.user;
    validateObjectId(creatorId, "Admin Id");
    await validateAdminExists(creatorId);
    if (req.body.client) {
      validateObjectId(req.body.client, "Client Id");
      await validateClientExists(req.body.client, "Client not found");
    }

    validateDateRange(startDate, req.body.endDate);

    if (startDate) {
      req.body.startDate = new Date(startDate);
    }
    if (req.body.endDate) {
      req.body.endDate = new Date(req.body.endDate);
    }

    if (!teamMembers || teamMembers === "") req.body.teamMembers = [];
    else if (typeof teamMembers === "string")
      req.body.teamMembers = [teamMembers];

    if (req.body.teamMembers && Array.isArray(req.body.teamMembers)) {
      const invalidMembers = req.body.teamMembers.filter(
        (memberId) => !mongoose.Types.ObjectId.isValid(memberId)
      );
      if (invalidMembers.length > 0) {
        throw errors.badRequest("Invalid structure of teamMember fields");
      }
    }

    const project = await Project.create(req.body);
    res.status(201).json({
      status: "success",
      project,
    });
  })
);

projectRouter.get("/getProjectsByUser",catchAsync(async (req, res) => {
  const userId = req.user;
  validateObjectId(userId, "User ID");

  let result=[];

  const user = await validateExists(User, userId, "User not found");
  if (user.role === "admin") {
    result = await Project.find({isValid:true}).select("-files");
  } else if (user.role === "client") {
    result = await Project.find({ client: userId, isValid:true }).select("-files");
  } else {
    result = await Project.find({
      $or: [{ projectManager: userId }, { teamMembers: userId }],
      isValid:true
    }).select("-files")
  }

  res.status(200).json({
    status: "success",
    result,
  });
}));

projectRouter.get("/getProject", catchAsync(async (req, res) => {
  const { projectId } = req.query;
  const userId = req.user;

  validateObjectId(userId, "User ID");
  validateObjectId(projectId, "Project ID");
  const user = await User.findById(userId).select("id name role");
  if (!user) {
    return res.status(404).json({
      status: "fail",
      message: "User not found",
    });
  }
  await validateProjectExists(projectId);

  let project;
  if (user.role === "admin") {
    project = await Project.find({ _id: projectId, isValid:true })
  } else if (user.role === "client") {
    project = await Project.findOne({
      _id: projectId,
      client: userId,
      isValid:true
    });
  } else {
    project = await Project.findOne({
      _id: projectId,
      $or: [{ projectManager: userId }, { teamMembers: userId }],
      isValid:true
    });
  }

  const fileKeys=project.files || [];
  if (fileKeys.length > 0) {
    const presignedUrls=await getPresignedUrls(fileKeys);
    project.files = fileKeys.map((fileKey, index) => ({
      fileKey,
      presignedUrl: presignedUrls[index],
    }));
  }

  if (!project) {
    return res.status(403).json({
      status: "fail",
      message: "Project cannot be accessed by this user",
    });
  }
  await project.populate([{
    path: "teamMembers",
    select: "name email id",
  },{
    path: "projectManager",
    select: "name email id",
  }])

  res.status(200).json({
    status: "success",
    project,
  });
}));

projectRouter.patch("/update", catchAsync(async (req, res) => {
  const { projectId } = req.query;
  const { teamMembers, action, ...projectUpdates } = req.body;
  const adminorPmid = req.user;
  validateObjectId(projectId, "Project ID");
  validateObjectId(adminorPmid, "Admin or Project Manager ID");
  const { project } = await validateAdminOrProjectManager(
    adminorPmid,
    projectId
  );

  if (projectUpdates.endDate || projectUpdates.startDate) {
    const startDate = projectUpdates.startDate
      ? new Date(projectUpdates.startDate)
      : project.startDate;
    const endDate = projectUpdates.endDate
      ? new Date(projectUpdates.endDate)
      : project.endDate;

    validateDateRange(startDate, endDate);
  }

  let updatedProject = project;
  let existingMembers;

  if (!["add", "remove"].includes(action)) {
    return res.status(400).json({
      status: "fail",
      message: "Action is required and should be either add or remove",
    });
  }

  if (teamMembers && action) {
    let updateOp;
    existingMembers = project.teamMembers.map((id) => id.toString());

    if (action === "add") {
      const newMembers = teamMembers.filter(
        (memberId) => !existingMembers.includes(memberId)
      );
      if (newMembers.length > 0) {
        updateOp = { $push: { teamMembers: { $each: newMembers } } };
      }
    } else if (action === "remove") {
      const membersToRemove = teamMembers.filter((memberId) =>
        existingMembers.includes(memberId)
      );
      if (membersToRemove.length > 0) {
        updateOp = { $pull: { teamMembers: { $in: membersToRemove } } };
      }
    }
    updatedProject = await Project.findByIdAndUpdate(projectId, updateOp, {
      new: true,
    });
  }

  if (Object.keys(projectUpdates).length > 0) {
    updatedProject = await Project.findByIdAndUpdate(
      projectId,
      projectUpdates,
      { new: true }
    );
  }

  return res.status(200).json({
    status: "success",
    message: "Project updated successfully",
    project: updatedProject,
  });
}));


projectRouter.delete("/delete",catchAsync(async (req, res) => {
  const { projectId } = req.query;
  const adminId=req.user;
  validateObjectId(projectId, "Project ID");
  validateObjectId(adminId, "Admin ID");
  await validateAdminExists(adminId);
  await Project.findByIdAndDelete(projectId);

  res.status(200).json({
    status: "success",
    message: "Project deleted successfully",
  });
}));


projectRouter.patch("/updateFiles",upload,catchAsync(async(req,res)=>{
  const {projectId,action,fileKeys=[]}=req.query;
  const userId=req.user;
  const files = req.files;
  if(!['add','remove'].includes(action)){
    return res.status(400).json({
      status: "fail",
      message: "Action is required and should be either add or remove",
    });
  }
  validateObjectId(userId, "User ID");
  validateObjectId(projectId, "Project ID");
  await validateAdminOrProjectManager(userId, projectId);
  let keys=[]
  if(action=='add'){
      keys=await uploadFilesToS3(files,`${projectId}/shared`);
  
      await Project.findByIdAndUpdate(projectId,{
        $push: { files: { $each: keys } }
      },{new:true});
  }
  else if(action=='remove'){
      keys = fileKeys;
      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({
          status: "fail",
          message: "fileKeys is required and should be a non-empty array",
        });
      }

      await deleteFilesFromS3(keys);
      await Project.findByIdAndUpdate(projectId,{
        $pull: { files: { $in: keys } }
      },{new:true});
    }

  res.status(200).json({
    status: "success",
    message: `Files ${action}ed successfully`,
    files:keys,
  });
}))

export { projectRouter };
