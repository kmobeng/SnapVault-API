import { Router } from "express";
import {
  addPhotoToAlbum,
  createAlbum,
  getAllAlbums,
  getSingleAlbum,
  permanentlyDeleteSingleAlbum,
  removePhotosFromAlbum,
  restoreSingleAlbum,
  softDeleteAlbum,
  updateSingleAlbum,
  viewDeletedAlbums,
} from "../controller/album.controller";
import { apiLimiter } from "../middleware/limiter.middleware";
import {
  isEmailVerified,
  needToChangePassword,
  protect,
} from "../middleware/auth.middleware";

const router = Router();
router.use(protect);
router.use(isEmailVerified);
router.use(needToChangePassword);
router.use(apiLimiter);

router.route("/album").post(createAlbum).get(getAllAlbums);
router.route("/album/trash").get(viewDeletedAlbums);
router.route("/album/:albumId/permanent").delete(permanentlyDeleteSingleAlbum);
router.route("/album/:albumId/restore").patch(restoreSingleAlbum);
router.route("/album/:albumId/addPhotos").patch(addPhotoToAlbum);
router.route("/album/:albumId/removePhotos").delete(removePhotosFromAlbum);

router
  .route("/album/:albumId")
  .get(getSingleAlbum)
  .patch(updateSingleAlbum)
  .delete(softDeleteAlbum);

router.route("/:userId/album").get(getAllAlbums);

router.route("/:userId/album/:albumId").get(getSingleAlbum);

export default router;
