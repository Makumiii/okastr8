import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { createHmac, timingSafeEqual } from "crypto";

const http = httpRouter();

// OAuth Login Route
http.route({
  path: "/api/github/login",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return await ctx.runAction(api.auth.login, { request });
  }),
});

// OAuth Callback Route
http.route({
    path: "/api/github/callback",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
        return await ctx.runAction(api.auth.callback, { request });
    }),
});

// Webhook Secret
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;

http.route({
  path: "/api/github/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) return new Response("Missing signature", { status: 401 });

    const payload = await request.text();
    const hmac = createHmac("sha256", WEBHOOK_SECRET);
    const digest = "sha256=" + hmac.update(payload).digest("hex");

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(payload);
    
    // Process the event asynchronously
    await ctx.runAction(api.webhooks.handleEvent, { payload: event });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
