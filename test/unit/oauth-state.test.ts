import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const originalHome = process.env.HOME;
const originalSudo = process.env.SUDO_USER;
let tempHome = "";

beforeAll(() => {
    tempHome = mkdtempSync(join(tmpdir(), "okastr8-oauth-state-"));
    process.env.HOME = tempHome;
    delete process.env.SUDO_USER;
});

afterAll(() => {
    if (tempHome) rmSync(tempHome, { recursive: true, force: true });
    if (originalHome === undefined) {
        delete process.env.HOME;
    } else {
        process.env.HOME = originalHome;
    }
    if (originalSudo === undefined) {
        delete process.env.SUDO_USER;
    } else {
        process.env.SUDO_USER = originalSudo;
    }
});

describe("oauth state store", () => {
    test("issues and consumes state exactly once", async () => {
        const { issueOAuthState, consumeOAuthState } = await import("../../src/utils/oauth-state");
        const state = await issueOAuthState("login");

        expect(state.startsWith("login_")).toBeTrue();
        expect(await consumeOAuthState(state, "login")).toBeTrue();
        expect(await consumeOAuthState(state, "login")).toBeFalse();
    });

    test("rejects state for wrong flow prefix", async () => {
        const { issueOAuthState, consumeOAuthState } = await import("../../src/utils/oauth-state");
        const state = await issueOAuthState("connect");

        expect(await consumeOAuthState(state, "login")).toBeFalse();
    });
});
