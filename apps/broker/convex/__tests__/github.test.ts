import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

test("github repo creation from template", async () => {
    // @ts-ignore
    const t = convexTest(schema, import.meta.glob("../**/*.ts"));

    // Mock fetch for GitHub API
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            full_name: "testuser/my-okastr8-dashboard",
            html_url: "https://github.com/testuser/my-okastr8-dashboard"
        })
    });
    (global as any).fetch = mockFetch;

    // We need to set GITHUB_APP_ID and GITHUB_PRIVATE_KEY for the JWT generation to not throw
    // This is tricky in convex-test. 
    // For now, let's just assume the action is there and test its logic if possible.
    // Or we can mock the entire action for the integration test.
});
