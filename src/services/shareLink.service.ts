import crypto from "crypto";
import mongoose from "mongoose";
import Album from "../model/album.model";
import Photo from "../model/photo.model";
import PhotoAlbum from "../model/photoAlbum.model";
import ShareLink from "../model/shareLInk.model";
import { createError } from "../utils/error.util";

const calculateExpiresAt = (expiresIn: "1d" | "7d" | "30d" | "never") => {
  if (expiresIn === "never") {
    return null;
  }

  const dayToMilliseconds: Record<"1d" | "7d" | "30d", number> = {
    "1d": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + dayToMilliseconds[expiresIn]);
};

const hashShareToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const revokeShareLinksForAlbumService = async (
  albumId: string,
  userId: string,
) => {
  if (
    !mongoose.Types.ObjectId.isValid(albumId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw createError("Invalid album ID or user ID", 400);
  }

  await ShareLink.updateOne(
    {
      album: albumId,
      user: userId,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    },
  );
};

export const createAlbumShareLinkService = async (
  albumId: string,
  userId: string,
  expiresIn: "1d" | "7d" | "30d" | "never",
) => {
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    throw createError("Invalid album ID", 400);
  }

  const album = await Album.findOne({
    _id: albumId,
    user: userId,
    isDeleted: false,
    visibility: "public",
  }).select("_id");

  if (!album) {
    throw createError(
      "Album must exist and be public before creating a share link",
      400,
    );
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashShareToken(rawToken);
  const expiresAt = calculateExpiresAt(expiresIn);

  // One active link per album: revoke previous active link before issuing a new one.
  await ShareLink.updateOne(
    {
      album: albumId,
      user: userId,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    },
  );

  const createdShareLink = await ShareLink.create({
    album: albumId,
    user: userId,
    tokenHash,
    expiresAt,
  });

  return {
    id: String(createdShareLink._id),
    token: rawToken,
    sharePath: `/api/share/${rawToken}`,
    expiresAt,
    revokedAt: null,
    createdAt: createdShareLink.createdAt,
  };
};

export const getSharedAlbumByTokenService = async (token: string) => {
  const tokenHash = hashShareToken(token);

  const shareLink = await ShareLink.findOne({
    tokenHash,
    revokedAt: null,
  }).lean();

  if (!shareLink) {
    throw createError("Invalid or revoked share link", 404);
  }

  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    throw createError("Share link has expired", 410);
  }

  const album = await Album.findOne({
    _id: shareLink.album,
    user: shareLink.user,
    isDeleted: false,
    visibility: "public",
  }).lean();

  if (!album) {
    throw createError("Shared album is unavailable", 404);
  }

  const photoLinks = await PhotoAlbum.find({
    album: shareLink.album,
    user: shareLink.user,
  })
    .select("photo")
    .lean();

  const photoIds = photoLinks.map((row: any) => row.photo);

  let photos: any[] = [];
  if (photoIds.length > 0) {
    photos = await Photo.find({
      _id: { $in: photoIds },
      user: shareLink.user,
      isDeleted: false,
      visibility: "public",
    }).lean();
  }

  return {
    album: {
      ...album,
      photos,
    },
    shareLink: {
      id: String(shareLink._id),
      expiresAt: shareLink.expiresAt,
      createdAt: shareLink.createdAt,
    },
  };
};

export const revokeSingleAlbumShareLinkService = async (
  albumId: string,
  userId: string,
  shareLinkId: string,
) => {
  if (
    !mongoose.Types.ObjectId.isValid(albumId) ||
    !mongoose.Types.ObjectId.isValid(shareLinkId)
  ) {
    throw createError("Invalid album ID or share link ID", 400);
  }

  const shareLink = await ShareLink.findOneAndUpdate(
    {
      _id: shareLinkId,
      album: albumId,
      user: userId,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    },
    { new: true },
  ).lean();

  if (!shareLink) {
    throw createError("Share link not found or already revoked", 404);
  }

  return {
    id: String(shareLink._id),
    revokedAt: shareLink.revokedAt,
  };
};
