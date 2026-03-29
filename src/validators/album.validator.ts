import { z } from "zod";

export const createAlbumSchema = z.object({
  name: z.string().min(1, "Album name is required"),
  visibility: z
    .enum(["private", "public"], {
      message: "Visibility must be 'private' or 'public'",
    })
    .default("private"),
});

export const updateAlbumSchema = z.object({
  name: z.string().min(1, "Album name is required"),
});

export const albumPhotosSchema = z.object({
  photoIds: z
    .array(z.string(), { message: "photoIds must be an array of valid IDs" })
    .min(1, "Please provide at least one photo ID"),
});
