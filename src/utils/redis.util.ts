import { RedisClient } from "../config/db.config";
import PhotoAlbum from "../model/photoAlbum.model";

export const scanAndDelete = async (pattern: string) => {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await RedisClient.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await RedisClient.del(...keys);
    }
  } while (cursor !== "0");
};

// Photo cache
export const invalidatePhotosCache = async (userId: string) => {
  await scanAndDelete(`photos:${userId}:*`);
};

export const invalidateSinglePhotoCache = async (photoId: string) => {
  await scanAndDelete(`photo:${photoId}:*`);
};

export const invalidateAlbumCachesForPhoto = async (photoId: string) => {
  const albumIds = await PhotoAlbum.distinct("album", { photo: photoId });
  if (albumIds.length === 0) return;
  await Promise.all(
    albumIds.map((albumId) => invalidateAlbumCache(String(albumId))),
  );
};

// Album cache
export const invalidateAlbumsCache = async (userId: string) => {
  await scanAndDelete(`albums:${userId}:*`);
};

export const invalidateAlbumCache = async (albumId: string) => {
  await scanAndDelete(`album:${albumId}:*`);
};

// User cache
export const invalidateUserCache = async (userId: string) => {
  await RedisClient.del(`user:${userId}`);
};

export const invalidateUsersCache = async () => {
  await scanAndDelete(`users:all:*`);
};
