import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';
import client, { connectRedis } from '../utils/redisSetup.js';
import User from '../models/user.js';
import * as dateUtils from '../utils/workloadUtils.js';
import UserWorkException from '../models/userWorkException.js';
let tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

let agent;
beforeAll(async () => {
    connectRedis()
    agent = request.agent(app);
    await UserWorkException.create({
        _id: new mongoose.Types.ObjectId('6846bfd44766ec3c873e55df'),
        userId: '68665b4a11d7ef8522c181c3',
        date: tomorrow,
        availableHours: 0,
        reason: 'Test leave application',
        exceptionType: 'holiday',
    })

    console.log('Leave application created for delete test');
    
})

describe('User Management', () => {
  it('should create a new user', async () => {
    //login as super admin
    const response = await agent
      .post('/api/auth/login')
      .send({
        email: 'manish2306j@gmail.com',
        password: 'password',
      });
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.body).toHaveProperty('message', 'User logged in successfully');


    const creationResponse=await agent
      .post('/api/users/create')
        .send({
            name: 'testuser',
            email: 'nramdoss123456@gmail.com',
            role:'admin'
        });
    expect(creationResponse.status).toBe(201);
    expect(creationResponse.body).toHaveProperty('message', 'User created successfully');
  });
});

describe('User skill addition',()=>{
  beforeEach(async()=>{
    const loginResponse = await agent.post('/api/auth/login').send({
      email: 'user2@gmail.com',
      password: 'user2',
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('message', 'User logged in successfully');
  })

  it('adding skills to user',async()=>{
    const response = await agent
      .patch('/api/users/updateInfo')
      .send({
        skills: [        
        {"skillId":"68375a9c6ffa1a7235fd3b52","level":"1"},
        {"skillId":"68375aa66ffa1a7235fd3b54","level":"3"},
        {"skillId":"68375aae6ffa1a7235fd3b56","level":"5"},
        {"skillId":"68375aca6ffa1a7235fd3b5a","level":"3"},
        {"skillId":"68375ad66ffa1a7235fd3b5c","level":"1"},
        {"skillId":"68375ae46ffa1a7235fd3b5e","level":"4"}
      ]
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'User information updated successfully');
    expect(response.body).toHaveProperty('user');
    expect(typeof response.body.user).toBe('object');
  })

  it('throw error if some skill level are not provided',async()=>{
    const response = await agent
      .patch('/api/users/updateInfo')
      .send({
        skills: [        
        {"skillId":"68375a9c6ffa1a7235fd3b52","level":"1"},
        {"skillId":"68375aa66ffa1a7235fd3b54","level":"3"},
        {"skillId":"68375aae6ffa1a7235fd3b56","level":"5"},
        {"skillId":"68375aca6ffa1a7235fd3b5a","level":"3"},
        {"skillId":"68375ad66ffa1a7235fd3b5c","level":"1"},
        {"skillId":"68375ae46ffa1a7235fd3b5e"}
        ]
      });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'fail');
    expect(response.body).toHaveProperty('message', 'Skill level is required for skill at position 6');
  })

  it('throw error if skill is missed',async()=>{
    const response = await agent
      .patch('/api/users/updateInfo')
      .send({
        skills: [        
        {"skillId":"68375a9c6ffa1a7235fd3b52","level":"1"},
        {"skillId":"68375aa66ffa1a7235fd3b54","level":"3"},
        {"skillId":"68375aae6ffa1a7235fd3b56","level":"5"},
        {"skillId":"68375aca6ffa1a7235fd3b5a","level":"3"},
        {"skillId":"68375ad66ffa1a7235fd3b5c","level":"1"}
        ]
      });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'fail');
    expect(response.body).toHaveProperty('message', 'Exactly 6 skills must be provided');
  })

  afterEach(async()=>{
    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('status', 'success');
    expect(logoutResponse.body).toHaveProperty('message', 'User logged out successfully');
  })
})

describe('Users fetching',()=>{
  beforeEach(async()=>{
    const loginResponse = await agent.post('/api/auth/login').send({
      email: 'manish.r2022@vitstudent.ac.in',
      password: 'admin',
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('message', 'User logged in successfully');
  })

  it('fetch users by query',async()=>{
    const response = await agent.get('/api/users/searchUsers?query=user');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('users');
    expect(Array.isArray(response.body.users)).toBe(true);
    expect(response.body.users.length).toBe(7);
  })

  it('no users found',async()=>{
    const response = await agent.get('/api/users/searchUsers?query=use&role=client');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('count', 0);
    expect(response.body).toHaveProperty('message', 'No users found');
  })

  afterEach(async()=>{
    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('status', 'success');
    expect(logoutResponse.body).toHaveProperty('message', 'User logged out successfully');
  })

})

describe('Leave applications',()=>{
  beforeEach(async()=>{
    const loginResponse = await agent.post('/api/auth/login').send({
      email:'user7@gmail.com',
      password:'user7',
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('message', 'User logged in successfully');
  })

  it('apply for leave',async()=>{
    const response = await agent.post('/api/users/applyForLeave')
      .send({
        date: tomorrow,
        availableHours: '0',
        reason: 'Personal leave',
        exceptionType:'holiday'
      });
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'Leave application submitted successfully');
    expect(response.body).toHaveProperty('leave');
    expect(typeof response.body.leave).toBe('object');

    await UserWorkException.findByIdAndDelete(response.body.leave.id);
    console.log('Leave application deleted after test');
  })

  it('cancel leave application',async()=>{
    const response = await agent.delete('/api/users/cancelLeave?leaveId=6846bfd44766ec3c873e55df');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'Leave application cancelled successfully');
  })

  it('invalid date',async()=>{
    const response = await agent.post('/api/users/applyForLeave')
      .send({
        date: '2025-06-15',
        availableHours: '0',
        reason: 'Personal leave',
        exceptionType:'holiday'
      });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'fail');
    expect(response.body).toHaveProperty('message', 'Cannot apply for leave in the past');
  })

  it('apply for leave on weekends(fail)',async()=>{
    const spy=jest.spyOn(dateUtils, 'getDayName').mockReturnValue('Saturday');
    const response = await agent.post('/api/users/applyForLeave')
      .send({
        date: '2025-10-14',
        availableHours: '0',
        reason: 'Personal leave',
        exceptionType:'holiday'
      });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('status', 'fail');
    expect(response.body).toHaveProperty('message', 'Cannot apply for leave on weekends');
    spy.mockRestore();
  })

  it('get all leave applications',async()=>{
    const response = await agent.get('/api/users/getLeaves');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'Leaves fetched successfully');
    expect(response.body).toHaveProperty('count', 2);
    expect(response.body).toHaveProperty('leaves');
    expect(Array.isArray(response.body.leaves)).toBe(true);
  })

  afterEach(async()=>{
    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('status', 'success');
    expect(logoutResponse.body).toHaveProperty('message', 'User logged out successfully');
  })

})

describe('Admin actions for leaves',()=>{
  beforeEach(async()=>{
    const loginResponse = await agent.post('/api/auth/login').send({
      email: 'manish.r2022@vitstudent.ac.in',
      password: 'admin',
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('message', 'User logged in successfully');
  })

  it('approve leave application',async()=>{
    const response = await agent.patch('/api/users/approveLeave?leaveId=6846bfd44766ec3c873e55de')

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'Leave application approved successfully');
  })

  it('get all leaves',async()=>{
    const response = await agent.get('/api/users/getLeaves');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'Leaves fetched successfully');
    expect(response.body).toHaveProperty('count', 3);
    expect(response.body).toHaveProperty('leaves');
    expect(Array.isArray(response.body.leaves)).toBe(true);
  })


  afterEach(async()=>{
    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('status', 'success');
    expect(logoutResponse.body).toHaveProperty('message', 'User logged out successfully');
  })
  afterAll(async()=>{
    await UserWorkException.findByIdAndUpdate('6846bfd44766ec3c873e55de',
    {
      $set: { approved: false }, 
      $unset: {
        approvedBy: "",
        approvalDate: ""
      }
    });

    console.log('Leave application restored after test');})
})

afterAll(async () => {
    try{
        await User.findOneAndDelete({
            email:'nramdoss123456@gmail.com'
        })
        await User.findByIdAndUpdate('68665b4a11d7ef8522c181c0',{
          skills:[]
        })
        await new Promise(resolve=> setTimeout(resolve, 500)); // wait for 500ms
        if(client && client.isOpen){
            await client.quit();
            console.log('Redis client disconnected after testing');
        }
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB after testing');

    }
    catch(err){
        console.error('Error during cleanup:', err);
    }
});