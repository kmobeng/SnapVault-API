import {
  enqueueCloudinaryDeleteRetryJob,
  initializeCloudinaryDeleteRetryWorker,
} from "../utils/cloudinaryDeleteQueue.util";
import { scheduleCleanupJob } from "../jobs/cleanup.jobs";

describe("Background jobs", () => {
  it("initializes purge schedule based on env", () => {
    const cron = require("node-cron");
    const enabled = ["true", "1"].includes(
      (process.env.PHOTO_PURGE_ENABLED ?? "").toLowerCase(),
    );

    scheduleCleanupJob();

    if (enabled) {
      expect(cron.schedule).toHaveBeenCalled();
    } else {
      expect(cron.schedule).not.toHaveBeenCalled();
    }
  });

  it("enqueues cloudinary delete retries based on env", async () => {
    const bullmq = require("bullmq");
    const queueEnabled = ["true", "1"].includes(
      (process.env.CLOUDINARY_DELETE_RETRY_QUEUE_ENABLED ?? "").toLowerCase(),
    );

    await enqueueCloudinaryDeleteRetryJob({
      publicId: "test-public-id",
      photoId: "test-photo-id",
      source: "photo-permanent-delete",
    });

    if (queueEnabled) {
      expect(bullmq.__mocks.addMock).toHaveBeenCalled();
    } else {
      expect(bullmq.__mocks.addMock).not.toHaveBeenCalled();
    }
  });

  it("starts cloudinary retry worker based on env", () => {
    const bullmq = require("bullmq");
    const queueEnabled = ["true", "1"].includes(
      (process.env.CLOUDINARY_DELETE_RETRY_QUEUE_ENABLED ?? "").toLowerCase(),
    );
    const workerEnabled = ["true", "1"].includes(
      (process.env.CLOUDINARY_DELETE_RETRY_WORKER_ENABLED ?? "").toLowerCase(),
    );

    initializeCloudinaryDeleteRetryWorker();

    if (queueEnabled && workerEnabled) {
      expect(bullmq.__mocks.workerCtorMock).toHaveBeenCalled();
    } else {
      expect(bullmq.__mocks.workerCtorMock).not.toHaveBeenCalled();
    }
  });
});
