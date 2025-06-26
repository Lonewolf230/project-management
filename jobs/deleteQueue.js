import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import Project from "../models/project.js";
import { deleteFilesFromS3 } from "../utils/s3Utils.js";
import Task from "../models/task.js";
import TaskComment from "../models/taskComment.js";
import mongoose from "mongoose";
dotenv.config();

const redisConnection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
};

export const deleteQueue = new Queue("delete-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

const worker = new Worker("delete-queue", async (job) => {
  const { name,data } = job;

  if (name === "deleteProject") {
    const { projectId} = data;
    const project = await Project.findById(projectId).select("files");
    if (!project) return;

    await deleteFilesFromS3(project.files);
    
    try {
      await Project.deleteOne({ _id: projectId, isValid: false });
      console.log(`Project with ID ${projectId} deleted`);
    } catch (err) {
      console.error(`Failed to delete project ${projectId}:`, err);
      throw errors.badRequest(`Could not delete project: ${err.message}`);
    }
  } else if (name === "deleteTask") {
    const { taskId} = data;
    const task = await Task.findById(taskId).select("files");
    if (!task) return;

    await deleteFilesFromS3(task.files);
    
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Task.deleteOne({ _id: taskId, isValid: false }, { session });
      await TaskComment.deleteMany({ taskId }, { session });
      await session.commitTransaction();
      console.log(`Task ${taskId} and its comments deleted`);
    } catch (err) {
      await session.abortTransaction();
      throw errors.badRequest(`Failed to delete task: ${err.message}`);
    } finally {
      await session.endSession();
    }
  }
},{connection:redisConnection});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  console.log("Worker shut down successfully");
  process.exit(0);
})

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  console.log("Worker shut down successfully");
  process.exit(0);
});