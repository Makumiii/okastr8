import { describe, expect, test } from "bun:test";
import { resolveGitRollbackTarget, type GitRollbackVersion } from "../../src/commands/deploy";

describe("resolveGitRollbackTarget", () => {
    const versions: GitRollbackVersion[] = [
        { id: 1, commit: "abc1111", status: "active" },
        { id: 2, commit: "def2222", status: "active" },
        { id: 3, commit: "fed3333", status: "failed" },
    ];

    test("selects previous non-failed version when no target provided", () => {
        const selected = resolveGitRollbackTarget(versions, 2, undefined);
        expect(selected).toBe(1);
    });

    test("selects explicit numeric version target", () => {
        const selected = resolveGitRollbackTarget(versions, 2, "1");
        expect(selected).toBe(1);
    });

    test("selects commit-prefix target", () => {
        const selected = resolveGitRollbackTarget(versions, 2, "def");
        expect(selected).toBe(2);
    });

    test("returns null for unknown target", () => {
        const selected = resolveGitRollbackTarget(versions, 2, "nope");
        expect(selected).toBeNull();
    });

    test("returns null when no fallback exists", () => {
        const onlyCurrent: GitRollbackVersion[] = [{ id: 7, commit: "abc", status: "active" }];
        const selected = resolveGitRollbackTarget(onlyCurrent, 7, undefined);
        expect(selected).toBeNull();
    });
});
