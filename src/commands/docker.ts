import { runCommand } from "../utils/command";
import { existsSync } from "fs";

const ALLOWED_DOCKER_SUBCOMMANDS = new Set([
    "--version",
    "build",
    "buildx",
    "image",
    "inspect",
    "pull",
    "push",
    "tag",
    "run",
    "start",
    "stop",
    "rm",
    "restart",
    "ps",
    "logs",
    "login",
    "logout",
    "system",
]);

const BLOCKED_DOCKER_RUN_FLAGS = new Set([
    "--privileged",
    "--pid",
    "--ipc",
    "--uts",
    "--device",
    "--cap-add",
    "--security-opt",
    "--mount",
    "-v",
    "--volume",
]);

function hasBlockedFlag(args: string[], blocked: Set<string>): string | null {
    for (const arg of args) {
        const key = arg.includes("=") ? arg.split("=")[0] : arg;
        if (key && blocked.has(key)) return key;
    }
    return null;
}

export function assertAllowedDockerArgs(args: string[]): void {
    if (!args.length) {
        throw new Error("Docker command args cannot be empty");
    }
    const sub = args[0];
    if (!sub || !ALLOWED_DOCKER_SUBCOMMANDS.has(sub)) {
        throw new Error(`Blocked docker subcommand '${sub || "<empty>"}'`);
    }

    if (sub === "run") {
        const blocked = hasBlockedFlag(args.slice(1), BLOCKED_DOCKER_RUN_FLAGS);
        if (blocked) {
            throw new Error(`Blocked docker run flag '${blocked}'`);
        }
    }

    if (sub === "system") {
        const op = args[1];
        if (op !== "df") {
            throw new Error(`Blocked docker system operation '${op || "<empty>"}'`);
        }
    }
}

export function assertAllowedComposeArgs(args: string[]): void {
    if (!args.length) {
        throw new Error("Compose command args cannot be empty");
    }
    if (args[0] === "--version") {
        return;
    }

    // Allow compose up/down with optional -f/-p flags only.
    const operation = args.find((arg) => ["up", "down"].includes(arg));
    if (!operation) {
        throw new Error("Blocked compose operation");
    }

    const blocked = args.find((arg) =>
        ["run", "exec", "cp", "buildx", "create", "kill", "attach"].includes(arg)
    );
    if (blocked) {
        throw new Error(`Blocked compose token '${blocked}'`);
    }
}

/**
 * Get absolute path to docker binary to match sudoers NOPASSWD rules
 */
function getDockerPath(): string {
    const paths = ["/usr/bin/docker", "/usr/local/bin/docker"];
    for (const p of paths) {
        if (existsSync(p)) return p;
    }
    return "docker"; // Fallback
}

/**
 * Get absolute path to docker-compose binary to match sudoers NOPASSWD rules
 */
function getComposePath(): string {
    const paths = [
        "/usr/bin/docker-compose",
        "/usr/local/bin/docker-compose",
        "/usr/local/lib/docker/cli-plugins/docker-compose",
    ];
    for (const p of paths) {
        if (existsSync(p)) return p;
    }
    return "docker-compose"; // Fallback
}

function isDockerPermissionError(text: string): boolean {
    const value = text.toLowerCase();
    return (
        value.includes("permission denied") ||
        value.includes("cannot connect to the docker daemon") ||
        value.includes("got permission denied while trying to connect") ||
        value.includes("superuser privileges")
    );
}

function isComposeCommandUnavailable(text: string): boolean {
    const value = text.toLowerCase();
    return value.includes("is not a docker command") || value.includes("unknown command");
}

/**
 * Run a docker command with sudo for permission handling
 */
async function dockerCommand(args: string[], cwd?: string) {
    assertAllowedDockerArgs(args);
    const dockerPath = getDockerPath();

    try {
        const direct = await runCommand(dockerPath, args, cwd);
        if (direct.exitCode === 0) {
            return direct;
        }
        if (!isDockerPermissionError(`${direct.stdout}\n${direct.stderr}`)) {
            return direct;
        }
    } catch {
        // Fall through to sudo execution.
    }

    // High-impact operations should not auto-escalate to sudo.
    if (args[0] === "run" || args[0] === "build" || args[0] === "login") {
        return {
            stdout: directSafeOutput("", ""),
            stderr:
                "Docker permission denied for high-impact operation. Ensure user is in docker group.",
            exitCode: 1,
        };
    }

    return runCommand("sudo", ["-n", dockerPath, ...args], cwd);
}

function directSafeOutput(stdout: string, stderr: string): string {
    return stdout || stderr;
}

/**
 * Run a docker-compose command with sudo for permission handling
 */
async function composeCommand(args: string[], cwd?: string) {
    assertAllowedComposeArgs(args);
    const dockerPath = getDockerPath();
    const composeBinary = getComposePath();

    try {
        const directPlugin = await runCommand(dockerPath, ["compose", ...args], cwd);
        if (directPlugin.exitCode === 0) {
            return directPlugin;
        }

        const pluginOutput = `${directPlugin.stdout}\n${directPlugin.stderr}`;
        const pluginUnavailable = isComposeCommandUnavailable(pluginOutput);
        const pluginPermissionError = isDockerPermissionError(pluginOutput);

        if (!pluginUnavailable && !pluginPermissionError) {
            return directPlugin;
        }

        if (pluginPermissionError || pluginUnavailable) {
            const sudoPlugin = await runCommand("sudo", ["-n", dockerPath, "compose", ...args], cwd);
            if (sudoPlugin.exitCode === 0) {
                return sudoPlugin;
            }

            const sudoPluginOutput = `${sudoPlugin.stdout}\n${sudoPlugin.stderr}`;
            if (!isComposeCommandUnavailable(sudoPluginOutput)) {
                return sudoPlugin;
            }
        }
    } catch {
        // Fall through to docker-compose binary fallback.
    }

    try {
        const directBinary = await runCommand(composeBinary, args, cwd);
        if (directBinary.exitCode === 0) {
            return directBinary;
        }
        if (!isDockerPermissionError(`${directBinary.stdout}\n${directBinary.stderr}`)) {
            return directBinary;
        }
    } catch {
        // Fall through to sudo binary fallback.
    }

    return runCommand("sudo", ["-n", composeBinary, ...args], cwd);
}

/**
 * Build Docker image from Dockerfile
 */
export async function buildImage(
    appName: string,
    tag: string,
    context: string,
    dockerfilePath: string = "Dockerfile"
): Promise<{ success: boolean; message: string }> {
    try {
        const dockerPath = getDockerPath();
        const buildxCheck = await runCommand(dockerPath, ["buildx", "version"]);
        const canUseBuildx = buildxCheck.exitCode === 0;

        const result = canUseBuildx
            ? await runCommand(
                dockerPath,
                ["buildx", "build", "--load", "-t", tag, "-f", dockerfilePath, context]
            )
            : await dockerCommand(["build", "-t", tag, "-f", dockerfilePath, context]);

        if (result.exitCode !== 0) {
            const details = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
            return {
                success: false,
                message: `Docker build failed: ${details || "Unknown docker build error"}`,
            };
        }

        return {
            success: true,
            message: `Successfully built image: ${tag}`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Build error: ${error.message}`,
        };
    }
}

export async function imageExists(image: string): Promise<boolean> {
    try {
        const result = await dockerCommand(["image", "inspect", image]);
        return result.exitCode === 0;
    } catch {
        return false;
    }
}

export async function pullImage(image: string): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["pull", image]);
        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to pull image: ${result.stderr || result.stdout}`,
            };
        }
        return {
            success: true,
            message: `Pulled image ${image}`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Pull error: ${error.message}`,
        };
    }
}

export async function tagImage(
    sourceImage: string,
    targetImage: string
): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["tag", sourceImage, targetImage]);
        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to tag image: ${result.stderr || result.stdout}`,
            };
        }
        return {
            success: true,
            message: `Tagged ${sourceImage} as ${targetImage}`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Tag error: ${error.message}`,
        };
    }
}

export async function pushImage(image: string): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["push", image]);
        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to push image: ${result.stderr || result.stdout}`,
            };
        }
        return {
            success: true,
            message: `Pushed image ${image}`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Push error: ${error.message}`,
        };
    }
}

export async function dockerLogin(
    server: string,
    username: string,
    passwordOrToken: string
): Promise<{ success: boolean; message: string }> {
    try {
        const dockerPath = getDockerPath();
        let result = await runCommand(
            dockerPath,
            ["login", server, "-u", username, "--password-stdin"],
            undefined,
            passwordOrToken
        );

        if (
            result.exitCode !== 0 &&
            isDockerPermissionError(`${result.stdout}\n${result.stderr}`)
        ) {
            result = await runCommand(
                "sudo",
                ["-n", dockerPath, "login", server, "-u", username, "--password-stdin"],
                undefined,
                passwordOrToken
            );
        }

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Docker login failed for ${server}: ${result.stderr || result.stdout}`,
            };
        }
        return {
            success: true,
            message: `Authenticated to ${server}`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Docker login error: ${error.message}`,
        };
    }
}

export async function dockerLogout(server: string): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["logout", server]);
        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Docker logout failed for ${server}: ${result.stderr || result.stdout}`,
            };
        }
        return {
            success: true,
            message: `Logged out from ${server}`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Docker logout error: ${error.message}`,
        };
    }
}

export async function inspectImageDigest(image: string): Promise<string | undefined> {
    try {
        const result = await dockerCommand([
            "inspect",
            "--format",
            "{{index .RepoDigests 0}}",
            image,
        ]);
        if (result.exitCode !== 0) return undefined;
        const digest = result.stdout.trim();
        return digest && digest !== "<no value>" ? digest : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Run a Docker container
 */
export async function runContainer(
    appName: string,
    image: string,
    port: number,
    containerPort: number = port,
    envFilePath?: string
): Promise<{ success: boolean; message: string }> {
    try {
        // Container name = app name (no prefix for simplicity)
        const containerName = appName;
        const args = [
            "run",
            "-d",
            "--name",
            containerName,
            "-p",
            `${port}:${containerPort}`,
            "--restart",
            "unless-stopped",
            // Inject HOST=0.0.0.0 so dev servers (Vite, CRA, Next.js, etc.)
            // bind to all interfaces instead of localhost-only.
            // This makes them accessible through Docker's port mapping.
            "-e",
            "HOST=0.0.0.0",
        ];

        // Add env file if provided
        if (envFilePath) {
            args.push("--env-file", envFilePath);
        }

        args.push(image);

        const result = await dockerCommand(args);

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to run container: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Container ${containerName} started successfully`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Run error: ${error.message}`,
        };
    }
}

export async function startContainer(
    containerName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["start", containerName]);
        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to start container: ${result.stderr || result.stdout}`,
            };
        }
        return { success: true, message: `Container ${containerName} started` };
    } catch (error: any) {
        return { success: false, message: `Start error: ${error.message}` };
    }
}

/**
 * Run docker-compose up
 */
export async function composeUp(
    composePaths: string | string[],
    projectName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const paths = Array.isArray(composePaths) ? composePaths : [composePaths];
        const fileArgs = paths.flatMap((p) => ["-f", p]);

        const result = await composeCommand(
            [...fileArgs, "-p", projectName, "up", "-d", "--build"],
            process.cwd()
        );

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `docker-compose up failed: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Services started successfully`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Compose error: ${error.message}`,
        };
    }
}

/**
 * Stop docker-compose services
 */
export async function composeDown(
    composePath: string,
    projectName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const result = await composeCommand(
            ["-f", composePath, "-p", projectName, "down"],
            process.cwd()
        );

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `docker-compose down failed: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Services stopped successfully`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Compose error: ${error.message}`,
        };
    }
}

/**
 * Stop a Docker container
 */
export async function stopContainer(
    containerName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["stop", containerName]);

        if (result.exitCode !== 0 && !result.stderr.includes("No such container")) {
            return {
                success: false,
                message: `Failed to stop container: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Container ${containerName} stopped`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Stop error: ${error.message}`,
        };
    }
}

/**
 * Remove a Docker container
 */
export async function removeContainer(
    containerName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["rm", "-f", containerName]);

        if (result.exitCode !== 0 && !result.stderr.includes("No such container")) {
            return {
                success: false,
                message: `Failed to remove container: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Container ${containerName} removed`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Remove error: ${error.message}`,
        };
    }
}

/**
 * Restart a Docker container
 */
export async function restartContainer(
    containerName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const result = await dockerCommand(["restart", containerName]);

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to restart container: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Container ${containerName} restarted`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Restart error: ${error.message}`,
        };
    }
}

/**
 * Get container status
 */
export async function containerStatus(
    containerName: string
): Promise<{ running: boolean; status: string; health?: string }> {
    try {
        const stateResult = await dockerCommand([
            "inspect",
            "--format",
            "{{.State.Status}}",
            containerName,
        ]);

        if (stateResult.exitCode !== 0) {
            return {
                running: false,
                status: "not found",
            };
        }

        const status = stateResult.stdout.trim() || "unknown";
        let health: string | undefined;

        // Health is optional in Docker metadata. Query separately and tolerate missing health object.
        const healthResult = await dockerCommand([
            "inspect",
            "--format",
            "{{if .State.Health}}{{.State.Health.Status}}{{end}}",
            containerName,
        ]);

        if (healthResult.exitCode === 0) {
            const healthRaw = healthResult.stdout.trim();
            if (healthRaw) {
                health = healthRaw;
            }
        }

        return {
            running: status === "running",
            status: status,
            health: health,
        };
    } catch (error: any) {
        return {
            running: false,
            status: "error",
        };
    }
}

export async function inspectContainer(
    containerName: string
): Promise<{ success: boolean; output: string }> {
    try {
        const result = await dockerCommand(["inspect", containerName]);
        if (result.exitCode !== 0) {
            return { success: false, output: result.stderr || result.stdout };
        }
        return { success: true, output: result.stdout || "" };
    } catch (error: any) {
        return { success: false, output: String(error?.message || error) };
    }
}

/**
 * Start an app-specific Cloudflare Tunnel sidecar container
 */
export async function startAppTunnelContainer(
    appName: string,
    tunnelToken: string
): Promise<{ success: boolean; message: string }> {
    try {
        const containerName = `${appName}-tunnel`;

        // Remove existing if any
        await removeContainer(containerName).catch(() => { });

        const result = await dockerCommand([
            "run",
            "-d",
            "--name",
            containerName,
            "--network",
            "host",
            "--restart",
            "unless-stopped",
            "cloudflare/cloudflared:latest",
            "tunnel",
            "--no-autoupdate",
            "run",
            "--token",
            tunnelToken,
        ]);

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Failed to start tunnel container: ${result.stderr}`,
            };
        }

        return {
            success: true,
            message: `Tunnel container ${containerName} started successfully`,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Tunnel start error: ${error.message}`,
        };
    }
}

/**
 * Stop and remove an app-specific Cloudflare Tunnel sidecar container
 */
export async function stopAppTunnelContainer(
    appName: string
): Promise<{ success: boolean; message: string }> {
    const containerName = `${appName}-tunnel`;
    let success = true;
    let message = `Tunnel container ${containerName} stopped and removed`;

    const stopResult = await stopContainer(containerName);
    if (!stopResult.success && !stopResult.message.includes("No such container")) {
        success = false;
        message = stopResult.message;
    }

    const rmResult = await removeContainer(containerName);
    if (!rmResult.success && !rmResult.message.includes("No such container")) {
        success = false;
        message = rmResult.message;
    }

    return { success, message };
}

/**
 * Get container logs
 */
export async function containerLogs(containerName: string, lines: number = 50): Promise<string> {
    try {
        const result = await dockerCommand(["logs", "--tail", lines.toString(), containerName]);

        return result.stdout || result.stderr || "No logs available";
    } catch (error: any) {
        return `Error fetching logs: ${error.message}`;
    }
}

/**
 * List all okastr8 containers
 */
export async function listContainers(): Promise<
    Array<{ name: string; status: string; state: string; ports: string }>
> {
    try {
        const result = await dockerCommand([
            "ps",
            "-a",
            "--format",
            "{{.Names}}|{{.Status}}|{{.State}}|{{.Ports}}",
        ]);

        if (result.exitCode !== 0) {
            return [];
        }

        const lines = result.stdout
            .trim()
            .split("\n")
            .filter((line) => line && line.includes("|"));

        return lines.map((line) => {
            const [name = "", status = "", state = "", ports = ""] = line.split("|");
            return { name, status, state, ports };
        });
    } catch (error: any) {
        return [];
    }
}

export async function systemDfVerbose(): Promise<{ success: boolean; output: string }> {
    try {
        const result = await dockerCommand(["system", "df", "-v"]);
        if (result.exitCode !== 0) {
            return { success: false, output: result.stderr || result.stdout };
        }
        return { success: true, output: result.stdout || "" };
    } catch (error: any) {
        return { success: false, output: String(error?.message || error) };
    }
}

/**
 * Get all containers for a compose project
 */
export async function getProjectContainers(
    projectName: string
): Promise<Array<{ name: string; status: string; health?: string }>> {
    try {
        const result = await dockerCommand([
            "ps",
            "-a",
            "--filter",
            `label=com.docker.compose.project=${projectName}`,
            "--format",
            "{{.Names}}|{{.State}}|{{.Status}}",
        ]);

        if (result.exitCode !== 0) {
            return [];
        }

        const lines = result.stdout
            .trim()
            .split("\n")
            .filter((line) => line && line.includes("|"));

        return lines.map((line) => {
            const [name = "", status = "", healthRaw = ""] = line.split("|");
            const health = healthRaw && healthRaw !== "<no value>" ? healthRaw : undefined;
            return { name, status, health };
        });
    } catch (error: any) {
        return [];
    }
}

/**
 * Check if Docker is installed and running
 */
export async function checkDockerInstalled(): Promise<boolean> {
    try {
        const result = await dockerCommand(["--version"]);
        return result.exitCode === 0;
    } catch {
        return false;
    }
}

/**
 * Check if Docker Compose is installed
 */
export async function checkComposeInstalled(): Promise<boolean> {
    try {
        const result = await composeCommand(["--version"]);
        return result.exitCode === 0;
    } catch {
        return false;
    }
}
