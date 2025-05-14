import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config()
import cors from "cors"
import express from "express";
import {uri,port} from './utils/config.js'
import { projectRouter } from "./controllers/projectRouter.js";
import { userRouter } from "./controllers/userRouter.js";

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

app.listen(port,()=>{
    console.log(`server is running on port ${port} and env is ${process.env.NODE_ENV}`)
})

