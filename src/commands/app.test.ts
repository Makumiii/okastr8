import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { createApp, deleteApp } from "./app";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";
import { OKASTR8_HOME } from "../config";

describe("App Configuration with Tunnel Routing", () => {
    const testAppName = "test-app-tunnel-config";
    const appDir = join(OKASTR8_HOME, "apps", testAppName);

    beforeAll(async () => {
        // Clean up before test
        try {
            await deleteApp(testAppName);
        } catch {
            if (existsSync(appDir)) {
                rmSync(appDir, { recursive: true, force: true });
            }
        }
    });

    afterAll(async () => {
        // Clean up after test
        try {
            await deleteApp(testAppName);
        } catch { }
    });

    test("creates app with tunnel_routing enabled", async () => {
        const result = await createApp({
            name: testAppName,
            description: "Test app for tunnel routing config",
            port: 3000,
            domain: "tunnel.example.com",
            tunnel_routing: true, // Key feature being tested
            deployStrategy: "image",
            imageRef: "nginx:alpine",
            pullPolicy: "if-not-present",
            webhookAutoDeploy: false,
            execStart: "",
            workingDirectory: "",
            user: "root",
        });

        expect(result.success).toBe(true);
        expect(existsSync(join(appDir, "app.json"))).toBe(true);

        // Verify the property was saved
        const appJson = JSON.parse(readFileSync(join(appDir, "app.json"), "utf8"));
        expect(appJson.tunnel_routing).toBe(true);
        expect(appJson.domain).toBe("tunnel.example.com");
    });
});
