// Applies pending Prisma migrations during the Vercel production build only.
// Preview builds skip it so they never touch the production database.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping prisma migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}
