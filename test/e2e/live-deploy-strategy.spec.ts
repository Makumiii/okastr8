import { expect, test } from "@playwright/test";
import { createLiveTestToken, getBaseUrl, setSessionCookie } from "./live-auth.helpers";

const BASE_URL = getBaseUrl();

test.describe("live deploy strategy UI", () => {
    test("authenticated session can open deploy strategy page and see both strategies", async ({
        context,
        page,
    }) => {
        const token = createLiveTestToken("e2e-deploy-strategy-user");
        await setSessionCookie(context, token, BASE_URL);

        await page.goto(`${BASE_URL}/deploy`);
        await expect(page.getByRole("heading", { name: /deploy/i })).toBeVisible();
        await expect(page.getByText(/github strategy/i)).toBeVisible();
        await expect(page.getByText(/container strategy/i)).toBeVisible();
    });

    test("strategy cards navigate to GitHub and Container flows", async ({ context, page }) => {
        const token = createLiveTestToken("e2e-deploy-strategy-nav-user");
        await setSessionCookie(context, token, BASE_URL);

        await page.goto(`${BASE_URL}/deploy`);
        await page.getByRole("heading", { name: /deploy/i }).waitFor();

        await page.locator('a[href="/github"]').first().click();
        await expect(page).toHaveURL(/\/github$/);

        await page.goto(`${BASE_URL}/deploy`);
        await page.locator('a[href="/container"]').first().click();
        await expect(page).toHaveURL(/\/container$/);
    });
});
