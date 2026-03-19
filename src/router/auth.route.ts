import { Router } from "express";
import {
  forgotPassword,
  googleRedirect,
  login,
  logout,
  requestEmailVerify,
  resetPassword,
  signUp,
  verifyEmail,
} from "../controller/auth.controller";
import {
  loginLimiter,
  resetPasswordLimiter,
} from "../middleware/limiter.middleware";
import passport from "passport";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", loginLimiter, signUp);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", resetPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", resetPasswordLimiter, resetPassword);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

router.get(
  "/google/redirect",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/login",
    session: true,
  }),
  googleRedirect,
);

router.use(protect);

router.post("/verify-email/", verifyEmail);
router.post("/verify-email/request", requestEmailVerify);
router.post("/logout", logout);

export default router;
