import { Router } from "express";
import {
  deletePhoto,
  getAllPhotos,
  getSinglePhoto,
  updatePhoto,
  uploadPhoto,
} from "../controller/photo.controller";
import multer from "multer";
import { apiLimiter } from "../middleware/limiter.middleware";
import { setRole } from "../middleware/setRoleAdmin.middleware";
import { protect, restrictTo } from "../middleware/auth.middleware";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();
router.use(protect);
router.use(apiLimiter);

router
  .route("/photo")
  .post(upload.single("photo"), uploadPhoto)
  .get(getAllPhotos);

router
  .route("/photo/:photoId")
  .get(getSinglePhoto)
  .patch(updatePhoto)
  .delete(deletePhoto);

router.route("/:userId/photo").get(getAllPhotos);

router.route("/:userId/photo/:photoId").get(getSinglePhoto);

router.use(restrictTo("admin"));

router.route("/:userId/photo/:photoId").delete(setRole, deletePhoto);
export default router;
