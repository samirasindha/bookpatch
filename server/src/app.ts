import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { env } from "./env.js";
import { db } from "./db/client.js";
import { loadUser } from "./lib/auth.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { booksRouter } from "./routes/books.js";
import { libraryRouter } from "./routes/library.js";
import { shelvesRouter } from "./routes/shelves.js";
import { goalsRouter } from "./routes/goals.js";
import { importExportRouter } from "./routes/importExport.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://accounts.google.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'", "https://accounts.google.com"],
          frameSrc: ["https://accounts.google.com"],
          mediaSrc: ["'self'", "blob:"],
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "5mb" })); // Goodreads exports can be large
  app.use(cookieParser());
  app.use("/api", rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === "test" ? 10_000 : 300 }));
  app.use(loadUser);

  app.get("/api/health", async (_req, res) => {
    await db.execute(sql`select 1`);
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/library", importExportRouter, libraryRouter);
  app.use("/api/shelves", shelvesRouter);
  app.use("/api/goals", goalsRouter);

  app.use("/api", notFoundHandler);

  // In production the server also serves the built React app
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: "1h", index: false }));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
