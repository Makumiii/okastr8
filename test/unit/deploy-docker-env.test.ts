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

function makeRelease(): string {
    const releasePath = makeTempDir("okastr8-docker-env-release-");
    writeFileSync(
        join(releasePath, "docker-compose.yml"),
        [
            "services:",
            "  web:",
            "    image: nginx:alpine",
            "    environment:",
            "      DATABASE_URL: ${DATABASE_URL}",
            "",
        ].join("\n")
    );
    return releasePath;
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

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) rmSync(dir, { recursive: true, force: true });
    }
});

describe("deployWithDocker user compose env handling", () => {
    it("persists manual env vars, injects env_file override, and passes both compose files", () => {
        const home = makeTempDir("okastr8-docker-env-home-");
        const releasePath = makeRelease();

        const data = runIsolatedScript(
            `
            const { mock } = await import("bun:test");
            const { existsSync, readFileSync } = await import("fs");
            const { join } = await import("path");

            const composeUpCalls = [];
            mock.module("./src/commands/docker", () => ({
                buildImage: async () => ({ success: true, message: "built" }),
                runContainer: async () => ({ success: true, message: "running" }),
                stopContainer: async () => ({ success: true, message: "stopped" }),
                removeContainer: async () => ({ success: true, message: "removed" }),
                containerStatus: async () => ({ running: true, status: "running" }),
                composeUp: async (composePaths, projectName, deploymentId, envFilePath) => {
                    composeUpCalls.push({ composePaths, projectName, deploymentId, envFilePath });
                    return { success: true, message: "compose up" };
                },
                composeDown: async () => ({ success: true, message: "compose down" }),
                checkDockerInstalled: async () => true,
                checkComposeInstalled: async () => true,
                getProjectContainers: async () => [],
            }));

            const { deployWithDocker } = await import("./src/utils/deploy-docker.ts");
            const logs = [];
            const result = await deployWithDocker(
                {
                    appName: "compose-env-app",
                    releasePath: process.env.RELEASE_PATH,
                    versionId: 1,
                    env: {
                        DATABASE_URL: "postgres://user:pass@database:5432/app",
                    },
                    onProgress: (message) => logs.push(message),
                    deploymentId: "deployment-1",
                },
                {
                    runtime: "node",
                    buildSteps: [],
                    startCommand: "",
                    port: 3000,
                }
            );

            const envFilePath = join(
                process.env.HOME,
                ".okastr8",
                "apps",
                "compose-env-app",
                ".env.production"
            );
            const overridePath = join(process.env.RELEASE_PATH, "docker-compose.override.yml");

            console.log(JSON.stringify({
                result,
                envFilePath,
                overridePath,
                envExists: existsSync(envFilePath),
                envContent: existsSync(envFilePath) ? readFileSync(envFilePath, "utf-8") : "",
                overrideContent: existsSync(overridePath) ? readFileSync(overridePath, "utf-8") : "",
                composeUpCalls,
                logs,
            }));
            `,
            {
                HOME: home,
                RELEASE_PATH: releasePath,
            }
        );

        expect(data.result.success).toBe(true);
        expect(data.envExists).toBe(true);
        expect(data.envContent).toContain("DATABASE_URL=postgres://user:pass@database:5432/app");
        expect(data.overrideContent).toContain("env_file:");
        expect(data.overrideContent).toContain(data.envFilePath);
        expect(data.composeUpCalls).toEqual([
            {
                composePaths: [join(releasePath, "docker-compose.yml"), data.overridePath],
                projectName: "compose-env-app",
                deploymentId: "deployment-1",
                envFilePath: data.envFilePath,
            },
        ]);
        expect(data.logs.join("\n")).toContain(data.envFilePath);
        expect(data.logs.join("\n")).toContain(data.overridePath);
    });

    it("fails before compose up when a persistent env file exists but is empty", () => {
        const home = makeTempDir("okastr8-docker-env-home-");
        const releasePath = makeRelease();
        const appDir = join(home, ".okastr8", "apps", "empty-env-app");
        mkdirSync(appDir, { recursive: true });
        writeFileSync(join(appDir, ".env.production"), "");

        const data = runIsolatedScript(
            `
            const { mock } = await import("bun:test");

            const composeUpCalls = [];
            mock.module("./src/commands/docker", () => ({
                buildImage: async () => ({ success: true, message: "built" }),
                runContainer: async () => ({ success: true, message: "running" }),
                stopContainer: async () => ({ success: true, message: "stopped" }),
                removeContainer: async () => ({ success: true, message: "removed" }),
                containerStatus: async () => ({ running: true, status: "running" }),
                composeUp: async (composePaths, projectName, deploymentId, envFilePath) => {
                    composeUpCalls.push({ composePaths, projectName, deploymentId, envFilePath });
                    return { success: true, message: "compose up" };
                },
                composeDown: async () => ({ success: true, message: "compose down" }),
                checkDockerInstalled: async () => true,
                checkComposeInstalled: async () => true,
                getProjectContainers: async () => [],
            }));

            const { deployWithDocker } = await import("./src/utils/deploy-docker.ts");
            const result = await deployWithDocker(
                {
                    appName: "empty-env-app",
                    releasePath: process.env.RELEASE_PATH,
                    versionId: 1,
                    onProgress: () => {},
                },
                {
                    runtime: "node",
                    buildSteps: [],
                    startCommand: "",
                    port: 3000,
                }
            );

            console.log(JSON.stringify({ result, composeUpCalls }));
            `,
            {
                HOME: home,
                RELEASE_PATH: releasePath,
            }
        );

        expect(data.result.success).toBe(false);
        expect(data.result.message).toContain(".env.production");
        expect(data.result.message).toContain("empty");
        expect(data.composeUpCalls).toHaveLength(0);
    });
});
