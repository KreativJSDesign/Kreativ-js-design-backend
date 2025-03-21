import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from "passport-jwt";
import route from "./routes";
import { JwtPayload } from "./types/common";
import connectToDb from "./utils/dbConnection";
import { Request, Response, NextFunction } from "express";
import UserModel from "./model/userModel";
import dotenvExpand from "dotenv-expand";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
// import { fetchLatestOrders } from "./controllers/newOrder.controller";
import { fetchEmails } from "./controllers/email.controller";
import axios from "axios";
// Initialize environment variables
const env = dotenv.config();
dotenvExpand.expand(env);

// Validate required environment variables
const requiredEnvVars = [
  "PORT",
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "ETSY_CLIENT_ID",
  "FRONTEND_URL_LOCAL",
  "FRONTEND_URL_PROD",
  "REDIRECT_URI",
  "BACKEND_URL_LOCAL",
  "BACKEND_URL_PROD",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
  process.exit(1);
}

// Initialize Express application
const app = express();
const port = process.env.PORT;

app.use(cookieParser());
// Enable trust proxy to handle X-Forwarded-For header correctly
app.set("trust proxy", 1);

// Security Middlewares
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    keyGenerator: (req: any) => {
      const forwarded = req.headers["x-forwarded-for"];

      let ip = "";

      if (typeof forwarded === "string") {
        // If it's a string, split by comma to get the first IP
        ip = forwarded.split(",")[0].trim();
      } else if (Array.isArray(forwarded)) {
        // If it's an array, take the first element
        ip = forwarded[0].trim();
      } else {
        // Fallback to req.ip and remove port if present
        ip = req.ip.includes(":") ? req.ip.split(":")[0] : req.ip;
      }

      return ip;
    },
  }),
);

// Request logging
app.use(morgan("combined"));

// Configure CORS
const allowedOrigins = [
  process.env.FRONTEND_URL_LOCAL,
  process.env.FRONTEND_URL_PROD,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
  }),
);

// Body parser
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport JWT Strategy Configuration
const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || "",
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload: JwtPayload, done) => {
    try {
      const user = await UserModel.findById(jwtPayload.identifier).select(
        "-password",
      );
      return user ? done(null, user) : done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }),
);

// Database Connection
connectToDb();

// Routes
app.use("/api", route);
// cron.schedule("*/4 * * * *", fetchLatestOrders);
// cron.schedule("*/4 * * * *", fetchEmails);

console.log("⏳ Etsy order checker started. Running every 4 minutes...");
// Health Check Endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Error Handling Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

// Graceful shutdown
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
