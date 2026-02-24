import { expect, test } from "@playwright/test";
import { createLiveTestToken, getBaseUrl, setSessionCookie } from "./live-auth.helpers";

const BASE_URL = getBaseUrl();

test.describe("live container deploy UI", () => {
    test("authenticated session can open container deploy page", async ({ context, page }) => {
        const token = createLiveTestToken("e2e-container-page-user");
        await setSessionCookie(context, token, BASE_URL);

        await page.goto(`${BASE_URL}/container`);
        await expect(page.getByRole("heading", { name: /container deploy/i })).toBeVisible();
        await expect(page.getByLabel(/provider/i)).toBeVisible();
        await expect(page.getByLabel(/registry credential/i)).toBeVisible();
        await expect(page.getByLabel(/image reference/i)).toBeVisible();
    });

    test("github deploy page shows publish built image controls", async ({ context, page }) => {
        const token = createLiveTestToken("e2e-github-publish-ui-user");
        await setSessionCookie(context, token, BASE_URL);

        await page.goto(`${BASE_URL}/github/deploy/Makumiii%2Fokastr8-test-app`);
        await expect(page.getByRole("heading", { name: /deploy okastr8-test-app/i })).toBeVisible();
        await expect(page.getByText(/publish built image/i)).toBeVisible();
    });
});
