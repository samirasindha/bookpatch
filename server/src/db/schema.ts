import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uuid,
  primaryKey,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ---------- Enums ---------- */
export const readingStatus = pgEnum("reading_status", ["want_to_read", "reading", "finished", "dnf"]);
export const goalPeriod = pgEnum("goal_period", ["week", "month", "year"]);
export const clubRole = pgEnum("club_role", ["owner", "moderator", "member"]);
export const nudgeChannel = pgEnum("nudge_channel", ["email", "in_app"]);
export const visibility = pgEnum("visibility", ["public", "friends", "private"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
};

/* ---------- Users ---------- */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleId: text("google_id").unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    handle: text("handle").notNull().unique(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    libraryVisibility: visibility("library_visibility").default("friends").notNull(),
    isDemo: boolean("is_demo").default(false).notNull(),
    ...timestamps,
  },
);

/* ---------- Books (shared catalog) ---------- */
export const books = pgTable(
  "books",
  {
    id: text("id").primaryKey(), // Google Books volume id, or "isbn-<isbn>" / "gr-<slug>" for imports
    title: text("title").notNull(),
    author: text("author"),
    coverUrl: text("cover_url"),
    description: text("description"),
    publishedYear: integer("published_year"),
    isbn: text("isbn"),
    pageCount: integer("page_count"),
    ...timestamps,
  },
  (t) => [index("books_isbn_idx").on(t.isbn)],
);

/* ---------- A user's copy / reading record of a book ---------- */
export const userBooks = pgTable(
  "user_books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull().references(() => books.id),
    status: readingStatus("status").default("want_to_read").notNull(),
    owned: boolean("owned").default(false).notNull(),
    progress: integer("progress").default(0).notNull(),
    totalPages: integer("total_pages"),
    rating: integer("rating"),
    review: text("review"),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_books_user_book_uq").on(t.userId, t.bookId),
    index("user_books_user_status_idx").on(t.userId, t.status),
  ],
);

/* ---------- Custom shelves ---------- */
export const shelves = pgTable(
  "shelves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#c8873a").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("shelves_user_name_uq").on(t.userId, t.name)],
);

export const shelfBooks = pgTable(
  "shelf_books",
  {
    shelfId: uuid("shelf_id").notNull().references(() => shelves.id, { onDelete: "cascade" }),
    userBookId: uuid("user_book_id").notNull().references(() => userBooks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.shelfId, t.userBookId] })],
);

/* ---------- Reading goals ---------- */
export const readingGoals = pgTable(
  "reading_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    target: integer("target").notNull(),
    period: goalPeriod("period").default("year").notNull(),
  },
  (t) => [uniqueIndex("reading_goals_user_year_uq").on(t.userId, t.year)],
);

/* ---------- Friends (one-way follows; mutual follow = friends) ---------- */
export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })],
);

/* ---------- Lending ---------- */
export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userBookId: uuid("user_book_id").notNull().references(() => userBooks.id, { onDelete: "cascade" }),
    lenderId: uuid("lender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // Either a STACKS user, or just a name + email for friends who aren't on the app yet
    borrowerId: uuid("borrower_id").references(() => users.id, { onDelete: "set null" }),
    borrowerName: text("borrower_name").notNull(),
    borrowerEmail: text("borrower_email"),
    loanedAt: timestamp("loaned_at", { withTimezone: true }).defaultNow().notNull(),
    dueDate: date("due_date"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    index("loans_lender_idx").on(t.lenderId),
    index("loans_borrower_idx").on(t.borrowerId),
  ],
);

export const nudges = pgTable("nudges", {
  id: uuid("id").primaryKey().defaultRandom(),
  loanId: uuid("loan_id").notNull().references(() => loans.id, { onDelete: "cascade" }),
  channel: nudgeChannel("channel").notNull(),
  delivered: boolean("delivered").default(false).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- In-app notifications ---------- */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "nudge" | "loan_created" | "loan_returned" | "new_follower" | "club_post"
    payload: text("payload").notNull(), // JSON
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/* ---------- Book clubs ---------- */
export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentBookId: text("current_book_id").references(() => books.id),
  isPrivate: boolean("is_private").default(true).notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  ...timestamps,
});

export const clubMembers = pgTable(
  "club_members",
  {
    clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: clubRole("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.userId] })],
);

export const clubPosts = pgTable(
  "club_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").references(() => books.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => clubPosts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    spoilerUpToPage: integer("spoiler_up_to_page"),
    ...timestamps,
  },
  (t) => [index("club_posts_club_idx").on(t.clubId, t.createdAt)],
);

/* ---------- Relations (for typed relational queries) ---------- */
export const usersRelations = relations(users, ({ many }) => ({
  userBooks: many(userBooks),
  shelves: many(shelves),
}));

export const userBooksRelations = relations(userBooks, ({ one, many }) => ({
  user: one(users, { fields: [userBooks.userId], references: [users.id] }),
  book: one(books, { fields: [userBooks.bookId], references: [books.id] }),
  shelfBooks: many(shelfBooks),
  loans: many(loans),
}));

export const shelvesRelations = relations(shelves, ({ one, many }) => ({
  user: one(users, { fields: [shelves.userId], references: [users.id] }),
  shelfBooks: many(shelfBooks),
}));

export const shelfBooksRelations = relations(shelfBooks, ({ one }) => ({
  shelf: one(shelves, { fields: [shelfBooks.shelfId], references: [shelves.id] }),
  userBook: one(userBooks, { fields: [shelfBooks.userBookId], references: [userBooks.id] }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  userBook: one(userBooks, { fields: [loans.userBookId], references: [userBooks.id] }),
  lender: one(users, { fields: [loans.lenderId], references: [users.id] }),
  borrower: one(users, { fields: [loans.borrowerId], references: [users.id] }),
  nudges: many(nudges),
}));

export const nudgesRelations = relations(nudges, ({ one }) => ({
  loan: one(loans, { fields: [nudges.loanId], references: [loans.id] }),
}));

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  owner: one(users, { fields: [clubs.ownerId], references: [users.id] }),
  currentBook: one(books, { fields: [clubs.currentBookId], references: [books.id] }),
  members: many(clubMembers),
  posts: many(clubPosts),
}));

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, { fields: [clubMembers.clubId], references: [clubs.id] }),
  user: one(users, { fields: [clubMembers.userId], references: [users.id] }),
}));

export const clubPostsRelations = relations(clubPosts, ({ one }) => ({
  club: one(clubs, { fields: [clubPosts.clubId], references: [clubs.id] }),
  author: one(users, { fields: [clubPosts.authorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
