import mongoose from "mongoose";
import sharp from "sharp";
import Photo from "../model/photo.model";
import { createError } from "../utils/error.util";
import { cloudinary, RedisClient } from "../config/db.config";
import APIFeatures from "../utils/APIFeatures.util";
import logger from "../config/wiston.config";
import PhotoAlbum from "../model/photoAlbum.model";
import {
  invalidateAlbumCache,
  invalidateAlbumCachesForPhoto,
  invalidatePhotosCache,
  invalidateSinglePhotoCache,
} from "../utils/redis.util";
import { enqueueCloudinaryDeleteRetryJob } from "../utils/cloudinaryDeleteQueue.util";

const uploadCompressedPhotoToCloudinary = async (buffer: Buffer) => {
  const compressedBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "snapvault",
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

    if (!createdPhoto) {
      throw createError("Unable to create photo", 400);
    }

    await invalidatePhotosCache(userId);
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
  description: string,
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
      { $set: { title, visibility, description } },
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

    // External cleanup is best-effort so DB delete does not fail on Cloudinary errors.
    if (photo.publicId) {
      try {
        await cloudinary.uploader.destroy(photo.publicId);
      } catch (cloudinaryError) {
        logger.error("Cloudinary cleanup failed after DB photo delete", {
          photoId: String(photo._id),
          publicId: photo.publicId,
          error: cloudinaryError,
        });

        try {
          await enqueueCloudinaryDeleteRetryJob({
            publicId: photo.publicId,
            photoId: String(photo._id),
            source: "photo-permanent-delete",
          });
        } catch (queueError) {
          logger.error("Failed to enqueue Cloudinary delete retry job", {
            photoId: String(photo._id),
            publicId: photo.publicId,
            error: queueError,
          });
        }
      }
    }

    // Invalidate related Redis cache
    await invalidatePhotosCache(String(photo.user));
    await invalidateSinglePhotoCache(photoId);

    await Promise.all(
      albumIds.map((albumId) =>
        invalidateAlbumCache(String(albumId)),
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
