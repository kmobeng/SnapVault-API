import { Router } from "express";
import {
  deletePhoto,
  getAllPhotos,
  getSinglePhoto,
  restorePhoto,
  softDeletePhoto,
  updatePhoto,
  uploadPhoto,
  viewdeletedPhotos,
} from "../controller/photo.controller";
import { apiLimiter } from "../middleware/limiter.middleware";
import {
  isEmailVerified,
  needToChangePassword,
  protect,
  restrictTo,
} from "../middleware/auth.middleware";
import upload from "../middleware/multer.middleware";

const router = Router();
router.use(protect);
router.use(isEmailVerified);
router.use(needToChangePassword);
router.use(apiLimiter);

router
  .route("/photo")
  .post(upload.array("photo", 10), uploadPhoto)
  .get(getAllPhotos);

router.route("/photo/trash").get(viewdeletedPhotos);

router.route("/photo/:photoId/restore").patch(restorePhoto);

router
  .route("/photo/:photoId/permanent")
  .delete(restrictTo("admin", "user"), deletePhoto);

router
  .route("/photo/:photoId")
  .get(getSinglePhoto)
  .patch(updatePhoto)
  .delete(softDeletePhoto);

router.route("/:userId/photo").get(getAllPhotos);

router.route("/:userId/photo/:photoId").get(getSinglePhoto);

export default router;
