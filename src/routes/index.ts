import express, { Application } from "express";
import authRouter from "./auth.route";
import etsyRouter from "./etsyRoutes/etsy.route";
import templateRouter from "./templateRoutes/template.route";
import customRoute from "./customCardRoutes/customCard.route";
import cronRouter from "./cronRoutes/cron.route";
const route: Application = express();

route.use("/auth", authRouter);
route.use("/etsy", etsyRouter);
route.use("/template", templateRouter);
route.use("/custom", customRoute);
route.use("/cron", cronRouter);

export default route;
