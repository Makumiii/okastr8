import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { githubUserId: v.number(), githubUsername: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_github_user_id", (q) => q.eq("githubUserId", args.githubUserId))
      .unique();

    if (existing) {
        await ctx.db.patch(existing._id, {
            githubUsername: args.githubUsername,
        });
        return existing._id;
    }

    return await ctx.db.insert("users", {
      githubUserId: args.githubUserId,
      githubUsername: args.githubUsername,
    });
  },
});

export const getByGitHubId = query({
  args: { githubUserId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_github_user_id", (q) => q.eq("githubUserId", args.githubUserId))
      .unique();
  },
});
