import { NextFunction, Request, Response } from "express";
import { createError } from "../utils/error.util";
import { shareLinkCreateSchema } from "../validators/shareLink.validators";
import {
  createAlbumShareLinkService,
  getSharedAlbumByTokenService,
  revokeSingleAlbumShareLinkService,
} from "../services/shareLink.service";

export const createAlbumShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId } = req.params;
    if (!albumId) {
      throw createError("No album ID provided", 400);
    }

    const parsed = shareLinkCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }

    const shareLink = await createAlbumShareLinkService(
      albumId,
      req.currentUser._id.toString(),
      parsed.data.expiresIn,
    );

    res.status(201).json({
      status: "success",
      data: { shareLink },
    });
  } catch (error) {
    next(error);
  }
};

export const getSharedAlbumByToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.params;
    if (!token) {
      throw createError("No share token provided", 400);
    }

    const data = await getSharedAlbumByTokenService(token);

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const revokeSingleAlbumShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { albumId, shareLinkId } = req.params;
    if (!albumId || !shareLinkId) {
      throw createError("Album ID and share link ID are required", 400);
    }

    const link = await revokeSingleAlbumShareLinkService(
      albumId,
      req.currentUser._id.toString(),
      shareLinkId,
    );

    res.status(200).json({
      status: "success",
      data: { link },
    });
  } catch (error) {
    next(error);
  }
};
