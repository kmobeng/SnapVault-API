import logger from "../config/wiston.config";
import { scheduleCleanupJob } from "./cleanup.jobs";

export const initializeBackgroundJobs = () => {
  try {
    scheduleCleanupJob();
  } catch (error) {
    logger.error("Failed to initialize background jobs", error);
  }
};
