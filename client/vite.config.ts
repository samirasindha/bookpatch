import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Ports live in one place: server/.env (PORT for the API, CLIENT_ORIGIN for this site).
// The defaults below match server/src/env.ts, so it still works with no .env file.
export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, "../server", "");
  const apiPort = serverEnv.PORT || "3001";
  const clientOrigin = serverEnv.CLIENT_ORIGIN || "http://localhost:5174";

  return {
    plugins: [react()],
    server: {
      port: Number(new URL(clientOrigin).port) || 5174,
      strictPort: true,
      // Forward API calls to the Express server during development
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
  };
});
