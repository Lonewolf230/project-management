import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import {uri,port} from '../src/utils/config.js';

beforeAll(async () => {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB for testing');
});

describe('Authentication', () => {
  it('should log in an existing user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpass',
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});

afterAll(async () => {
  await mongoose.connection.close();
  console.log('Disconnected from MongoDB after testing');
});