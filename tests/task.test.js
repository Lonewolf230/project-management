import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';
import client, { connectRedis } from '../utils/redisSetup.js';
import path from 'path';
import { deleteFilesFromS3 } from '../utils/s3Utils.js';
import Task from '../models/task.js';
let agent;
let fileKeys;
let fileKeys2;
let taskId;
beforeAll(async () => {
  connectRedis();
  agent = request.agent(app);
});

describe('Task Management',()=>{
    beforeEach(async () => {
        const loginResponse = await agent.post('/api/auth/login').send({
        email: 'manish.r2022@vitstudent.ac.in',
        password: 'admin',
        });
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.headers['set-cookie']).toBeDefined();
        expect(loginResponse.body).toHaveProperty('user');
        expect(loginResponse.body).toHaveProperty(
        'message',
        'User logged in successfully'
        );
    })


    it('upload files to S3',async()=>{
        const file1=path.join(__dirname, 'files/user.jpg');
        const file2=path.join(__dirname, 'files/facebook.png');
        const response = await agent.post('/api/tasks/uploadFiles?projectId=6864ad7813d0c5339d058120')
            .attach('files', file1)
            .attach('files', file2);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Files uploaded successfully');
        expect(response.body).toHaveProperty('fileKeys');
        expect(Array.isArray(response.body.fileKeys)).toBe(true);
        expect(response.body.fileKeys.length).toBe(2);
        fileKeys = response.body.fileKeys;
        console.log('Uploaded files:', fileKeys);
    })

    it('upload files to an exisitng task',async()=>{
        const file1=path.join(__dirname, 'files/user.jpg');
        const file2=path.join(__dirname, 'files/facebook.png');
        const response = await agent.patch('/api/tasks/uploadTaskFiles?taskId=6866d2bb11d7ef8522c18205&projectId=6864ad7813d0c5339d058120')
            .attach('files', file1)
            .attach('files', file2);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Files uploaded successfully');
        expect(response.body).toHaveProperty('fileKeys');
        expect(Array.isArray(response.body.fileKeys)).toBe(true);
        expect(response.body.fileKeys.length).toBe(2);
        fileKeys2 = response.body.fileKeys;
        console.log('Uploaded files to task:', response.body.fileKeys);
    })

    it('should create a new task', async () => {
        const response = await agent.post('/api/tasks/create?projectId=6864ad7813d0c5339d058120')
            .send({
                taskName: 'Test Task',
                taskDescription: 'This is a test task',
                estimatedHours: 5,
                assignees: ['68666a3511d7ef8522c181c2'],
                fileKeys: fileKeys, 
                isValid:true,
                startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days ago
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            });
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Task created successfully');
        expect(response.body).toHaveProperty('task');
        taskId = response.body.task.id;
        console.log('Created task ID:', taskId);
    })

    it('get a task by taskId',async()=>{
        const response = await agent.get(`/api/tasks/getTaskById?taskId=${taskId}`);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Task retrieved successfully');
        expect(response.body).toHaveProperty('task');
        
        console.log('Retrieved task:', response.body.task);
    })    

    it('update a task by taskId',async()=>{
        const response = await agent.patch(`/api/tasks/update?taskId=${taskId}`)
            .send({
                action:'add',
                assignees:['68666a6511d7ef8522c181c3'],
                startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 10 days from now
            });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Task updated successfully');
        expect(response.body).toHaveProperty('task');
        expect(response.body.task.assignees.length).toBe(2);
        console.log('Updated task:', response.body.task);
    })

    it('removing a assignee',async()=>{
        const response = await agent.patch(`/api/tasks/update?taskId=${taskId}`)
            .send({
                action:'remove',
                assignees:['68666a6511d7ef8522c181c3'],
                startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 10 days from now
            });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Task updated successfully');
        expect(response.body).toHaveProperty('task');
        expect(response.body.task.assignees.length).toBe(1);
        console.log('Updated task:', response.body.task);
    })

    it('delete a task by taskId',async()=>{
        const response = await agent.delete(`/api/tasks/delete?taskId=${taskId}`);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'Task deleted successfully');
    })

    afterEach(async () => {
        const response=await agent.post('/api/auth/logout')
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('message', 'User logged out successfully');

    })

    afterAll(async()=>{
        if (fileKeys && fileKeys.length > 0) {
            // Assuming deleteFilesFromS3 is a function that deletes files from S3
            await deleteFilesFromS3(fileKeys2);
            console.log('Test files (exisiting task) deleted from S3');

            await Task.findByIdAndUpdate('6866d2bb11d7ef8522c18205',{
                $pull: { files: { $in: fileKeys2 } }
            },{new:true});      
            console.log('Test files removed from task (exisitng) in database');
            await deleteFilesFromS3(fileKeys);
            console.log('Test files deleted from S3');
            await Task.findByIdAndDelete(taskId);
            console.log('Test task deleted from database');
        }
    })
})

afterAll(async () => {
    try {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB after testing');
        if (client && client.isOpen) {
        await client.quit();
        console.log('Redis client disconnected after testing');
        }
    } catch (error) {
        console.error('Error during disconnection:', error);
    }
})