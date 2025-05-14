import express from 'express';
import Project from '../models/project.js';
import User from '../models/user.js';

const projectRouter=express.Router()

projectRouter.post('/create',async (req,res)=>{
    const {creatorId,projectName,projectCode,description,projectManager,startDate,endDate,budget,workflow,teamMembers}=req.body

    try {
        const user=await User.findById(creatorId)
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'The creator does not exist'
            })
        }
        if(user.role!=='admin'){
            return res.status(403).json({
                status:'fail',
                message:'Only admins can create a project'
            })
        }
        if(teamMembers===null){
            teamMembers=[]
        }
        const project=await Project.create({
            projectName,
            projectCode,
            description,
            projectManager,
            startDate,
            endDate,
            budget,
            workflow,
            teamMembers
        })
        res.status(201).json({
            status:'success',
            data:{
                project
            }
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.get('/getProjects',async(req,res)=>{
    try{
        const projects=await Project.find()
        if(!projects){
            return res.status(404).json({
                status:'fail',
                message:'No projects found'
            })
        }
        res.status(200).json({
            status:'success',
            data:{
                projects
            }
        })
    }
    catch(error){
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.get('/getProject/:projectId',async(req,res)=>{
    const {projectId}=req.params
    try {
        const project=await Project.findById(projectId)
        if(!project){
            return res.status(404).json({
                status:'fail',
                message:'Project not found'
            })
        }
        res.status(200).json({
            status:'success',
            data:{
                project
            }
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.patch('/update/:projectId',async(req,res)=>{
    const {projectId}=req.params
    try {
        const project=await Project.findByIdAndUpdate(projectId,req.body,{new:true})
        if(!project){
            return res.status(404).json({
                status:'fail',
                message:'Project not found'
            })
        }
        res.status(200).json({
            status:'success',
            data:{
                project
            }
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.patch('/manageTeamMembers/:projectId',async(req,res)=>{
    const {projectId}=req.params
    const {teamMembers,action,adminorPmid}=req.body
    try {
        const user=await User.findById(adminorPmid)
        const pro=await Project.findById(projectId)
        if(!user && !pro){
            return res.status(404).json({
                status:'fail',
                message:'The admin or project manager does not exist'
            })
        }
        if(!pro.projectManager.equals(user._id) && user.role!=='admin'){
            return res.status(403).json({
                status:'fail',
                message:'Only admins or project managers can manage team members'
            })
        }
        if(!action || (action!=='add' && action!=='remove')){
            return res.status(400).json({
                status:'fail',
                message:'Action is required and should be either add or remove'
            })
        }
        let updateOp
        if(action==='add'){
            updateOp={$push:{teamMembers:{$each:teamMembers}}}
        }
        else{
            updateOp={$pull:{teamMembers:{$in:teamMembers}}}
        }
        const project=await Project.findByIdAndUpdate(projectId,updateOp,{new:true})
        if(!project){
            return res.status(404).json({
                status:'fail',
                message:'Project not found'
            })
        }
        res.status(200).json({
            status:'success',
            data:{
                project
            }
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.delete('/delete/:projectId',async(req,res)=>{
    const {projectId}=req.params
    const {adminId}=req.body
    try {
        const user=await User.findById(adminId)
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'The admin does not exist'
            })
        }
        if(user.role!=='admin'){
            return res.status(403).json({
                status:'fail',
                message:'Only admins can delete a project'
            })
        }
        const project=await Project.findByIdAndDelete(projectId)
        if(!project){
            return res.status(404).json({
                status:'fail',
                message:'Project not found'
            })
        }
        res.status(200).json({
            status:'success',
            data:{
                project
            }
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})


export {projectRouter}

