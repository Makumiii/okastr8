import { spawnSync } from "node:child_process";

export function getBaseUrl(): string {
    return process.env.OKASTR8_BASE_URL || "http://127.0.0.1:41788";
}

function extractHostFromBaseUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    return url.hostname;
}

export function createLiveTestToken(userId = "e2e-live-probe"): string {
    const result = spawnSync(
        "bun",
        [
            "--eval",
            `
      (async () => {
        const auth = await import('./src/commands/auth.ts');
        const generated = await auth.generateToken(${JSON.stringify(userId)}, '1h');
        console.log('TOKEN_JSON:' + JSON.stringify({ token: generated.token }));
      })().catch((err) => {
        console.error(String(err?.stack || err));
        process.exit(1);
      });
      `,
        ],
        { cwd: process.cwd(), encoding: "utf-8" }
    );

    if (result.status !== 0) {
        throw new Error(`Failed to generate live test token: ${result.stderr || result.stdout}`);
    }

    const combined = `${result.stdout}\n${result.stderr}`.split("\n").map((line) => line.trim());
    const tokenLine = combined.find((line) => line.startsWith("TOKEN_JSON:"));
    if (!tokenLine) {
        throw new Error(
            `Token output missing TOKEN_JSON marker. Output: ${result.stdout} ${result.stderr}`
        );
    }

    const parsed = JSON.parse(tokenLine.slice("TOKEN_JSON:".length)) as { token?: string };
    if (!parsed.token) {
        throw new Error("Generated token payload did not include token");
    }

    return parsed.token;
}

export async function setSessionCookie(
    context: import("@playwright/test").BrowserContext,
    token: string,
    baseUrl: string
): Promise<void> {
    const domain = extractHostFromBaseUrl(baseUrl);
    await context.addCookies([
        {
            name: "okastr8_session",
            value: token,
            domain,
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
        },
    ]);
}
