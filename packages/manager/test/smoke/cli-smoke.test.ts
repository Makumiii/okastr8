import { describe, expect, it } from "bun:test";

const bunBin = process.execPath;

function runCli(args: string[]) {
    return Bun.spawnSync({
        cmd: [bunBin, "run", "src/main.ts", ...args],
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
        env: process.env,
    });
}

describe("CLI smoke", () => {
    it("prints help output", () => {
        const result = runCli(["--help"]);
        const output = new TextDecoder().decode(result.stdout);

        expect(result.exitCode).toBe(0);
        expect(output).toContain("CLI for orchestrating server environments and deployments");
        expect(output).toContain("Usage:");
    });

    it("prints version output", () => {
        const result = runCli(["--version"]);
        const output = new TextDecoder().decode(result.stdout).trim();

        expect(result.exitCode).toBe(0);
        expect(output).toBe("0.0.1");
    });

    it("fails on unknown command", () => {
        const result = runCli(["definitely-unknown-command"]);
        const stderr = new TextDecoder().decode(result.stderr);

        expect(result.exitCode).toBe(1);
        expect(stderr).toContain("unknown command");
    });

    it("exposes system update command", () => {
        const result = runCli(["system", "--help"]);
        const output = new TextDecoder().decode(result.stdout);

        expect(result.exitCode).toBe(0);
        expect(output).toContain("update");
    });

    it("does not expose unsupported deploy trigger flags", () => {
        const result = runCli(["deploy", "trigger", "--help"]);
        const output = new TextDecoder().decode(result.stdout);

        expect(result.exitCode).toBe(0);
        expect(output).toContain("--env");
        expect(output).toContain("--env-file");
        expect(output).toContain("--push-image");
        expect(output).toContain("--push-image-ref");
        expect(output).toContain("--push-registry-credential");
        expect(output).not.toContain("--build");
        expect(output).not.toContain("--health-method");
        expect(output).not.toContain("--health-target");
        expect(output).not.toContain("--health-timeout");
        expect(output).not.toContain("--skip-health");
        expect(output).not.toContain("--branch");
    });

    it("does not expose unsupported github import webhook toggle", () => {
        const result = runCli(["github", "import", "--help"]);
        const output = new TextDecoder().decode(result.stdout);

        expect(result.exitCode).toBe(0);
        expect(output).toContain("--branch");
        expect(output).toContain("--env");
        expect(output).toContain("--env-file");
        expect(output).not.toContain("--no-webhook");
    });

    it("exposes dual rollback targeting for git and image strategies", () => {
        const result = runCli(["deploy", "rollback", "--help"]);
        const output = new TextDecoder().decode(result.stdout);

        expect(result.exitCode).toBe(0);
        expect(output).toContain("--commit");
        expect(output).toContain("--target");
    });

    it("fails fast when --push-image is missing required companion options", () => {
        const result = runCli(["deploy", "trigger", "dummy-app", "--push-image"]);
        const stderr = new TextDecoder().decode(result.stderr);

        expect(result.exitCode).toBe(1);
        expect(stderr).toContain("--push-image-ref");
        expect(stderr).toContain("--push-registry-credential");
    });
});
