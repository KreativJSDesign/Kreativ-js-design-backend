import { Router } from "express";
import etsyAuthRouter from "./etsy.auth.route";
import passport from "passport";
import {
  CreateOrderWebhook,
  DebugListings,
  EtsyWebhookHandler,
  GetScracthCardProducts,
} from "../../controllers/etsy.controller";
const router = Router();

router.use("/auth", etsyAuthRouter);
// router.get("/listings", passport.authenticate("jwt", { session: false }), GetScracthCardProducts);
router.get("/listings", GetScracthCardProducts);
router.get("/debug-listings", DebugListings);
router.post("/create-etsy-webhook", CreateOrderWebhook);
router.post("/etsy-webhook", EtsyWebhookHandler);
export default router;
