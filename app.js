import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import express from "express";
import { uri, port } from "./utils/config.js";
import { projectRouter } from "./controllers/projectRouter.js";
import { userRouter } from "./controllers/userRouter.js";
import { taskRouter } from "./controllers/taskRouter.js";
import { globalErrorHandler } from "./utils/helper.js";
import { AppError } from "./utils/appError.js";
import Skill from "./models/skill.js";
import { tagRouter } from "./controllers/tagRouter.js";
import { commentRouter } from "./controllers/commentRouter.js";
import jobRouter from "./controllers/jobRouter.js";
import {
  validateAdminExists,
  validateExists,
  validateProjectExists,
} from "./utils/validationUtils.js";
import Project from "./models/project.js";
import Task from "./models/task.js";

const app = express();

mongoose.set("strictQuery", false);

mongoose.connect(uri).then((res) => {
  console.log("connected to MongoDB");
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).send("Welcome to the project management API");
});

app.use("/api/users", userRouter);
app.use("/api/projects", projectRouter);
app.use("/api/tasks", taskRouter);

app.post("/api/skills/add", async (req, res) => {
  const { name, category } = req.body;
  if (!name || !category) {
    return res.status(400).json({
      status: "fail",
      message: "Skill name and category are required",
    });
  }
  const skill = await Skill.create({
    name,
    category,
  });
  res.status(201).json({
    status: "success",
    skill,
  });
});

app.use("/api/tags", tagRouter);
app.use("/api/comments", commentRouter);
app.use("/api/jobs", jobRouter);

app.patch("/api/misc/confirmCreation", async (req, res) => {
  const { userId, projectId, taskIds } = req.query;
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

app.use(globalErrorHandler);

app.listen(port, () => {
  console.log(
    `server is running on port ${port} and env is ${process.env.NODE_ENV}`
  );
});
