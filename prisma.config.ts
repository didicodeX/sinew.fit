import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Migrations need a direct (non-pooled) connection; the app itself can use the pooled one
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
