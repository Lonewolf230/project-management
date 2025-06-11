import express from 'express'
import agenda from '../utils/deleteTrigger.js'
import { validateAdminExists, validateObjectId } from '../utils/validationUtils.js'
const jobRouter=express.Router()

jobRouter.post('/triggerDeleteJob',async(req,res)=>{
    const {taskId,projectId,userId} = req.query
    validateAdminExists(userId)
    
    if(taskId){
        validateObjectId(taskId, "Task ID")
        await agenda.now('deleteTask',{taskId})
    }
    if(projectId){
        validateObjectId(projectId, "Project ID")
        await agenda.now('deleteProject',{projectId})
    }

    return res.status(200).json({
        status: "success",
        message: "Delete job triggered successfully"
    })
})

export default jobRouter