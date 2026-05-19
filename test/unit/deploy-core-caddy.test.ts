import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

function writeReleaseConfig(
    releasePath: string,
    options: { domain: string; tunnelRouting?: boolean }
): void {
    writeFileSync(
        join(releasePath, "okastr8.yaml"),
        [
            "runtime: node",
            "start: node server.js",
            "port: 3000",
            `domain: ${options.domain}`,
            `tunnel_routing: ${options.tunnelRouting ? "true" : "false"}`,
            "",
        ].join("\n")
    );
}

function runIsolatedScript(scriptBody: string, env: Record<string, string>): any {
    const result = Bun.spawnSync({
        cmd: [
            process.execPath,
            "--eval",
            `
            (async () => {
                ${scriptBody}
            })().catch((error) => {
                console.error(String(error?.stack || error));
                process.exit(1);
            });
            `,
        ],
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        stdout: "pipe",
        stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(result.stdout).trim();
    const stderr = new TextDecoder().decode(result.stderr).trim();

    if (result.exitCode !== 0) {
        throw new Error(`script failed\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }

    return JSON.parse(stdout.split("\n").at(-1) || "{}");
}

function runDeployCoreScript(home: string, releasePath: string, appName: string): any {
    mkdirSync(join(home, ".okastr8", "apps", appName), { recursive: true });

    return runIsolatedScript(
        `
        const { mock } = await import("bun:test");

        let caddyCalls = 0;

        mock.module("./src/utils/command.ts", () => ({
            runCommand: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        }));

        mock.module("./src/utils/deploy-docker.ts", () => ({
            deployWithDocker: async (_options, config) => ({
                success: true,
                message: "deployed",
                config,
            }),
        }));

        mock.module("./src/commands/version.ts", () => ({
            setCurrentVersion: async () => {},
        }));

        mock.module("./src/commands/docker.ts", () => ({
            startAppTunnelContainer: async () => ({ success: true, message: "tunnel started" }),
            stopAppTunnelContainer: async () => ({ success: true, message: "tunnel stopped" }),
        }));

        mock.module("./src/utils/genCaddyFile.ts", () => ({
            genCaddyFile: async () => {
                caddyCalls += 1;
                throw new Error("reload failed");
            },
        }));

        const { deployFromPath } = await import("./src/commands/deploy-core.ts");
        const result = await deployFromPath({
            appName: process.env.APP_NAME,
            releasePath: process.env.RELEASE_PATH,
            versionId: 1,
            onProgress: () => {},
        });

        console.log(JSON.stringify({ result, caddyCalls }));
        `,
        {
            HOME: home,
            RELEASE_PATH: releasePath,
            APP_NAME: appName,
        }
    );
}

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) rmSync(dir, { recursive: true, force: true });
    }
});

describe("deployFromPath Caddy failure handling", () => {
    it("fails deployment when Caddy route generation fails for a domain app", () => {
        const home = makeTempDir("okastr8-deploy-core-home-");
        const releasePath = makeTempDir("okastr8-deploy-core-release-");
        writeReleaseConfig(releasePath, { domain: "example.com" });

        const data = runDeployCoreScript(home, releasePath, "domain-app");

        expect(data.result.success).toBe(false);
        expect(data.result.message).toContain("Failed to update Caddy");
        expect(data.caddyCalls).toBe(1);
    });

    it("does not block tunnel-routed deployments on Caddy route generation", () => {
        const home = makeTempDir("okastr8-deploy-core-home-");
        const releasePath = makeTempDir("okastr8-deploy-core-release-");
        writeReleaseConfig(releasePath, {
            domain: "tunnel.example.com",
            tunnelRouting: true,
        });

        const data = runDeployCoreScript(home, releasePath, "tunnel-app");

        expect(data.result.success).toBe(true);
        expect(data.caddyCalls).toBe(0);
    });
});
