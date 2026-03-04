import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message:
    "Too many login requests from this IP, please try again in 15 minutes",
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: "Too many requests from this IP, please try again in 1 minutes",
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 *1000,
  max: 5,
  message:"Too many forgot password request from this IP, pleae try again in 15 minutes"
})