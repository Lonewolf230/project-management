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
  validateDateRange,
} from "../utils/helper.js";
import { errors } from "../utils/appError.js";
const projectRouter = express.Router();

projectRouter.post(
  "/create",
  catchAsync(async (req, res) => {
    req.body = cleanEmptyStrings(req.body);
    const { creatorId, startDate, teamMembers } = req.body;

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

projectRouter.get("/getProjectsByUser", async (req, res) => {
  const { userId } = req.query;
  validateObjectId(userId, "User ID");

  let result;

  const user = await validateExists(User, userId, "User not found");
  if (user.role === "admin") {
    result = await Project.find({});
  } else if (user.role === "client") {
    result = await Project.find({ client: userId });
  } else {
    result = await Project.find({
      $or: [{ projectManager: userId }, { teamMembers: userId }],
    });
  }
  if (result.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "No projects found for this user",
    });
  }
  res.status(200).json({
    status: "success",
    result,
  });
});

projectRouter.get("/getProject", async (req, res) => {
  const { projectId, userId } = req.query;

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
    project = await Project.findById(projectId);
  } else if (user.role === "client") {
    project = await Project.findOne({
      _id: projectId,
      client: userId,
    });
  } else {
    project = await Project.findOne({
      _id: projectId,
      $or: [{ projectManager: userId }, { teamMembers: userId }],
    });
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
});

projectRouter.patch("/update", async (req, res) => {
  const { projectId, adminorPmid } = req.query;
  const { teamMembers, action, ...projectUpdates } = req.body;

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
    project: updatedProject,
  });
});


projectRouter.delete("/delete", async (req, res) => {
  const { projectId } = req.query;
  const { adminId } = req.query;

  validateObjectId(projectId, "Project ID");
  validateObjectId(adminId, "Admin ID");
  await validateAdminExists(adminId);
  await Project.findByIdAndDelete(projectId);

  res.status(200).json({
    status: "success",
    message: "Project deleted successfully",
  });
});

export { projectRouter };
