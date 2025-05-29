import mongoose, { model } from "mongoose"
import { errors } from "./appError.js"
import User from "../models/user.js"
import Project from "../models/project.js"
import Task from "../models/task.js"
import Skill from "../models/skill.js"


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
    validateObjectId(userId, 'User ID');
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
  const isAdmin = user.role === 'admin';

  const project = await validateExists(Project, projectId, 'Project not found');
  
  if (!isAdmin && project.projectManager.toString() !== userId.toString()) {
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

export const validateUploadTaskFiles=async(userId,taskId,projectId)=>{
    validateObjectId(taskId, 'Task ID');
    validateObjectId(userId, 'User ID');
    validateObjectId(projectId, 'Project ID');
    const task=await Task.findById(taskId).select('project assignees');
    if (!task) {
        throw errors.notFound('Task not found');
    }
    if( task.project.toString() !== projectId.toString()) {
        throw errors.badRequest('Task does not belong to this project');
    }
    const user=await User.exists({_id:userId,role:'admin'});
    const pm=await Project.exists({_id:projectId,projectManager:userId})
    const assignee=task.assignees.includes(userId);
    if (!user && !pm && !assignee) {
        throw errors.forbidden('You do not have permission to upload files to this task');
    }
    return task
}

export const validateTasksViewAccess=async(userId,projectId)=>{
    const user = await validateExists(User, userId, 'User not found');
    
    if (user.role === 'admin') return user;
    
    validateObjectId(projectId, 'Project ID');
    const project=await Project.exists({_id:projectId,$or:[{projectManager:userId},{teamMembers:userId},{client:userId}]});    
    if(!project){
        throw errors.forbidden('You do not have permission to view tasks in this project');
    }
}

export const validateIndividualTaskViewAccess=async(userId,taskId)=>{
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

export const validateTaskUpdateAccess=async(userId,taskId,updateData)=>{
    const user=await validateExists(User, userId, 'User not found');
    const task=await validateExists(Task, taskId, 'Task not found');
    const project=await validateExists(Project, task.project, 'Project not found');

    if(user.role==='admin') return {user,task,project}

    const isProjectManager=project.projectManager.toString()===userId.toString();
    const isAssignee=task.assignees.some(a=>a.toString()===userId.toString());

    if(!isProjectManager && !isAssignee) {
        throw errors.forbidden('You do not have permission to update this task');
    }

    if(updateData){
        const restrictedFields=['project','assignees','startDate','dueDate','priority','requiredSkill']
        const isTouchingRestrictedField=Object.keys(updateData).some(field=>restrictedFields.includes(field))
        const isModifyingAssignees=(
            ('assignees' in updateData) ||
            ('action' in updateData && 'assignees' in updateData)
        )
        if((isTouchingRestrictedField || isModifyingAssignees) && !isProjectManager) {
            throw errors.forbidden('You do not have permission to update restricted fields');
        }
    }
    return { user, task, project };
}

export const validateAssigneeSkills=async(assigneesIds,requiredSkills)=>{
    const users=await User.find({
        _id:{$in:assigneesIds}
    }).select('skills')

    const skillErrors=[]
    for(const {skill:skillId,minLevel} of requiredSkills){
        const skill=await Skill.exists({_id:skillId});
        if(!skill){
            skillErrors.push(`Skill with ID ${skillId} does not exist`);
            continue;
        }

        const hasQualifiedUser=users.some(user=>{
            const userSkill=user.skills.find(s=>s.skillId.equals(skillId))
            return userSkill && userSkill.level>=minLevel
        })

        if(!hasQualifiedUser){
            skillErrors.push(`No user has the required skill ${skillId} with level ${minLevel}`);
        }
    }

    if(skillErrors.length > 0) {
        throw errors.badRequest(`Skill validation failed: ${skillErrors.join(', ')}`);
    }
}