import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { login, callback } from "./auth";
import { api } from "./_generated/api";

// Use Web Crypto API (available in the Convex runtime) for HMAC verification
async function computeHmacHex(payload: string, secret: string) {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const http = httpRouter();

// OAuth Login Route
http.route({
  path: "/api/github/login",
  method: "GET",
  handler: login,
});

// OAuth Callback Route
http.route({
  path: "/api/github/callback",
  method: "GET",
  handler: callback,
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
    const digestHex = await computeHmacHex(payload, WEBHOOK_SECRET);
    const digest = `sha256=${digestHex}`;

    if (!constantTimeEquals(signature, digest)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(payload);
    
    // Process the event asynchronously
    await ctx.runAction(api.webhooks.handleEvent, { payload: event });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
