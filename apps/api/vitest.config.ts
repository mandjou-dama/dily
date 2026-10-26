import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: "../../.env", quiet: true });

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Database suites share one test database
    fileParallelism: false,
  },
});
