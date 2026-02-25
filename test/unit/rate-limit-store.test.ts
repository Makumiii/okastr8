import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const originalHome = process.env.HOME;
const originalSudo = process.env.SUDO_USER;
let tempHome = "";

beforeAll(() => {
    tempHome = mkdtempSync(join(tmpdir(), "okastr8-rate-limit-"));
    process.env.HOME = tempHome;
    delete process.env.SUDO_USER;
});

afterAll(() => {
    if (tempHome) rmSync(tempHome, { recursive: true, force: true });
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalSudo === undefined) delete process.env.SUDO_USER;
    else process.env.SUDO_USER = originalSudo;
});

describe("rate limit store", () => {
    test("tracks counts across repeated requests and enforces max", async () => {
        const { checkAndBumpRateLimit } = await import("../../src/utils/rate-limit-store");
        const key = `k1-${Date.now()}-${Math.random()}`;
        const first = await checkAndBumpRateLimit({ key, windowMs: 60_000, max: 2 });
        const second = await checkAndBumpRateLimit({ key, windowMs: 60_000, max: 2 });
        const third = await checkAndBumpRateLimit({ key, windowMs: 60_000, max: 2 });

        expect(first.limited).toBeFalse();
        expect(second.limited).toBeFalse();
        expect(third.limited).toBeTrue();
        expect((third.retryAfter || 0) > 0).toBeTrue();
    });
});
