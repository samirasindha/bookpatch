import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env.js";
import * as schema from "./schema.js";

const isLocal = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  // Hosted Postgres providers (Neon, Render, Supabase) require TLS
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
