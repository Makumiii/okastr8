import { getSystemConfig } from "../config";
import { importRepo } from "./github";
import { ConvexClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://rapid-wolf-687.convex.cloud";

export interface DashboardDeployOptions {
    domain: string;
    repoName?: string;
}

export async function deployDashboard(options: DashboardDeployOptions): Promise<{
    success: boolean;
    message: string;
    url?: string;
}> {
    const config = await getSystemConfig();
    
    // 1. Ensure we have GitHub connection
    if (!config.manager?.auth?.github_admin_id) {
        return { 
            success: false, 
            message: "GitHub not connected. Please run 'okastr8 github connect' first." 
        };
    }

    const client = new ConvexClient(CONVEX_URL);
    const repoName = options.repoName || "my-okastr8-dashboard";

    try {
        console.log(`Creating private repository '${repoName}' from template...`);
        
        // We need to find the user in Convex by their githubUserId
        const user = await client.query("users:getByGitHubId" as any, { 
            githubUserId: Number(config.manager.auth.github_admin_id) 
        }) as any;

        if (!user) {
            return { success: false, message: "User not found in Broker. Please reconnect GitHub." };
        }

        // 2. Create the repo via Broker
        const repoData = await client.action("github:createDashboardRepo" as any, {
            userId: user._id,
            repoName: repoName
        }) as any;

        console.log(`Repository created: ${repoData.fullName}`);
        console.log(`Deploying dashboard to ${options.domain}...`);

        // 3. Import and deploy the repo
        // We override the domain in the import options
        const result = await importRepo({
            repoFullName: repoData.fullName,
            domain: options.domain,
            appName: "dashboard",
            tunnel_routing: true, // Use tunnel by default for zero-config
        });

        if (result.success) {
            return {
                success: true,
                message: "Dashboard successfully deployed to your repository and server!",
                url: `https://${options.domain}`
            };
        } else {
            return {
                success: false,
                message: `Deployment failed: ${result.message}`
            };
        }

    } catch (e: any) {
        console.error("Dashboard deployment failed:", e);
        return {
            success: false,
            message: e.message
        };
    }
}
