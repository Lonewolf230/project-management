
import Agenda from 'agenda'
import { uri } from './config.js'
import Project from '../models/project.js'
import { errors } from './appError.js'
import Task from '../models/task.js'
import TaskComment from '../models/taskComment.js'
import mongoose from 'mongoose'
import { deleteFilesFromS3 } from './s3Utils.js'

const agenda=new Agenda({
    db:{
        address:uri,
        collection: 'agendaJobs',
    }
})


agenda.define('deleteProject',async(job)=>{
    const {projectId,areFilesDeleted}=job.attrs.data
    const project=await Project.findById(projectId).select('files')
    if(!project) return

    if(!areFilesDeleted){
        await deleteFilesFromS3(project.files)
        job.attrs.data.areFilesDeleted=true
        await job.save()
    }
    try {
        await Project.deleteOne({_id:projectId,isValid:false})
        console.log(`Project with ID ${projectId} has been deleted`)

    } catch (error) {
        console.error(`Error deleting project with ID ${projectId}:`, error)
        throw errors.badRequest(`Failed to delete project with ID ${projectId}`)
    }
});

agenda.define('deleteTask',async(job)=>{
    const {taskId,areFilesDeleted=false,failedKeys=[]}=job.attrs.data

    const task=await Task.findById(taskId).select('files')
    if(!task) return

    if(!areFilesDeleted){
      await deleteFilesFromS3(task.files)
      job.attrs.data.areFilesDeleted=true
      await job.save()   
    }
    
    const session=await mongoose.startSession()
    try {
        session.startTransaction()
        await Task.deleteOne({_id:taskId,isValid:false},{session})
        await TaskComment.deleteMany({taskId:taskId},{session})
        await session.commitTransaction()
        console.log(`Task with ID ${taskId} has been deleted`)
        console.log(`Task comments associated with this ${taskId} have also been deleted`)
    } catch (error) {
        await session.abortTransaction()
        console.error(`Error deleting task with ID ${taskId}:`, error)
        throw errors.badRequest(`Failed to delete task with ID ${taskId}`)
    }
    finally{
        await session.endSession()
    }
});

agenda.define('dailyCleanUp',async()=>{
    const failedJobs=await agenda.jobs({failedAt:{$ne:null}})
    if(failedJobs.length === 0){
        console.log('No failed jobs found')
        return
    }

    for(const job of failedJobs){
        try{
            await job.now(job.attrs.name,job.attrs.data)
            await job.remove()
            console.log(`Removed failed job with ID ${job.attrs._id}`)
        }
        catch(error){
            console.error(`Error removing failed job with ID ${job.attrs._id}:`, error)
            throw errors.badRequest(`Failed to remove job with ID ${job.attrs._id}: ${error.message}`)
        }
    }
});

(async function(){
    await agenda.start();
    await agenda.every('24 hours','dailyCleanUp');
})()

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, gracefully shutting down Agenda...')
    await agenda.stop()
    process.exit(0)
})

process.on('SIGINT', async () => {
    console.log('Received SIGINT, gracefully shutting down Agenda...')
    await agenda.stop()
    process.exit(0)
})

export default agenda