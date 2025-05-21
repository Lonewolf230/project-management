import express from 'express';
import Project from '../models/project.js';
import User from '../models/user.js';
import mongoose from 'mongoose';
const projectRouter=express.Router()

projectRouter.post('/create',async (req,res)=>{
    const {creatorId,startDate,teamMembers}=req.body

    try {
        if(!creatorId){
            return res.status(400).json({
                status:'fail',
                message:'Admin Id is required'
            })
        }
        const user=await User.exists({_id:creatorId,role:'admin'})

        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'The user is not an admin'
            })
        }

        if(!mongoose.Types.ObjectId.isValid(req.body.projectManager)){
            return res.status(400).json({
                status:'fail',
                message:'Project manager ID is not valid'
            })
        }

        if(req.body.client){
            if(!mongoose.Types.ObjectId.isValid(req.body.client)){
                return res.status(400).json({
                    status:'fail',
                    message:'Client ID is not valid'
                })
            }
        }

        if(!startDate || startDate===""){
            delete req.body.startDate
        }
        else{
            req.body.startDate=new Date(startDate)
        }

        if(!teamMembers || teamMembers===""){
            req.body.teamMembers=[]
        }
        else if(typeof teamMembers==="string"){
            req.body.teamMembers=[teamMembers]
        }

        if(req.body.teamMembers && Array.isArray(req.body.teamMembers)){
            const invalidMembers=req.body.teamMembers.filter((memberId)=>!mongoose.Types.ObjectId.isValid(memberId))
            if(invalidMembers.length>0){
                return res.status(400).json({
                    status:'fail',
                    message:'Invalid structure of teamMember fields'
                })
            }
        }

        const project=await Project.create(req.body)
        
        res.status(201).json({
            status:'success',
            project
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
            projects
        })
    }
    catch(error){
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.get('/getProjectsByUser',async(req,res)=>{
    const {userId}=req.query
    try {
        if(!userId){
            return res.status(400).json({
                status:'fail',
                message:'User ID is required'
            })
        }
        const user=await User.findById(userId).select('id name role')
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'User not found'
            })
        }
        let result
        if(user.role==='admin'){
            result=await Project.find({})
        }
        else{
            result=await Project.find({
                $or:[
                    {projectManager:userId},
                    {teamMembers:userId}
                ]
            })
        }
        if(result.length===0){
            return res.status(404).json({
                status:'fail',
                message:'No projects found for this user'
            })
        }
        console.log(result.length)
        res.status(200).json({
            status:'success',
            result
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.get('/getProject',async(req,res)=>{
    const {projectId,userId}=req.query
    try {
        if(!userId){
            return res.status(400).json({
                status:'fail',
                message:'User ID is required'
            })
        }
        const user=await User.findById(userId).select('id name role')
        if(!user){
            return res.status(404).json({
                status:'fail',
                message:'User not found'
            })
        }
        let project
        if(user.role==='admin'){
            project=await Project.findById(projectId)
        }
        else{
            project=await Project.findOne({
                _id:projectId,
                $or:[
                    {projectManager:userId},
                    {teamMembers:userId}
                ]
            })
        }
        
        if(!project){
            return res.status(404).json({
                status:'fail',
                message:'Project not found'
            })
        }
        res.status(200).json({
            status:'success',
            project
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

projectRouter.patch('/update', async (req, res) => {
    const { projectId } = req.query
    const { teamMembers, action, adminorPmid, ...projectUpdates } = req.body
    
    try {
        const project = await Project.findById(projectId)
        if (!project) {
            return res.status(404).json({
                status: 'fail',
                message: 'Project not found'
            })
        }
        
        // Check authorization for ANY updates to the project
        // adminorPmid is required for ALL updates
        if (!adminorPmid) {
            return res.status(400).json({
                status: 'fail',
                message: 'Admin or Project Manager ID is required'
            })
        }
        
        const user = await User.findById(adminorPmid)
        if (!user) {
            return res.status(404).json({
                status: 'fail',
                message: 'The admin or project manager does not exist'
            })
        }
        
        const isAdmin = user.role === 'admin'
        const isProjectManager = project.projectManager.toString() === user._id.toString()
        
        if (!isAdmin && !isProjectManager) {
            return res.status(403).json({
                status: 'fail',
                message: 'Only admins or the assigned project manager can update this project'
            })
        }

        if (projectUpdates.endDate || projectUpdates.startDate) {
            const startDate = projectUpdates.startDate ? new Date(projectUpdates.startDate) : project.startDate;
            const endDate = projectUpdates.endDate ? new Date(projectUpdates.endDate) : project.endDate;
            
            if (endDate <= startDate) {
                return res.status(400).json({
                    status: 'fail',
                    message: 'End date must be greater than start date'
                });
            }
        }
        
        let updatedProject = project;
        let existingMembers
        // let addMembers
        // let removeMembers
        if (teamMembers && action) {

            let updateOp;
            existingMembers=project.teamMembers.map(id=>id.toString())

            if (action === 'add') {
                const newMembers=teamMembers.filter(memberId=>!existingMembers.includes(memberId))
                // addMembers=newMembers
                if(newMembers.length>0){
                    updateOp = { $push: { teamMembers: { $each: newMembers } } };
                }
            } else if (action === 'remove') {
                const membersToRemove=teamMembers.filter(memberId=>existingMembers.includes(memberId))
                // removeMembers=membersToRemove
                if(membersToRemove.length>0){
                    updateOp = { $pull: { teamMembers: { $in: membersToRemove } } };
                }
            } else {
                return res.status(400).json({
                    status: 'fail',
                    message: 'Action is required and should be either add or remove'
                })
            }
            updatedProject = await Project.findByIdAndUpdate(projectId, updateOp, { new: true });
            // if(addMembers){
            //     await User.updateMany(
            //         { _id: { $in: addMembers } },
            //         { $addToSet: { projects: projectId } }
            //     );

            // }
            // if(removeMembers){
            //     await User.updateMany(
            //         { _id: { $in: removeMembers } },
            //         { $pull: { projects: projectId } }
            //     );
            // }
        }
        
        if (Object.keys(projectUpdates).length > 0) {
            updatedProject = await Project.findByIdAndUpdate(projectId, projectUpdates, { new: true });
        }
        
        return res.status(200).json({
            status: 'success',
            project: updatedProject
        })
    } catch (error) {
        return res.status(400).json({
            status: 'fail',
            message: error.message
        })
    }
})

projectRouter.delete('/delete',async(req,res)=>{
    const {projectId}=req.params
    const {adminId}=req.body
    try {
        if(!adminId){
            return res.status(400).json({
                status:'fail',
                message:'Admin ID is required'
            })
        }
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
        await Project.findByIdAndDelete(projectId)

        res.status(200).json({
            status:'success',
            message:'Project deleted successfully'
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})


export {projectRouter}

