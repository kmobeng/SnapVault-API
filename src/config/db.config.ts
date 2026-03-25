import mongoose from "mongoose";
import Redis from "ioredis";
import { v2 as cloudinary } from "cloudinary";
import logger from "./wiston.config";

// database connection function
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL!);
    logger.info("connected to database successfully");
  } catch (error) {
    logger.error("Error connecting to database", error);
    process.exit(1);
  }
};

// redis connection
export const RedisClient = new Redis(process.env.REDIS_URL!, {
  tls: {},
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 5) {
      logger.error("Redis max retries reached. Check REDIS_URL.");
      return null;
    }
    return times * 500;
  },
});

RedisClient.on("error", (err) => {
  logger.error("Redis error", err);
});

RedisClient.on("connect", () => {
  logger.info("Connected to redis");
});

// cloudinary configuration
cloudinary.config({
  cloud_name: "dlyx92sx3",
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export { cloudinary };
