import request from "supertest";
import app from "../app.js";
import mongoose from "mongoose";
import client, { connectRedis } from "../utils/redisSetup.js";
import User from "../models/user.js";

let agent;

beforeAll(async () => {
  connectRedis();
  agent = request.agent(app);
});

describe("Change role", () => {
  it("change role for the user", async () => {
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "manish2306j@gmail.com",
      password: "password",
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers["set-cookie"]).toBeDefined();
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body).toHaveProperty(
      "message",
      "User logged in successfully"
    );

    const response = await agent.patch("/api/auth/change-role").send({
      newRole: "user",
      affectedUserId: "6865f66c11d7ef8522c181bc",
    });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty(
      "message",
      "User role changed successfully"
    );
  });

  it("should not change role if new role is admin and user is not super-admin", async () => {
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "manish.r2022@vitstudent.ac.in",
      password: "admin",
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body).toHaveProperty(
      "message",
      "User logged in successfully"
    );
    expect(loginResponse.headers["set-cookie"]).toBeDefined();

    const response = await agent.patch("/api/auth/change-role").send({
      newRole: "admin",
      affectedUserId: "6865f62b11d7ef8522c181bb",
    });
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty(
      "message",
      "Only super admins can perform this action"
    );
  });

  it("should not change role if user is trying to change own role", async () => {
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "manish.r2022@vitstudent.ac.in",
      password: "admin",
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body).toHaveProperty(
      "message",
      "User logged in successfully"
    );
    expect(loginResponse.headers["set-cookie"]).toBeDefined();

    const response = await agent.patch("/api/auth/change-role").send({
      newRole: "client",
      affectedUserId: "6865f5c611d7ef8522c181ba",
    });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty(
      "message",
      "You cannot change your own role"
    );
  });
});

describe("Change password", () => {
  it("should not change password if current password is incorrect", async () => {
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "user2@gmail.com",
      password: "user2",
    });
    //$2b$10$UJo8VcOPzs8mVnHg2HMBpu3YPjDs9W89.jcR3/p2B8KqjRbTLiqBa
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers["set-cookie"]).toBeDefined();
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body).toHaveProperty(
      "message",
      "User logged in successfully"
    );

    const response = await agent.patch("/api/auth/change-password").send({
      currentPassword: "wrongpassword",
      newPassword: "newpassword",
    });
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty(
      "message",
      "Password is incorrect"
    );
  });

  it("change password for the user", async () => {
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "user@gmail.com",
      password: "user",
    });
    //$2b$10$Zg3t8IVxNx0THjhIynk2Bu1Y7C9LzQboPrLsnQ1TxeC2l6K79xRiu
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers["set-cookie"]).toBeDefined();
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body).toHaveProperty(
      "message",
      "User logged in successfully"
    );

    const response = await agent.patch("/api/auth/change-password").send({
      currentPassword: "user",
      newPassword: "user1",
    });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "Password changed successfully"
    );
  });
});

afterAll(async () => {
  try {
    await User.findByIdAndUpdate("6865f66c11d7ef8522c181bc", {
      role: "client",
    });
    console.log("User role reset to client");
    await User.findOneAndUpdate(
      { email: "user@gmail.com" },
      {
        password:
          "$2b$10$Zg3t8IVxNx0THjhIynk2Bu1Y7C9LzQboPrLsnQ1TxeC2l6K79xRiu",
      }
    );
    console.log("User password reset to original");
    await mongoose.connection.close();
    console.log("Disconnected from MongoDB after testing");
    if (client && client.isOpen) {
      await client.quit();
      console.log("Redis client disconnected after testing");
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});
