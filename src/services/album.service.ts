import { RedisClient } from "../config/db.config";
import Album from "../model/album.model";
import { createError } from "../utils/error.util";
import APIFeatures from "../utils/APIFeatures.util";
import mongoose from "mongoose";
import PhotoAlbum from "../model/photoAlbum.model";

const getAlbumsCacheIndexKey = (userId: string) => `albums:index:${userId}`;
const getAlbumCacheIndexKey = (albumId: string) => `album:index:${albumId}`;

const trackAlbumsCacheKey = async (userId: string, cacheKey: string) => {
  await RedisClient.sadd(getAlbumsCacheIndexKey(userId), cacheKey);
};

const trackAlbumCacheKey = async (albumId: string, cacheKey: string) => {
  await RedisClient.sadd(getAlbumCacheIndexKey(albumId), cacheKey);
};

const invalidateAlbumsCache = async (userId: string) => {
  const indexKey = getAlbumsCacheIndexKey(userId);
  const cachedKeys = await RedisClient.smembers(indexKey);

  if (cachedKeys.length !== 0) {
    await RedisClient.del(...cachedKeys);
  }

  await RedisClient.del(indexKey);
};

const invalidateAlbumCache = async (albumId: string) => {
  const indexKey = getAlbumCacheIndexKey(albumId);
  const cachedKeys = await RedisClient.smembers(indexKey);

  if (cachedKeys.length !== 0) {
    await RedisClient.del(...cachedKeys);
  }

  await RedisClient.del(indexKey);
};

export const invalidateSingleAlbumCacheService = async (albumId: string) => {
  await invalidateAlbumCache(albumId);
};

export const createAlbumService = async (
  name: string,
  visibility: string,
  userId: string,
) => {
  try {
    const album = await Album.create({ name, visibility, user: userId });
    if (!album) {
      throw createError("Unable to create album", 400);
    }
    await invalidateAlbumsCache(userId);
    return album;
  } catch (error) {
    throw error;
  }
};

export const getAllAlbumsService = async (
  userId: string,
  user: string,
  queryString: any,
) => {
  const normalizedQuery = Object.keys(queryString)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = queryString[key];
      return acc;
    }, {});

  const albumsKey = `albums:${userId}:${JSON.stringify(normalizedQuery)}`;
  try {
    const cachedAlbums = await RedisClient.get(albumsKey);

    if (cachedAlbums) {
      return JSON.parse(cachedAlbums);
    }

    let query: any;

    if (user === userId) {
      query = { user: userId };
    } else {
      query = { user: userId, visibility: "public" };
    }

    const features = new APIFeatures(Album.find(query), queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const albums = await features.query.lean();

    await RedisClient.setex(albumsKey, 3600, JSON.stringify(albums));
    await trackAlbumsCacheKey(userId, albumsKey);

    return albums;
  } catch (error) {
    throw error;
  }
};

export const getSingleAlbumService = async (
  albumId: string,
  userId: string,
  user: string,
) => {
  const albumKey = `album:${albumId}:${user}`;
  try {
    // Check Redis cache first
    const cachedAlbum = await RedisClient.get(albumKey);

    if (cachedAlbum) {
      return JSON.parse(cachedAlbum);
    }

    // If not in cache, fetch from database
    if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw createError("Invalid album ID", 400);
    }

    const query: { _id: string; user: string; visibility?: "public" } = {
      _id: albumId,
      user: userId,
    };

    if (user !== userId) {
      query.visibility = "public";
    }

    const album = await Album.findOne(query)
      .populate({
        path: "photos",
        match: { user: userId },
        populate: {
          path: "photo",
          match: { isDeleted: false },
        },
      })
      .lean();

    if (!album) {
      throw createError("No album found", 404);
    }

    // Remove relation rows whose nested photo failed the match filter.
    const photos = Array.isArray((album as any).photos)
      ? (album as any).photos.filter((row: any) => row?.photo)
      : [];

    const hydratedAlbum = {
      ...(album as any),
      photos,
    };

    await RedisClient.setex(albumKey, 3600, JSON.stringify(hydratedAlbum));
    await trackAlbumCacheKey(albumId, albumKey);

    return hydratedAlbum;
  } catch (error) {
    throw error;
  }
};

export const updateSingleAlbumService = async (
  albumId: string,
  userId: string,
  name: string,
) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw createError("Invalid album ID", 400);
    }

    const album = await Album.findOneAndUpdate(
      { _id: albumId, user: userId },
      { $set: { name } },
      { new: true, runValidators: true },
    );
    if (!album) {
      throw createError("Error while updating album", 400);
    }
    await invalidateAlbumsCache(userId);
    await invalidateAlbumCache(albumId);

    return album;
  } catch (error) {
    throw error;
  }
};

export const deleteSingleAlbumService = async (
  albumId: string,
  userId: string,
) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(albumId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw createError("Invalid album ID or user ID", 400);
    }

    const album = await Album.findOneAndDelete({
      _id: albumId,
      user: userId,
    });
    if (!album) {
      throw createError("Unable to delete album", 400);
    }

    await PhotoAlbum.deleteMany({ album: albumId });

    await invalidateAlbumsCache(userId);
    await invalidateAlbumCache(albumId);

    return album;
  } catch (error) {
    throw error;
  }
};

export const addPhotosToAlbumService = async (
  albumId: string,
  userId: string,
  photoIds: string[],
) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw createError("Invalid album ID", 400);
    }

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      throw createError("Please provide at least one photo ID", 400);
    }

    for (const id of photoIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError("Invalid photo ID", 400);
      }
    }

    const uniquePhotoIds = [...new Set(photoIds)];
    const albumObjectId = new mongoose.Types.ObjectId(albumId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const uniquePhotoObjectIds = uniquePhotoIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const [validation] = await Album.aggregate<{
      _id: mongoose.Types.ObjectId;
      name: string;
      visibility: "public" | "private";
      user: mongoose.Types.ObjectId;
      createdAt: Date;
      ownedPhotosCount: number;
    }>([
      { $match: { _id: albumObjectId, user: userObjectId } },
      { $limit: 1 },
      {
        $lookup: {
          from: "photos",
          let: { photoIds: uniquePhotoObjectIds, currentUserId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$_id", "$$photoIds"] },
                    { $eq: ["$user", "$$currentUserId"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          as: "ownedPhotosMeta",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          visibility: 1,
          user: 1,
          createdAt: 1,
          ownedPhotosCount: {
            $ifNull: [{ $arrayElemAt: ["$ownedPhotosMeta.count", 0] }, 0],
          },
        },
      },
    ]);

    if (!validation) {
      throw createError("Album not found", 404);
    }

    if (validation.ownedPhotosCount !== uniquePhotoIds.length) {
      throw createError("One or more photos do not belong to this user", 403);
    }

    const writeResult = await PhotoAlbum.bulkWrite(
      uniquePhotoObjectIds.map((photoObjectId) => ({
        updateOne: {
          filter: {
            album: albumObjectId,
            photo: photoObjectId,
            user: userObjectId,
          },
          update: {
            $setOnInsert: {
              album: albumObjectId,
              photo: photoObjectId,
              user: userObjectId,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    await invalidateAlbumsCache(userId);
    await invalidateAlbumCache(albumId);

    return {
      album: {
        _id: validation._id,
        name: validation.name,
        visibility: validation.visibility,
        user: validation.user,
        createdAt: validation.createdAt,
      },
      stats: {
        totalRequested: uniquePhotoIds.length,
        inserted: writeResult.upsertedCount,
        alreadyInAlbum: uniquePhotoIds.length - writeResult.upsertedCount,
      },
    };
  } catch (error) {
    throw error;
  }
};
