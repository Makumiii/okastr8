import { describe, expect, it } from "bun:test";
import { normalizeImageRef, resolveRegistryServer } from "../../src/utils/registry-image";

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

describe("normalizeImageRef", () => {
    it("lowercases registry and repository path while preserving tag", () => {
        expect(normalizeImageRef("ghcr.io/Makumiii/Okastr8-Test-App:Phase7")).toBe(
            "ghcr.io/makumiii/okastr8-test-app:Phase7"
        );
    });

    it("preserves digest suffix while lowercasing repository path", () => {
        expect(normalizeImageRef("GHCR.IO/Makumiii/Okastr8-Test-App@sha256:abc123def456")).toBe(
            "ghcr.io/makumiii/okastr8-test-app@sha256:abc123def456"
        );
    });
});
