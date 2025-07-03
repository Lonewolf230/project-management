import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import client, { connectRedis } from "../utils/redisSetup.js";
import Project from "../models/project.js";
let agent;
let tomorrow, oneMonthAhead;
beforeAll(async()=>{
    connectRedis();
    agent = request.agent(app);

    tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    oneMonthAhead=new Date();
    oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);

    await Project.create({
        _id:new mongoose.Types.ObjectId('6864ad7813d0c5339d058121'),
        projectName: 'Deletion Project',
        projectCode: 'P-002',
        description: 'This is a test project',
        client: '68666d7011d7ef8522c181c4',
        projectManager: '6865f62b11d7ef8522c181bb',
        startDate: tomorrow,
        endDate: oneMonthAhead,
        teamMembers: ['68666a6511d7ef8522c181c3', '68666a3511d7ef8522c181c2'],
        workflow: "Kanban"
    })

    await Project.create({
        _id:new mongoose.Types.ObjectId('6864ad7813d0c5339d058122'),
        projectName: 'Update Project',
        projectCode: 'P-003',
        description: 'This is a test project',
        client: '68666d7011d7ef8522c181c4',
        projectManager: '6865f62b11d7ef8522c181bb',
        startDate: tomorrow,
        endDate: oneMonthAhead,
        teamMembers: ['68666a6511d7ef8522c181c3', '68666a3511d7ef8522c181c2'],
        workflow: "Kanban"
    })
})

describe("Project based tests admin",()=>{
    beforeEach(async()=>{
        const loginResponse = await agent.post("/api/auth/login").send({
            email: "manish.r2022@vitstudent.ac.in",
            password: "admin",
        });
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.headers["set-cookie"]).toBeDefined();
        expect(loginResponse.body).toHaveProperty("user");
        expect(loginResponse.body).toHaveProperty(
            "message",
            "User logged in successfully"
        );
    })

    it('create a new project',async()=>{
        const response=await agent.post('/api/projects/create')
            .send({
                projectName:'Test Project',
                projectCode:'P-001',
                description:'This is a test project',
                client:'68666d7011d7ef8522c181c4',
                projectManager:'6865f62b11d7ef8522c181bb',
                startDate:tomorrow,
                endDate:oneMonthAhead,
                teamMembers:['68666a6511d7ef8522c181c3','68666a3511d7ef8522c181c2'],
                workflow:"Kanban"
            })
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("status", "success");
        expect(response.body).toHaveProperty("project");
    })

    it('get projects for this user',async()=>{
        const response=await agent.get('/api/projects/getProjectsByUser')
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("status", "success");
        expect(response.body).toHaveProperty("result");
        expect(Array.isArray(response.body.result)).toBe(true);
        expect(response.body.result.length).toBe(2);
    })

    it('update a project',async()=>{
        const response=await agent.patch('/api/projects/update?projectId=6864ad7813d0c5339d058121')
            .send({
                teamMembers:['68665b4a11d7ef8522c181c0','68666a3511d7ef8522c181c2'],
                action:'add'
            })
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("status", "success");
        expect(response.body).toHaveProperty("message", "Project updated successfully");
        expect(response.body).toHaveProperty("project");
        expect(response.body.project.teamMembers).toContain('68665b4a11d7ef8522c181c0');
        expect(typeof response.body.project).toBe('object');
    })

    it('delete a project',async()=>{
        const response=await agent.delete('/api/projects/delete?projectId=6864ad7813d0c5339d058121')
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("status", "success");
        expect(response.body).toHaveProperty("message", "Project deleted successfully");
    })

    afterEach(async()=>{
        const logoutResponse = await agent.post("/api/auth/logout");
        expect(logoutResponse.status).toBe(200);
        expect(logoutResponse.body).toHaveProperty("status", "success");
        expect(logoutResponse.body).toHaveProperty("message", "User logged out successfully");
    })

})

describe("Regular User Project based tests",()=>{
    beforeEach(async()=>{
        const loginResponse = await agent.post("/api/auth/login").send({
            email: "user4@gmail.com",
            password: "user4",
        });
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.headers["set-cookie"]).toBeDefined();
        expect(loginResponse.body).toHaveProperty("user");
        expect(loginResponse.body).toHaveProperty(
            "message",
            "User logged in successfully"
        );
    })
    it('should get projects for the user',async()=>{
        const response=await agent.get('/api/projects/getProjectsByUser')
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("status", "success");
        expect(response.body).toHaveProperty("result");
        expect(Array.isArray(response.body.result)).toBe(true);
        expect(response.body.result.length).toBe(1);
    })

    it('should not update a project',async()=>{
        const response=await agent.patch('/api/projects/update?projectId=6864ad7813d0c5339d058122')
            .send({
                teamMembers:['68665b4a11d7ef8522c181c0','68666a3511d7ef8522c181c2'],
                action:'add'
            })
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty("status", "fail");
        expect(response.body).toHaveProperty("message", "Only admins or project managers can perform this action");
    })

    it('should not delete a project',async()=>{
        const response=await agent.delete('/api/projects/delete?projectId=686674fe11d7ef8522c181cb')
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty("status", "fail");
        expect(response.body).toHaveProperty("message", "Only admins can perform this action");
    })
    afterEach(async()=>{
        const logoutResponse = await agent.post("/api/auth/logout");
        expect(logoutResponse.status).toBe(200);
        expect(logoutResponse.body).toHaveProperty("status", "success");
        expect(logoutResponse.body).toHaveProperty("message", "User logged out successfully");
    })
})

describe("Project Manager tests",()=>{
    beforeEach(async()=>{
        const loginResponse = await agent.post("/api/auth/login").send({
            email: "user@gmail.com",
            password: "user",
        });
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.headers["set-cookie"]).toBeDefined();
        expect(loginResponse.body).toHaveProperty("user");
        expect(loginResponse.body).toHaveProperty(
            "message",
            "User logged in successfully"
        );
    })
    it('update project details',async()=>{
        const response=await agent.patch('/api/projects/update?projectId=6864ad7813d0c5339d058122')
            .send({
                teamMembers:['68665b4a11d7ef8522c181c0','68666a3511d7ef8522c181c2'],
                action:'add'
            })
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("status", "success");
        expect(response.body).toHaveProperty("message", "Project updated successfully");
        expect(response.body).toHaveProperty("project");
        expect(response.body.project.teamMembers).toContain('68665b4a11d7ef8522c181c0');
        expect(typeof response.body.project).toBe('object');
    })
})


afterAll(async () => {
    try {
        await Project.findOneAndDelete({
            projectCode: 'P-001'
        })
        await Project.findByIdAndDelete('6864ad7813d0c5339d058122')
        console.log("Test project deleted successfully");
        
        await mongoose.connection.close();
        console.log("Disconnected from MongoDB after testing");
        if (client && client.isOpen) {
            await client.quit();
            console.log("Redis client disconnected after testing");
        }
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
})