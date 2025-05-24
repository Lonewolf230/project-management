import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config()
import cors from "cors"
import express from "express";
import {uri,port} from './utils/config.js'
import { projectRouter } from "./controllers/projectRouter.js";
import { userRouter } from "./controllers/userRouter.js";
import { taskRouter } from "./controllers/taskRouter.js";
import { upload } from "./utils/helper.js";
import { getPresignedUrls, uploadFilesToS3 } from "./utils/s3Utils.js";

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

// app.post("/upload",upload ,async (req, res) => {
//     const files = req.files;
//     try {
//         if (!files || files.length === 0) {
//             return res.status(400).json({ message: "No files uploaded" });
//         }
//         const keys=await uploadFilesToS3(files);
//         res.status(200).json({ message: "Files uploaded successfully", keys });
//     } catch (error) {
//         res.status(500).json({ message: "Error uploading files", error: error.message });
//     }
// })  

// app.get("/getUrls",async (req,res)=>{
//     const {fileKeys}=req.body
//     if(!fileKeys || fileKeys.length===0){
//         return res.status(400).json({message:"No file keys provided"})
//     }
//     try {
//         const urls=await getPresignedUrls(fileKeys)
//         res.status(200).json({message:"Presigned URLs generated successfully",urls})
//     } catch (error) {
//         res.status(500).json({message:"Error generating presigned URLs",error:error.message})
//     }
// })

app.use("/api/users",userRouter)
app.use("/api/projects",projectRouter)
app.use("/api/tasks",taskRouter)

app.listen(port,()=>{
    console.log(`server is running on port ${port} and env is ${process.env.NODE_ENV}`)
})

