import { action } from "./_generated/server";
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
 * Gets an Installation Access Token for a repository name.
 * This is what the manager will call.
 */
export const getInstallationTokenForRepo = action({
    args: { repoFullName: v.string() },
    handler: async (ctx, args) => {
        // 1. Find the installation ID for this repo
        const result = await ctx.runQuery(api.installations.getByRepoName, {
            fullName: args.repoFullName,
        });

        if (!result || !result.installation) {
            throw new Error(`No installation found for repository: ${args.repoFullName}`);
        }

        // 2. Generate token for this installation
        const jwt = await generateAppJWT();
        const response = await fetch(
            `https://api.github.com/app/installations/${result.installation.githubInstallationId}/access_tokens`,
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
