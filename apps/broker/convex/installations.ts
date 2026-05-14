import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertInstallation = mutation({
    args: {
        userId: v.id("users"),
        githubInstallationId: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("installations")
            .withIndex("by_github_installation_id", (q) => q.eq("githubInstallationId", args.githubInstallationId))
            .unique();
        
        if (existing) {
            await ctx.db.patch(existing._id, { status: "active" });
            return existing._id;
        }

        return await ctx.db.insert("installations", {
            userId: args.userId,
            githubInstallationId: args.githubInstallationId,
            status: "active",
        });
    }
});

export const addRepository = mutation({
    args: {
        installationId: v.id("installations"),
        githubRepoId: v.number(),
        fullName: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("repositories")
            .withIndex("by_full_name", (q) => q.eq("fullName", args.fullName))
            .unique();
        
        if (existing) {
            await ctx.db.patch(existing._id, {
                installationId: args.installationId,
                githubRepoId: args.githubRepoId,
            });
            return existing._id;
        }

        return await ctx.db.insert("repositories", {
            installationId: args.installationId,
            githubRepoId: args.githubRepoId,
            fullName: args.fullName,
        });
    }
});

export const getByRepoName = query({
    args: { fullName: v.string() },
    handler: async (ctx, args) => {
        const repo = await ctx.db
            .query("repositories")
            .withIndex("by_full_name", (q) => q.eq("fullName", args.fullName))
            .unique();
        
        if (!repo) return null;

        const installation = await ctx.db.get(repo.installationId);
        return { repo, installation };
    }
});
