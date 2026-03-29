import { z } from "zod";

export const uploadPhotoSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    visibility: z.enum(["private", "public"], { message: "Visibility must be 'private' or 'public'" }).default("public"),
});

export const getAllPhotosSchema = z.object({
    page: z.number().min(1, "Page must be at least 1").default(1),
    limit: z.number().min(1, "Limit must be at least 1").default(10),
    sort: z.string().optional(),
    fields: z.string().optional(),
    filters: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        visibility: z.enum(["private", "public"]).optional(),
    }).optional(),
});

export const updatePhotoSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    visibility: z.enum(["private", "public"], { message: "Visibility must be 'private' or 'public'" }).optional().default("public"),
});