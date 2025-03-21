import { Router } from "express";
import { adminLogin, adminRegister } from "../controllers/auth.controller";
const router = Router();

router.post("/admin/login", adminLogin);
router.post("/admin/register", adminRegister);

export default router;
