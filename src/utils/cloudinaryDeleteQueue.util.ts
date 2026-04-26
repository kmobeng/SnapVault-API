import { JobsOptions, Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { cloudinary } from "../config/db.config";
import logger from "../config/wiston.config";

type CloudinaryDeleteRetrySource =
  | "photo-permanent-delete"
  | "scheduled-photo-purge";

interface CloudinaryDeleteRetryPayload {
  publicId: string;
  photoId: string;
  source: CloudinaryDeleteRetrySource;
}

const CLOUDINARY_DELETE_QUEUE_NAME = "cloudinary-delete-retry";
const CLOUDINARY_DELETE_ATTEMPTS = 5;
const CLOUDINARY_DELETE_BACKOFF_MS = 5000;
const CLOUDINARY_DELETE_REMOVE_ON_COMPLETE_AGE_SECONDS = 24 * 60 * 60;
const CLOUDINARY_DELETE_REMOVE_ON_FAIL_AGE_SECONDS = 7 * 24 * 60 * 60;

const isCloudinaryDeleteRetryQueueEnabled = () => {
  const value = (
    process.env.CLOUDINARY_DELETE_RETRY_QUEUE_ENABLED ?? "false"
  ).toLowerCase();
  return value === "true" || value === "1";
};

const isCloudinaryDeleteRetryWorkerEnabled = () => {
  const value = (
    process.env.CLOUDINARY_DELETE_RETRY_WORKER_ENABLED ?? "false"
  ).toLowerCase();
  return value === "true" || value === "1";
};

const defaultJobOptions: JobsOptions = {
  attempts: CLOUDINARY_DELETE_ATTEMPTS,
  backoff: {
    type: "exponential",
    delay: CLOUDINARY_DELETE_BACKOFF_MS,
  },
  removeOnComplete: {
    age: CLOUDINARY_DELETE_REMOVE_ON_COMPLETE_AGE_SECONDS,
  },
  removeOnFail: {
    age: CLOUDINARY_DELETE_REMOVE_ON_FAIL_AGE_SECONDS,
  },
};

let queueConnection: Redis | null = null;
let cloudinaryDeleteRetryQueue: Queue<CloudinaryDeleteRetryPayload> | null =
  null;

const getQueueConnection = () => {
  if (!isCloudinaryDeleteRetryQueueEnabled()) {
    return null;
  }

  if (queueConnection) {
    return queueConnection;
  }

  queueConnection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    tls: {},
    retryStrategy: (times) => {
      if (times > 5) {
        logger.error("Cloudinary retry queue Redis max retries reached.");
        return null;
      }
      return times * 500;
    },
  });

  queueConnection.on("error", (error) => {
    logger.error("Cloudinary retry queue Redis error", error);
  });

  return queueConnection;
};

const getCloudinaryDeleteRetryQueue = () => {
  if (!isCloudinaryDeleteRetryQueueEnabled()) {
    return null;
  }

  if (cloudinaryDeleteRetryQueue) {
    return cloudinaryDeleteRetryQueue;
  }

  const connection = getQueueConnection();
  if (!connection) {
    return null;
  }

  cloudinaryDeleteRetryQueue = new Queue<CloudinaryDeleteRetryPayload>(
    CLOUDINARY_DELETE_QUEUE_NAME,
    {
      connection,
      defaultJobOptions,
    },
  );

  return cloudinaryDeleteRetryQueue;
};

const buildCloudinaryRetryJobId = (publicId: string) =>
  `cloudinary-delete:${encodeURIComponent(publicId)}`;

let cloudinaryDeleteRetryWorker: Worker<CloudinaryDeleteRetryPayload> | null =
  null;

export const enqueueCloudinaryDeleteRetryJob = async (
  payload: CloudinaryDeleteRetryPayload,
) => {
  const queue = getCloudinaryDeleteRetryQueue();
  if (!queue) {
    return;
  }

  await queue.add("delete", payload, {
    jobId: buildCloudinaryRetryJobId(payload.publicId),
  });
};

export const initializeCloudinaryDeleteRetryWorker = () => {
  if (
    !isCloudinaryDeleteRetryQueueEnabled() ||
    !isCloudinaryDeleteRetryWorkerEnabled()
  ) {
    return;
  }

  if (cloudinaryDeleteRetryWorker) {
    return;
  }

  const connection = getQueueConnection();
  if (!connection) {
    return;
  }

  cloudinaryDeleteRetryWorker = new Worker<CloudinaryDeleteRetryPayload>(
    CLOUDINARY_DELETE_QUEUE_NAME,
    async (job) => {
      await cloudinary.uploader.destroy(job.data.publicId);
    },
    {
      connection,
      concurrency: 3,
    },
  );

  cloudinaryDeleteRetryWorker.on("failed", (job, error) => {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? CLOUDINARY_DELETE_ATTEMPTS;
    const isTerminalFailure = attemptsMade >= maxAttempts;

    if (!isTerminalFailure) {
      return;
    }

    logger.error("Cloudinary delete retry job failed", {
      jobId: job?.id,
      publicId: job?.data.publicId,
      photoId: job?.data.photoId,
      source: job?.data.source,
      attemptsMade,
      maxAttempts,
      isTerminalFailure,
      error,
    });
  });

  cloudinaryDeleteRetryWorker.on("error", (error) => {
    logger.error("Cloudinary delete retry worker error", error);
  });
};
