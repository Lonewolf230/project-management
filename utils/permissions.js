import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import mongoose from "mongoose";

export const validateRequired = (value, fieldName) => {
  if (!value) {
    return {
      isValid: false,
      error: {
        status: 'fail',
        message: `${fieldName} is required`
      }
    };
  }
  return { isValid: true };
};

export const validateObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return {
      isValid: false,
      error: {
        status: 'fail',
        message: `${fieldName} is not valid`
      }
    };
  }
  return { isValid: true };
};

export const validateAndGetUser = async (userId, fieldName = 'User ID') => {
  const requiredCheck = validateRequired(userId, fieldName);
  if (!requiredCheck.isValid) {
    return requiredCheck;
  }

  const objectIdCheck = validateObjectId(userId, fieldName);
  if (!objectIdCheck.isValid) {
    return objectIdCheck;
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        isValid: false,
        error: {
          status: 'fail',
          message: 'User not found'
        }
      };
    }
    return { isValid: true, user };
  } catch (error) {
    throw error;
  }
};

export const validateUserRole = (user, allowedRoles) => {
  if (!allowedRoles.includes(user.role)) {
    return {
      isValid: false,
      error: {
        status: 'fail',
        message: `Only ${allowedRoles.join(' or ')} can perform this action`
      }
    };
  }
  return { isValid: true };
};

export const checkAdminExists = async (adminId) => {
  const validation = await validateAndGetUser(adminId, 'Admin ID');
  if (!validation.isValid) {
    return validation;
  }

  const roleCheck = validateUserRole(validation.user, ['admin']);
  if (!roleCheck.isValid) {
    return {
      isValid: false,
      error: {
        status: 'fail',
        message: 'The user is not an admin'
      }
    };
  }

  return { isValid: true, user: validation.user };
};

export const validateAndGetProject = async (projectId, fieldName = 'Project ID') => {
  const requiredCheck = validateRequired(projectId, fieldName);
  if (!requiredCheck.isValid) {
    return requiredCheck;
  }

  const objectIdCheck = validateObjectId(projectId, fieldName);
  if (!objectIdCheck.isValid) {
    return objectIdCheck;
  }

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return {
        isValid: false,
        error: {
          status: 'fail',
          message: 'Project not found'
        }
      };
    }
    return { isValid: true, project };
  } catch (error) {
    throw error;
  }
};

export const validateAndGetTask = async (taskId, fieldName = 'Task ID') => {
  const requiredCheck = validateRequired(taskId, fieldName);
  if (!requiredCheck.isValid) {
    return requiredCheck;
  }

  const objectIdCheck = validateObjectId(taskId, fieldName);
  if (!objectIdCheck.isValid) {
    return objectIdCheck;
  }

  try {
    const task = await Task.findById(taskId);
    if (!task) {
      return {
        isValid: false,
        error: {
          status: 'fail',
          message: 'The task does not exist'
        }
      };
    }
    return { isValid: true, task };
  } catch (error) {
    throw error;
  }
};


export const checkProjectAccess = (user, project) => {
  const isAdmin = user.role === 'admin';
  const isProjectManager = project.projectManager.toString() === user._id.toString();
  const isTeamMember = project.teamMembers.some(memberId => memberId.toString() === user._id.toString());
  const isClient = user.role === 'client' && project.client && project.client.toString() === user._id.toString();

  return {
    isAdmin,
    isProjectManager,
    isTeamMember,
    isClient,
    hasAccess: isAdmin || isProjectManager || isTeamMember || isClient
  };
};

export const checkTaskAccess = (user, task, project) => {
  const projectAccess = checkProjectAccess(user, project);
  const isAssignee = task.assignees.some(assigneeId => assigneeId.toString() === user._id.toString());

  return {
    ...projectAccess,
    isAssignee,
    hasTaskAccess: projectAccess.hasAccess || isAssignee
  };
};


export const validateAdminOrProjectManager = async (userId, project) => {
  const userValidation = await validateAndGetUser(userId, 'Admin or Project Manager ID');
  if (!userValidation.isValid) {
    return userValidation;
  }

  const access = checkProjectAccess(userValidation.user, project);
  if (!access.isAdmin && !access.isProjectManager) {
    return {
      isValid: false,
      error: {
        status: 'fail',
        message: 'Only admins or the assigned project manager can perform this action'
      }
    };
  }

  return { isValid: true, user: userValidation.user, access };
};

export const validateTaskCreator = async (creatorId, project) => {
  const userValidation = await validateAndGetUser(creatorId, 'Creator ID');
  if (!userValidation.isValid) {
    return userValidation;
  }

  const user = userValidation.user;
  const isAdmin = user.role === 'admin';
  const isProjectManager = project.projectManager.toString() === user._id.toString();

  if (!isAdmin && !isProjectManager) {
    return {
      isValid: false,
      error: {
        status: 'fail',
        message: 'Only admins or project managers can create a task'
      }
    };
  }

  return { isValid: true, user, isAdmin, isProjectManager };
};


export const checkMultipleConditions = async (userId, conditions) => {
  const userValidation = await validateAndGetUser(userId, 'User ID');
  if (!userValidation.isValid) {
    return userValidation;
  }

  const results = {};
  for (const [key, condition] of Object.entries(conditions)) {
    try {
      results[key] = await condition(userValidation.user);
    } catch (error) {
      results[key] = false;
    }
  }

  const hasAnyAccess = Object.values(results).some(result => result === true);
  
  return {
    isValid: true,
    user: userValidation.user,
    results,
    hasAnyAccess
  };
};

export const validateTeamMembers = (teamMembers) => {
  if (!teamMembers || teamMembers === "") {
    return { isValid: true, members: [] };
  }

  let finalisedMembers = [];
  if (typeof teamMembers === "string") {
    finalisedMembers = [teamMembers];
  } else if (Array.isArray(teamMembers)) {
    finalisedMembers = teamMembers;
  }

  if (finalisedMembers.length > 0) {
    const invalidMembers = finalisedMembers.filter((memberId) => !mongoose.Types.ObjectId.isValid(memberId));
    if (invalidMembers.length > 0) {
      return {
        isValid: false,
        error: {
          status: 'fail',
          message: 'Invalid structure of teamMember fields'
        }
      };
    }
  }

  return { isValid: true, members: finalisedMembers };
};

export const validateAssignees = (assignees) => {
  if (!assignees) {
    return { isValid: true, assignees: [] };
  }

  let finalisedAssignees = [];
  if (typeof assignees === 'string') {
    finalisedAssignees = [assignees];
  } else if (Array.isArray(assignees)) {
    finalisedAssignees = assignees;
  }

  if (finalisedAssignees.length > 0) {
    const invalidAssignees = finalisedAssignees.filter((assignee) => !mongoose.Types.ObjectId.isValid(assignee));
    if (invalidAssignees.length > 0) {
      return {
        isValid: false,
        error: {
          status: 'fail',
          message: 'Invalid assignee IDs'
        }
      };
    }
  }

  return { isValid: true, assignees: finalisedAssignees };
};