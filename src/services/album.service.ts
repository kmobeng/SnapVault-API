import { RedisClient } from "../config/db.config";
import Album from "../model/album.model";
import Photo from "../model/photo.model";
import { createError } from "../utils/error.util";
import APIFeatures from "../utils/APIFeatures.util";
import mongoose from "mongoose";

export const createAlbumService = async (name: string, userId: any) => {
  try {
    const album = await Album.create({ name, user: userId });
    if (!album) {
      throw createError("Unable to create album", 400);
    }
    const albumsKeys = await RedisClient.keys(`album:${userId}:*`);
    if (albumsKeys.length !== 0) {
      await RedisClient.del(...albumsKeys);
    }
    return album;
  } catch (error) {
    throw error;
  }
};

export const getAllAlbumsService = async (userId: any, queryString: any) => {
  const albumsKey = `albums:${userId}:${JSON.stringify(queryString)}`;
  try {
    const cachedAlbums = await RedisClient.get(albumsKey);

    if (cachedAlbums) {
      return JSON.parse(cachedAlbums);
    }

    const features = new APIFeatures(Album.find({ user: userId }), queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const albums = await features.query.lean();

    await RedisClient.setex(albumsKey, 3600, JSON.stringify(albums));

    return albums;
  } catch (error) {
    throw error;
  }
};

export const getSingleAlbumService = async (
  albumId: string,
  userId: string,
) => {
  const albumKey = `album:${albumId}`;
  try {
    const cachedAlbum = await RedisClient.get(albumKey);

    if (cachedAlbum) {
      return JSON.parse(cachedAlbum);
    }

    if (!mongoose.Types.ObjectId.isValid(albumId)) {
      throw createError("Invalid album ID", 400);
    }

    const album = await Album.findOne({ _id: albumId, user: userId });

    if (!album) {
      throw createError("No album found", 404);
    }

    RedisClient.setex(albumKey, 3600, JSON.stringify(album));

    return album;
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
    const albumsKeys = await RedisClient.keys(`albums:${userId}:*`);

    if (albumsKeys.length !== 0) {
      await RedisClient.del(...albumsKeys);
    }
    await RedisClient.del(`album:${albumId}`);

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

    const albumsKeys = await RedisClient.keys(`albums:${userId}:*`);

    if (albumsKeys.length !== 0) {
      await RedisClient.del(...albumsKeys);
    }

    await RedisClient.del(`album:${albumId}`);

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

    const ownedPhotosCount = await Photo.countDocuments({
      _id: { $in: uniquePhotoIds },
      user: userId,
      isDeleted: false,
    });

    if (ownedPhotosCount !== uniquePhotoIds.length) {
      throw createError("One or more photos do not belong to this user", 403);
    }

    const updatedAlbum = await Album.findOneAndUpdate(
      { _id: albumId, user: userId },
      { $addToSet: { photos: { $each: uniquePhotoIds } } },
      { new: true },
    );

    if (!updatedAlbum) {
      throw createError("Album not found", 404);
    }

    const albumsKeys = await RedisClient.keys(`albums:${userId}:*`);
    if (albumsKeys.length !== 0) {
      await RedisClient.del(...albumsKeys);
    }
    await RedisClient.del(`album:${albumId}`);

    return updatedAlbum;
  } catch (error) {
    throw error;
  }
};
