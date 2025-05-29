import express from "express";
import { validateExists, validateIndividualTaskViewAccess, validateObjectId, validateTaskUpdateAccess } from "../utils/validationUtils.js";
import TaskComment from "../models/taskComment.js";
import Task from "../models/task.js";


const commentRouter = express.Router();

commentRouter.post("/create",async(req,res)=>{
    const {taskId,creatorId}=req.query
    const {content,parentId=''}= req.body

    await validateTaskUpdateAccess(creatorId,taskId,{comments: { content, parentId } })

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Comment content cannot be empty' });
    }
    let level=0
    let parentComment=null
    if(parentId){
        validateObjectId(parentId, 'Parent ID')
        const taskComment=await TaskComment.findOne({taskId})
        if(!taskComment){
            return res.status(404).json({ error: 'Parent comment not found' });
        }
        parentComment=taskComment.comments.find(c=>c._id.toString()===parentId)
        if(!parentComment){
            return res.status(404).json({ error: 'Parent comment not found' });
        }
        level=parentComment.level+1
    }
    let taskComment=await TaskComment.findOne({taskId})
    if(!taskComment){
        taskComment=new TaskComment({
            taskId,
            comments: []
        })
    }

    taskComment.comments.push({
        content,
        parentId: parentId || null,
        userId: creatorId,
        level,
        createdAt: new Date(),
        updatedAt: new Date(),
    })
    await taskComment.save()

    const responseComment={
        id:taskComment._id,
        taskId: taskComment.taskId,
        comments:taskComment.comments.map(c=>({
            id: c._id,
            content: c.content,
            parentId: c.parentId,
            userId: c.userId,
            level: c.level,
            isDeleted: c.isDeleted,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
        }))
    }

    console.log("Task Comment:", taskComment)

    res.status(201).json({ 
        message: 'Comment added successfully', 
        comment: responseComment
    });

})

commentRouter.delete("/delete",async(req,res)=>{
    const {taskId,commentId,userId}=req.query
    validateObjectId(commentId, 'Comment ID')
    validateObjectId(userId, 'User ID')
    validateExists(Task, taskId, 'Task not found')

    const taskComment=await TaskComment.findOne({taskId})
    if(!taskComment){
        return res.status(404).json({ error: 'Task comment not found' });
    }
    const comment=taskComment.comments.id(commentId)
    if(userId!==comment.userId.toString()){
        return res.status(403).json({ error: 'You do not have permission to delete this comment' })
    }
    if(!comment){
        return res.status(404).json({ error: 'Comment not found' });
    }

    comment.content='[deleted]'
    comment.isDeleted=true
    comment.updatedAt=new Date()

    await taskComment.save()

    res.status(200).json({
        message: 'Comment deleted successfully',
    })
})

commentRouter.patch("/edit",async(req,res)=>{
    const {taskId,commentId,userId}=req.query
    const {content}=req.body

    validateObjectId(commentId, 'Comment ID')
    validateObjectId(userId, 'User ID')
    validateExists(Task, taskId, 'Task not found')

    const taskComment=await TaskComment.findOne({taskId})
    if(!taskComment){
        return res.status(404).json({ error: 'Task comment not found' });
    }
    const comment=taskComment.comments.id(commentId)
    if(!comment){
        return res.status(404).json({ error: 'Comment not found' });
    }
    if(comment.isDeleted){
        return res.status(403).json({ error: 'You cannot edit a deleted comment' })
    }
    if(userId!==comment.userId.toString()){
        return res.status(403).json({ error: 'You do not have permission to edit this comment' })
    }
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Comment content cannot be empty' });
    }
    comment.content=content
    comment.updatedAt=new Date()

    await taskComment.save()

    const responseComment={
        id:taskComment._id,
        taskId: taskComment.taskId,
        comments:taskComment.comments.map(c=>({
            id: c._id,
            content: c.content,
            parentId: c.parentId,
            userId: c.userId,
            level: c.level,
            isDeleted: c.isDeleted,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
        }))
    }

    res.status(200).json({ 
        message: 'Comment edited successfully', 
        comment: responseComment
    });

})

commentRouter.get("/allComments",async(req,res)=>{
    const {taskId,userId}=req.query
    validateExists(Task, taskId, 'Task not found')
    validateObjectId(userId, 'User ID')

    await validateIndividualTaskViewAccess(userId, taskId)

    const taskComment=await TaskComment.findOne({taskId})
                        .select('comments taskId')
                        .populate({
                            path: 'comments.userId',
                            select: 'name email id'
                        })

    if(!taskComment){
        return res.status(404).json({ error: 'No comments found for this task' });
    }

    const responseComments=taskComment.comments.map(c=>({
        id: c._id,
        content: c.content,
        parentId: c.parentId,
        user: {
            id: c.userId._id,
            name: c.userId.name,
            email: c.userId.email
        },
        level: c.level,
        isDeleted: c.isDeleted,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
    }))

    res.status(200).json({ 
        message: 'Comments retrieved successfully', 
        taskId: taskComment.taskId,
        comments: responseComments
    });
})

export {commentRouter}