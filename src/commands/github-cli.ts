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
import { isCurrentUserAdmin, getAdminUser } from "./auth";

const SSH_KEY_PATH = join(homedir(), ".ssh", "okastr8_deploy_key");

async function requireAdminCli(): Promise<void> {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
        const adminUser = await getAdminUser();
        console.error(` Only the admin user (${adminUser}) can use GitHub commands.`);
        console.error(`   Current user: ${process.env.SUDO_USER || process.env.USER}`);
        process.exit(1);
    }
}

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
                await requireAdminCli();
                const status = await getConnectionStatus();
                if (status.connected) {
                    console.log(` Connected to GitHub as: ${status.username}`);
                    console.log(`   Connected at: ${status.connectedAt}`);

                    // Check deploy key
                    const config = await getGitHubConfig();
                    if (config.accessToken) {
                        const hasKey = await hasOkastr8DeployKey(config.accessToken);
                        console.log(`   Deploy key: ${hasKey ? ' Configured' : ' Not configured'}`);
                    }
                } else {
                    console.log("Not connected to GitHub");
                    console.log("   Use the web UI to connect via OAuth, or configure manually.");
                }
            } catch (error: any) {
                console.error("Error checking status:", error.message);
                process.exit(1);
            }
        });

    // Connect command (CLI OAuth flow)
    github
        .command("connect")
        .description("Connect to GitHub via OAuth (opens browser)")
        .action(async () => {
            try {
                await requireAdminCli();
                const config = await getGitHubConfig();
                if (!config.clientId || !config.clientSecret) {
                    console.error("GitHub OAuth not configured.");
                    console.error("   Add to system.yaml:");
                    console.error("     manager:");
                    console.error("       github:");
                    console.error("         client_id: YOUR_CLIENT_ID");
                    console.error("         client_secret: YOUR_CLIENT_SECRET");
                    process.exit(1);
                }

                // Check if already connected
                const status = await getConnectionStatus();
                if (status.connected) {
                    console.log(`Already connected as ${status.username}.`);
                    console.log("Run 'okastr8 github disconnect' first to reconnect.");
                    return;
                }

                // Use manager's callback (requires manager to be running)
                const callbackUrl = `http://localhost:41788/api/github/callback`;

                const { getAuthUrl } = await import('./github');
                const authUrl = getAuthUrl(config.clientId, callbackUrl, 'connect');

                console.log("\nOpen this URL in your browser:\n");
                console.log(`   ${authUrl}\n`);

                // Try to open browser automatically
                try {
                    const { exec } = await import('child_process');
                    const openCmd = process.platform === 'darwin' ? 'open' :
                        process.platform === 'win32' ? 'start' : 'xdg-open';
                    exec(`${openCmd} "${authUrl}"`);
                    console.log("   (Attempting to open browser automatically...)\n");
                } catch { }

                console.log("⏳ Waiting for authorization...");
                console.log("   (Make sure okastr8-manager is running)\n");

                // Poll for connection status (faster intervals, check immediately)
                const maxAttempts = 150; // 5 minutes at 2 second intervals
                for (let i = 0; i < maxAttempts; i++) {
                    const newStatus = await getConnectionStatus();
                    if (newStatus.connected) {
                        console.log(`\n Connected to GitHub as: ${newStatus.username}`);
                        return;
                    }
                    process.stdout.write('.');
                    await new Promise(r => setTimeout(r, 2000));
                }

                console.log("\n Timed out waiting for authorization.");
                process.exit(1);

            } catch (error: any) {
                console.error("Error:", error.message);
                process.exit(1);
            }
        });

    // List repos command (interactive fuzzy search with actions)
    github
        .command("repos")
        .description("Browse and import GitHub repositories")
        .option("--plain", "Plain list output (no interactive mode)")
        .action(async (options) => {
            try {
                await requireAdminCli();
                const config = await getGitHubConfig();
                if (!config.accessToken) {
                    console.error("Not connected to GitHub. Run 'okastr8 github connect' first.");
                    process.exit(1);
                }

                console.log("Fetching repositories...\n");
                const repos = await listRepos(config.accessToken);

                if (repos.length === 0) {
                    console.log("No repositories found.");
                    return;
                }

                // Get deployed apps for status indication
                const { listApps } = await import('./app');
                const { apps: deployedApps } = await listApps();
                const deployedRepos = new Map<string, { appName: string; branch: string }>();
                for (const app of deployedApps) {
                    if (app.gitRepo) {
                        // Extract repo name from git URL
                        const match = app.gitRepo.match(/github\.com[/:]([^/]+\/[^/.]+)/);
                        if (match) {
                            deployedRepos.set(match[1].toLowerCase(), {
                                appName: app.name,
                                branch: app.gitBranch || 'main'
                            });
                        }
                    }
                }

                // Plain mode - just list
                if (options.plain) {
                    for (const repo of repos) {
                        const privacyIcon = repo.private ? "[PRIVATE]" : "[PUBLIC]";
                        const deployed = deployedRepos.get(repo.full_name.toLowerCase());
                        const status = deployed ? ` [ deployed: ${deployed.appName}@${deployed.branch}]` : '';
                        console.log(`${privacyIcon} ${repo.full_name}${status}`);
                    }
                    return;
                }

                // Interactive mode with fuzzy search
                const Enquirer = (await import('enquirer')).default;

                // Build choices with deploy status
                const choices = repos.map((repo: any) => {
                    const deployed = deployedRepos.get(repo.full_name.toLowerCase());
                    if (deployed) {
                        return ` ${repo.full_name} [${deployed.appName}@${deployed.branch}]`;
                    }
                    return `   ${repo.full_name}`;
                });

                const response = await Enquirer.prompt({
                    type: 'autocomplete',
                    name: 'repo',
                    message: `Select a repository (${repos.length} total,  = deployed):`,
                    limit: 10,
                    choices: choices,
                } as any);

                // Extract repo name from selection (remove status prefix)
                const selectedRaw = (response as any).repo;
                const repoName = selectedRaw.replace(/^[\s]+/, '').split(' [')[0];
                const repo = repos.find((r: any) => r.full_name === repoName);

                if (!repo) return;

                const deployed = deployedRepos.get(repo.full_name.toLowerCase());

                // Show repo details
                console.log(`\n${repo.full_name}`);
                console.log(`   ${repo.private ? 'Private' : 'Public'}`);
                if (repo.description) console.log(`   ${repo.description}`);
                console.log(`   Default Branch: ${repo.default_branch}`);
                if (deployed) {
                    console.log(`   Deployed as: ${deployed.appName} (branch: ${deployed.branch})`);
                }

                // Action menu
                const actionChoices = deployed
                    ? ['Redeploy', 'View Details', 'Open on GitHub', 'Cancel']
                    : ['Import and Deploy', 'View Details', 'Open on GitHub', 'Cancel'];

                const actionResponse = await Enquirer.prompt({
                    type: 'select',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: actionChoices,
                } as any);

                const action = (actionResponse as any).action;

                if (action.includes('Cancel')) {
                    console.log("Cancelled.");
                    return;
                }

                if (action.includes('Open on GitHub')) {
                    const { exec } = await import('child_process');
                    const openCmd = process.platform === 'darwin' ? 'open' :
                        process.platform === 'win32' ? 'start' : 'xdg-open';
                    exec(`${openCmd} "${repo.html_url}"`);
                    console.log(`Opening ${repo.html_url}`);
                    return;
                }

                if (action.includes('View Details')) {
                    console.log(`\nFull Details for ${repo.full_name}`);
                    console.log(`   URL: ${repo.html_url}`);
                    console.log(`   Clone: ${repo.clone_url}`);
                    console.log(`   Language: ${repo.language || 'Unknown'}`);
                    console.log(`   Updated: ${new Date(repo.updated_at).toLocaleDateString()}`);
                    console.log(`   Pushed: ${new Date(repo.pushed_at).toLocaleDateString()}`);
                    return;
                }

                // Import/Redeploy flow
                if (action.includes('Import') || action.includes('Redeploy')) {
                    // Branch selection
                    const branchResponse = await Enquirer.prompt({
                        type: 'input',
                        name: 'branch',
                        message: 'Branch to deploy:',
                        initial: deployed?.branch || repo.default_branch,
                    } as any);
                    const branch = (branchResponse as any).branch;

                    // Branch change warning
                    if (deployed && branch !== deployed.branch) {
                        console.log(`\nWarning: Changing branch from '${deployed.branch}' to '${branch}'`);
                        const confirmResponse = await Enquirer.prompt({
                            type: 'confirm',
                            name: 'confirm',
                            message: 'Are you sure you want to change the deployment branch?',
                            initial: false,
                        } as any);
                        if (!(confirmResponse as any).confirm) {
                            console.log("Cancelled.");
                            return;
                        }
                    }

                    // For new imports, get app name
                    let appName = deployed?.appName;
                    if (!deployed) {
                        const nameResponse = await Enquirer.prompt({
                            type: 'input',
                            name: 'appName',
                            message: 'App name:',
                            initial: repo.name,
                        } as any);
                        appName = (nameResponse as any).appName;
                    }

                    // 4. Environment Variables Prompt (Opinionated Flow)
                    let env: Record<string, string> = {};
                    const envOption = await Enquirer.prompt({
                        type: 'select',
                        name: 'choice',
                        message: 'Configure environment variables?',
                        choices: [
                            'No, skip for now',
                            'Import from .env file',
                            'Manual entry (key=value)',
                        ],
                    } as any);

                    if ((envOption as any).choice === 'Import from .env file') {
                        const fileRes = await Enquirer.prompt({
                            type: 'input',
                            name: 'path',
                            message: 'Path to .env file:',
                            initial: '.env',
                        } as any);
                        const filePath = (fileRes as any).path;
                        if (existsSync(filePath)) {
                            const { readFile } = await import('fs/promises');
                            const content = await readFile(filePath, 'utf-8');
                            content.split('\n').forEach(line => {
                                line = line.trim();
                                if (!line || line.startsWith('#')) return;
                                const [k, ...v] = line.split('=');
                                if (k && v.length > 0) env[k.trim()] = v.join('=').trim();
                            });
                            console.log(`    Loaded ${Object.keys(env).length} variables from ${filePath}`);
                        } else {
                            console.error(`    File not found: ${filePath}`);
                        }
                    } else if ((envOption as any).choice === 'Manual entry (key=value)') {
                        console.log('   Enter variables (empty key to finish):');
                        while (true) {
                            const pair = await Enquirer.prompt({
                                type: 'input',
                                name: 'val',
                                message: 'Variable (KEY=VALUE):',
                            } as any);
                            const val = (pair as any).val;
                            if (!val) break;
                            const [k, ...v] = val.split('=');
                            if (k && v.length > 0) {
                                env[k.trim()] = v.join('=').trim();
                            } else {
                                console.log('   Invalid format. Use KEY=VALUE');
                            }
                        }
                    }

                    console.log(`\n${deployed ? 'Redeploying' : 'Importing'} ${repo.full_name}...`);
                    console.log(`   App: ${appName}`);
                    console.log(`   Branch: ${branch}\n`);

                    // Call import function
                    const result = await importRepo({
                        repoFullName: repo.full_name,
                        appName: appName,
                        branch: branch,
                        setupWebhook: true,
                        env: Object.keys(env).length > 0 ? env : undefined
                    });

                    if (result.success) {
                        console.log(`\n ${result.message}`);
                    } else {
                        console.error(`\n ${result.message}`);
                    }
                }

            } catch (error: any) {
                if (error.message === '' || error.name === 'ExitPromptError') {
                    console.log("\nCancelled.");
                    return;
                }
                console.error("Error:", error.message);
                process.exit(1);
            }
        });

    // Import command
    github
        .command("import")
        .description("Import and deploy a GitHub repository")
        .argument("<repo>", "Repository full name (e.g., owner/repo)")
        .option("-b, --branch <branch>", "Branch to deploy")
        .option("--env <vars...>", "Environment variables (KEY=VALUE)")
        .option("--env-file <path>", "Path to .env file")
        .option("--no-webhook", "Don't setup webhook for auto-deploys")
        .action(async (repo, options) => {
            try {
                await requireAdminCli();
                const config = await getGitHubConfig();
                if (!config.accessToken) {
                    console.error("Not connected to GitHub. Use web UI to connect first.");
                    process.exit(1);
                }

                let env: Record<string, string> = {};

                // Parse --env-file
                if (options.envFile) {
                    if (existsSync(options.envFile)) {
                        const { readFile } = await import('fs/promises');
                        const content = await readFile(options.envFile, 'utf-8');
                        content.split('\n').forEach(line => {
                            line = line.trim();
                            if (!line || line.startsWith('#')) return;
                            const [k, ...v] = line.split('=');
                            if (k && v.length > 0) env[k.trim()] = v.join('=').trim();
                        });
                    } else {
                        console.error(` Env file not found: ${options.envFile}`);
                        process.exit(1);
                    }
                }

                // Parse --env flags
                if (options.env) {
                    options.env.forEach((pair: string) => {
                        const [k, ...v] = pair.split('=');
                        if (k && v.length > 0) env[k.trim()] = v.join('=').trim();
                    });
                }

                console.log(`\nImporting ${repo}...\n`);

                const result = await importRepo({
                    repoFullName: repo,
                    branch: options.branch,
                    setupWebhook: options.webhook !== false,
                    env: Object.keys(env).length > 0 ? env : undefined
                });

                if (result.success) {
                    console.log(`\n ${result.message}`);
                    if (result.appName) {
                        console.log(`   App name: ${result.appName}`);
                    }
                } else {
                    console.error(`\n ${result.message}`);
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
                await requireAdminCli();
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
                console.log("Disconnected from GitHub");
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
                await requireAdminCli();
                const config = await getGitHubConfig();
                if (!config.accessToken) {
                    console.error("Not connected to GitHub. Use web UI to connect first.");
                    process.exit(1);
                }

                // Check if key already exists in GitHub
                console.log("Checking existing keys...");
                const keyExists = await hasOkastr8DeployKey(config.accessToken);
                if (keyExists) {
                    console.log("Deploy key already configured in GitHub!");
                    return;
                }

                // Generate local key if needed
                const pubKeyPath = `${SSH_KEY_PATH}.pub`;
                if (!existsSync(pubKeyPath)) {
                    console.log("Generating new SSH deploy key...");
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
                    console.log("SSH key generated");
                }

                // Read public key
                const publicKey = (await readFile(pubKeyPath, "utf-8")).trim();

                // Push to GitHub
                console.log("Adding key to GitHub...");
                const hostname = (await runCommand("hostname", [])).stdout.trim();
                const keyTitle = `Okastr8 Deploy Key (${hostname})`;

                const result = await createSSHKey(config.accessToken, keyTitle, publicKey);
                if (!result.success) {
                    console.error(`Failed to add key to GitHub: ${result.message}`);
                    process.exit(1);
                }

                // Configure Git
                console.log("Configuring Git to use SSH...");
                await runCommand("git", ["config", "--global", "url.git@github.com:.insteadOf", "https://github.com/"]);

                console.log("\n Deploy key configured successfully!");
                console.log("   All GitHub clones will now use SSH automatically.");
            } catch (error: any) {
                console.error("Error setting up key:", error.message);
                process.exit(1);
            }
        });
}
