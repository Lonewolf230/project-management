import express from 'express';
import Project from '../models/project.js';
import User from '../models/user.js';

const projectRouter=express.Router()

projectRouter.post('/create',async (req,res)=>{
    const {creatorId,projectManager,startDate,teamMembers}=req.body

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

        const project=await Project.create(req.body)

        await Promise.all(
            teamMembers.map(async (memberId)=> {
                await User.findByIdAndUpdate(memberId,{
                    $push:{
                        projects:project.id
                    }
                })
            })
        )
        await User.findByIdAndUpdate(projectManager,{
            $push:{
                projects:project.id
            }
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

projectRouter.get('/getProjectsByUser',async(req,res)=>{
    const {userId}=req.query
    try {
        const result=await User.findById(userId).select('id projects').populate('projects')
        if(!result){
            return res.status(404).json({
                status:'fail',
                message:'User not found'
            })
        }
        if(result.projects.length===0){
            return res.status(404).json({
                status:'fail',
                message:'No projects found for this user'
            })
        }
        res.status(200).json({
            status:'success',
            data:{
                result
            }
        })
    } catch (error) {
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

projectRouter.patch('/update/:projectId', async (req, res) => {
    const { projectId } = req.params
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
        
        let updatedProject = project;
        let existingMembers
        let addMembers
        let removeMembers
        if (teamMembers && action) {

            let updateOp;
            existingMembers=project.teamMembers.map(id=>id.toString())

            if (action === 'add') {
                const newMembers=teamMembers.filter(memberId=>!existingMembers.includes(memberId))
                addMembers=newMembers
                if(newMembers.length>0){
                    updateOp = { $push: { teamMembers: { $each: newMembers } } };
                }
            } else if (action === 'remove') {
                const membersToRemove=teamMembers.filter(memberId=>existingMembers.includes(memberId))
                removeMembers=membersToRemove
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
            if(addMembers){
                await User.updateMany(
                    { _id: { $in: addMembers } },
                    { $addToSet: { projects: projectId } }
                );

            }
            if(removeMembers){
                await User.updateMany(
                    { _id: { $in: removeMembers } },
                    { $pull: { projects: projectId } }
                );
            }
        }
        
        if (Object.keys(projectUpdates).length > 0) {
            updatedProject = await Project.findByIdAndUpdate(projectId, projectUpdates, { new: true });
        }
        
        return res.status(200).json({
            status: 'success',
            data: {
                project: updatedProject
            }
        })
    } catch (error) {
        return res.status(400).json({
            status: 'fail',
            message: error.message
        })
    }
})

projectRouter.delete('/delete/:projectId',async(req,res)=>{
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
        const project=await Project.findByIdAndDelete(projectId)

        await User.updateMany(
            { _id: { $in: project.teamMembers } },
            { $pull: { projects: projectId } }
        );
        await User.findByIdAndUpdate(project.projectManager,{
            $pull:{
                projects:project.id
            }
        })
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

