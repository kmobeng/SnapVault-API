import { Request, Response, NextFunction } from "express";
import {
  deletePhotoService,
  getAllPhotosService,
  getSinglePhotoService,
  softDeletePhotoService,
  updatePhotoService,
  uploadPhotoService,
} from "../services/photo.service";
import { createError } from "../utils/error.util";

export const uploadPhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { title, description, visibility, albumId } = req.body;

    const userId = req.currentUser._id.toString();
    const photo = req.file;

    const photoResult = await uploadPhotoService(
      title,
      description,
      visibility,
      userId,
      photo,
      albumId?.toString(),
    );

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
    const userId = req.params.userId || req.currentUser._id.toString();
    const photos = await getAllPhotosService(
      userId,
      req.currentUser._id.toString(),
      req.query,
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
    const { title, visibility } = req.body;
    const { photoId } = req.params;
    if (!photoId) {
      throw createError("No photoID provided", 400);
    }
    const userId = req.currentUser._id.toString();
    const photo = await updatePhotoService(title, visibility, photoId, userId);

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
    const photo = await deletePhotoService(photoId, userId, req.params.role);

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

    const photo = await softDeletePhotoService(
      photoId,
      req.currentUser._id.toString(),
    );

    res.status(200).json({
      status: "success",
    });
  } catch (error) {
    next(error);
  }
};
