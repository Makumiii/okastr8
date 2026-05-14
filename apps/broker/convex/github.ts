import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import * as jose from "jose";

/**
 * Generates a GitHub App JWT for authentication.
 */
async function generateAppJWT() {
    const appId = process.env.GITHUB_APP_ID!;
    const privateKey = process.env.GITHUB_PRIVATE_KEY!;

    // Clean up the private key format if it's passed as a single line
    const formattedKey = privateKey.includes("-----BEGIN") 
        ? privateKey 
        : `-----BEGIN RSA PRIVATE KEY-----\n${privateKey}\n-----END RSA PRIVATE KEY-----`;

    const alg = "RS256";
    const pkcs8 = await jose.importPKCS8(formattedKey, alg);

    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose.SignJWT({})
        .setProtectedHeader({ alg })
        .setIssuedAt(now - 60)
        .setExpirationTime(now + (10 * 60)) // 10 minutes
        .setIssuer(appId)
        .sign(pkcs8);

    return jwt;
}

/**
 * Gets an Installation Access Token (IAT) for a specific installation.
 */
export const getInstallationToken = action({
    args: { installationId: v.number() },
    handler: async (ctx, args) => {
        const jwt = await generateAppJWT();

        const response = await fetch(
            `https://api.github.com/app/installations/${args.installationId}/access_tokens`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${jwt}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "okastr8-broker",
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get installation token: ${error}`);
        }

        const data = await response.json();
        return data.token as string;
    },
});

/**
 * Creates a new private repository from the Okastr8 Dashboard template.
 */
export const createDashboardRepo = action({
    args: { 
        userId: v.id("users"), 
        repoName: v.string() 
    },
    handler: async (ctx, args): Promise<{ fullName: string; cloneUrl: string }> => {
        // 1. Get user's installation
        const installations = await ctx.runQuery(api.installations.getByUserId, {
            userId: args.userId
        });

        if (installations.length === 0) {
            throw new Error("No GitHub App installation found. Please install the App first.");
        }

        const installation = installations[0];

        // 2. Get Installation Token
        const jwt: string = await generateAppJWT();
        const tokenResponse = await fetch(
            `https://api.github.com/app/installations/${installation.githubInstallationId}/access_tokens`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${jwt}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "okastr8-broker",
                },
            }
        );

        if (!tokenResponse.ok) {
            throw new Error("Failed to get installation token");
        }
        const { token }: { token: string } = await tokenResponse.json();

        // 3. Create repo from template
        const templateOwner = "okastr8";
        const templateRepo = "dashboard-template";

        const response = await fetch(
            `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "Content-Type": "application/json",
                    "User-Agent": "okastr8-broker",
                },
                body: JSON.stringify({
                    name: args.repoName,
                    private: true,
                    description: "My Okastr8 Dashboard",
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create repository: ${error.message}`);
        }

        const data: { full_name: string; clone_url: string } = await response.json();
        return {
            fullName: data.full_name,
            cloneUrl: data.clone_url,
        };
    },
});
