import { createAuthClient } from "better-auth/react";

const configuredApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const authApiUrl = new URL(configuredApiUrl);
if (["localhost", "127.0.0.1"].includes(authApiUrl.hostname) && typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  authApiUrl.hostname = window.location.hostname;
}

export const authClient = createAuthClient({
  baseURL: authApiUrl.toString(),
  fetchOptions: { credentials: "include" },
});
