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

    test("github deploy page supports strategy toggle and publish form reveal", async ({
        context,
        page,
    }) => {
        const token = createLiveTestToken("e2e-github-deploy-strategy-toggle-user");
        await setSessionCookie(context, token, BASE_URL);

        await page.goto(`${BASE_URL}/github/deploy/Makumiii%2Fokastr8-test-app`);
        await expect(page.getByRole("heading", { name: /deploy okastr8-test-app/i })).toBeVisible();

        const yamlButton = page.getByRole("button", { name: /okastr8\.yaml/i });
        const dockerButton = page.getByRole("button", { name: /dockerfile \/ compose/i });
        await expect(yamlButton).toBeVisible();
        await expect(dockerButton).toBeVisible();

        if (!(await dockerButton.isDisabled())) {
            await dockerButton.click();
            await expect(page.locator("#docker-port")).toBeVisible();
            await yamlButton.click();
            await expect(page.locator("#docker-port")).toHaveCount(0);
        }

        await page.getByRole("checkbox", { name: /enable/i }).check();
        await expect(page.locator("#publish-image-ref")).toBeVisible();
        await expect(page.locator("#publish-credential")).toBeVisible();
    });

    test("github deploy page surfaces env validation errors before deploy", async ({
        context,
        page,
    }) => {
        const token = createLiveTestToken("e2e-github-env-validation-user");
        await setSessionCookie(context, token, BASE_URL);

        await page.goto(`${BASE_URL}/github/deploy/Makumiii%2Fokastr8-test-app`);
        await expect(page.getByRole("heading", { name: /deploy okastr8-test-app/i })).toBeVisible();

        const keyInputs = page.locator('input[placeholder="KEY"]');
        await keyInputs.first().fill("1INVALID_KEY");
        await expect(page.getByText(/invalid keys/i)).toBeVisible();

        await keyInputs.first().fill("DUP_KEY");
        await page.getByRole("button", { name: /\+ add variable/i }).click();
        await keyInputs.nth(1).fill("DUP_KEY");
        await expect(page.getByText(/duplicate keys/i)).toBeVisible();
    });
});
