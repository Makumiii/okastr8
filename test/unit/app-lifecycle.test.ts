import { expect, test } from "bun:test";

function runIsolatedScript(scriptBody: string): any {
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

test("stopping a Compose app stops every project container", () => {
    const data = runIsolatedScript(`
        const { mock } = await import("bun:test");
        const stopped = [];

        mock.module("./src/commands/docker", () => ({
            assertAllowedDockerArgs: () => {},
            assertAllowedComposeArgs: () => {},
            buildImage: async () => ({ success: true, message: "built" }),
            imageExists: async () => false,
            pullImage: async () => ({ success: true, message: "pulled" }),
            tagImage: async () => ({ success: true, message: "tagged" }),
            pushImage: async () => ({ success: true, message: "pushed" }),
            dockerLogin: async () => ({ success: true, message: "logged in" }),
            dockerLogout: async () => ({ success: true, message: "logged out" }),
            inspectImageDigest: async () => undefined,
            containerStatus: async (name) =>
                name === "compose-app"
                    ? { running: false, status: "not found" }
                    : { running: false, status: "not found" },
            containerLogs: async () => "",
            runContainer: async () => ({ success: true, message: "running" }),
            startContainer: async () => ({ success: true, message: "started" }),
            stopContainer: async (name) => {
                stopped.push(name);
                return { success: true, message: "stopped " + name };
            },
            restartContainer: async () => ({ success: true, message: "restarted" }),
            removeContainer: async () => ({ success: true, message: "removed" }),
            inspectContainer: async () => ({ success: true, output: "" }),
            startAppTunnelContainer: async () => ({ success: true, message: "tunnel started" }),
            stopAppTunnelContainer: async () => ({ success: true, message: "tunnel stopped" }),
            composeUp: async () => ({ success: true, message: "compose up" }),
            composeDown: async () => ({ success: true, message: "compose down" }),
            buildComposeUpArgs: () => [],
            systemDfVerbose: async () => ({ success: true, output: "" }),
            checkDockerInstalled: async () => true,
            checkComposeInstalled: async () => true,
            listContainers: async () => [],
            getProjectContainers: async (name) =>
                name === "compose-app"
                    ? [
                          { name: "compose-app-db-1", status: "running" },
                          { name: "compose-app-odoo-1", status: "running" },
                      ]
                    : [],
        }));

        const { stopApp } = await import("./src/commands/app");
        const result = await stopApp("compose-app");
        console.log(JSON.stringify({ result, stopped }));
    `);

    expect(data.result).toMatchObject({ success: true });
    expect(data.stopped).toEqual(["compose-app-db-1", "compose-app-odoo-1"]);
});
