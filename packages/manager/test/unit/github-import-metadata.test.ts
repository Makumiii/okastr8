import { describe, expect, it } from "bun:test";
import { reconcileImportAppMetadata } from "../../src/commands/github";

describe("reconcileImportAppMetadata", () => {
    it("updates git branch metadata on re-import branch change", () => {
        const existing = {
            gitRepo: "https://github.com/Makumiii/okastr8-test-app.git",
            gitBranch: "v1-simple",
            branch: "v1-simple",
            webhookBranch: "v1-simple",
        };

        const { nextMeta, dirty } = reconcileImportAppMetadata(
            existing,
            "https://github.com/Makumiii/okastr8-test-app.git",
            "v5-user-dockerfile"
        );

        expect(dirty).toBe(true);
        expect(nextMeta.gitBranch).toBe("v5-user-dockerfile");
        expect(nextMeta.branch).toBe("v5-user-dockerfile");
        expect(nextMeta.webhookBranch).toBe("v5-user-dockerfile");
    });

    it("preserves intentionally custom webhook branch", () => {
        const existing = {
            gitRepo: "https://github.com/Makumiii/okastr8-test-app.git",
            gitBranch: "main",
            branch: "main",
            webhookBranch: "release",
        };

        const { nextMeta, dirty } = reconcileImportAppMetadata(
            existing,
            "https://github.com/Makumiii/okastr8-test-app.git",
            "feature-x"
        );

        expect(dirty).toBe(true);
        expect(nextMeta.gitBranch).toBe("feature-x");
        expect(nextMeta.branch).toBe("feature-x");
        expect(nextMeta.webhookBranch).toBe("release");
    });
});
