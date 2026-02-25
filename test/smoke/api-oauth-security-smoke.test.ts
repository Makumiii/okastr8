import { describe, expect, it } from "bun:test";
import api from "../../src/api";
import { getSystemConfig } from "../../src/config";

async function callbackHeaders() {
    const config = await getSystemConfig();
    const configuredUrl = config.manager?.public_url || config.tunnel?.url;
    if (!configuredUrl) return {};
    const parsed = new URL(configuredUrl);
    return {
        host: parsed.host,
        "x-forwarded-proto": parsed.protocol.replace(":", ""),
    };
}

describe("API OAuth/session security smoke", () => {
    it("rejects github callback without state parameter", async () => {
        const response = await api.request("/github/callback?code=fake-code", {
            method: "GET",
            headers: await callbackHeaders(),
        });
        expect(response.status).toBe(302);
        const location = response.headers.get("location") || "";
        expect(location).toContain("error=missing_state");
    });

    it("rejects github callback with unrecognized state parameter", async () => {
        const response = await api.request("/github/callback?code=fake-code&state=login_invalid", {
            method: "GET",
            headers: await callbackHeaders(),
        });
        expect(response.status).toBe(302);
        const location = response.headers.get("location") || "";
        expect(location).toContain("error=invalid_state");
    });

    it("sets secure session cookie attributes on https logout responses", async () => {
        const response = await api.request("/auth/logout", {
            method: "POST",
            headers: {
                "x-forwarded-proto": "https",
            },
        });
        expect(response.status).toBe(200);
        const setCookie = response.headers.get("set-cookie") || "";
        expect(setCookie).toContain("okastr8_session=;");
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("SameSite=Strict");
        expect(setCookie).toContain("Secure");
    });

    it("rate limits repeated oauth login entry requests per client IP", async () => {
        let limitedStatus = 0;
        for (let i = 0; i < 12; i++) {
            const response = await api.request("/auth/github", {
                method: "GET",
                headers: {
                    "x-forwarded-for": "203.0.113.99",
                },
            });
            limitedStatus = response.status;
        }
        expect(limitedStatus).toBe(302);

        const blocked = await api.request("/auth/github", {
            method: "GET",
            headers: {
                "x-forwarded-for": "203.0.113.99",
            },
        });
        expect(blocked.status).toBe(302);
        const location = blocked.headers.get("location") || "";
        expect(location).toContain("error=rate_limited");
    });
});
