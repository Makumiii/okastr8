import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tempDirs: string[] = [];

function makeHome(): string {
    const home = mkdtempSync(join(tmpdir(), "okastr8-caddy-home-"));
    tempDirs.push(home);
    return home;
}

function writeApp(home: string, appName: string, metadata: Record<string, unknown>): void {
    const appDir = join(home, ".okastr8", "apps", appName);
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "app.json"), JSON.stringify(metadata, null, 2));
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

function runCaddyScript(home: string, writeExitCode = 0, reloadExitCode = 0): any {
    return runIsolatedScript(
        `
        const { mock } = await import("bun:test");

        const commandCalls = [];
        mock.module("./src/utils/command", () => ({
            runCommand: async (command, args = [], _cwd, stdin) => {
                commandCalls.push({ command, args, stdin });
                const isWrite = args.some((arg) => arg.endsWith("writeCaddyfile.sh"));
                const isReload = args.some((arg) => arg.endsWith("reloadCaddy.sh"));
                return {
                    stdout: "",
                    stderr: isWrite ? "write failed" : isReload ? "reload failed" : "",
                    exitCode: isWrite ? Number(process.env.WRITE_EXIT_CODE) : isReload ? Number(process.env.RELOAD_EXIT_CODE) : 0,
                };
            },
        }));

        const { genCaddyFile } = await import("./src/utils/genCaddyFile.ts");
        const logs = [];
        let threw = false;
        let errorMessage = "";

        try {
            await genCaddyFile((message) => logs.push(message));
        } catch (error) {
            threw = true;
            errorMessage = String(error?.message || error);
        }

        const writeCall = commandCalls.find((call) =>
            call.args.some((arg) => arg.endsWith("writeCaddyfile.sh"))
        );

        console.log(JSON.stringify({
            caddyfile: writeCall?.stdin || "",
            logs,
            threw,
            errorMessage,
        }));
        `,
        {
            HOME: home,
            WRITE_EXIT_CODE: String(writeExitCode),
            RELOAD_EXIT_CODE: String(reloadExitCode),
        }
    );
}

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) rmSync(dir, { recursive: true, force: true });
    }
});

describe("genCaddyFile", () => {
    it("generates TLS-capable domain blocks without forcing http", () => {
        const home = makeHome();
        writeApp(home, "web", {
            domain: "example.com",
            port: 8080,
            tunnel_routing: false,
        });

        const data = runCaddyScript(home);

        expect(data.caddyfile).toContain("example.com {\n  reverse_proxy 127.0.0.1:8080\n}");
        expect(data.caddyfile).not.toContain("http://example.com");
    });

    it("keeps .localhost routes on http to avoid local TLS", () => {
        const home = makeHome();
        writeApp(home, "local", {
            domain: "demo.localhost",
            port: 4321,
            tunnel_routing: false,
        });

        const data = runCaddyScript(home);

        expect(data.caddyfile).toContain(
            "http://demo.localhost {\n  reverse_proxy 127.0.0.1:4321\n}"
        );
    });

    it("skips Cloudflare Tunnel routed apps", () => {
        const home = makeHome();
        writeApp(home, "tunnel", {
            domain: "tunnel.example.com",
            port: 5050,
            tunnel_routing: true,
        });

        const data = runCaddyScript(home);

        expect(data.caddyfile).not.toContain("tunnel.example.com");
        expect(data.logs.join("\n")).toContain("using Cloudflare Tunnel");
    });

    it("throws when writing the Caddyfile fails", () => {
        const home = makeHome();
        writeApp(home, "web", {
            domain: "example.com",
            port: 8080,
            tunnel_routing: false,
        });

        const data = runCaddyScript(home, 1);

        expect(data.threw).toBe(true);
        expect(data.errorMessage).toContain("Failed to write Caddyfile");
    });

    it("throws when reloading Caddy fails", () => {
        const home = makeHome();
        writeApp(home, "web", {
            domain: "example.com",
            port: 8080,
            tunnel_routing: false,
        });

        const data = runCaddyScript(home, 0, 1);

        expect(data.threw).toBe(true);
        expect(data.errorMessage).toContain("Failed to reload Caddy");
    });
});
