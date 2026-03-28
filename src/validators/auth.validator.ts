import * as z from "zod";

export const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.email("Please provide a valid email"),
    password: z.string().min(8, "Password should be 8 characters or more"),
    passwordConfirm: z
      .string()
      .min(8, "Password confirmation should be 8 characters or more"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords don't match",
  });

export const loginSchema = z.object({
  email: z.email("Please provide a valid email"),
  password: z.string().min(8, "Password should be 8 characters or more"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Please provide a valid email"),
});

export const resetPasswordTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password should be 8 characters or more"),
    passwordConfirm: z
      .string()
      .min(8, "Password confirmation should be 8 characters or more"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords don't match",
  });
  
  export const verifyEmailTokenSchema = z.object({
    emailToken: z.string().min(1, "Token is required"),
  });
