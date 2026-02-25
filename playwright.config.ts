import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./test/e2e",
    timeout: 30_000,
    // Auth token state is persisted to ~/.okastr8/auth.json; run live e2e serially
    // to avoid cross-process token write races.
    workers: 1,
    fullyParallel: false,
    reporter: "list",
    use: {
        baseURL: process.env.OKASTR8_BASE_URL || "http://127.0.0.1:41788",
        trace: "on-first-retry",
    },
});
