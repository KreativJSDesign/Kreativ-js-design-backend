import { Router } from "express";
import {
  deleteTemplate,
  getAllTemplates,
  getSingleTemplate,
  selectedTemplate,
  uploadTemplate,
} from "../../controllers/template.controller";
import upload from "../../utils/upload";
import passport from "passport";
const router = Router();

router.post("/upload", upload, uploadTemplate);
router.get(
  "/all",
  passport.authenticate("jwt", { session: false }),
  getAllTemplates,
);
router.post(
  "/delete-template",
  passport.authenticate("jwt", { session: false }),
  deleteTemplate,
);
router.post(
  "/selectedTemplate",
  passport.authenticate("jwt", { session: false }),
  selectedTemplate,
);
router.get(
  "/single-template/:templateId",
  passport.authenticate("jwt", { session: false }),
  getSingleTemplate,
);

export default router;
