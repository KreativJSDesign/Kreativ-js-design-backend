import { Router } from "express";
import {
  handleRedirect,
  handleRefreshToken,
  initiateAuth,
} from "../../controllers/etsy.auth.controller";

const router = Router();

router.get("/", initiateAuth);
router.get("/oauth/redirect", handleRedirect);
router.post("/refresh-token", handleRefreshToken);

export default router;
