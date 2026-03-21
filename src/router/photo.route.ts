import { Router } from "express";
import {
  deletePhoto,
  getAllPhotos,
  getSinglePhoto,
  softDeletePhoto,
  updatePhoto,
  uploadPhoto,
} from "../controller/photo.controller";
import multer from "multer";
import { apiLimiter } from "../middleware/limiter.middleware";
import {
  isEmailVerified,
  needToChangePassword,
  protect,
  restrictTo,
} from "../middleware/auth.middleware";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();
router.use(protect);
router.use(isEmailVerified);
router.use(needToChangePassword);
router.use(apiLimiter);

router
  .route("/photo")
  .post(upload.single("photo"), uploadPhoto)
  .get(getAllPhotos);

router
  .route("/photo/:photoId")
  .get(getSinglePhoto)
  .patch(updatePhoto)
  .delete(softDeletePhoto);

router
  .route("/photo/:photoId/permanent")
  .delete(restrictTo("admin", "user"), deletePhoto);

router.route("/:userId/photo").get(getAllPhotos);

router.route("/:userId/photo/:photoId").get(getSinglePhoto);

export default router;
