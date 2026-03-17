import { NextFunction, Request, Response } from "express";
import {
  createAlbumService,
  deleteSingleAlbumService,
  getAllAlbumsService,
  getSingleAlbumService,
  updateSingleAlbumService,
} from "../services/album.service";
import { createError } from "../utils/error.util";

export const createAlbum = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.currentUser._id;

    const { name } = req.body;
    if (!name) {
      return createError("Please provide name of album", 400);
    }
    const album = await createAlbumService(name, userId);
    res
      .status(201)
      .json({ status: "success", accessToken: res.locals.token, data: album });
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
    const albums = await getAllAlbumsService(userId, req.query);
    if (albums.length < 1) {
      return res.status(404).json({ message: "No albums found" });
    }

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
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
    const album = await getSingleAlbumService(albumId, userId);

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
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
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }
    const userId = req.params.userId || req.currentUser._id.toString();
    const { name } = req.body;
    const album = await updateSingleAlbumService(albumId, userId, name);

    res
      .status(200)
      .json({ status: "success", accessToken: res.locals.token, data: album });
  } catch (error) {
    next(error);
  }
};

export const deleteSingleAlbum = async (
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
    const album = await deleteSingleAlbumService(albumId, userId);
    res
      .status(200)
      .json({
        status: "success",
        accessToken: res.locals.token,
      });
  } catch (error) {
    next(error);
  }
};
