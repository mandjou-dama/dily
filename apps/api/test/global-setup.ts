import { execFileSync } from "node:child_process";
import pg from "pg";

/**
 * Prepares the test database (TEST_DATABASE_URL): created if needed, then
 * migrated. Without TEST_DATABASE_URL, database suites are skipped (test/db.ts).
 */
export default async function setup(): Promise<void> {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    console.warn("TEST_DATABASE_URL missing: database suites are skipped.");
    return;
  }

  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rowCount === 0)
      await client.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
