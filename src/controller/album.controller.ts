import { NextFunction, Request, Response } from "express";
import {
  addPhotosToAlbumService,
  createAlbumService,
  deleteSingleAlbumPermanentlyService,
  getAllAlbumsService,
  removePhotosFromAlbumService,
  restoreAlbumService,
  getSingleAlbumService,
  updateSingleAlbumService,
  viewDeletedAlbumsService,
  softDeleteAlbumService,
} from "../services/album.service";
import { createError } from "../utils/error.util";
import {
  albumPhotosSchema,
  createAlbumSchema,
  updateAlbumSchema,
} from "../validators/album.validator";

export const createAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = createAlbumSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }

    const { name, visibility } = parsed.data;
    const userId = req.currentUser._id;
    const album = await createAlbumService(name, visibility, userId.toString());
    res.status(201).json({ status: "success", data: album });
  } catch (error) {
    next(error);
  }
};

export const getAllAlbums = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.params.userId || req.currentUser._id;
    const albums = await getAllAlbumsService(
      userId.toString(),
      req.currentUser._id.toString(),
      req.query,
    );
    if (albums.length < 1) {
      return res.status(404).json({ message: "No albums found" });
    }

    res.status(200).json({
      status: "success",

      result: albums.length,
      data: albums,
    });
  } catch (error) {
    next(error);
  }
};

export const getSingleAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album id provided", 400);
    }
    const userId = req.params.userId || req.currentUser._id.toString();
    const album = await getSingleAlbumService(
      albumId,
      userId,
      req.currentUser._id.toString(),
      req.query,
    );

    res.status(200).json({
      status: "success",

      data: { album },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSingleAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateAlbumSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }

    const userId = req.params.userId || req.currentUser._id.toString();
    const { name,visibility } = parsed.data;
    const album = await updateSingleAlbumService(albumId, userId, name,visibility);

    res.status(200).json({ status: "success", data: album });
  } catch (error) {
    next(error);
  }
};

export const permanentlyDeleteSingleAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("Invalid album ID", 400);
    }

    const userId = req.params.userId || req.currentUser._id.toString();
    await deleteSingleAlbumPermanentlyService(albumId, userId);
    res.status(200).json({
      status: "success",
    });
  } catch (error) {
    next(error);
  }
};

export const addPhotoToAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }

    const parsed = albumPhotosSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }
    const userId = req.currentUser._id.toString();
    const { photoIds } = parsed.data;
    const album = await addPhotosToAlbumService(albumId, userId, photoIds);
    res.status(200).json({ status: "success", data: album });
  } catch (error) {
    next(error);
  }
};

export const removePhotosFromAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }

    const parsed = albumPhotosSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }

    const userId = req.currentUser._id.toString();
    const { photoIds } = parsed.data;
    const result = await removePhotosFromAlbumService(
      albumId,
      userId,
      photoIds,
    );

    res.status(200).json({
      status: "success",

      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const viewDeletedAlbums = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.currentUser._id.toString();
    const albums = await viewDeletedAlbumsService(userId);
    if (albums.length < 1) {
      return res.status(404).json({ message: "No deleted albums found" });
    }

    res.status(200).json({
      status: "success",
      result: albums.length,
      data: albums,
    });
  } catch (error) {
    next(error);
  }
};

export const softDeleteAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }

    const userId = req.currentUser._id.toString();
    await softDeleteAlbumService(albumId, userId);

    res.status(200).json({
      status: "success",
    });
  } catch (error) {
    next(error);
  }
};

export const restoreSingleAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }

    const userId = req.currentUser._id.toString();
    const album = await restoreAlbumService(albumId, userId);

    res.status(200).json({
      status: "success",
      data: album,
    });
  } catch (error) {
    next(error);
  }
};