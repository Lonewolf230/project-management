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
import jobRouter from "./controllers/jobRouter.js";
import authRouter from "./controllers/authRouter.js";
import cookieParser from "cookie-parser";
import { verifyTokenMiddleware } from "./utils/authUtils.js";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import Project from "./models/project.js";
import { validateAdminExists, validateExists } from "./utils/validationUtils.js";
import Task from "./models/task.js";

const app=express()
const limiter=rateLimit({
    windowMs:15*60*1000,
    max:200,
    message:"Too many requests from this IP, please try again after 15 minutes"
})

mongoose.set('strictQuery',false)

mongoose.connect(uri).then((res)=>{
    console.log("connected to MongoDB")
})
app.use(helmet())
app.use(limiter)

app.use(cors({
    origin:process.env.CLIENT_URL,
    methods:["GET","POST","PUT","PATCH","DELETE"],
    credentials:true,
}))
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
// app.use(mongoSanitize())
app.disable('x-powered-by')

app.get("/",(req,res)=>{
    res.status(200).send("Welcome to the project management API")
})

app.use("/api/auth",authRouter)
app.use("/api/users",verifyTokenMiddleware,userRouter)
app.use("/api/projects",verifyTokenMiddleware,projectRouter)
app.use("/api/tasks",verifyTokenMiddleware,taskRouter)

app.post("/api/skills/add",verifyTokenMiddleware,async(req,res)=>{
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

app.use("/api/tags",verifyTokenMiddleware,tagRouter)
app.use("/api/comments",verifyTokenMiddleware,commentRouter)
app.use("/api/jobs",verifyTokenMiddleware,jobRouter)

app.patch("/api/misc/confirmCreation", async (req, res) => {
    const userId = req.user;
    const { projectId, taskIds } = req.query;
  await validateAdminExists(userId);

  if (!projectId && !taskIds) {
    return res.status(400).json({
      status: "fail",
      message: "Project ID and Task ID are required",
    });
  }
  if (projectId) await validateExists(Project,projectId,'Project ID' );

  if (taskIds) {
    const taskIdArray = taskIds.split(",");
    console.log("taskIdArray", taskIdArray);
    if(taskIdArray.length>0){
        for (const taskId of taskIdArray) {
            await validateExists(Task,taskId.trim(),"Task ID");
        }
    }
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (projectId) {
      const project = await Project.findByIdAndUpdate(
        projectId,
        { isValid: true },
        { new: true, session }
      );
    }

    if (taskIds) {
      const taskIdArray = taskIds
        .split(",")
        .map((id) =>new mongoose.Types.ObjectId(id.trim()));
      const bulkOps = taskIdArray.map((taskId) => ({
        updateOne: {
          filter: { _id: taskId },
          update: { isValid: true },
        },
      }));
      if (bulkOps.length > 0) {
        await Task.bulkWrite(bulkOps, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: "Project and Tasks confirmed successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      status: "fail",
      message: "Error confirming project and task",
      error: error.message,
    });
  }
});

app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});


app.use(globalErrorHandler)

app.listen(port,()=>{
    console.log(`server is running on port ${port} and env is ${process.env.NODE_ENV}`)
})

export default app;