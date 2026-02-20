import { describe, expect, it } from "bun:test";
import { generateCompose } from "../../src/utils/compose-generator";
import type { DeployConfig } from "../../src/types";

function baseConfig(overrides: Partial<DeployConfig> = {}): DeployConfig {
    return {
        runtime: "node",
        buildSteps: [],
        startCommand: "node server.js",
        port: 3000,
        ...overrides,
    };
}

describe("generateCompose", () => {
    it("generates minimal compose for app-only deployment", () => {
        const compose = generateCompose(baseConfig(), "my-app");

        expect(compose).toContain("services:");
        expect(compose).toContain("app:");
        expect(compose).toContain("container_name: my-app");
        expect(compose).not.toContain("depends_on:");
        expect(compose).not.toContain("volumes:");
    });

    it("adds database and cache services with connection env vars", () => {
        const compose = generateCompose(
            baseConfig({ database: "postgres:16", cache: "redis:7" }),
            "demo-app",
            ".env"
        );

        expect(compose).toContain("database:");
        expect(compose).toContain('image: "postgres:16"');
        expect(compose).toContain("cache:");
        expect(compose).toContain('image: "redis:7-alpine"');
        expect(compose).toContain('DATABASE_URL: "postgres://user:changeme@database:5432/app"');
        expect(compose).toContain('REDIS_URL: "redis://cache:6379"');
        expect(compose).toContain("env_file:");
        expect(compose).toContain("volumes:");
        expect(compose).toContain("demo-app_dbdata:");
    });

    it("throws for unsupported database type", () => {
        expect(() => generateCompose(baseConfig({ database: "sqlite:3" }), "broken-app")).toThrow(
            "Unsupported database type"
        );
    });
});
