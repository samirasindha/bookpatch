import { Router } from "express";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { books, readingGoals, userBooks } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

function startOfWeek(d: Date) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (s.getUTCDay() + 6) % 7; // Monday = 0
  s.setUTCDate(s.getUTCDate() - day);
  return s;
}

/**
 * Where you should be by now if you read at an even pace.
 * e.g. 24 books/year, on July 1st (day 182 of 365) -> expected 11.
 */
export function expectedByNow(target: number, now = new Date()) {
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.floor(((now.getTime() - start) / (end - start)) * target);
}

export function paceLabel(finished: number, expected: number) {
  if (finished >= expected + 2) return "ahead" as const;
  if (finished >= expected - 1) return "on_track" as const;
  return "behind" as const;
}

goalsRouter.get("/", async (req, res) => {
  const userId = currentUser(req).id;
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYear = new Date(Date.UTC(year + 1, 0, 1));
  const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1));
  const weekStart = startOfWeek(now);

  const goal = await db.query.readingGoals.findFirst({
    where: and(eq(readingGoals.userId, userId), eq(readingGoals.year, year)),
  });

  const finishedThisYear = await db
    .select({ title: books.title, finishedAt: userBooks.finishedAt })
    .from(userBooks)
    .innerJoin(books, eq(books.id, userBooks.bookId))
    .where(
      and(
        eq(userBooks.userId, userId),
        eq(userBooks.status, "finished"),
        gte(userBooks.finishedAt, yearStart),
        lt(userBooks.finishedAt, nextYear),
      ),
    )
    .orderBy(sql`${userBooks.finishedAt} asc`);

  const monthly = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, count: 0, titles: [] as string[] }));
  for (const b of finishedThisYear) {
    const m = monthly[b.finishedAt!.getUTCMonth()];
    m.count++;
    m.titles.push(b.title);
  }

  const counts = {
    year: finishedThisYear.length,
    month: finishedThisYear.filter((b) => b.finishedAt! >= monthStart).length,
    week: finishedThisYear.filter((b) => b.finishedAt! >= weekStart).length,
  };

  let progress = null;
  if (goal) {
    const finished = counts[goal.period];
    const pace = goal.period === "year" ? paceLabel(finished, expectedByNow(goal.target, now)) : null;
    progress = { finished, remaining: Math.max(0, goal.target - finished), pace };
  }

  res.json({ year, goal: goal ? { target: goal.target, period: goal.period } : null, progress, counts, monthly });
});

goalsRouter.put("/", async (req, res) => {
  const userId = currentUser(req).id;
  const { target, period } = z
    .object({ target: z.number().int().min(1).max(1000), period: z.enum(["week", "month", "year"]) })
    .parse(req.body);
  const year = new Date().getUTCFullYear();
  await db
    .insert(readingGoals)
    .values({ userId, year, target, period })
    .onConflictDoUpdate({ target: [readingGoals.userId, readingGoals.year], set: { target, period } });
  res.json({ goal: { target, period } });
});
