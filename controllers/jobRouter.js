import express from 'express'
import { validateAdminExists, validateObjectId } from '../utils/validationUtils.js'
import { deleteQueue } from '../jobs/deleteQueue.js'
const jobRouter=express.Router()

jobRouter.post('/triggerDeleteJob',async(req,res)=>{
    const {taskIds,projectId,userId} = req.query
    validateAdminExists(userId)
    
    if(taskIds){
        const taskIdArray = taskIds.split(",");
        console.log("taskIds", taskIds);
        if(taskIdArray.length>0){
            for (const taskId of taskIdArray) {
                validateObjectId(taskId, "Task ID")
                await deleteQueue.add('deleteTask',{taskId:taskId.trim()})
            }
        }
        else{
            return res.status(400).json({
                status: "fail",
                message: "No valid task IDs provided"
            })
        }
    }
    if(projectId){
        validateObjectId(projectId, "Project ID")
        // await agenda.now('deleteProject',{projectId})
        await deleteQueue.add('deleteProject',{projectId})
    }

    return res.status(200).json({
        status: "success",
        message: "Delete job triggered successfully"
    })
})

export default jobRouter