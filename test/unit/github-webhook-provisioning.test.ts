import { describe, expect, test } from "bun:test";
import {
    getGitHubWebhookCallbackUrl,
    planGitHubWebhookOperation,
    provisionGitHubRepositoryWebhook,
    resolveGitHubWebhookSecret,
    type GitHubWebhook,
} from "../../src/commands/github";

describe("GitHub webhook provisioning", () => {
    test("resolves callback URL from public URL before tunnel URL", () => {
        expect(
            getGitHubWebhookCallbackUrl({
                manager: { public_url: "https://okastr8.example.com///" },
                tunnel: { url: "https://tunnel.example.com" },
            })
        ).toBe("https://okastr8.example.com/api/github/webhook");
    });

    test("falls back to tunnel URL for callback URL", () => {
        expect(
            getGitHubWebhookCallbackUrl({
                tunnel: { url: "https://tunnel.example.com/" },
            })
        ).toBe("https://tunnel.example.com/api/github/webhook");
    });

    test("returns an existing webhook plan when the hook is already correct", () => {
        const hook: GitHubWebhook = {
            id: 123,
            active: true,
            events: ["push"],
            config: {
                url: "https://okastr8.example.com/api/github/webhook",
                content_type: "json",
            },
        };

        const plan = planGitHubWebhookOperation(
            [hook],
            "https://okastr8.example.com/api/github/webhook"
        );

        expect(plan.action).toBe("exists");
        expect(plan.hook?.id).toBe(123);
    });

    test("updates a stale matching webhook instead of creating a duplicate", () => {
        const hook: GitHubWebhook = {
            id: 123,
            active: false,
            events: ["issues"],
            config: {
                url: "https://okastr8.example.com/api/github/webhook",
                content_type: "form",
            },
        };

        const plan = planGitHubWebhookOperation(
            [hook],
            "https://okastr8.example.com/api/github/webhook"
        );

        expect(plan.action).toBe("update");
        expect(plan.hook?.id).toBe(123);
    });

    test("creates a webhook when none points at the callback URL", () => {
        const plan = planGitHubWebhookOperation(
            [
                {
                    id: 123,
                    active: true,
                    events: ["push"],
                    config: { url: "https://other.example.com/api/github/webhook" },
                },
            ],
            "https://okastr8.example.com/api/github/webhook"
        );

        expect(plan.action).toBe("create");
    });

    test("reuses an existing webhook secret and generates one when missing", async () => {
        expect(
            await resolveGitHubWebhookSecret(
                { manager: { github: { webhook_secret: "existing-secret" } } },
                async () => {
                    throw new Error("should not persist");
                },
                () => "new-secret"
            )
        ).toBe("existing-secret");

        let persisted = "";
        const generated = await resolveGitHubWebhookSecret(
            { manager: { github: { access_token: "token" } } },
            async (secret) => {
                persisted = secret;
            },
            () => "generated-secret"
        );

        expect(generated).toBe("generated-secret");
        expect(persisted).toBe("generated-secret");
    });

    test("creates missing webhook through GitHub API", async () => {
        const requests: Array<{ url: string; method: string; body?: any }> = [];
        const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            requests.push({
                url: String(url),
                method: init?.method || "GET",
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            if (!init?.method || init.method === "GET") {
                return jsonResponse([]);
            }
            return jsonResponse({ id: 456, active: true, events: ["push"] }, 201);
        };

        const result = await provisionGitHubRepositoryWebhook({
            accessToken: "token",
            repoFullName: "Makumiii/example",
            callbackUrl: "https://okastr8.example.com/api/github/webhook",
            secret: "secret",
            fetchImpl,
        });

        expect(result.action).toBe("created");
        expect(requests.map((request) => request.method)).toEqual(["GET", "POST"]);
        expect(requests[1].body).toMatchObject({
            name: "web",
            active: true,
            events: ["push"],
            config: {
                url: "https://okastr8.example.com/api/github/webhook",
                content_type: "json",
                secret: "secret",
            },
        });
    });

    test("patches stale webhook through GitHub API", async () => {
        const requests: Array<{ url: string; method: string }> = [];
        const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            requests.push({ url: String(url), method: init?.method || "GET" });
            if (!init?.method || init.method === "GET") {
                return jsonResponse([
                    {
                        id: 456,
                        active: false,
                        events: ["issues"],
                        config: {
                            url: "https://okastr8.example.com/api/github/webhook",
                            content_type: "form",
                        },
                    },
                ]);
            }
            return jsonResponse({ id: 456, active: true, events: ["push"] });
        };

        const result = await provisionGitHubRepositoryWebhook({
            accessToken: "token",
            repoFullName: "Makumiii/example",
            callbackUrl: "https://okastr8.example.com/api/github/webhook",
            secret: "secret",
            fetchImpl,
        });

        expect(result.action).toBe("updated");
        expect(requests.map((request) => request.method)).toEqual(["GET", "PATCH"]);
        expect(requests[1].url).toEndWith("/repos/Makumiii/example/hooks/456");
    });

    test("reports GitHub permission failures clearly", async () => {
        const result = provisionGitHubRepositoryWebhook({
            accessToken: "token",
            repoFullName: "Makumiii/example",
            callbackUrl: "https://okastr8.example.com/api/github/webhook",
            secret: "secret",
            fetchImpl: async () =>
                jsonResponse({ message: "Resource not accessible by integration" }, 403),
        });

        await expect(result).rejects.toThrow(
            "GitHub webhook API failed: 403 Resource not accessible by integration"
        );
    });
});

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
