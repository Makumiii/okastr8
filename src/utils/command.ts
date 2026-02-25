import { spawn } from "child_process";
import { registerDeploymentCancelHandler } from "./deploymentLogger";

interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

interface RunCommandOptions {
    deploymentId?: string;
}

export async function runCommand(
    command: string,
    args: string[] = [],
    cwd?: string,
    stdin?: string,
    options?: RunCommandOptions
): Promise<CommandResult> {
    let cmdToExecute: string;
    let argsToExecute: string[];

    if (command === "sudo") {
        cmdToExecute = "sudo";
        const hasNonInteractiveFlag = args.includes("-n") || args.includes("--non-interactive");
        argsToExecute = hasNonInteractiveFlag ? args : ["-n", ...args];
    } else {
        cmdToExecute = command;
        argsToExecute = args;
    }

    return new Promise((resolve, reject) => {
        const child = spawn(cmdToExecute, argsToExecute, {
            stdio: stdin ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"], // Enable stdin pipe if needed
            cwd, // Pass the working directory
        });
        let forceKillTimeout: ReturnType<typeof setTimeout> | undefined;
        const unregisterCancel =
            options?.deploymentId
                ? registerDeploymentCancelHandler(options.deploymentId, () => {
                    try {
                        child.kill("SIGTERM");
                    } catch {}
                    forceKillTimeout = setTimeout(() => {
                        try {
                            child.kill("SIGKILL");
                        } catch {}
                    }, 2500);
                    forceKillTimeout.unref?.();
                })
                : () => {};

        let stdout = "";
        let stderr = "";

        // Write stdin if provided
        if (stdin && child.stdin) {
            child.stdin.write(stdin);
            child.stdin.end();
        }

        child.stdout?.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {
            if (forceKillTimeout) clearTimeout(forceKillTimeout);
            unregisterCancel();
            resolve({
                stdout,
                stderr,
                exitCode: code,
            });
        });

        child.on("error", (err) => {
            if (forceKillTimeout) clearTimeout(forceKillTimeout);
            unregisterCancel();
            reject(
                new Error(
                    `Failed to start command "${cmdToExecute} ${argsToExecute.join(" ")}": ${err.message}`
                )
            );
        });
    });
}
