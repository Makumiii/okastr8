import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./test/e2e",
    timeout: 30_000,
    fullyParallel: false,
    reporter: "list",
    use: {
        baseURL: process.env.OKASTR8_BASE_URL || "http://127.0.0.1:41788",
        trace: "on-first-retry",
    },
});
