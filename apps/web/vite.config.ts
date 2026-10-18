import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ""), ...process.env };

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: { proxy: { "/api": env.VITE_API_URL ?? "http://localhost:3000" } },
  };
});
