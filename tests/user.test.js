import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';
import client, { connectRedis } from '../utils/redisSetup.js';
import User from '../models/user.js';

beforeAll(async () => {
    connectRedis()
})

describe('User Management', () => {
  const agent = request.agent(app);
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

afterAll(async () => {
    try{
        await User.findOneAndDelete({
            email:'nramdoss123456@gmail.com'
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