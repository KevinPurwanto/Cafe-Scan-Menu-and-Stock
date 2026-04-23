"use strict";

const fs = require("fs");
const path = require("path");
const { defineConfig } = require("prisma/config");

function loadEnvFileIfPresent(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!key) continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFileIfPresent(path.resolve(process.cwd(), ".env"));

// Prisma CLI butuh `DIRECT_URL` (untuk migrations/db push) saat `DATABASE_URL` pakai pooler.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts"
  }
});
