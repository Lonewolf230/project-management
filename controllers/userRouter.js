import User from "../models/user.js";
import express from "express";
const userRouter=express.Router()

userRouter.post('/create',async(req,res)=>{
    const {name,email,role}=req.body

    try {
        const user=await User.create({
            name,
            email,
            role,
            projects:[]
        })
        res.status(201).json({
            status:'success',
            data:{
                user
            }
        })
    } catch (error) {
        res.status(400).json({
            status:'fail',
            message:error.message
        })
    }
})

export {userRouter}