import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only proxy so the frontend can call relative /dashboard/* and /api/*
// URLs without CORS -- points at the FastAPI backend (uvicorn main:app,
// default port 8000). Mirrors Ticket-Hub's frontend/vite.config.ts.
const apiTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/dashboard": { target: apiTarget, changeOrigin: true },
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
});
