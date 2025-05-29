import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config()
import cors from "cors"
import express from "express";
import {uri,port} from './utils/config.js'
import { projectRouter } from "./controllers/projectRouter.js";
import { userRouter } from "./controllers/userRouter.js";
import { taskRouter } from "./controllers/taskRouter.js";
import { globalErrorHandler } from "./utils/helper.js";
import { AppError } from "./utils/appError.js";
import Skill from "./models/skill.js";
import { tagRouter } from "./controllers/tagRouter.js";
import { commentRouter } from "./controllers/commentRouter.js";

const app=express()

mongoose.set('strictQuery',false)

mongoose.connect(uri).then((res)=>{
    console.log("connected to MongoDB")
})

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.get("/",(req,res)=>{
    res.status(200).send("Welcome to the project management API")
})

app.use("/api/users",userRouter)
app.use("/api/projects",projectRouter)
app.use("/api/tasks",taskRouter)

app.post("/api/skills/add",async(req,res)=>{
    const {name,category}=req.body
    if(!name || !category){
        return res.status(400).json({
            status:"fail",
            message:"Skill name and category are required"
        })
    }
    const skill=await Skill.create({
        name,
        category
    })
    res.status(201).json({
        status:"success",
        skill
    })
})

app.use("/api/tags",tagRouter)
app.use("/api/comments",commentRouter)

// app.all('*',(req,res,next)=>{
//     next(new AppError(`Can't find ${req.originalUrl} on this server`,404))
// })
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler)

app.listen(port,()=>{
    console.log(`server is running on port ${port} and env is ${process.env.NODE_ENV}`)
})

