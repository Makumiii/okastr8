import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

export const login = httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const redirect_uri = url.searchParams.get("redirect_uri");
    
    if (!state) return new Response("Missing state (userCode)", { status: 400 });

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
    
    // Pack state and redirect_uri
    const oauthState = redirect_uri ? `${state}|${redirect_uri}` : state;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&state=${oauthState}&scope=repo,user`;
    
    return Response.redirect(githubUrl);
});

export const callback = httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const oauthState = url.searchParams.get("state") || "";
    
    const [state, customRedirect] = oauthState.split("|");

    if (!code) return new Response("Missing code", { status: 400 });

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
        }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
        return new Response(tokenData.error_description || tokenData.error, { status: 400 });
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user info
    const userResponse = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "okastr8-broker",
        },
    });

    const userData = await userResponse.json();
    
    // 3. Create or update user in Convex
    const userId = await ctx.runMutation(api.users.create, {
        githubUserId: userData.id,
        githubUsername: userData.login,
    });

    // 4. Redirect
    if (customRedirect) {
        return Response.redirect(`${customRedirect}?userId=${userId}&code=${state}`);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return Response.redirect(`${frontendUrl}/link?code=${state}&userId=${userId}`);
});

import { query } from "./_generated/server";
import { v } from "convex/values";

export const verifyLogin = query({
    args: { state: v.string(), userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        return user || null;
    }
});
