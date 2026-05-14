import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

export const login = httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    
    if (!state) return new Response("Missing state (userCode)", { status: 400 });

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
    // Note: In a real app, we should store state in a cookie/session to prevent CSRF
    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&state=${state}&scope=repo,user`;
    
    return Response.redirect(redirectUrl);
});

export const callback = httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // This is our userCode (e.g. ABCD-1234)

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

    // 4. Redirect to the linking page on the frontend
    // We pass the state (userCode) and the userId so the frontend can finish the link
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return Response.redirect(`${frontendUrl}/link?code=${state}&userId=${userId}`);
});
