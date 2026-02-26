import { describe, expect, test } from "bun:test";
import { parseTunnelTokenFromEnv } from "../../src/services/startup-reconcile";

describe("startup reconcile env parsing", () => {
    test("extracts tunnel token from env content", () => {
        const content = "FOO=bar\nTUNNEL_TOKEN='abc123'\nBAR=baz\n";
        expect(parseTunnelTokenFromEnv(content)).toBe("abc123");
    });

    test("returns undefined when no tunnel token exists", () => {
        const content = "FOO=bar\nBAR=baz\n";
        expect(parseTunnelTokenFromEnv(content)).toBeUndefined();
    });
});
