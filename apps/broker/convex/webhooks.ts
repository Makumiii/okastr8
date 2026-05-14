import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const handleEvent = action({
    args: { payload: v.any() },
    handler: async (ctx, args) => {
        const event = args.payload;
        const action = event.action;

        // 1. Handle Installation Events
        if (event.installation && !event.pull_request && !event.push) {
            const installationId = event.installation.id;
            const githubUserId = event.sender.id;
            
            // Find the user in our DB
            const user = await ctx.runQuery(api.users.getByGitHubId, { githubUserId });
            if (!user) {
                console.warn(`Webhook received for unknown user: ${githubUserId}`);
                return;
            }

            if (action === "created" || action === "new_permissions_accepted") {
                const instId = await ctx.runMutation(api.installations.upsertInstallation, {
                    userId: user._id,
                    githubInstallationId: installationId,
                });

                // Add repositories if present
                if (event.repositories) {
                    for (const repo of event.repositories) {
                        await ctx.runMutation(api.installations.addRepository, {
                            installationId: instId,
                            githubRepoId: repo.id,
                            fullName: repo.full_name,
                        });
                    }
                }
            } else if (action === "deleted") {
                // TODO: Handle installation deletion
            }
        }

        // 2. Handle Repository Events (Addition/Removal)
        if (action === "added" && event.repositories_added) {
             // TODO: Handle repositories_added
        }

        // 3. Handle Deployment Events (Push/PR)
        if (event.push || event.pull_request) {
            const installationId = event.installation?.id;
            if (installationId) {
                await ctx.runMutation(api.deployments.queueEvent, {
                    installationId,
                    payload: event,
                });
            }
        }
    }
});
