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

const queueConnection = new Redis(process.env.REDIS_URL!, {
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

const cloudinaryDeleteRetryQueue = new Queue<CloudinaryDeleteRetryPayload>(
  CLOUDINARY_DELETE_QUEUE_NAME,
  {
    connection: queueConnection,
    defaultJobOptions,
  },
);

const buildCloudinaryRetryJobId = (publicId: string) =>
  `cloudinary-delete:${encodeURIComponent(publicId)}`;

let cloudinaryDeleteRetryWorker: Worker<CloudinaryDeleteRetryPayload> | null =
  null;

export const enqueueCloudinaryDeleteRetryJob = async (
  payload: CloudinaryDeleteRetryPayload,
) => {
  await cloudinaryDeleteRetryQueue.add("delete", payload, {
    jobId: buildCloudinaryRetryJobId(payload.publicId),
  });

  logger.info("Enqueued Cloudinary delete retry job", {
    publicId: payload.publicId,
    photoId: payload.photoId,
    source: payload.source,
  });
};

export const initializeCloudinaryDeleteRetryWorker = () => {
  if (cloudinaryDeleteRetryWorker) {
    logger.info("Cloudinary delete retry worker already initialized");
    return;
  }

  cloudinaryDeleteRetryWorker = new Worker<CloudinaryDeleteRetryPayload>(
    CLOUDINARY_DELETE_QUEUE_NAME,
    async (job) => {
      await cloudinary.uploader.destroy(job.data.publicId);
      logger.info("Cloudinary retry worker deleted asset", {
        publicId: job.data.publicId,
        photoId: job.data.photoId,
        source: job.data.source,
        attemptsUsed: job.attemptsMade + 1,
      });
    },
    {
      connection: queueConnection,
      concurrency: 3,
    },
  );

  cloudinaryDeleteRetryWorker.on("completed", (job) => {
    logger.info("Cloudinary delete retry job completed", {
      jobId: job.id,
      publicId: job.data.publicId,
      attemptsUsed: job.attemptsMade + 1,
    });
  });

  cloudinaryDeleteRetryWorker.on("failed", (job, error) => {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? CLOUDINARY_DELETE_ATTEMPTS;

    logger.error("Cloudinary delete retry job failed", {
      jobId: job?.id,
      publicId: job?.data.publicId,
      photoId: job?.data.photoId,
      source: job?.data.source,
      attemptsMade,
      maxAttempts,
      isTerminalFailure: attemptsMade >= maxAttempts,
      error,
    });
  });

  cloudinaryDeleteRetryWorker.on("error", (error) => {
    logger.error("Cloudinary delete retry worker error", error);
  });

  logger.info("Cloudinary delete retry worker initialized", {
    queue: CLOUDINARY_DELETE_QUEUE_NAME,
    attempts: CLOUDINARY_DELETE_ATTEMPTS,
    backoffMs: CLOUDINARY_DELETE_BACKOFF_MS,
  });
};
