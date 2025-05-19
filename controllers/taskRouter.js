import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";

import express from "express";

const taskRouter = express.Router();

taskRouter.post("/create",async (req,res)=>{
    const {creatorId,taskName,taskDescription,project,assignees,priority,dueDate}=req.body

    try {
        if(!creatorId){
            return res.status(400).json({
                status:'fail',
                message:'Creator ID is required'
            })
        }
        const user=await User.findById(creatorId)
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'The creator does not exist'
            })
        }
        const task=await Task.create({
            taskName,
            taskDescription,
            project,
            assignees,
            priority,
            dueDate
        })

        return res.status(201).json({
            status:'success',
            task
        })

    } catch (error) {
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
        const tasks=await Task.find({project:projectId})

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

// getTaskById can be implemented in the future if needed but won't be necessary 
// since in the tasks tile page we will be rendering all projects and the data will 
// be available then and there


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

export {taskRouter}