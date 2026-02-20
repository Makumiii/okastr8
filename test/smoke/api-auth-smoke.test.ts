import { describe, expect, it } from "bun:test";
import api from "../../src/api";

function assertEnvelope(body: unknown) {
    expect(body).toBeObject();
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("message");
}

describe("API auth smoke", () => {
    it("rejects protected routes without authentication", async () => {
        const response = await api.request("/system/status", {
            method: "GET",
        });

        expect(response.status).toBe(401);

        const body = await response.json();
        assertEnvelope(body);
        expect(body).toMatchObject({
            success: false,
            message: "Authentication required",
        });
    });

    it("returns not-authenticated response for auth/me without session cookie", async () => {
        const response = await api.request("/auth/me", {
            method: "GET",
        });

        expect(response.status).toBe(401);

        const body = await response.json();
        assertEnvelope(body);
        expect(body).toMatchObject({
            success: false,
            message: "Not authenticated",
        });
    });

    it("allows logout without auth and clears session cookie", async () => {
        const response = await api.request("/auth/logout", {
            method: "POST",
        });

        expect(response.status).toBe(200);
        const setCookie = response.headers.get("set-cookie") || "";
        expect(setCookie).toContain("okastr8_session=;");
        expect(setCookie).toContain("Max-Age=0");

        const body = await response.json();
        assertEnvelope(body);
        expect(body).toMatchObject({
            success: true,
            message: "Logged out",
        });
    });
});
