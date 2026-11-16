// Applies pending Prisma migrations during Vercel builds.
// - production: always.
// - preview: only when MIGRATE_PREVIEW=true, which must be set together with a
//   Preview-only DATABASE_URL/DIRECT_URL (separate database), never the production one.
import { execSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV;
const shouldMigrate =
  vercelEnv === "production" || (vercelEnv === "preview" && process.env.MIGRATE_PREVIEW === "true");

if (shouldMigrate) {
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping prisma migrate deploy (VERCEL_ENV=${vercelEnv ?? "unset"})`);
}
