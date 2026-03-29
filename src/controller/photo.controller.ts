import { Request, Response, NextFunction } from "express";
import {
  deletePhotoService,
  getAllPhotosService,
  getSinglePhotoService,
  restorePhotoService,
  softDeletePhotoService,
  uploadMultiplePhotosService,
  updatePhotoService,
  uploadPhotoService,
  viewDeletedPhotosService,
} from "../services/photo.service";
import { createError } from "../utils/error.util";
import {
  getAllPhotosSchema,
  updatePhotoSchema,
  uploadPhotoSchema,
} from "../validators/photo.validator";

export const uploadPhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = uploadPhotoSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }
    const { title, description, visibility } = parsed.data;

    const userId = req.currentUser._id.toString();
    const files = req.files as Express.Multer.File[];
    const photo = req.file;

    let photoResult;
    if (files && files.length > 0) {
      photoResult = await uploadMultiplePhotosService(
        title,
        description,
        visibility,
        userId,
        files,
      );
    } else {
      photoResult = await uploadPhotoService(
        title,
        description,
        visibility,
        userId,
        photo,
      );
    }

    res.status(201).json({
      status: "success",
      accessToken: res.locals.token,
      data: { photo: photoResult },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPhotos = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = getAllPhotosSchema.safeParse(req.query);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }
    const userId = req.params.userId || req.currentUser._id.toString();
    const queryString = parsed.data;
    const photos = await getAllPhotosService(
      userId,
      req.currentUser._id.toString(),
      queryString,
    );

    if (photos.length === 0) {
      return res
        .status(200)
        .json({ message: "No photos found", accessToken: res.locals.token });
    }
    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      result: photos.length,
      data: { photos },
    });
  } catch (error) {
    next(error);
  }
};

export const getSinglePhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { photoId } = req.params;
    if (!photoId) {
      throw createError("No photo id provided", 400);
    }
    const userId = req.params.userId || req.currentUser._id.toString();
    const photo = await getSinglePhotoService(
      photoId,
      userId,
      req.currentUser._id.toString(),
    );

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      data: photo,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updatePhotoSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }
    const { title, visibility, description } = req.body;

    const { photoId } = req.params;
    if (!photoId) {
      throw createError("No photoId provided", 400);
    }
    const userId = req.currentUser._id.toString();
    const photo = await updatePhotoService(
      title,
      visibility,
      description,
      photoId,
      userId,
    );

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      data: photo,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { photoId } = req.params;
    if (!photoId) {
      throw createError("Please provide photoId", 400);
    }
    const userId = req.params.userId || req.currentUser._id.toString();
    await deletePhotoService(photoId, userId, req.currentUser.role);

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
    });
  } catch (error) {
    next(error);
  }
};

export const softDeletePhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { photoId } = req.params;
    if (!photoId) {
      throw createError("Please provide photoId", 400);
    }

    await softDeletePhotoService(photoId, req.currentUser._id.toString());

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
    });
  } catch (error) {
    next(error);
  }
};

export const restorePhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { photoId } = req.params;
    if (!photoId) {
      throw createError("Please provide photoId", 400);
    }

    const photo = await restorePhotoService(
      photoId,
      req.currentUser._id.toString(),
    );

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      data: photo,
    });
  } catch (error) {
    next(error);
  }
};

export const viewdeletedPhotos = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.currentUser._id.toString();
    const photos = await viewDeletedPhotosService(userId);

    if (photos.length === 0) {
      return res.status(200).json({
        message: "No deleted photos found",
        accessToken: res.locals.token,
      });
    }
    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      result: photos.length,
      data: { photos },
    });
  } catch (error) {
    next(error);
  }
};
