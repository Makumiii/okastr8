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

    // Subscribe to pending deployment events
    unsubscribe = convexClient.onUpdate(
        "deployments:getPending",
        { serverId, serverToken },
        async (events: any[]) => {
            if (events && events.length > 0) {
                console.log(`Received ${events.length} deployment events from broker.`);
                for (const event of events) {
                    // Trigger deployment (this would call your internal deploy logic)
                    console.log(`Processing event ${event._id} for repo ${event.payload.repository?.full_name}`);
                    
                    // After processing, mark as done
                    try {
                        await convexClient!.mutation("deployments:markProcessed", {
                            eventId: event._id,
                            serverToken
                        });
                    } catch (e) {
                        console.error(`Failed to mark event ${event._id} as processed:`, e);
                    }
                }
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
        // Use the implementation we just added to the Broker
        const token = await convexClient.action("github:getInstallationTokenForRepo", {
            repoFullName
        });
        return token as string;
    } catch (e) {
        console.error("Failed to get installation token from broker:", e);
        return null;
    }
}
