import { describe, expect, test } from "bun:test";
import { assertAllowedComposeArgs, assertAllowedDockerArgs } from "../../src/commands/docker";

describe("docker command guards", () => {
    test("allows expected docker subcommands", () => {
        expect(() => assertAllowedDockerArgs(["pull", "nginx:latest"])).not.toThrow();
        expect(() => assertAllowedDockerArgs(["ps", "-a"])).not.toThrow();
        expect(() => assertAllowedDockerArgs(["run", "-d", "--name", "x", "nginx:latest"])).not.toThrow();
    });

    test("blocks unsupported docker subcommands", () => {
        expect(() => assertAllowedDockerArgs(["container", "prune", "-f"])).toThrow();
    });

    test("blocks dangerous docker run privilege flags", () => {
        expect(() =>
            assertAllowedDockerArgs(["run", "--privileged", "alpine", "sh"])
        ).toThrow();
        expect(() =>
            assertAllowedDockerArgs(["run", "-v", "/:/host", "alpine", "sh"])
        ).toThrow();
    });
});

describe("compose command guards", () => {
    test("allows compose up/down patterns", () => {
        expect(() =>
            assertAllowedComposeArgs(["-f", "/tmp/docker-compose.yml", "-p", "app", "up", "-d", "--build"])
        ).not.toThrow();
        expect(() =>
            assertAllowedComposeArgs(["-f", "/tmp/docker-compose.yml", "-p", "app", "down"])
        ).not.toThrow();
    });

    test("blocks unsupported compose operations", () => {
        expect(() => assertAllowedComposeArgs(["run", "--rm", "svc", "sh"])).toThrow();
        expect(() => assertAllowedComposeArgs(["exec", "svc", "sh"])).toThrow();
    });
});
