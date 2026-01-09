import { Command } from "commander";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { runCommand } from "../utils/command";
import {
    getGitHubConfig,
    saveGitHubConfig,
    getConnectionStatus,
    listRepos,
    importRepo,
    disconnectGitHub,
    hasOkastr8DeployKey,
    createSSHKey,
} from "./github";

const SSH_KEY_PATH = join(homedir(), ".ssh", "okastr8_deploy_key");

export function addGitHubCommands(program: Command) {
    const github = program
        .command("github")
        .description("GitHub integration commands");

    // Status command
    github
        .command("status")
        .description("Check GitHub connection status")
        .action(async () => {
            try {
                const status = await getConnectionStatus();
                if (status.connected) {
                    console.log(`✅ Connected to GitHub as: ${status.username}`);
                    console.log(`   Connected at: ${status.connectedAt}`);

                    // Check deploy key
                    const config = await getGitHubConfig();
                    if (config.accessToken) {
                        const hasKey = await hasOkastr8DeployKey(config.accessToken);
                        console.log(`   Deploy key: ${hasKey ? '✅ Configured' : '❌ Not configured'}`);
                    }
                } else {
                    console.log("❌ Not connected to GitHub");
                    console.log("   Use the web UI to connect via OAuth, or configure manually.");
                }
            } catch (error: any) {
                console.error("Error checking status:", error.message);
                process.exit(1);
            }
        });

    // List repos command
    github
        .command("repos")
        .description("List your GitHub repositories")
        .option("-l, --limit <count>", "Limit number of repos shown", "20")
        .action(async (options) => {
            try {
                const config = await getGitHubConfig();
                if (!config.accessToken) {
                    console.error("❌ Not connected to GitHub. Use web UI to connect first.");
                    process.exit(1);
                }

                console.log("📦 Fetching repositories...\n");
                const repos = await listRepos(config.accessToken);
                const limit = parseInt(options.limit, 10);

                console.log(`Found ${repos.length} repositories (showing ${Math.min(limit, repos.length)}):\n`);

                for (const repo of repos.slice(0, limit)) {
                    const privacyIcon = repo.private ? "🔒" : "🌐";
                    console.log(`  ${privacyIcon} ${repo.full_name}`);
                    if (repo.description) {
                        console.log(`     ${repo.description.substring(0, 60)}${repo.description.length > 60 ? '...' : ''}`);
                    }
                    console.log(`     Branch: ${repo.default_branch} | Updated: ${new Date(repo.updated_at).toLocaleDateString()}`);
                    console.log();
                }
            } catch (error: any) {
                console.error("Error listing repos:", error.message);
                process.exit(1);
            }
        });

    // Import command
    github
        .command("import")
        .description("Import and deploy a GitHub repository")
        .argument("<repo>", "Repository full name (e.g., owner/repo)")
        .option("-b, --branch <branch>", "Branch to deploy")
        .option("--no-webhook", "Don't setup webhook for auto-deploys")
        .action(async (repo, options) => {
            try {
                const config = await getGitHubConfig();
                if (!config.accessToken) {
                    console.error("❌ Not connected to GitHub. Use web UI to connect first.");
                    process.exit(1);
                }

                console.log(`\n🚀 Importing ${repo}...\n`);

                const result = await importRepo({
                    repoFullName: repo,
                    branch: options.branch,
                    setupWebhook: options.webhook !== false,
                });

                if (result.success) {
                    console.log(`\n✅ ${result.message}`);
                    if (result.appName) {
                        console.log(`   App name: ${result.appName}`);
                    }
                } else {
                    console.error(`\n❌ ${result.message}`);
                    process.exit(1);
                }
            } catch (error: any) {
                console.error("Error importing repo:", error.message);
                process.exit(1);
            }
        });

    // Disconnect command
    github
        .command("disconnect")
        .description("Disconnect from GitHub")
        .action(async () => {
            try {
                // Ask for confirmation
                const readline = await import("readline");
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                const answer = await new Promise<string>((resolve) => {
                    rl.question("Are you sure you want to disconnect from GitHub? (y/N): ", resolve);
                });
                rl.close();

                if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
                    console.log("Cancelled.");
                    return;
                }

                await disconnectGitHub();
                console.log("✅ Disconnected from GitHub");
            } catch (error: any) {
                console.error("Error disconnecting:", error.message);
                process.exit(1);
            }
        });

    // Setup deploy key command
    github
        .command("setup-key")
        .description("Setup SSH deploy key for passwordless cloning")
        .action(async () => {
            try {
                const config = await getGitHubConfig();
                if (!config.accessToken) {
                    console.error("❌ Not connected to GitHub. Use web UI to connect first.");
                    process.exit(1);
                }

                // Check if key already exists in GitHub
                console.log("🔍 Checking existing keys...");
                const keyExists = await hasOkastr8DeployKey(config.accessToken);
                if (keyExists) {
                    console.log("✅ Deploy key already configured in GitHub!");
                    return;
                }

                // Generate local key if needed
                const pubKeyPath = `${SSH_KEY_PATH}.pub`;
                if (!existsSync(pubKeyPath)) {
                    console.log("🔑 Generating new SSH deploy key...");
                    const sshDir = join(homedir(), ".ssh");
                    await runCommand("mkdir", ["-p", sshDir]);
                    await runCommand("chmod", ["700", sshDir]);

                    const genResult = await runCommand("ssh-keygen", [
                        "-t", "ed25519",
                        "-f", SSH_KEY_PATH,
                        "-N", "",  // No passphrase
                        "-C", "okastr8-deploy-key"
                    ]);

                    if (genResult.exitCode !== 0) {
                        console.error(`Failed to generate key: ${genResult.stderr}`);
                        process.exit(1);
                    }
                    console.log("✅ SSH key generated");
                }

                // Read public key
                const publicKey = (await readFile(pubKeyPath, "utf-8")).trim();

                // Push to GitHub
                console.log("☁️ Adding key to GitHub...");
                const hostname = (await runCommand("hostname", [])).stdout.trim();
                const keyTitle = `Okastr8 Deploy Key (${hostname})`;

                const result = await createSSHKey(config.accessToken, keyTitle, publicKey);
                if (!result.success) {
                    console.error(`Failed to add key to GitHub: ${result.message}`);
                    process.exit(1);
                }

                // Configure Git
                console.log("🔧 Configuring Git to use SSH...");
                await runCommand("git", ["config", "--global", "url.git@github.com:.insteadOf", "https://github.com/"]);

                console.log("\n✅ Deploy key configured successfully!");
                console.log("   All GitHub clones will now use SSH automatically.");
            } catch (error: any) {
                console.error("Error setting up key:", error.message);
                process.exit(1);
            }
        });
}
