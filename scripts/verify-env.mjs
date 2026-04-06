#!/usr/bin/env node

/**
 * Environment preflight checker for split-stack deployment.
 * - Frontend (Vercel): BACKEND_URL, NEXT_PUBLIC_BACKEND_URL
 * - Backend (Railway): GROQ_API_KEY (optional but recommended for AI routes)
 */

const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target = (targetArg?.split("=")[1] ?? "all").toLowerCase();

const frontendRequired = ["BACKEND_URL", "NEXT_PUBLIC_BACKEND_URL"];
const backendRecommended = ["GROQ_API_KEY"];

function missing(keys) {
  return keys.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
}

function printMissing(scope, keys) {
  if (keys.length === 0) {
    console.log(`[ok] ${scope} env looks good`);
    return true;
  }
  console.error(`[fail] Missing ${scope} env: ${keys.join(", ")}`);
  return false;
}

let ok = true;

if (target === "all" || target === "frontend") {
  ok = printMissing("frontend", missing(frontendRequired)) && ok;
}

if (target === "all" || target === "backend") {
  const missingBackend = missing(backendRecommended);
  if (missingBackend.length > 0) {
    console.warn(
      `[warn] Missing backend env: ${missingBackend.join(", ")} (AI routes will use deterministic fallback)`
    );
  } else {
    console.log("[ok] backend env looks good");
  }
}

if (!ok) {
  process.exit(1);
}

