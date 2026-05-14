import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generate = mutation({
  args: { serverId: v.string() },
  handler: async (ctx, args) => {
    const userCode = Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + 
                     Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const id = await ctx.db.insert("deviceCodes", {
      code,
      userCode,
      status: "pending",
      serverId: args.serverId,
      expiresAt,
    });

    return { userCode, code };
  },
});

export const poll = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const deviceCode = await ctx.db
      .query("deviceCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!deviceCode) return { status: "not_found" };
    if (deviceCode.expiresAt < Date.now()) return { status: "expired" };
    
    if (deviceCode.status === "authorized" && deviceCode.userId) {
        const user = await ctx.db.get(deviceCode.userId);
        if (!user) return { status: "error", message: "User not found" };

        return { 
            status: "authorized", 
            userId: deviceCode.userId,
            githubUserId: user.githubUserId,
            githubUsername: user.githubUsername,
            serverId: deviceCode.serverId
        };
    }

    return { status: deviceCode.status };
  },
});

export const authorize = mutation({
    args: { userCode: v.string(), userId: v.id("users") },
    handler: async (ctx, args) => {
        const deviceCode = await ctx.db
            .query("deviceCodes")
            .withIndex("by_user_code", (q) => q.eq("userCode", args.userCode))
            .unique();
        
        if (!deviceCode) throw new Error("Invalid code");
        if (deviceCode.expiresAt < Date.now()) {
            await ctx.db.patch(deviceCode._id, { status: "expired" });
            throw new Error("Code expired");
        }

        await ctx.db.patch(deviceCode._id, { 
            status: "authorized", 
            userId: args.userId 
        });
    }
});
