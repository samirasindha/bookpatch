export type Me = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  libraryVisibility: "public" | "friends" | "private";
  isDemo: boolean;
};

export type AuthConfig = { googleClientId: string | null; demoLogin: boolean };

export type Book = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
  publishedYear: number | null;
  isbn: string | null;
  pageCount: number | null;
  source?: "google" | "openlibrary" | "isbndb" | "cache";
};

export type ReadingStatus = "want_to_read" | "reading" | "finished" | "dnf";

export type Entry = {
  id: string;
  status: ReadingStatus;
  owned: boolean;
  progress: number;
  totalPages: number | null;
  rating: number | null;
  review: string | null;
  addedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  shelfIds: string[];
  activeLoan: { id: string; borrowerName: string; dueDate: string | null } | null;
  book: Book;
};

export type Shelf = { id: string; name: string; color: string; bookCount: number };

export type LibraryStats = {
  total: number;
  reading: number;
  finished: number;
  wantToRead: number;
  owned: number;
  avgRating: number | null;
};

export type GoalPeriod = "week" | "month" | "year";

export type Goals = {
  year: number;
  goal: { target: number; period: GoalPeriod } | null;
  progress: { finished: number; remaining: number; pace: "ahead" | "on_track" | "behind" | null } | null;
  counts: { year: number; month: number; week: number };
  monthly: { month: number; count: number; titles: string[] }[];
};

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  want_to_read: "Want to read",
  reading: "Reading",
  finished: "Finished",
  dnf: "Didn't finish",
};

export type PublicUser = { id: string; name: string; handle: string; avatarUrl: string | null; bio: string | null };

export type Relationship = { isSelf: boolean; following: boolean; followedBy: boolean; friends: boolean };

export type ProfileEntry = Pick<Entry, "id" | "status" | "owned" | "progress" | "totalPages" | "rating" | "review" | "finishedAt" | "book">;

export type Profile = {
  user: PublicUser & Partial<Pick<Me, "email" | "libraryVisibility" | "isDemo">>;
  libraryVisibility: Me["libraryVisibility"];
  relationship: Relationship;
  counts: { followers: number; following: number; books: number; finished: number };
  visible: boolean;
  shelf: {
    reading: ProfileEntry[];
    recentlyFinished: ProfileEntry[];
    library: ProfileEntry[];
    goal: { target: number; period: GoalPeriod; finishedThisYear: number } | null;
  } | null;
};

export type Loan = {
  id: string;
  book: Book;
  lender: PublicUser;
  borrower: PublicUser | null;
  borrowerName: string;
  borrowerEmail: string | null;
  loanedAt: string;
  dueDate: string | null;
  returnedAt: string | null;
  notes: string | null;
  nudgeCount: number;
  lastNudgeAt: string | null;
};

export type Notification = {
  id: string;
  type: "new_follower" | "loan_created" | "loan_returned" | "nudge";
  payload: { from?: PublicUser; by?: PublicUser; title?: string; dueDate?: string | null };
  read: boolean;
  createdAt: string;
};
