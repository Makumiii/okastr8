import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/github/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // This would be the userCode

    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

    // 1. Exchange code for GitHub token (skipped for now, just mock)
    // 2. Get GitHub user info (skipped for now)
    
    // For now, let's assume we have a user and we authorize the device code
    // In a real app, we'd do the fetch here.
    
    // Mock user identification
    const githubUserId = 12345; 
    const githubUsername = "mockuser";

    const user = await ctx.runQuery(api.users.getByGitHubId, { githubUserId });
    let userId;
    if (!user) {
        userId = await ctx.runMutation(api.users.create, { githubUserId, githubUsername });
    } else {
        userId = user._id;
    }

    try {
        await ctx.runMutation(api.deviceCodes.authorize, { userCode: state, userId });
        return Response.redirect(`${url.origin}/success`);
    } catch (e) {
        return new Response("Invalid or expired code", { status: 400 });
    }
  }),
});

http.route({
  path: "/api/github/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = await request.json();
    console.log("Received webhook:", payload);
    
    // Logic to route to the correct server via Convex subscriptions
    // We'll insert a record that the server is watching.
    
    return new Response("OK", { status: 200 });
  }),
});

export default http;
