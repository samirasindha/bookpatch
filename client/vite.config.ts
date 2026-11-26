import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Forward API calls to the Express server during development
    proxy: { "/api": "http://localhost:3001" },
  },
});
