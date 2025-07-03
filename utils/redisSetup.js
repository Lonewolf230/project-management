import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();
const client = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

client.on("error", (err) => console.log("Redis Client Error", err));

export async function connectRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
      console.log("Redis connected ");

      if (process.env.NODE_ENV !== "test") {
        await client.set("foo", "bar");
        const result = await client.get("foo");
        console.log("Redis test value:", result);
      }
    }
  } catch (error) {
    console.error("Error connecting to Redis:", error);
  }
}

if (process.env.NODE_ENV !== "test") {
  connectRedis().catch(console.error);
}

export default client;
