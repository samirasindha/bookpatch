import { Router } from "express";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db/client.js";
import { clubMembers, clubPosts, clubs, userBooks, users } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { saveBook } from "../lib/catalog.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { publicUser } from "../lib/users.js";
import { BookInputSchema } from "./library.js";

export const clubsRouter = Router();
clubsRouter.use(requireAuth);

/** Short, readable invite codes (no 0/O/1/l confusion). */
export function inviteCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");
}

async function membership(clubId: string, userId: string) {
  return db.query.clubMembers.findFirst({ where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)) });
}

async function requireMember(clubId: string, userId: string) {
  const club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
  if (!club) throw notFound("Club");
  const member = await membership(clubId, userId);
  if (!member) throw forbidden("Join this club to see its discussion");
  return { club, member };
}

const canManage = (role: string) => role === "owner" || role === "moderator";

/** Summary rows for a set of clubs, with the current book and member count. */
async function summaries(clubIds: string[], viewerId: string) {
  if (!clubIds.length) return [];
  const rows = await db.query.clubs.findMany({
    where: inArray(clubs.id, clubIds),
    with: { currentBook: true, members: { columns: { userId: true, role: true } } },
    orderBy: [desc(clubs.createdAt)],
  });
  const lastPosts = await db
    .select({ clubId: clubPosts.clubId, last: sql<Date>`max(${clubPosts.createdAt})` })
    .from(clubPosts)
    .where(inArray(clubPosts.clubId, clubIds))
    .groupBy(clubPosts.clubId);
  const lastBy = new Map(lastPosts.map((p) => [p.clubId, p.last]));
  return rows.map(({ members, inviteCode: _code, ...c }) => ({
    ...c,
    memberCount: members.length,
    myRole: members.find((m) => m.userId === viewerId)?.role ?? null,
    lastActivityAt: lastBy.get(c.id) ?? c.createdAt,
  }));
}

clubsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const mine = await db.select({ id: clubMembers.clubId }).from(clubMembers).where(eq(clubMembers.userId, me.id));
  const myIds = mine.map((m) => m.id);
  // Public clubs you could join (real users never see demo-only clubs)
  const publicRows = await db
    .select({ id: clubs.id })
    .from(clubs)
    .innerJoin(users, eq(users.id, clubs.ownerId))
    .where(
      and(
        eq(clubs.isPrivate, false),
        myIds.length ? notInArray(clubs.id, myIds) : undefined,
        me.isDemo ? undefined : eq(users.isDemo, false),
      ),
    )
    .limit(12);
  res.json({ mine: await summaries(myIds, me.id), discover: await summaries(publicRows.map((r) => r.id), me.id) });
});

const ClubSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).nullish(),
  isPrivate: z.boolean().default(true),
});

clubsRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const body = ClubSchema.parse(req.body);
  const club = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(clubs)
      .values({ ...body, description: body.description || null, ownerId: me.id, inviteCode: inviteCode() })
      .returning();
    await tx.insert(clubMembers).values({ clubId: c.id, userId: me.id, role: "owner" });
    return c;
  });
  res.status(201).json({ club });
});

/** Join with an invite code (private clubs) or directly (public clubs). */
clubsRouter.post("/join", async (req, res) => {
  const me = currentUser(req);
  const { code, clubId } = z.object({ code: z.string().trim().optional(), clubId: z.string().uuid().optional() }).parse(req.body);
  let club;
  if (code) club = await db.query.clubs.findFirst({ where: eq(clubs.inviteCode, code.toLowerCase()) });
  else if (clubId) {
    club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
    if (club?.isPrivate) throw forbidden("This club is invite-only");
  }
  if (!club) throw notFound("Club");
  await db.insert(clubMembers).values({ clubId: club.id, userId: me.id }).onConflictDoNothing();
  res.json({ clubId: club.id });
});

clubsRouter.get("/:id", async (req, res) => {
  const me = currentUser(req);
  const { club, member } = await requireMember(req.params.id, me.id);

  const members = await db
    .select({ user: users, role: clubMembers.role, joinedAt: clubMembers.joinedAt })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(eq(clubMembers.clubId, club.id))
    .orderBy(asc(clubMembers.joinedAt));

  // Everyone's place in the current book: the "reading together" shelf
  const currentBook = club.currentBookId ? await db.query.books.findFirst({ where: (b, { eq }) => eq(b.id, club.currentBookId!) }) : null;
  const progress = new Map<string, { progress: number; totalPages: number | null; status: string }>();
  if (currentBook) {
    const rows = await db
      .select({ userId: userBooks.userId, progress: userBooks.progress, totalPages: userBooks.totalPages, status: userBooks.status })
      .from(userBooks)
      .where(and(eq(userBooks.bookId, currentBook.id), inArray(userBooks.userId, members.map((m) => m.user.id))));
    for (const r of rows) progress.set(r.userId, r);
  }
  const pages = currentBook?.pageCount ?? null;
  const pageOf = (userId: string) => {
    const p = progress.get(userId);
    if (!p) return null;
    return p.status === "finished" ? (p.totalPages ?? pages ?? p.progress) : p.progress;
  };
  const myPage = pageOf(me.id) ?? 0;

  const posts = await db
    .select({ post: clubPosts, author: users })
    .from(clubPosts)
    .innerJoin(users, eq(users.id, clubPosts.authorId))
    .where(eq(clubPosts.clubId, club.id))
    .orderBy(asc(clubPosts.createdAt));

  res.json({
    club: {
      ...club,
      // Only people who can manage the club see the invite code
      inviteCode: canManage(member.role) || !club.isPrivate ? club.inviteCode : null,
    },
    myRole: member.role,
    currentBook,
    myPage,
    members: members.map((m) => ({
      ...publicUser(m.user),
      role: m.role,
      page: pageOf(m.user.id),
      totalPages: progress.get(m.user.id)?.totalPages ?? pages,
    })),
    posts: posts.map(({ post, author }) => ({
      id: post.id,
      parentId: post.parentId,
      body: post.body,
      createdAt: post.createdAt,
      author: publicUser(author),
      spoilerUpToPage: post.spoilerUpToPage,
      // Spoiler protection: hidden until you've read that far (your own posts are never hidden)
      hiddenAsSpoiler: !!post.spoilerUpToPage && post.authorId !== me.id && post.spoilerUpToPage > myPage,
      canDelete: post.authorId === me.id || canManage(member.role),
    })),
  });
});

clubsRouter.patch("/:id", async (req, res) => {
  const me = currentUser(req);
  const { club, member } = await requireMember(req.params.id, me.id);
  if (!canManage(member.role)) throw forbidden("Only the host can change the club");
  const body = ClubSchema.partial().extend({ currentBook: BookInputSchema.nullable().optional() }).parse(req.body);
  const { currentBook, ...fields } = body;
  const updates: Partial<typeof clubs.$inferInsert> = { ...fields };
  if (currentBook !== undefined) updates.currentBookId = currentBook ? await saveBook(currentBook) : null;
  if (Object.keys(updates).length) await db.update(clubs).set(updates).where(eq(clubs.id, club.id));
  res.json({ ok: true });
});

clubsRouter.post("/:id/invite/reset", async (req, res) => {
  const me = currentUser(req);
  const { club, member } = await requireMember(req.params.id, me.id);
  if (!canManage(member.role)) throw forbidden("Only the host can reset the invite link");
  const code = inviteCode();
  await db.update(clubs).set({ inviteCode: code }).where(eq(clubs.id, club.id));
  res.json({ inviteCode: code });
});

clubsRouter.delete("/:id/members/me", async (req, res) => {
  const me = currentUser(req);
  const { club, member } = await requireMember(req.params.id, me.id);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(clubMembers).where(eq(clubMembers.clubId, club.id));
  if (member.role === "owner") {
    if (n > 1) throw badRequest("Hosts can't leave while others are in the club. Delete the club instead.");
    await db.delete(clubs).where(eq(clubs.id, club.id));
    return res.json({ ok: true, deleted: true });
  }
  await db.delete(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, me.id)));
  res.json({ ok: true });
});

clubsRouter.delete("/:id", async (req, res) => {
  const me = currentUser(req);
  const { club, member } = await requireMember(req.params.id, me.id);
  if (member.role !== "owner") throw forbidden("Only the host can delete the club");
  await db.delete(clubs).where(eq(clubs.id, club.id));
  res.json({ ok: true });
});

const PostSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().uuid().nullish(),
  spoilerUpToPage: z.number().int().min(1).max(100_000).nullish(),
});

clubsRouter.post("/:id/posts", async (req, res) => {
  const me = currentUser(req);
  const { club } = await requireMember(req.params.id, me.id);
  const body = PostSchema.parse(req.body);
  if (body.parentId) {
    const parent = await db.query.clubPosts.findFirst({ where: and(eq(clubPosts.id, body.parentId), eq(clubPosts.clubId, club.id)) });
    if (!parent) throw badRequest("That reply's thread doesn't exist");
    if (parent.parentId) body.parentId = parent.parentId; // keep threads one level deep
  }
  const [post] = await db
    .insert(clubPosts)
    .values({
      clubId: club.id,
      authorId: me.id,
      bookId: club.currentBookId,
      body: body.body,
      parentId: body.parentId ?? null,
      spoilerUpToPage: body.spoilerUpToPage ?? null,
    })
    .returning();
  res.status(201).json({ post });
});

clubsRouter.delete("/:id/posts/:postId", async (req, res) => {
  const me = currentUser(req);
  const { club, member } = await requireMember(req.params.id, me.id);
  const post = await db.query.clubPosts.findFirst({ where: and(eq(clubPosts.id, req.params.postId), eq(clubPosts.clubId, club.id)) });
  if (!post) throw notFound("Post");
  if (post.authorId !== me.id && !canManage(member.role)) throw forbidden("You can only delete your own posts");
  await db.delete(clubPosts).where(eq(clubPosts.id, post.id));
  res.json({ ok: true });
});
