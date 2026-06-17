import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createAnalyzeHandler } from "./server/analyze";

function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "threadneedle-api",
    configureServer(server) {
      const handler = createAnalyzeHandler(env.OPENAI_API_KEY ?? "");
      server.middlewares.use("/api/analyze", (req, res, next) => {
        if (!env.OPENAI_API_KEY) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }));
          return;
        }
        handler(req, res, next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), apiPlugin(env)],
  };
});
