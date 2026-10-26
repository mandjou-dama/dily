import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The `.env` lives at the repo root, shared with docker compose
config({ path: "../../.env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` needs no database: the URL may be missing (CI)
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
