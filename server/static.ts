import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Skip static file serving for API routes so they reach the API handlers
  const staticMiddleware = express.static(distPath);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    return staticMiddleware(req, res, next);
  });

  // fall through to index.html if the file doesn't exist (but not for /api routes)
  app.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
