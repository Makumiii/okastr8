import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { runCommand } from "../utils/command";
// @ts-ignore - enquirer uses CommonJS exports
import Enquirer from "enquirer";
const { prompt } = Enquirer;

// Get the directory of this file (works in Bun and Node ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/commands/
const PROJECT_ROOT = join(__dirname, "..", "..");

const SCRIPTS = {
    setup: join(PROJECT_ROOT, "scripts", "setup.sh"),
    sudoers: join(PROJECT_ROOT, "scripts", "setup-sudoers.sh"),
    hardenSsh: join(PROJECT_ROOT, "scripts", "ssh", "harden-ssh.sh"),
    changeSshPort: join(PROJECT_ROOT, "scripts", "ssh", "change-ssh-port.sh"),
    ufwDefaults: join(PROJECT_ROOT, "scripts", "ufw", "defaults.sh"),
    fail2ban: join(PROJECT_ROOT, "scripts", "fail2ban", "fail2ban.sh"),
    orchestrate: join(PROJECT_ROOT, "scripts", "ochestrateEnvironment.sh"),
    createUser: join(PROJECT_ROOT, "scripts", "user", "create-user.sh"),
};

// Core Functions
export async function runFullSetup() {
    return await runCommand("sudo", [SCRIPTS.setup]);
}

export async function hardenSsh(port?: number) {
    const args = port ? [SCRIPTS.hardenSsh, port.toString()] : [SCRIPTS.hardenSsh];
    return await runCommand("sudo", args);
}

export async function changeSshPort(port: number) {
    return await runCommand("sudo", [SCRIPTS.changeSshPort, port.toString()]);
}

export async function configureFirewall(sshPort?: number) {
    const args = sshPort ? [SCRIPTS.ufwDefaults, sshPort.toString()] : [SCRIPTS.ufwDefaults];
    return await runCommand("sudo", args);
}

export async function configureFail2ban() {
    return await runCommand("sudo", [SCRIPTS.fail2ban]);
}

export async function orchestrateEnvironment() {
    return await runCommand(SCRIPTS.orchestrate, []);
}

// Commander Integration
export function addSetupCommands(program: Command) {
    const setup = program.command("setup").description("Server setup and hardening commands");

    setup
        .command("full")
        .description("Run complete server setup (installs dependencies, configures firewall, etc)")
        .action(async () => {
            console.log("Running full server setup...");
            const result = await runFullSetup();
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("ssh-harden")
        .description("Harden SSH configuration (disable password auth, root login, etc)")
        .option("-p, --port <port>", "Optionally change SSH port")
        .action(async (options: any) => {
            console.log("Hardening SSH configuration...");
            const port = options.port ? parseInt(options.port, 10) : undefined;
            const result = await hardenSsh(port);
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("ssh-port")
        .description("Change the SSH port")
        .argument("<port>", "New SSH port number")
        .action(async (port: string) => {
            console.log(`Changing SSH port to ${port}...`);
            const result = await changeSshPort(parseInt(port, 10));
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("firewall")
        .description("Configure UFW firewall with secure defaults")
        .option("-p, --ssh-port <port>", "SSH port to allow (default: 2222)")
        .action(async (options: any) => {
            console.log("Configuring firewall...");
            const sshPort = options.sshPort ? parseInt(options.sshPort, 10) : undefined;
            const result = await configureFirewall(sshPort);
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("fail2ban")
        .description("Configure fail2ban for DDoS/brute-force protection")
        .action(async () => {
            console.log("Configuring fail2ban...");
            const result = await configureFail2ban();
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("orchestrate")
        .description("Orchestrate complete environment from ~/.okastr8/environment.json")
        .action(async () => {
            console.log("Orchestrating environment...");
            const result = await orchestrateEnvironment();
            console.log(result.stdout || result.stderr);
            if (result.exitCode !== 0) {
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("sudoers")
        .description("Configure passwordless sudo for all okastr8 operations (including Docker)")
        .action(async () => {
            console.log("Configuring sudoers for passwordless operation...\n");
            console.log("This will allow okastr8 and Docker to run without password prompts.");
            console.log("You may be asked for your password once to apply the configuration.\n");

            const result = await runCommand("sudo", [SCRIPTS.sudoers]);
            console.log(result.stdout || result.stderr);

            if (result.exitCode === 0) {
                console.log("\n Sudoers configured successfully!");
                console.log(
                    "   Okastr8 and Docker can now run system commands without password prompts."
                );
                console.log("   Try running a deployment now—it should be fast and seamless.");
            } else {
                console.error("\n Sudoers configuration failed.");
                process.exit(result.exitCode || 1);
            }
        });

    setup
        .command("user")
        .description("Interactively create a new non-root user with sudo and docker access")
        .action(async () => {
            console.log("New User Setup\n");

            try {
                const response = (await prompt([
                    {
                        type: "input",
                        name: "username",
                        message: "Enter username for the new user:",
                        validate: (val: string) => val.length > 0,
                    },
                    {
                        type: "password",
                        name: "password",
                        message: "Enter password for the new user:",
                        validate: (val: string) => val.length > 0,
                    },
                ])) as any;

                console.log(`\nCreating user '${response.username}'...`);

                const result = await runCommand("sudo", [
                    SCRIPTS.createUser,
                    response.username,
                    response.password,
                ]);

                console.log(result.stdout || result.stderr);

                if (result.exitCode === 0) {
                    console.log("\n User created successfully!");
                    console.log(`   You can now switch to the new user: su - ${response.username}`);
                    console.log(
                        "   From there, you can run 'okastr8 setup full' to complete the installation."
                    );
                } else {
                    console.error("\n Failed to create user.");
                    process.exit(1);
                }
            } catch (e) {
                console.log("\nUser setup cancelled.");
            }
        });
}
