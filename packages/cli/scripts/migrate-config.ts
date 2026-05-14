import { join } from "path";
import { homedir } from "os";
import { readFile, rename } from "fs/promises";
import { existsSync } from "fs";
import { saveSystemConfig, type SystemConfig } from "../src/config";

const OKASTR8_HOME = join(homedir(), ".okastr8");

async function migrate() {
    console.log("🔄 Starting Configuration Migration to system.yaml...");
    // const configManager = ConfigManager.getInstance(); -> Removed
    const newConfig: SystemConfig = {};

    // 1. Migrate config.json (Manager & GitHub)
    const configJsonPath = join(OKASTR8_HOME, "config.json");
    if (existsSync(configJsonPath)) {
        try {
            const data = JSON.parse(await readFile(configJsonPath, "utf-8"));
            newConfig.manager = {
                api_key: data.apiKey,
                github: {
                    client_id: data.github?.clientId,
                    client_secret: data.github?.clientSecret,
                    access_token: data.github?.accessToken,
                    username: data.github?.username,
                    connected_at: data.github?.connectedAt,
                },
            };
            console.log("✅ Loaded config.json");
        } catch (e) {
            console.error("❌ Failed to read config.json:", e);
        }
    }

    // 2. Migrate environment.json (Setup)
    const envJsonPath = join(OKASTR8_HOME, "environment.json");
    if (existsSync(envJsonPath)) {
        try {
            const data = JSON.parse(await readFile(envJsonPath, "utf-8"));
            newConfig.setup = {
                user: {
                    username: data.createUser?.userName,
                    password: data.createUser?.passWord,
                    distro: data.createUser?.distro,
                },
                ssh: {
                    port: data.changeSSHPort?.port,
                },
                firewall: {
                    allowed_ports: data.firewall?.allowedPorts,
                },
            };
            console.log("✅ Loaded environment.json");
        } catch (e) {
            console.error("❌ Failed to read environment.json:", e);
        }
    }

    // 3. Migrate tunnel_manager.json (Tunnel)
    const tunnelJsonPath = join(OKASTR8_HOME, "tunnel_manager.json");
    if (existsSync(tunnelJsonPath)) {
        try {
            const data = JSON.parse(await readFile(tunnelJsonPath, "utf-8"));
            newConfig.tunnel = {
                enabled: true,
                service: data.service,
                port: data.port,
                url: data.url,
                auth_token: data.auth_token, // if existed
            };
            console.log("✅ Loaded tunnel_manager.json");
        } catch (e) {
            console.error("❌ Failed to read tunnel_manager.json:", e);
        }
    }

    // 4. Migrate deployment.json (Deployments)
    const deployJsonPath = join(OKASTR8_HOME, "deployment.json");
    if (existsSync(deployJsonPath)) {
        try {
            const data = JSON.parse(await readFile(deployJsonPath, "utf-8"));
            newConfig.deployments = data.deployments || [];
            console.log("✅ Loaded deployment.json");
        } catch (e) {
            console.error("❌ Failed to read deployment.json:", e);
        }
    }

    // Save Unified Config
    await saveSystemConfig(newConfig);
    console.log("💾 Saved unified configuration to system.yaml");

    // Backup Old Files
    const backupDir = join(OKASTR8_HOME, "legacy_configs_backup");
    await Bun.write(
        join(backupDir, "README.txt"),
        "Backup of legacy JSON configs before migration to system.yaml"
    );

    // We won't delete them yet, just to be safe. User can delete manually.
    console.log(
        "Note: Legacy JSON files were NOT deleted. You can remove them after verification."
    );
}

migrate().catch(console.error);
