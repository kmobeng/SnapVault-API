import { z } from "zod";

export const updateMeSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "New password must be 8 characters or more"),
    newPasswordConfirm: z
      .string()
      .min(8, "Password confirmation must be 8 characters or more"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "Passwords don't match",
  });
