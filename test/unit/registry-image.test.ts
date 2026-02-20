import { describe, expect, it } from "bun:test";
import { resolveRegistryServer } from "../../src/utils/registry-image";

describe("resolveRegistryServer", () => {
    it("detects explicit registry host prefixes", () => {
        expect(resolveRegistryServer("ghcr.io/org/app:1")).toBe("ghcr.io");
        expect(
            resolveRegistryServer("123456789012.dkr.ecr.us-east-1.amazonaws.com/app:latest")
        ).toBe("123456789012.dkr.ecr.us-east-1.amazonaws.com");
    });

    it("defaults docker hub style refs to docker.io", () => {
        expect(resolveRegistryServer("traefik/whoami:latest")).toBe("docker.io");
        expect(resolveRegistryServer("nginx:alpine")).toBe("docker.io");
    });
});
