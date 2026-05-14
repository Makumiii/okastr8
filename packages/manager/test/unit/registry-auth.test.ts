import { describe, expect, it } from "bun:test";
import { deriveEcrRegionFromServer } from "../../src/commands/registry";

describe("deriveEcrRegionFromServer", () => {
    it("extracts region from private ECR registry hostname", () => {
        expect(deriveEcrRegionFromServer("123456789012.dkr.ecr.us-east-1.amazonaws.com")).toBe(
            "us-east-1"
        );
        expect(deriveEcrRegionFromServer("555555555555.dkr.ecr.eu-west-2.amazonaws.com")).toBe(
            "eu-west-2"
        );
    });

    it("returns undefined for non-ECR hosts", () => {
        expect(deriveEcrRegionFromServer("ghcr.io")).toBeUndefined();
        expect(deriveEcrRegionFromServer("docker.io")).toBeUndefined();
    });
});
