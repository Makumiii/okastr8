import { query } from "./_generated/server";
import { v } from "convex/values";

export const getPending = query({
  args: { serverId: v.string(), serverToken: v.string() },
  handler: async (ctx, args) => {
    // In a real implementation, you would verify the serverToken against the database
    // For this prototype, we return a mock event to verify the subscription logic
    return [{ id: "event-1", repo: "owner/repo" }];
  },
});
