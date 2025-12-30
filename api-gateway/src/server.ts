/**
 * This is not a userion server yet!
 * This is only a minimal backend to get started.
 */
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import * as path from "path";
import cors from "cors";
import proxy from "express-http-proxy";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { isAuthenticated } from "./middleware/isAuth";


const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.use(morgan("dev"));

app.use(
  express.json({
    limit: "100mb",
  })
);

app.use(
  express.urlencoded({
    limit: "100mb",
    extended: true,
  })
);

app.use(cookieParser());
app.set("trust proxy", 1);

app.use("/assets", express.static(path.join(__dirname, "assets")));

// Fixed rate limiter - removed custom keyGenerator
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: any) => (req.user ? 1000 : 100), // reg users: 1000 requests, non-reg: 100
  message: {
    error: "too many requests in 15 minutes. please try again",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Remove keyGenerator - let express-rate-limit handle it automatically
});

app.use(limiter);

// Health check endpoint - before proxy
app.get("/gateway-health", (req, res) => {
  res.json({
    message: "API Gateway is healthy!",
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Chat App API Gateway",
    version: "1.0.0",
    services: {
      auth: `http://localhost:${process.env.AUTH_SERVICE_PORT}`,
      gateway: `http://localhost:${process.env.API_GATEWAY_PORT}`,
    },
  });
});

// app.use(
//   "/auth",
//   proxy(`http://localhost:${process.env.AUTH_SERVICE_PORT}`, {
//     proxyReqPathResolver: (req) => {
//       // Remove /auth prefix when forwarding to auth service
//       return req.url.replace("/auth", "");
//     },
//   })
// );

app.use(
  "/api/auth",
  proxy(`http://localhost:${process.env.AUTH_SERVICE_PORT}`, {
    proxyReqPathResolver: (req) => `/api/auth${req.url}`,
  })
);
app.use(
  "/api/user",
  proxy(`http://localhost:${process.env.USER_SERVICE_PORT}`, {
    proxyReqPathResolver: (req) => `/api/user${req.url}`,
  })
);


// user service is PROTECTED
app.use(
  "/api/user",
  isAuthenticated, // First verify the token
  proxy(`http://localhost:${process.env.USER_SERVICE_PORT}`, {
    proxyReqPathResolver: (req) => `/api/user${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq: any) => {
      // Pass the userId we extracted in the middleware to the user Service
      proxyReqOpts.headers['x-user-id'] = srcReq.headers['x-user-id'];
      return proxyReqOpts;
    }
  })
);

// chat service is PROTECTED
app.use(
  "/api/chat",
  isAuthenticated, // First verify the token
  proxy(`http://localhost:${process.env.CHAT_SERVICE_PORT}`, {
    proxyReqPathResolver: (req) => `/api/chat${req.url}`,
    proxyReqOptDecorator: (proxyReqOpts, srcReq: any) => {
      // Pass the chatId we extracted in the middleware to the chat Service
      proxyReqOpts.headers['x-user-id'] = srcReq.headers['x-user-id'];
      return proxyReqOpts;
    }
  })
);
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal server error now!!!",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

const port = process.env.API_GATEWAY_PORT || 8080;
const server = app.listen(port, () => {
  
  console.log(`Listening at http://localhost:${port}`); // Fixed syntax to see errors
  console.log(`Gateway health check: http://localhost:${port}/gateway-health`);
  });

server.on("error", console.error);
