import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const queueEvent = mutation({
  args: { installationId: v.number(), payload: v.any() },
  handler: async (ctx, args) => {
    // 1. Find the installation
    const installation = await ctx.db
      .query("installations")
      .withIndex("by_github_installation_id", (q) => q.eq("githubInstallationId", args.installationId))
      .unique();

    if (!installation) return;

    // 2. Find all repositories for this installation that match the event
    // For a push event, we look at the repo full name
    const repoFullName = args.payload.repository?.full_name;
    if (!repoFullName) return;

    const repo = await ctx.db
        .query("repositories")
        .withIndex("by_full_name", (q) => q.eq("fullName", repoFullName))
        .unique();
    
    if (!repo || !repo.serverId) return;

    // 3. Queue the deployment event for the specific server
    await ctx.db.insert("deploymentEvents", {
      serverId: repo.serverId,
      payload: args.payload,
      status: "pending",
    });
  },
});

export const getPending = query({
  args: { serverId: v.string(), serverToken: v.string() },
  handler: async (ctx, args) => {
    // 1. Verify server token
    const server = await ctx.db
      .query("servers")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .unique();

    if (!server || server.serverToken !== args.serverToken) {
      // In a real app, use a more secure token comparison
      return [];
    }

    // 2. Return pending events
    return await ctx.db
      .query("deploymentEvents")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const markProcessed = mutation({
    args: { eventId: v.id("deploymentEvents"), serverToken: v.string() },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) return;

        const server = await ctx.db
            .query("servers")
            .withIndex("by_server_id", (q) => q.eq("serverId", event.serverId))
            .unique();
        
        if (!server || server.serverToken !== args.serverToken) return;

        await ctx.db.patch(args.eventId, { status: "processed" });
    }
});
