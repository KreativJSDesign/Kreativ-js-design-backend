import { Router } from "express";
import {
  CustomizeCard,
  ScratchCardInfo,
  SingleCardInfo,
} from "../../controllers/customizeCard.controller";

const customRoute = Router();

customRoute.post("/update-custom-card", CustomizeCard);
customRoute.get("/single-card/:cardId", SingleCardInfo);
customRoute.get("/scratch-card/:cardId", ScratchCardInfo);

export default customRoute;
