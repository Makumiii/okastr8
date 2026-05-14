import { Command } from "commander";
import { ConvexClient } from "convex/browser";
import { randomBytes } from "crypto";
import ora from "ora";
import { getSystemConfig, saveSystemConfig } from "../config";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://rapid-wolf-687.convex.cloud";

export async function runLoginFlow(client: ConvexClient, serverId: string, pollIntervalMs = 2000) {
    const { userCode, code } = await client.mutation("deviceCodes:generate", { serverId });

    console.log(`\nPlease open the following URL in your browser:`);
    console.log(`  https://okastr8.com/link (or your deployed broker URL)`);
    console.log(`\nAnd enter the code: \x1b[1m${userCode}\x1b[0m\n`);

    const spinner = ora("Waiting for authorization...").start();

    while (true) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        const res = await client.query("deviceCodes:poll", { code });

        if (res.status === "authorized") {
            spinner.succeed("Successfully authenticated!");
            
            // Generate a secure token to act as the password for local system operations and websocket auth
            const serverToken = randomBytes(32).toString("hex");

            await saveSystemConfig({
                broker: {
                    server_id: res.serverId,
                    server_token: serverToken,
                }
            });

            return res;
        }

        if (res.status === "expired") {
            spinner.fail("Device code expired.");
            throw new Error("Device code expired.");
        }

        if (res.status === "not_found") {
            spinner.fail("Device code not found.");
            throw new Error("Device code not found.");
        }
    }
}

export function addLoginCommand(program: Command) {
    program
        .command("login")
        .description("Authenticate this server with the central Okastr8 broker")
        .action(async () => {
            const config = await getSystemConfig();
            const serverId = config.broker?.server_id || randomBytes(16).toString("hex");
            
            // Using ConvexClient (requires providing the URL)
            const client = new ConvexClient(CONVEX_URL);
            try {
                await runLoginFlow(client, serverId);
            } catch (e: any) {
                console.error(`Login failed: ${e.message}`);
                process.exit(1);
            }
        });
}
