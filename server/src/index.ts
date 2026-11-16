import { createApp } from "./app.js";
import { env } from "./env.js";
import { runMigrations } from "./db/migrate.js";

await runMigrations();

createApp().listen(env.PORT, () => {
  console.log(`Bookpatch API listening on http://localhost:${env.PORT}`);
});
