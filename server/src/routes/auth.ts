import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { env } from "../env.js";
import { clearSessionCookie, setSessionCookie } from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";
import { selfUser, upsertGoogleUser } from "../lib/users.js";
import { createDemoUser } from "../db/demo.js";

const googleClient = new OAuth2Client();

export const authRouter = Router();

/** Tells the client which sign-in options are available. */
authRouter.get("/config", (_req, res) => {
  res.json({ googleClientId: env.GOOGLE_CLIENT_ID || null, demoLogin: env.ALLOW_DEMO_LOGIN });
});

/**
 * Google Identity Services flow: the browser gets a signed ID token from Google,
 * we verify its signature and audience, then issue our own httpOnly session cookie.
 */
authRouter.post("/google", async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID) throw new HttpError(503, "Google sign-in is not configured");
  const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, "Google sign-in could not be verified");
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new HttpError(401, "Google account email is not verified");
  }

  const user = await upsertGoogleUser({
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0],
    avatarUrl: payload.picture,
  });
  setSessionCookie(res, user.id);
  res.json({ user: selfUser(user) });
});

/** One-click demo account so recruiters can try the live app without signing in. */
authRouter.post("/demo", async (_req, res) => {
  if (!env.ALLOW_DEMO_LOGIN) throw new HttpError(403, "Demo login is disabled");
  const user = await createDemoUser();
  setSessionCookie(res, user.id);
  res.json({ user: selfUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ? selfUser(req.user) : null });
});
