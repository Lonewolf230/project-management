import mongoose, { model } from "mongoose"
import { errors } from "./appError.js"
import User from "../models/user.js"
import Project from "../models/project.js"
import Task from "../models/task.js"


export const validateObjectId=(id,name='ID')=>{
    if(!mongoose.Types.ObjectId.isValid(id)){
        throw errors.badRequest(`${name} is not a valid ObjectId`)
    }
}

export const validateExists=async(Model,id,errorMessage)=>{
    validateObjectId(id,`${Model.modelName} ID`);
    const doc=await Model.findById(id);
    if(!doc){
        throw errors.notFound(errorMessage)
    }
    return doc;
}

export const validateAdmin=async(userId)=>{
    const user=await validateExists(User,userId,'User not found');
    if(user.role!=='admin'){
        throw errors.forbidden('Only admins can perform this action')
    }
    return user;
}

export const validateAdminExists= async(userId)=>{
    const user=await User.exists({_id:userId,role:'admin'});
    if(!user){
        throw errors.forbidden('Only admins can perform this action')
    }
    return user;
}

export const validateProjectExists=async(projectId)=>{
    const project=await Project.exists({_id:projectId});
    if(!project){
        throw errors.notFound('Project does not exist');
    }
    return project;
}

export const validateClientExists=async(userId)=>{
    const user = await User.exists({_id: userId, role: 'client'});
    if (!user) {
        throw errors.forbidden('Client does not exist');
    }
    return user;
}

export const validateAdminOrProjectManager = async (userId, projectId) => {
  const user = await validateExists(User, userId, 'User not found');
  
  if (user.role === 'admin') return user;

  const project = await validateExists(Project, projectId, 'Project not found');
  
  if (project.projectManager.toString() !== userId.toString()) {
    throw errors.forbidden('Only admins or project managers can perform this action');
  }
  
  return { user, project };
};

export const validateForTaskDeletion=async(userId,taskId)=>{
    const user = await validateExists(User, userId, 'User not found');
    
    if (user.role === 'admin') return user;
    
    const task = await validateExists(Task, taskId, 'Task not found');
    
    const project = await validateExists(Project, task.project, 'Project not found');
    
    const isProjectManager = project.projectManager.toString() === userId.toString();
    
    if (!isProjectManager ) {
        throw errors.forbidden('You do not have permission to delete this task');
    }
    
    return task ;
}

export const validateTaskUpdateAccess=async(userId,taskId)=>{
  const user = await validateExists(User, userId, 'User not found');
  
  if (user.role === 'admin') return user;

  const task = await validateExists(Task, taskId, 'Task not found');
  const project = await validateExists(Project, task.project, 'Project not found');
  
  const isProjectManager = project.projectManager.toString() === userId.toString();
  const isAssignee = task.assignees.some(a => a.toString() === userId.toString());
  
  if (!isProjectManager && !isAssignee) {
    throw errors.forbidden('You do not have permission to access this task');
  }
  
  return { user, task, project };
}