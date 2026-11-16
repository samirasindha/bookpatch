import { Router } from "express";
import { and, desc, eq, ilike, ne, notLike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { books, follows, readingGoals, userBooks, users } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest, notFound } from "../lib/errors.js";
import { canSeeLibrary, notify, relationship } from "../lib/social.js";
import { publicUser, selfUser } from "../lib/users.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

async function byHandle(handle: string) {
  const u = await db.query.users.findFirst({ where: eq(users.handle, handle.toLowerCase()) });
  if (!u) throw notFound("Reader");
  return u;
}

/** Find people by name or @handle. */
usersRouter.get("/search", async (req, res) => {
  const me = currentUser(req);
  const { q } = z.object({ q: z.string().trim().min(1).max(60) }).parse(req.query);
  const term = `%${q.replace(/^@/, "").replace(/[%_]/g, "")}%`;
  const found = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.id, me.id),
        // Real users never see demo accounts; demo visitors see the demo cast but not other visitors
        me.isDemo ? notLike(users.email, "demo+%") : eq(users.isDemo, false),
        or(ilike(users.name, term), ilike(users.handle, term)),
      ),
    )
    .limit(20);
  const myFollows = new Set(
    (await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, me.id))).map((f) => f.id),
  );
  res.json({ users: found.map((u) => ({ ...publicUser(u), following: myFollows.has(u.id) })) });
});

/** People you follow, marking who follows you back (friends). */
usersRouter.get("/me/friends", async (req, res) => {
  const me = currentUser(req);
  const following = await db
    .select({ user: users })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(eq(follows.followerId, me.id));
  const followerIds = new Set(
    (await db.select({ id: follows.followerId }).from(follows).where(eq(follows.followingId, me.id))).map((f) => f.id),
  );
  res.json({
    people: following
      .map(({ user }) => ({ ...publicUser(user), friends: followerIds.has(user.id) }))
      .sort((a, b) => Number(b.friends) - Number(a.friends) || a.name.localeCompare(b.name)),
  });
});

const ProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,20}$/, "Handles are 3 to 20 letters, numbers or underscores"),
    bio: z.string().trim().max(200).nullable(),
    libraryVisibility: z.enum(["public", "friends", "private"]),
  })
  .partial();

usersRouter.patch("/me", async (req, res) => {
  const me = currentUser(req);
  const body = ProfileSchema.parse(req.body);
  if (body.handle && body.handle !== me.handle) {
    const taken = await db.query.users.findFirst({ where: eq(users.handle, body.handle), columns: { id: true } });
    if (taken) throw badRequest(`@${body.handle} is taken`);
  }
  const [updated] = await db.update(users).set(body).where(eq(users.id, me.id)).returning();
  res.json({ user: selfUser(updated) });
});

usersRouter.get("/:handle", async (req, res) => {
  const me = currentUser(req);
  const user = await byHandle(req.params.handle);
  const rel = await relationship(me.id, user.id);
  const visible = canSeeLibrary(user, rel);

  const [counts] = await db
    .select({
      followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followingId} = ${user.id})`,
      following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${user.id})`,
      books: sql<number>`(select count(*)::int from ${userBooks} where ${userBooks.userId} = ${user.id})`,
      finished: sql<number>`(select count(*)::int from ${userBooks} where ${userBooks.userId} = ${user.id} and ${userBooks.status} = 'finished')`,
    })
    .from(users)
    .where(eq(users.id, user.id));

  let shelf = null;
  if (visible) {
    const year = new Date().getUTCFullYear();
    const entries = await db
      .select({
        id: userBooks.id,
        status: userBooks.status,
        owned: userBooks.owned,
        progress: userBooks.progress,
        totalPages: userBooks.totalPages,
        rating: userBooks.rating,
        review: userBooks.review,
        finishedAt: userBooks.finishedAt,
        book: books,
      })
      .from(userBooks)
      .innerJoin(books, eq(books.id, userBooks.bookId))
      .where(eq(userBooks.userId, user.id))
      .orderBy(desc(userBooks.updatedAt));
    const goal = await db.query.readingGoals.findFirst({
      where: and(eq(readingGoals.userId, user.id), eq(readingGoals.year, year)),
    });
    const finishedThisYear = entries.filter((e) => e.finishedAt && e.finishedAt.getUTCFullYear() === year).length;
    shelf = {
      reading: entries.filter((e) => e.status === "reading"),
      recentlyFinished: entries
        .filter((e) => e.status === "finished")
        .sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))
        .slice(0, 12),
      library: entries,
      goal: goal ? { target: goal.target, period: goal.period, finishedThisYear } : null,
    };
  }

  res.json({
    user: rel.isSelf ? selfUser(user) : publicUser(user),
    libraryVisibility: user.libraryVisibility,
    relationship: rel,
    counts,
    visible,
    shelf,
  });
});

usersRouter.post("/:handle/follow", async (req, res) => {
  const me = currentUser(req);
  const user = await byHandle(req.params.handle);
  if (user.id === me.id) throw badRequest("You can't follow yourself");
  const inserted = await db
    .insert(follows)
    .values({ followerId: me.id, followingId: user.id })
    .onConflictDoNothing()
    .returning();
  if (inserted.length) await notify(user.id, "new_follower", { from: publicUser(me) });
  res.json({ relationship: await relationship(me.id, user.id) });
});

usersRouter.delete("/:handle/follow", async (req, res) => {
  const me = currentUser(req);
  const user = await byHandle(req.params.handle);
  await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, user.id)));
  res.json({ relationship: await relationship(me.id, user.id) });
});

