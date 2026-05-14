import { ConvexClient } from "convex/browser";
import { getSystemConfig } from "../config";
// @ts-ignore
import { anyApi } from "convex/server";

let convexClient: ConvexClient | null = null;
let unsubscribe: (() => void) | null = null;

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://rapid-wolf-687.convex.cloud";

export async function initBrokerSync() {
    const config = await getSystemConfig();
    const serverId = config.broker?.server_id;
    const serverToken = config.broker?.server_token;

    if (!serverId || !serverToken) {
        console.log("No broker configuration found. Skipping broker sync.");
        return;
    }

    if (!convexClient) {
        convexClient = new ConvexClient(CONVEX_URL);
    }

    // Unsubscribe from any previous subscriptions if re-initializing
    if (unsubscribe) {
        unsubscribe();
    }

    console.log(`Connecting to Okastr8 Broker as server ${serverId}...`);

    // In a real implementation, we would subscribe to a query that returns pending deploy events.
    // For this brainstorm/TDD phase, we just mock the connection and listen.
    unsubscribe = convexClient.onUpdate(
        "deployments:getPending", // Mock string since we don't have exact api exported
        { serverId, serverToken },
        (events: any[]) => {
            if (events && events.length > 0) {
                console.log(`Received ${events.length} deployment events from broker.`);
                // Here we would trigger local deployments based on events
            }
        },
        (error) => {
            console.error("Error syncing with broker:", error);
        }
    );
}

export async function getInstallationTokenFromBroker(repoFullName: string): Promise<string | null> {
    const config = await getSystemConfig();
    const serverId = config.broker?.server_id;
    const serverToken = config.broker?.server_token;

    if (!serverId || !serverToken) {
        return null;
    }

    if (!convexClient) {
        convexClient = new ConvexClient(CONVEX_URL);
    }

    try {
        // Mock asking the broker for a short-lived token
        const token = await convexClient.mutation("github:getInstallationToken", {
            serverId,
            serverToken,
            repoFullName
        });
        return token as string;
    } catch (e) {
        console.error("Failed to get installation token from broker:", e);
        return null;
    }
}
