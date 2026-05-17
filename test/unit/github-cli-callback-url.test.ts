import { describe, expect, test } from "bun:test";
import { getCliGitHubCallbackUrl } from "../../src/commands/github-cli";

describe("getCliGitHubCallbackUrl", () => {
    test("uses manager.public_url when set", () => {
        const callback = getCliGitHubCallbackUrl({
            manager: { public_url: "https://okastr8.makumitech.co.ke" },
            tunnel: { url: "https://fallback.example.com" },
        });
        expect(callback).toBe("https://okastr8.makumitech.co.ke/api/github/callback");
    });

    test("falls back to tunnel.url when manager.public_url is missing", () => {
        const callback = getCliGitHubCallbackUrl({
            tunnel: { url: "https://okastr8.example.com" },
        });
        expect(callback).toBe("https://okastr8.example.com/api/github/callback");
    });

    test("falls back to localhost when no public url exists", () => {
        const callback = getCliGitHubCallbackUrl({});
        expect(callback).toBe("http://localhost:41788/api/github/callback");
    });

    test("normalizes trailing slashes", () => {
        const callback = getCliGitHubCallbackUrl({
            manager: { public_url: "https://okastr8.example.com///" },
        });
        expect(callback).toBe("https://okastr8.example.com/api/github/callback");
    });
});
