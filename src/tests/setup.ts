import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

jest.setTimeout(20000);

const redisStore = new Map<string, string>();

const resetRedisStore = () => {
  redisStore.clear();
};

jest.mock("ioredis", () => {
  return class MockRedis {
    private store: Map<string, string>;

    constructor() {
      this.store = redisStore;
    }

    resetStore() {
      resetRedisStore();
    }

    flushall() {
      resetRedisStore();
      return "OK";
    }

    async get(key: string) {
      return this.store.get(key) ?? null;
    }

    async setex(key: string, _ttl: number, value: string) {
      this.store.set(key, value);
      return "OK";
    }

    async del(...keys: string[]) {
      let count = 0;
      keys.forEach((key) => {
        if (this.store.delete(key)) {
          count += 1;
        }
      });
      return count;
    }

    async scan(
      _cursor: string,
      _match: string,
      _pattern: string,
      _count: string,
      _size: number,
    ) {
      return ["0", []];
    }

    on() {
      return this;
    }
  };
});

jest.mock("cloudinary", () => {
  let uploadCount = 0;
  const { PassThrough } = require("stream");
  const uploadStream = jest.fn((_options: any, cb: any) => {
    const stream = new PassThrough();
    process.nextTick(() => {
      uploadCount += 1;
      cb(null, {
        secure_url: "https://example.com/test.webp",
        public_id: `test-public-id-${uploadCount}`,
      });
    });
    return stream;
  });

  const destroy = jest.fn().mockResolvedValue({ result: "ok" });

  return {
    v2: {
      uploader: {
        upload_stream: uploadStream,
        destroy,
      },
      config: jest.fn(),
    },
  };
});

jest.mock("sharp", () => {
  return () => {
    const chain: any = {};
    chain.rotate = () => chain;
    chain.resize = () => chain;
    chain.webp = () => chain;
    chain.toBuffer = async () => Buffer.from("test-image");
    return chain;
  };
});

jest.mock("bullmq", () => {
  const addMock = jest.fn().mockResolvedValue({ id: "job-1" });
  const queueCtorMock = jest.fn();
  const workerCtorMock = jest.fn();

  class MockQueue {
    add = addMock;
    close = jest.fn();

    constructor() {
      queueCtorMock();
    }
  }

  class MockWorker {
    on = jest.fn();
    close = jest.fn();

    constructor() {
      workerCtorMock();
    }
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
    __mocks: {
      addMock,
      queueCtorMock,
      workerCtorMock,
    },
  };
});

jest.mock("node-cron", () => {
  return {
    schedule: jest.fn(),
    validate: jest.fn(() => true),
  };
});

jest.mock("passport-google-oauth20", () => {
  class Strategy {
    name = "google";

    constructor(_options: any, _verify: any) {
      // noop: test stub
    }
  }

  return { Strategy };
});

jest.mock("../utils/email.util", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

const clearDatabase = async () => {
  const db = mongoose.connection.db;
  if (!db) {
    return;
  }
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

beforeAll(async () => {
  const requiredEnvVars = [
    "DB_URL",
    "JWT_SECRET",
    "ACCESS_JWT_EXPIRES_IN",
    "ACCESS_JWT_COOKIE_EXPIRES_IN",
    "REFRESH_JWT_COOKIE_EXPIRES_IN",
    "COOKIE_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required env vars for tests: ${missingEnvVars.join(", ")}`,
    );
  }

  const dbUrl = process.env.DB_URL ?? "";
  if (!dbUrl) {
    throw new Error("DB_URL must be set for integration tests");
  }

  await mongoose.connect(dbUrl);
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await mongoose.disconnect();

  const { RedisClient } = require("../config/db.config");
  if (RedisClient?.resetStore) {
    RedisClient.resetStore();
  } else if (RedisClient?.flushall) {
    RedisClient.flushall();
  }
});
