import dotenv from "dotenv";
dotenv.config();

import express from "express";

//import * as path from "path";

import cookieParser from "cookie-parser";

import { errorMiddleware } from "@shared/error-handler/error-middleware";
//const swaggerDocument = require("./swagger-output.json");
import cors from "cors";
import { corsOptions } from "@shared/middleware";
//import router from "./routes/auth.router"
import prisma from "./database";
//import { initPublisher } from "./utils/messaging/event-publishing";
const app = express();

app.use(express.json());
//app.use("/assets", express.static(path.join(__dirname, "assets")));

app.use(express.json());

app.use(cookieParser());
// Your routes here
app.use(cors(corsOptions()));

//app.use("/api/auth", router);
// app.get("/docs-json", (req, res) => {
//   res.json({
//     swaggerDocument,
//   });
// });

// Add this endpoint
app.get("/api/user", (req, res) => {
  res.json({
    message: "user service is working via gateway!",
    success: true,
    timestamp: new Date().toISOString(),
  });
});

// Error middleware MUST be last
app.use(errorMiddleware);

const PORT = process.env.PORT || 8081;

async function startServer() {
  try {
    // This sends a simple query to the DB to verify connection
    await prisma.$connect();
    //await initPublisher();
    console.log(
      "✅ Database connected successfully to Neon DB for user service"
    );
    app.listen(PORT, () => {
      console.log(
        `user Service listening at http://localhost:${PORT}/api/user`
      );
      console.log(`Swagger Service listening at http://localhost:${PORT}/docs`);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

startServer();

// server()
// server.on("error", console.error);
