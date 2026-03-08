import { Router } from "express";
import {
  forgotPassword,
  googleRedirect,
  login,
  resetPassword,
  signUp,
} from "../controller/auth.controller";
import { loginLimiter, resetPasswordLimiter } from "../middleware/limiter.middleware";
import passport from "passport";

const router = Router();

router.post("/signup", loginLimiter, signUp);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", resetPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", resetPasswordLimiter, resetPassword);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile","email"],
  }),
);


router.get(
  "/google/redirect",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/login",
    session: true,
  }),
  googleRedirect
);

export default router;
