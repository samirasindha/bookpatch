import { Router } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { notifications } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(40);
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
  res.json({
    unread,
    items: rows.map((n) => ({ id: n.id, type: n.type, payload: JSON.parse(n.payload), read: !!n.readAt, createdAt: n.createdAt })),
  });
});

notificationsRouter.post("/read-all", async (req, res) => {
  const me = currentUser(req);
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
  res.json({ ok: true });
});
