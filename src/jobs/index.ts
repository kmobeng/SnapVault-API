import logger from "../config/wiston.config";
import { scheduleCleanupJob } from "./cleanup.jobs";
import { initializeCloudinaryDeleteRetryWorker } from "../utils/cloudinaryDeleteQueue.util";

export const initializeBackgroundJobs = () => {
  try {
    scheduleCleanupJob();
    initializeCloudinaryDeleteRetryWorker();
  } catch (error) {
    logger.error("Failed to initialize background jobs", error);
  }
};
