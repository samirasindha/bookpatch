import type { Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { users, type User } from "../db/schema.js";
import { HttpError } from "./errors.js";

export const SESSION_COOKIE = "bookpatch_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function setSessionCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, env.SESSION_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

function readUserId(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET);
    return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Attaches req.user when a valid session exists. Never rejects. */
export const loadUser: RequestHandler = async (req, _res, next) => {
  const id = readUserId(req);
  if (id) {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (user) req.user = user;
  }
  next();
};

/** Rejects with 401 unless signed in. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, "Please sign in"));
  next();
};

/** Typed accessor for handlers mounted behind requireAuth. */
export function currentUser(req: Request): User {
  if (!req.user) throw new HttpError(401, "Please sign in");
  return req.user;
}
