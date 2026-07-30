/**
 * Run `prisma db push` when DATABASE_URL is a real Postgres URL (Vercel build).
 */
import { spawnSync } from "node:child_process";

const url = (process.env.DATABASE_URL ?? "").trim();

function isPostgresUrl(u) {
  return u.startsWith("postgresql://") || u.startsWith("postgres://");
}

if (!url) {
  console.error(`
✖ DATABASE_URL is not set.

In Vercel → Project → Settings → Environment Variables, add:

  Name:  DATABASE_URL
  Value: postgresql://USER:PASSWORD@HOST/db?sslmode=require

Then redeploy.
`);
  process.exit(1);
}

if (!isPostgresUrl(url)) {
  console.error(`
✖ DATABASE_URL must start with postgresql:// or postgres://
Current prefix: ${JSON.stringify(url.slice(0, 24))}…
`);
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
