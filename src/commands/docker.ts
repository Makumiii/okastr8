import { runCommand } from "../utils/command";
import { existsSync } from "fs";

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
    const paths = ["/usr/bin/docker-compose", "/usr/local/bin/docker-compose", "/usr/local/lib/docker/cli-plugins/docker-compose"];
    for (const p of paths) {
        if (existsSync(p)) return p;
    }
    return "docker-compose"; // Fallback
}

/**
 * Run a docker command with sudo for permission handling
 */
async function dockerCommand(args: string[], cwd?: string) {
    return runCommand("sudo", [getDockerPath(), ...args], cwd);
}

/**
 * Run a docker-compose command with sudo for permission handling
 */
async function composeCommand(args: string[], cwd?: string) {
    return runCommand("sudo", [getComposePath(), ...args], cwd);
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
        const result = await dockerCommand([
            "build",
            "-t",
            tag,
            "-f",
            dockerfilePath,
            context,
        ]);

        if (result.exitCode !== 0) {
            return {
                success: false,
                message: `Docker build failed: ${result.stderr}`,
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

/**
 * Run a Docker container
 */
export async function runContainer(
    appName: string,
    image: string,
    port: number,
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
            `${port}:${port}`,
            "--restart",
            "unless-stopped",
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

/**
 * Run docker-compose up
 */
export async function composeUp(
    composePaths: string | string[],
    projectName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const paths = Array.isArray(composePaths) ? composePaths : [composePaths];
        const fileArgs = paths.flatMap(p => ["-f", p]);

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
        const result = await dockerCommand([
            "inspect",
            "--format",
            "{{.State.Status}}|{{.State.Health.Status}}",
            containerName,
        ]);

        if (result.exitCode !== 0) {
            return {
                running: false,
                status: "not found",
            };
        }

        const parts = result.stdout.trim().split("|");
        const status = parts[0] || "unknown";
        const healthRaw = parts[1] || "";
        const health = healthRaw && healthRaw !== "<no value>" ? healthRaw : undefined;

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

/**
 * Get container logs
 */
export async function containerLogs(
    containerName: string,
    lines: number = 50
): Promise<string> {
    try {
        const result = await dockerCommand([
            "logs",
            "--tail",
            lines.toString(),
            containerName,
        ]);

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
        const result = await runCommand("sudo", [
            "-n",
            getDockerPath(),
            "ps",
            "-a",
            "--format",
            "{{.Names}}|{{.Status}}|{{.State}}|{{.Ports}}",
        ]);

        if (result.exitCode !== 0) {
            return [];
        }

        const lines = result.stdout.trim().split("\n").filter((line) => line && line.includes("|"));

        return lines.map((line) => {
            const [name = "", status = "", state = "", ports = ""] = line.split("|");
            return { name, status, state, ports };
        });
    } catch (error: any) {
        return [];
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

        const lines = result.stdout.trim().split("\n").filter((line) => line && line.includes("|"));

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
