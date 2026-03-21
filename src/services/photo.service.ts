import mongoose, { Types } from "mongoose";
import Photo from "../model/photo.model";
import { createError } from "../utils/error.util";
import { cloudinary, RedisClient } from "../config/db.config";
import APIFeatures from "../utils/APIFeatures.util";
import User from "../model/user.model";
import logger from "../config/wiston.config";

export const uploadPhotoService = async (
  title: string,
  description: string,
  visibility: string,
  userId: string,
  photo: any,
  albumId?: any,
) => {
  let publicId;
  try {
    if (
      (albumId && !mongoose.Types.ObjectId.isValid(albumId)) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw createError("Invalid user id or album id", 400);
    }

    if (!photo || !photo.buffer) {
      throw createError("No photo file provided", 400);
    }

    const uploadResult = await new Promise<any>((resolve, reject) => {
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

      stream.end(photo.buffer);
    });

    const url = uploadResult.secure_url;
    publicId = uploadResult.public_id;

    const createdPhoto = await Photo.create({
      title,
      description,
      visibility,
      url,
      publicId,
      user: userId,
      album: albumId,
    });

    const keys = await RedisClient.keys(`photos:${userId}:*`);
    if (keys.length > 0) {
      await RedisClient.del(...keys);
    }

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

export const getAllPhotosService = async (
  userId: string,
  reqUserId: string,
  queryString: any,
) => {
  if (userId !== reqUserId) {
    queryString.visibility = "public";
  }

  const normalizedQuery = Object.keys(queryString)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = queryString[key];
      return acc;
    }, {});

  const photosKey = `photos:${userId}:${JSON.stringify(normalizedQuery)}`;
  try {
    const cachedPhotos = await RedisClient.get(photosKey);

    if (cachedPhotos) {
      return JSON.parse(cachedPhotos);
    }
    const filter: any = { user: userId, isDeleted: false };

    const features = new APIFeatures(Photo.find(filter), queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const photos = await features.query;

    await RedisClient.setex(photosKey, 3600, JSON.stringify(photos));

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
    if (
      !mongoose.Types.ObjectId.isValid(photoId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw createError("Invalid user ID or photo ID", 400);
    }

    const isOwner = userId === reqUserId;
    const photoKey = `photo:${photoId}:${isOwner ? "owner" : "public"}`;

    const cachedPhoto = await RedisClient.get(photoKey);

    if (cachedPhoto) {
      return JSON.parse(cachedPhoto);
    }
    const query: any = { _id: photoId, user: userId, isDeleted: false };
    if (!isOwner) {
      query.visibility = "public";
    }

    const photo = await Photo.findOne(query);
    if (!photo) {
      throw createError("No photo found", 404);
    }

    RedisClient.setex(photoKey, 3600, JSON.stringify(photo));

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
    const photosKey = await RedisClient.keys(`photos:${userId}:*`);

    if (photosKey.length !== 0) {
      await RedisClient.del(...photosKey);
    }
    await RedisClient.del(`photo:${photoId}:owner`);
    await RedisClient.del(`photo:${photoId}:public`);

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

    // Delete the photo from Cloudinary
    await cloudinary.uploader.destroy(photo.publicId);

    // Invalidate related Redis cache
    const photosKey = await RedisClient.keys(`photos:${userId}:*`);

    if (photosKey.length !== 0) {
      await RedisClient.del(...photosKey);
    }
    await RedisClient.del(`photo:${userId}:${photoId}:owner`);
    await RedisClient.del(`photo:${userId}:${photoId}:public`);

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

    // Invalidate related Redis cache
    const photosKey = await RedisClient.keys(`photos:${userId}:*`);

    if (photosKey.length !== 0) {
      await RedisClient.del(...photosKey);
    }
    await RedisClient.del(`photo:${userId}:${photoId}:owner`);
    await RedisClient.del(`photo:${userId}:${photoId}:public`);

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

    const photosKey = await RedisClient.keys(`photos:${userId}:*`);

    if (photosKey.length !== 0) {
      await RedisClient.del(...photosKey);
    }
    await RedisClient.del(`photo:${photoId}:owner`);
    await RedisClient.del(`photo:${photoId}:public`);

    return photo;
  } catch (error) {
    throw error;
  }
};
