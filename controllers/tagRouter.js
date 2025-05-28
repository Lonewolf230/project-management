import express from "express";
import Tag from "../models/tag.js";
import { validateTaskUpdateAccess,validateObjectId } from "../utils/validationUtils.js";
import Task from "../models/task.js";

const tagRouter = express.Router();

tagRouter.get("/all", async (req, res) => {
    const tags = await Tag.find({})
    return res.status(200).json({
        status: "success",
        tags,
    });
});

tagRouter.patch("/updateTags",async(req, res) => {
    const {taskId,userId} = req.query;
    const {tags,action} = req.body;
    validateObjectId(taskId, "Task ID");
    validateObjectId(userId, "User ID");

    if(!['add','remove'].includes(action)){
        return res.status(400).json({
            status:"fail",
            message:"Action must be either add or remove"
        })
    }
    if(!tags || !Array.isArray(tags)){
        return res.status(400).json({
            status:"fail",
            message:"Tags must be an array"
        })
    }

    await validateTaskUpdateAccess(userId, taskId,{tags});
    const uniqueIds=[...new Set(tags.map(tag=>tag.trim().toLowerCase()))]
    let updatedTask

    if(action=='add'){
        const tagIds=await Promise.all(
            uniqueIds.map(async tagName=>{
                const tag=await Tag.findOneAndUpdate(
                    {name:tagName},
                    {$setOnInsert:{name:tagName}},
                    {upsert:true, new:true}
                )
                return tag.id
            })
        )

        updatedTask=await Task.findByIdAndUpdate(
            taskId,
            {$addToSet:{tags:{$each:tagIds}}},
            {new:true}
        ).populate("tags","id name")
    }
    else if(action=='remove'){
        const tagsToRemove=await Tag.find({
            name:{$in:uniqueIds}
        }).select("id")

        updatedTask=await Task.findByIdAndUpdate(
            taskId,
            {$pull:{tags:{$in:tagsToRemove.map(tag=>tag.id)}}},
            {new:true}
        ).populate("tags","id name")
    }

    return res.status(200).json({
        status:"success",
        task:updatedTask
    })
})

export {tagRouter};