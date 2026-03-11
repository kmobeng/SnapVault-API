import { Router } from "express";
import {
  createAlbum,
  deleteSingleAlbum,
  getAllAlbums,
  getSingleAlbum,
  updateSingleAlbum,
} from "../controller/album.controller";
import { apiLimiter } from "../middleware/limiter.middleware";
import { needToChangePassword, protect } from "../middleware/auth.middleware";

const router = Router();
router.use(protect);
router.use(needToChangePassword)
router.use(apiLimiter);

router.route("/album").post(createAlbum).get(getAllAlbums);

router
  .route("/album/:albumId")
  .get(getSingleAlbum)
  .patch(updateSingleAlbum)
  .delete(deleteSingleAlbum);

router.route("/:userId/album").get(getAllAlbums);

router.route("/:userId/album/:albumId").get(getSingleAlbum);

export default router;
