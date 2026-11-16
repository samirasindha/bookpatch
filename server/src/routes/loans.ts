import { Router } from "express";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { loans, nudges, userBooks, users } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { nudgeEmail, sendEmail } from "../lib/email.js";
import { badRequest, forbidden, HttpError, notFound } from "../lib/errors.js";
import { notify } from "../lib/social.js";
import { publicUser } from "../lib/users.js";

export const loansRouter = Router();
loansRouter.use(requireAuth);

/** One nudge per loan per this many hours, so reminders stay friendly. */
export const NUDGE_COOLDOWN_HOURS = 24;

async function loadLoans(where: ReturnType<typeof and>) {
  const rows = await db.query.loans.findMany({
    where,
    with: {
      userBook: { with: { book: true } },
      lender: true,
      borrower: true,
      nudges: { orderBy: [desc(nudges.sentAt)] },
    },
    orderBy: [desc(loans.loanedAt)],
  });
  return rows.map(({ userBook, lender, borrower, nudges: n, ...loan }) => ({
    ...loan,
    book: userBook.book,
    lender: publicUser(lender),
    borrower: borrower ? publicUser(borrower) : null,
    nudgeCount: n.length,
    lastNudgeAt: n[0]?.sentAt ?? null,
  }));
}

loansRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const [lent, borrowed, history] = await Promise.all([
    loadLoans(and(eq(loans.lenderId, me.id), isNull(loans.returnedAt))),
    loadLoans(and(eq(loans.borrowerId, me.id), isNull(loans.returnedAt))),
    loadLoans(and(or(eq(loans.lenderId, me.id), eq(loans.borrowerId, me.id)), isNotNull(loans.returnedAt))),
  ]);
  res.json({ lent, borrowed, history: history.slice(0, 50) });
});

const LendSchema = z
  .object({
    userBookId: z.string().uuid(),
    borrowerHandle: z.string().trim().min(1).optional(),
    borrowerName: z.string().trim().min(1).max(80).optional(),
    borrowerEmail: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.borrowerHandle || v.borrowerName, { message: "Choose a friend or type the borrower's name" });

loansRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const body = LendSchema.parse(req.body);

  const entry = await db.query.userBooks.findFirst({
    where: and(eq(userBooks.id, body.userBookId), eq(userBooks.userId, me.id)),
    with: { book: true },
  });
  if (!entry) throw notFound("Library entry");
  if (!entry.owned) throw badRequest("Mark the book as owned before lending it");

  const open = await db.query.loans.findFirst({ where: and(eq(loans.userBookId, entry.id), isNull(loans.returnedAt)) });
  if (open) throw new HttpError(409, "This book is already lent out");

  let borrower = null;
  if (body.borrowerHandle) {
    borrower = await db.query.users.findFirst({ where: eq(users.handle, body.borrowerHandle.replace(/^@/, "").toLowerCase()) });
    if (!borrower) throw notFound("Reader");
    if (borrower.id === me.id) throw badRequest("You can't lend a book to yourself");
  }

  const [loan] = await db
    .insert(loans)
    .values({
      userBookId: entry.id,
      lenderId: me.id,
      borrowerId: borrower?.id ?? null,
      borrowerName: borrower?.name ?? body.borrowerName!,
      borrowerEmail: borrower ? null : (body.borrowerEmail ?? null),
      dueDate: body.dueDate ?? null,
      notes: body.notes || null,
    })
    .returning();

  if (borrower) {
    await notify(borrower.id, "loan_created", { loanId: loan.id, from: publicUser(me), title: entry.book.title, dueDate: loan.dueDate });
  }
  const [full] = await loadLoans(and(eq(loans.id, loan.id)));
  res.status(201).json({ loan: full });
});

loansRouter.patch("/:id/return", async (req, res) => {
  const me = currentUser(req);
  const loan = await db.query.loans.findFirst({ where: eq(loans.id, req.params.id), with: { userBook: { with: { book: true } } } });
  if (!loan || (loan.lenderId !== me.id && loan.borrowerId !== me.id)) throw notFound("Loan");
  if (loan.returnedAt) throw badRequest("Already returned");

  await db.update(loans).set({ returnedAt: new Date() }).where(eq(loans.id, loan.id));
  // Whoever didn't mark it returned gets told
  const other = me.id === loan.lenderId ? loan.borrowerId : loan.lenderId;
  if (other) await notify(other, "loan_returned", { loanId: loan.id, by: publicUser(me), title: loan.userBook.book.title });
  res.json({ ok: true });
});

loansRouter.post("/:id/nudge", async (req, res) => {
  const me = currentUser(req);
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, req.params.id),
    with: { userBook: { with: { book: true } }, borrower: true, nudges: { orderBy: [desc(nudges.sentAt)], limit: 1 } },
  });
  if (!loan) throw notFound("Loan");
  if (loan.lenderId !== me.id) throw forbidden("Only the lender can send a nudge");
  if (loan.returnedAt) throw badRequest("This book has already been returned");

  const last = loan.nudges[0]?.sentAt;
  if (last && Date.now() - last.getTime() < NUDGE_COOLDOWN_HOURS * 3600_000) {
    throw new HttpError(429, "You already nudged them today. Give it a day.");
  }

  const book = loan.userBook.book;
  let channel: "in_app" | "email";
  let delivered: boolean;
  if (loan.borrowerId) {
    channel = "in_app";
    await notify(loan.borrowerId, "nudge", { loanId: loan.id, from: publicUser(me), title: book.title });
    delivered = true;
  } else if (loan.borrowerEmail) {
    channel = "email";
    delivered = await sendEmail(
      loan.borrowerEmail,
      `A friendly reminder about "${book.title}"`,
      nudgeEmail({ lenderName: me.name, borrowerName: loan.borrowerName, title: book.title, author: book.author, loanedAt: loan.loanedAt, dueDate: loan.dueDate }),
    );
  } else {
    throw badRequest("Add the borrower's email to send them a nudge");
  }

  await db.insert(nudges).values({ loanId: loan.id, channel, delivered });
  res.json({ channel, delivered });
});
