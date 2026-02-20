import { describe, expect, it } from "bun:test";
import { resolveDeployStrategy } from "../../src/utils/deploy-strategy";

describe("resolveDeployStrategy", () => {
    it("defaults to git for legacy metadata", () => {
        expect(resolveDeployStrategy({})).toBe("git");
        expect(resolveDeployStrategy({ gitRepo: "https://github.com/org/repo.git" })).toBe("git");
    });

    it("respects explicit image strategy", () => {
        expect(
            resolveDeployStrategy({ deployStrategy: "image", imageRef: "ghcr.io/org/app:latest" })
        ).toBe("image");
    });

    it("respects explicit git strategy", () => {
        expect(resolveDeployStrategy({ deployStrategy: "git" })).toBe("git");
    });

    it("falls back to git on invalid strategy strings", () => {
        expect(resolveDeployStrategy({ deployStrategy: "unknown" })).toBe("git");
    });
});
