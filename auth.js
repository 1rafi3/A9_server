import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { db, client } from "./db.js";
import dotenv from "dotenv";

dotenv.config();

function parseOriginList(value, fallback) {
  if (Array.isArray(value)) {
    return value.map(origin => String(origin).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map(origin => origin.trim()).filter(Boolean);
  }

  if (Array.isArray(fallback)) {
    return fallback.map(origin => String(origin).trim()).filter(Boolean);
  }

  if (typeof fallback === "string") {
    return fallback.split(",").map(origin => origin.trim()).filter(Boolean);
  }

  return [];
}

const trustedOrigins = parseOriginList(
  process.env.BETTER_AUTH_TRUSTED_ORIGINS || process.env.CORS_ORIGINS || process.env.CLIENT_ORIGINS || process.env.APP_ORIGIN,
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
  ]
);

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-google-client-secret",
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || "sportnest-auth-secret-key-for-session-signing-2026",
  trustedOrigins,
  baseURL: process.env.BETTER_AUTH_URL || process.env.PUBLIC_SERVER_URL || "http://localhost:5000",
});
