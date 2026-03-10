import { Router } from "express";
import {
  changePassword,
  deleteUser,
  getAllUsers,
  getMe,
  getSingleUser,
  updateMe,
} from "../controller/user.controller";
import { apiLimiter } from "../middleware/limiter.middleware";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);
router.use(apiLimiter);

router.get("/me", getMe, getSingleUser);
router.patch("/update-me", updateMe);
router.patch("/change-password", changePassword);

router.use(restrictTo("admin"));
router.route("/").get(getAllUsers);

router.route("/:userId").get(getSingleUser).delete(deleteUser);

export default router;
