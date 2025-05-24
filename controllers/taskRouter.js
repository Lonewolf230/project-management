import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import express from "express";
import { upload } from "../utils/helper.js";
import { deleteFilesFromS3, getPresignedUrls, uploadFilesToS3 } from "../utils/s3Utils.js";
import mongoose from "mongoose";
import { validateRequired } from "../utils/permissions.js";


const taskRouter = express.Router();

taskRouter.post("/create",async (req,res)=>{
    const {creatorId,taskName,taskDescription,project,assignees,priority,dueDate,fileKeys}=req.body
    try {
        if(!creatorId){
            return res.status(400).json({
                status:'fail',
                message:'Creator ID is required'
            })
        }
        if(!mongoose.Types.ObjectId.isValid(project)){
            return res.status(400).json({
                status:'fail',
                message:'Project ID is invalid'
            })
        }
        const user=await User.exists(
            {
                _id:creatorId,
                role:{$ne:'client',$eq:'admin'}
            }
        )
        const projectExist=await Project.findById(project).select('projectManager')
        console.log(projectExist)
        if(!user && projectExist.projectManager.toString()!==creatorId){
            return res.status(404).json({
                status:'fail',
                message:'Only admins or project managers can create a task'
            })
        }

        if(!fileKeys || !Array.isArray(fileKeys) || fileKeys == ''){
            fileKeys=[]
        }
        else if(typeof fileKeys === 'string'){
            fileKeys=[fileKeys]
        }

        let finalisedAssignees=[]
        
        if (assignees) {
            if (typeof assignees === 'string') {
                finalisedAssignees = [assignees] 
            } else if (Array.isArray(assignees)) {
                finalisedAssignees = assignees
            }
        }

        if (finalisedAssignees.length > 0) {
            const invalidAssignees = finalisedAssignees.filter((assignee) => !mongoose.Types.ObjectId.isValid(assignee));
            if (invalidAssignees.length > 0) {
                return res.status(400).json({
                    status: 'fail',
                    message: 'Invalid assignee IDs' 
            })
        }}
        
        const task=await Task.create({
            taskName,
            taskDescription,
            project,
            assignees:finalisedAssignees,
            priority,
            dueDate,
            files:fileKeys
        })

        return res.status(201).json({
            status:'success',
            task
        })
    }
    catch (error) {
        return res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

taskRouter.get("/allTasks",async (req,res)=>{
    const {projectId}=req.query

    try {
        if(!projectId){
            return res.status(400).json({
                status:'fail',
                message:'Project ID is required'
            })
        }
        const project=await Project.findById(projectId)
        if(!project){
            return res.status(404).json({
                status:'fail',
                message:'The project does not exist'
            })
        }
        const tasks=await Task.find({project:projectId}).select('-files')

        if(tasks.length===0){
            return res.status(404).json({
                status:'fail',
                message:'No tasks found for this project'
            })
        }

        return res.status(200).json({
            status:'success',
            tasks
        })

    } catch (error) {
        return res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

taskRouter.get("/getTaskById",async (req,res)=>{
    const {taskId}=req.query
    try {
        if(!taskId){
            return res.status(400).json({
                status:'fail',
                message:'Task ID is required'
            })
        }
        let task=await Task.findById(taskId).lean()
        if(!task){
            return res.status(404).json({
                status:'fail',
                message:'The task does not exist'
            })
        }
        let presignedUrls=[]
        if(task.files && task.files.length>0){
            presignedUrls=await getPresignedUrls(task.files)
        }
        let keyUrlMap=[]
        if(task.files && task.files.length>0){
            keyUrlMap=task.files.map((fileKey,index)=>{
                return {
                    fileKey,
                    presignedUrl:presignedUrls[index]
                }
            })
        }

        task.files=keyUrlMap
        return res.status(200).json({
            status:'success',
            task
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
    })
}})


taskRouter.delete("/delete",async (req,res)=>{
    const {taskId,adminOrPmid}=req.query

    try {
        if(!taskId){
            return res.status(400).json({
                status:'fail',
                message:'Task ID is required'
            })
        }
        const task=await Task.findById(taskId)
        if(!task){
            return res.status(404).json({
                status:'fail',
                message:'The task does not exist'
            })
        }

        if(!adminOrPmid){
            return res.status(400).json({
                status:'fail',
                message:'Admin or PM ID is required'
            })
        }
        const user=await User.findById(adminOrPmid)
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'The user does not exist'
            })
        }
        const project=await Project.findById(task.project)
        if(user.role!=='admin' && project.projectManager.toString()!==adminOrPmid){
            return res.status(403).json({
                status:'fail',
                message:'Only admins or project managers can delete a task'
            })
        }
        if(task.files && task.files.length>0){
            await deleteFilesFromS3(task.files)
        }
        await Task.findByIdAndDelete(taskId)

        return res.status(200).json({
            status:'success',
            message:'Task deleted successfully'
        })

    } catch (error) {
        return res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

taskRouter.patch("/update",async(req,res)=>{
    const {taskId,userId}=req.query
    const {action,assignees,...updateBody}=req.body

    try {
        if(!taskId){
            return res.status(400).json({
                status:'fail',
                message:'Task ID is required'
            })
        }
        const task=await Task.findById(taskId)
        if(!task){
            return res.status(404).json({
                status:'fail',
                message:'The task does not exist'
            })
        }
        if(!userId){
            return res.status(400).json({
                status:'fail',
                message:'User ID is required'
            })
        }
        const user=await User.findById(userId)
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'The user does not exist'
            })
        }
        const project=await Project.findById(task.project)
        if(updateBody.dueDate || assignees){
            if(user.role!=='admin' && project.projectManager.toString()!==userId){
                return res.status(403).json({
                    status:'fail',
                    message:'Only admins or respective project manager can add or remove assignees'
                })
            }
        }
        else{
            if(!task.assignees.includes(userId)){
                return res.status(403).json({
                    status:'fail',
                    message:'Only the assigned user can update the task'
                })
            }
        }

        const existingAssignees=task.assignees
        let updateOp
        let updatedTask
        if(assignees && !action){
            return res.status(400).json({
                status:'fail',
                message:'Action is required to add or remove assignees'
            })
        }
        if(action && assignees){
            if(action==='add'){
                const newAssignees=assignees.filter((assignee)=>project.teamMembers.includes(assignee) && !existingAssignees.includes(assignee))
                updateOp={
                    $push:{
                        assignees:{
                            $each:newAssignees
                        }
                    }
                }
            }
            else if(action==='remove'){
                const assigneesToRemove=assignees.filter((assignee)=>existingAssignees.includes(assignee))
                updateOp={
                    $pull:{
                        assignees:{
                            $in:assigneesToRemove
                        }
                    }
                }
            }
            else{
                return res.status(400).json({
                    status:'fail',
                    message:'Invalid action'
                })
            }
            updatedTask=await Task.findByIdAndUpdate(taskId,updateOp,{new:true})
        }
        if(Object.keys(updateBody).length>0){
            updatedTask=await Task.findByIdAndUpdate(taskId,updateBody,{new:true})
        }
        return res.status(200).json({
            status:'success',
            task:updatedTask
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

taskRouter.post("/uploadFiles",upload,async(req,res)=>{
    const files=req.files
    const {userId,projectId}=req.query
    try {
        if(!userId){
            return res.status(400).json({
                status:'fail',
                message:'User ID is required'
            })
        }
        const user=await User.exists({_id:userId,role:{$eq:'admin'}})
        console.log(user)
        const project=await Project.findById(projectId).select('projectManager')
        console.log(project)
        if(!user && project.projectManager.toString()!==userId){
            return res.status(403).json({
                status:'fail',
                message:'Only admins or project managers can upload files'
            })
        }

        if(files && files.length>0){
            const fileKeys=await uploadFilesToS3(files,`${projectId}/`)
            return res.status(200).json({
                status:'success',
                message:'Files uploaded successfully',
                fileKeys
            })
        }
    } catch (error) {
        return res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

taskRouter.patch("/uploadTaskFiles",upload,async(req,res)=>{
    const files=req.files
    const {taskId,userId}=req.query
    try {
        if(!taskId || !userId){
            return res.status(400).json({
                status:'fail',
                message:'Task ID and User ID are required'
            })
        }
        const task=await Task.findById(taskId).select('project assignees')
        const user=await User.exists({_id:userId,role:{$eq:'admin'}})
        const pm=await Project.exists({_id:task.project,projectManager:userId})
        const assignee=task.assignees.includes(userId)
        console.log(user,pm,assignee)
        if(!user && !pm && !assignee){
            return res.status(403).json({
                status:'fail',
                message:'Only admins, project managers or assigned users can upload files'
            })
        }

        if(files && files.length>0){
            const fileKeys=await uploadFilesToS3(files,`tasks/`)
            return res.status(200).json({
                status:'success',
                message:'Files uploaded successfully',
                fileKeys
            })
        }

    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

taskRouter.patch("/updateFiles",async(req,res)=>{
    const {taskId,userId}=req.query
    const {action,fileKeys}=req.body
    try {
        if(!userId){
            return res.status(400).json({
                status:'fail',
                message:'User ID is required'
            })
        }
        const taskPrev=await Task.findById(taskId).select('project assignees')
        const user=await User.exists({_id:userId,role:{$ne:'client',$eq:'admin'}})
        const pm=await Project.exists({_id:taskPrev.project,projectManager:userId})
        const assignee=taskPrev.assignees.includes(userId)

        if(!user && !pm && !assignee){
            return res.status(404).json({
                status:'fail',
                message:'Only admins, project managers or assigned users can update files'
            })
        }

        if(!fileKeys || !Array.isArray(fileKeys) || fileKeys.length===0){
            return res.status(400).json({
                status:'fail',
                message:'File keys are required'
            })
        }
        if(!action){
            return res.status(400).json({
                status:'fail',
                message:'Action is required'
            })
        }
        if(!taskId){
            return res.status(400).json({
                status:'fail',
                message:'Task ID is required'
            })
        }
        const task=await Task.exists({_id:taskId})
        if(!task){
            return res.status(404).json({
                status:'fail',
                message:'The task does not exist'
            })
        }
        let updatedTask
        if(action=='add'){
            updatedTask=await Task.findByIdAndUpdate(taskId,{
                $push:{
                    files:{
                        $each:fileKeys
                    }
                }
            },
        {new:true})            

        }
        else if(action==='remove'){

            await deleteFilesFromS3(fileKeys)
            updatedTask=await Task.findByIdAndUpdate(taskId,{
                $pull:{
                    files:{
                        $in:fileKeys
                    }
                }
            },
            {new:true})
        }
 
        return res.status(200).json({
            status:'success',
            message:`Files ${action} successfully`,
            task:updatedTask
        })

    } catch (error) {
        return res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

export {taskRouter}



// depends on whether a user can see only his tasks or all tasks in a project

// taskRouter.get("/getTasksByUser",async (req,res)=>{
//     const {userId,projectId}=req.query

//     try {
//         if(!userId){
//             return res.status(400).json({
//                 status:'fail',
//                 message:'User ID is required'
//             })
//         }
//         const user=await User.findById(userId)
//         if(!user){
//             return res.status(404).json({
//                 status:'fail',
//                 message:'The user does not exist'
//             })
//         }
//         if(!projectId){
//             return res.status(400).json({
//                 status:'fail',
//                 message:'Project ID is required'
//             })
//         }
//         const project=await Project.findById(projectId)
//         if(!project){
//             return res.status(404).json({
//                 status:'fail',
//                 message:'The project does not exist'
//             })
//         }
//         const tasks=await Task.find({
//             $and:[
//                 {assignees:userId},
//                 {project:projectId}
//             ]
//         })

//         if(tasks.length===0){
//             return res.status(404).json({
//                 status:'fail',
//                 message:'No tasks found for this user in this project'
//             })
//         }

//         return res.status(200).json({
//             status:'success',
//             tasks
//         })

//     } catch (error) {
//         return res.status(400).json({
//             status:'fail',
//             message:error.message
//         })
//     }
// })