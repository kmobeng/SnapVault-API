import { Router } from "express";
import { apiLimiter } from "../middleware/limiter.middleware";
import {
  isEmailVerified,
  needToChangePassword,
  protect,
} from "../middleware/auth.middleware";
import {
  createAlbumShareLink,
  getSharedAlbumByToken,
  revokeSingleAlbumShareLink,
} from "../controller/shareLink.controller";

const router = Router();

router.get("/share/:token", apiLimiter, getSharedAlbumByToken);

router.use(protect);
router.use(isEmailVerified);
router.use(needToChangePassword);
router.use(apiLimiter);

router.route("/album/:albumId/share").post(createAlbumShareLink);

router
  .route("/album/:albumId/share/:shareLinkId")
  .delete(revokeSingleAlbumShareLink);

export default router;
