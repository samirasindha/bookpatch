# Bookpatch

A social library app: scan the books on your shelf, track what you're reading, lend books to friends with a digital checkout card, and talk about them in book clubs.

> Work in progress. The full README with screenshots, architecture, and design decisions comes with the final stage.

## Features so far

- **Scan your shelves.** Works with a handheld USB/Bluetooth barcode scanner (detected anywhere in the app by typing speed) or a phone camera. Rapid shelving mode queues book after book, then adds them all at once.
- **Find any book.** Searches Google Books first and falls back to Open Library, with optional ISBNdb for hard-to-find editions. Every lookup is saved, so a book is only fetched once.
- **Your library.** Reading status, page progress, ratings, reviews, owned copies, and custom shelves.
- **Reading goals.** Per week, month, or year, with a pace indicator and monthly breakdown based on real finish dates.
- **Goodreads import.** Brings over ratings, reviews, read dates, owned copies, and shelves. Re-importing never duplicates.
- **Friends and profiles.** Follow people; following each other makes you friends. Each reader chooses who can see their library: anyone, friends, or just them.
- **Lending with checkout cards.** Lend to a friend on the app, or to anyone by name. Cards show who has the book, since when, and a stamped due date. Nudge once a day (in the app for members, by email for everyone else), and either side can mark a book returned.
- **Book clubs.** Invite-only clubs (shareable invite link) or open ones anyone can join. The host picks the book, and a shared track shows where every member is in it. Threaded discussion with **spoiler protection**: tag a post with a page number and it stays blurred for anyone who hasn't read that far.
- **Notifications** for new followers, books lent to you, nudges, and returns.
- **Light and dark themes**, a phone layout with a bottom tab bar, and a one-click demo that gives each visitor their own seeded library.

## Tech stack

| Layer    | Tools                                                                 |
| -------- | --------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query              |
| Backend  | Node.js, Express 5, TypeScript, Zod validation                        |
| Database | PostgreSQL with Drizzle ORM and versioned SQL migrations              |
| Auth     | Google Identity Services (ID token verified server-side), httpOnly JWT session cookie |
| Security | Helmet (CSP), CORS allowlist, rate limiting                           |
| Testing  | Vitest + Supertest against a real Postgres test database              |

## Run it locally

You need **Node.js 20+** and a **PostgreSQL database**. The easiest database option is a free [Neon](https://neon.tech) project, which you'll reuse when deploying. You can also install Postgres locally (Postgres.app on Mac, or the official installer on Windows).

```bash
# 1. Install everything (client + server)
npm install

# 2. Configure the server
cp server/.env.example server/.env
#    then open server/.env and set DATABASE_URL and SESSION_SECRET

# 3. Start the API and the web app together
npm run dev
```

Open http://localhost:5173. The database tables are created automatically when the server starts.

### Google sign-in (optional for local dev)

Without a Google client ID, the sign-in page offers the demo account only. To enable Google:

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project, then **APIs & Services > Credentials > Create credentials > OAuth client ID > Web application**.
2. Under **Authorized JavaScript origins**, add `http://localhost:5173`.
3. Copy the client ID into `GOOGLE_CLIENT_ID` in `server/.env` and restart.

## Scripts

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | API on :3000 and web app on :5173          |
| `npm test`          | API test suite (needs a test database)     |
| `npm run lint`      | Type-check server and client               |
| `npm run build`     | Production build of both                   |

Tests use `TEST_DATABASE_URL` (defaults to a local `bookpatch_test` database). Never point it at a database with real data, because tests wipe it.
