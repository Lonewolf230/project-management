import request from "supertest";
import app from "../app.js";
import mongoose from "mongoose";
import client,{ connectRedis } from "../utils/redisSetup";

beforeAll(async () => {
  connectRedis();

});

describe("Login Tests", () => {

    it('should log in an existing user', async () => {
        const response=await request(app)
          .post('/api/auth/login')
          .send({
            email: 'manish2306j@gmail.com',
            password: 'password',
          })
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'User logged in successfully');
        expect(response.headers['set-cookie']).toBeDefined();
    })

    it('user not found', async () => {
        const response=await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid@example.com',
            password: 'wrongpassword',
          })
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('status', 'fail');
        expect(response.body).toHaveProperty('message', 'User with given credentials does not exist');
    });

    it('should return 401 if password does not match', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'manish2306j@gmail.com',
            password: 'wrongpassword',
          })
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('status', 'fail');
        expect(response.body).toHaveProperty('message', 'Password is incorrect');
    });

    
})

afterAll(async () => {
  try {
    await mongoose.connection.close();
    console.log("Disconnected from MongoDB after testing");
    if (client && client.isOpen) {
      await client.quit();
      console.log("Redis client disconnected after testing");
    }
  } catch (error) {
    console.error("Error disconnecting from databases:", error);
  }
});
