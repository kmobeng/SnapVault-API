import cron from "node-cron";
import logger from "../config/wiston.config";
import Photo from "../model/photo.model";
import PhotoAlbum from "../model/photoAlbum.model";
import { cloudinary } from "../config/db.config";
import {
  invalidateAlbumCache,
  invalidatePhotosCache,
  invalidateSinglePhotoCache,
} from "../utils/redis.util";

const DEFAULT_PURGE_CRON = "0 2 * * *";
const DEFAULT_RETENTION_DAYS = 30;
const PURGE_BATCH_SIZE = 100;

let purgeIsRunning = false;

const shouldEnablePurge = () => {
  const value = (process.env.PHOTO_PURGE_ENABLED ?? "false").toLowerCase();
  return value === "true" || value === "1";
};

const purgeExpiredSoftDeletedPhotos = async (retentionDays: number) => {
  const startedAt = Date.now();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const summary = {
    eligible: 0,
    deleted: 0,
    cloudinaryFailed: 0,
  };

  while (true) {
    const photos = await Photo.find({
      isDeleted: true,
      deletedAt: { $lt: cutoffDate },
    })
      .select("_id publicId user")
      .limit(PURGE_BATCH_SIZE)
      .lean();

    if (photos.length === 0) {
      break;
    }

    summary.eligible += photos.length;

    const photoIds = photos.map((photo) => photo._id);
    const userIds = new Set(photos.map((photo) => String(photo.user)));

    const photoAlbumLinks = await PhotoAlbum.find({
      photo: { $in: photoIds },
    })
      .select("album")
      .lean();

    const albumIds = new Set(
      photoAlbumLinks.map((photoAlbumLink) => String(photoAlbumLink.album)),
    );

    await PhotoAlbum.deleteMany({ photo: { $in: photoIds } });
    const deletedPhotosResult = await Photo.deleteMany({ _id: { $in: photoIds } });
    summary.deleted += deletedPhotosResult.deletedCount;

    for (const photo of photos) {
      if (!photo.publicId) {
        continue;
      }

      try {
        await cloudinary.uploader.destroy(photo.publicId);
      } catch (error) {
        summary.cloudinaryFailed += 1;
        logger.error("Cloudinary cleanup failed after scheduled DB purge", {
          photoId: String(photo._id),
          publicId: photo.publicId,
          error,
        });
      }
    }

    await Promise.all(
      Array.from(userIds).map((userId) => invalidatePhotosCache(userId)),
    );
    await Promise.all(
      photos.map((photo) => invalidateSinglePhotoCache(String(photo._id))),
    );
    await Promise.all(
      Array.from(albumIds).map((albumId) => invalidateAlbumCache(albumId)),
    );
  }

  logger.info("Photo purge job run completed", {
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    ...summary,
    durationMs: Date.now() - startedAt,
  });
};

export const scheduleCleanupJob = () => {
  if (!shouldEnablePurge()) {
    logger.info("Photo purge scheduler is disabled", {
      env: "PHOTO_PURGE_ENABLED",
    });
    return;
  }

  const retentionDays = DEFAULT_RETENTION_DAYS;
  const schedule = DEFAULT_PURGE_CRON;

  if (!cron.validate(schedule)) {
    logger.error("PHOTO_PURGE_CRON is invalid; scheduler not started", {
      schedule,
    });
    return;
  }

  cron.schedule(schedule, async () => {
    if (purgeIsRunning) {
      logger.info("Skipping photo purge run because previous run is still active");
      return;
    }

    purgeIsRunning = true;
    try {
      await purgeExpiredSoftDeletedPhotos(retentionDays);
    } catch (error) {
      logger.error("Error while running scheduled photo purge", error);
    } finally {
      purgeIsRunning = false;
    }
  });

  logger.info("Photo purge scheduler initialized", {
    schedule,
    retentionDays,
    batchSize: PURGE_BATCH_SIZE,
  });
};