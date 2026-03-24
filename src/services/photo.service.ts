import mongoose from "mongoose";
import sharp from "sharp";
import Photo from "../model/photo.model";
import { createError } from "../utils/error.util";
import { cloudinary, RedisClient } from "../config/db.config";
import APIFeatures from "../utils/APIFeatures.util";
import logger from "../config/wiston.config";
import PhotoAlbum from "../model/photoAlbum.model";
import { invalidateSingleAlbumCacheService } from "./album.service";

const getPhotosCacheIndexKey = (userId: string) => `photos:index:${userId}`;

const trackPhotosCacheKey = async (userId: string, cacheKey: string) => {
  await RedisClient.sadd(getPhotosCacheIndexKey(userId), cacheKey);
};

const invalidatePhotosCache = async (userId: string) => {
  const indexKey = getPhotosCacheIndexKey(userId);
  const cachedKeys = await RedisClient.smembers(indexKey);

  if (cachedKeys.length > 0) {
    await RedisClient.del(...cachedKeys);
  }

  await RedisClient.del(indexKey);
};

const getPhotoCacheKeys = (photoId: string) => [
  `photo:${photoId}:owner`,
  `photo:${photoId}:public`,
];

const invalidateSinglePhotoCache = async (photoId: string) => {
  await RedisClient.del(...getPhotoCacheKeys(photoId));
};

const invalidateAlbumCachesForPhoto = async (photoId: string) => {
  const albumIds = await PhotoAlbum.distinct("album", { photo: photoId });

  if (albumIds.length === 0) {
    return;
  }

  await Promise.all(
    albumIds.map((albumId) =>
      invalidateSingleAlbumCacheService(String(albumId)),
    ),
  );
};

const uploadCompressedPhotoToCloudinary = async (buffer: Buffer) => {
  const compressedBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "photo-vault",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      },
    );

    stream.end(compressedBuffer);
  });
};

export const uploadPhotoService = async (
  title: string,
  description: string,
  visibility: string,
  userId: string,
  photo: any,
) => {
  let publicId;
  try {
    if (!photo || !photo.buffer) {
      throw createError("No photo file provided", 400);
    }

    const uploadResult = await uploadCompressedPhotoToCloudinary(photo.buffer);

    const url = uploadResult.secure_url;
    publicId = uploadResult.public_id;

    const createdPhoto = await Photo.create({
      title,
      description,
      visibility,
      url,
      publicId,
      user: userId,
    });

    await invalidatePhotosCache(userId);

    if (!createdPhoto) {
      throw createError("Unable to create photo", 400);
    }
    return createdPhoto;
  } catch (error) {
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
        logger.info("Cloudinary cleanup successful");
      } catch (deleteError) {
        logger.error("Failed to cleanup Cloudinary:", deleteError);
      }
    }
    throw error;
  }
};

export const uploadMultiplePhotosService = async (
  title: string,
  description: string,
  visibility: string,
  userId: string,
  photos: any[],
) => {
  const uploadedPublicIds: string[] = [];
  try {
    if (!Array.isArray(photos) || photos.length === 0) {
      throw createError("No photo files provided", 400);
    }

    const uploadedPhotos = await Promise.all(
      photos.map(async (photo) => {
        if (!photo || !photo.buffer) {
          throw createError("Invalid photo file provided", 400);
        }

        const uploadResult = await uploadCompressedPhotoToCloudinary(
          photo.buffer,
        );
        uploadedPublicIds.push(uploadResult.public_id);

        return {
          title,
          description,
          visibility,
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          user: userId,
        };
      }),
    );

    const createdPhotos = await Photo.insertMany(uploadedPhotos);

    await invalidatePhotosCache(userId);

    return createdPhotos;
  } catch (error) {
    if (uploadedPublicIds.length > 0) {
      await Promise.allSettled(
        uploadedPublicIds.map((publicId) =>
          cloudinary.uploader.destroy(publicId),
        ),
      );
    }
    throw error;
  }
};

export const getAllPhotosService = async (
  userId: string,
  reqUserId: string,
  queryString: any,
) => {
  const query = { ...queryString };

  if (userId !== reqUserId) {
    query.visibility = "public";
  }

  const normalizedQuery = Object.keys(query)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = query[key];
      return acc;
    }, {});

  const photosKey = `photos:${userId}:${JSON.stringify(normalizedQuery)}`;
  try {
    const cachedPhotos = await RedisClient.get(photosKey);

    if (cachedPhotos) {
      return JSON.parse(cachedPhotos);
    }
    const filter: any = { user: userId, isDeleted: false };

    const features = new APIFeatures(Photo.find(filter), query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const photos = await features.query;

    await RedisClient.setex(photosKey, 3600, JSON.stringify(photos));
    await trackPhotosCacheKey(userId, photosKey);

    return photos;
  } catch (error) {
    throw error;
  }
};

export const getSinglePhotoService = async (
  photoId: any,
  userId: string,
  reqUserId: string,
) => {
  try {
    // Validate photoId and userId
    if (
      !mongoose.Types.ObjectId.isValid(photoId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw createError("Invalid user ID or photo ID", 400);
    }

    // Check if the requested photo belongs to the user or is public
    const isOwner = userId === reqUserId;
    const photoKey = `photo:${photoId}:${isOwner ? "owner" : "public"}`;

    // Check Redis cache first
    const cachedPhoto = await RedisClient.get(photoKey);

    // If cached photo exists, return it
    if (cachedPhoto) {
      return JSON.parse(cachedPhoto);
    }

    // If not in cache, query the database
    const query: any = { _id: photoId, user: userId, isDeleted: false };
    // If the requester is not the owner, only allow access to public photos
    if (!isOwner) {
      query.visibility = "public";
    }
    
    const photo = await Photo.findOne(query);
    if (!photo) {
      throw createError("No photo found", 404);
    }
    // Cache the photo in Redis for future requests
    await RedisClient.setex(photoKey, 3600, JSON.stringify(photo));

    return photo;
  } catch (error) {
    throw error;
  }
};

export const updatePhotoService = async (
  title: string,
  visibility: string,
  photoId: any,
  userId: string,
) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(photoId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw createError("Invalid user ID or photo ID", 400);
    }

    const photo: any = await Photo.findOneAndUpdate(
      { _id: photoId, user: userId, isDeleted: false },
      { $set: { title, visibility } },
      { new: true, runValidators: true },
    );
    if (!photo) {
      throw createError("No photo Id", 400);
    }
    await invalidatePhotosCache(userId);
    await invalidateSinglePhotoCache(photoId);

    return photo;
  } catch (error) {
    throw error;
  }
};

export const deletePhotoService = async (
  photoId: any,
  userId: string,
  role: string,
) => {
  try {
    // Validate photoId and userId
    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      throw createError("Invalid photo ID", 400);
    }

    // If role is not provided, only allow deletion of photos owned by the user
    let query: any;

    if (role === "admin") {
      query = {
        _id: photoId,
        $or: [{ user: userId }, { visibility: "public" }],
      };
    } else {
      query = { _id: photoId, user: userId };
    }

    // Find and delete the photo
    const photo: any = await Photo.findOneAndDelete(query);

    if (!photo) {
      throw createError("No photo found", 404);
    }

    const albumIds = await PhotoAlbum.distinct("album", { photo: photo._id });

    await PhotoAlbum.deleteMany({ photo: photo._id });

    // Delete the photo from Cloudinary
    await cloudinary.uploader.destroy(photo.publicId);

    // Invalidate related Redis cache
    await invalidatePhotosCache(String(photo.user));
    await invalidateSinglePhotoCache(photoId);

    await Promise.all(
      albumIds.map((albumId) =>
        invalidateSingleAlbumCacheService(String(albumId)),
      ),
    );

    return photo;
  } catch (error) {
    throw error;
  }
};

export const softDeletePhotoService = async (photoId: any, userId: string) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      throw createError("Invalid photo ID", 400);
    }

    const photo: any = await Photo.findOneAndUpdate(
      { _id: photoId, user: userId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    if (!photo) {
      throw createError("No photo found", 404);
    }

    // Invalidate related Redis cache
    await invalidatePhotosCache(userId);
    await invalidateSinglePhotoCache(photoId);
    await invalidateAlbumCachesForPhoto(photoId);

    return photo;
  } catch (error) {
    throw error;
  }
};

export const restorePhotoService = async (photoId: any, userId: string) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      throw createError("Invalid photo ID", 400);
    }

    const photo: any = await Photo.findOneAndUpdate(
      { _id: photoId, user: userId, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } },
      { new: true },
    );

    if (!photo) {
      throw createError("No photo found", 404);
    }

    await invalidatePhotosCache(userId);
    await invalidateSinglePhotoCache(photoId);
    await invalidateAlbumCachesForPhoto(photoId);

    return photo;
  } catch (error) {
    throw error;
  }
};

export const viewDeletedPhotosService = async (userId: string) => {
  try {
    const photos = await Photo.find({ user: userId, isDeleted: true });
    return photos;
  } catch (error) {
    throw error;
  }
};
