import { spawn } from "child_process";
import { registerDeploymentCancelHandler } from "./deploymentLogger";

interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

interface RunCommandOptions {
    deploymentId?: string;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
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
            detached: true, // Isolate process tree so cancellation can kill full command group.
        });
        let forceKillTimeout: ReturnType<typeof setTimeout> | undefined;
        const unregisterCancel =
            options?.deploymentId
                ? registerDeploymentCancelHandler(options.deploymentId, () => {
                    try {
                        process.kill(-child.pid!, "SIGTERM");
                    } catch {
                        try {
                            child.kill("SIGTERM");
                        } catch {}
                    }
                    forceKillTimeout = setTimeout(() => {
                        try {
                            process.kill(-child.pid!, "SIGKILL");
                        } catch {
                            try {
                                child.kill("SIGKILL");
                            } catch {}
                        }
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
            const text = data.toString();
            stdout += text;
            options?.onStdout?.(text);
        });

        child.stderr?.on("data", (data) => {
            const text = data.toString();
            stderr += text;
            options?.onStderr?.(text);
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
