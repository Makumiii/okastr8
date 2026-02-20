import { spawn } from "child_process";

interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

export async function runCommand(
    command: string,
    args: string[] = [],
    cwd?: string,
    stdin?: string
): Promise<CommandResult> {
    let cmdToExecute: string;
    let argsToExecute: string[];

    if (command === "sudo") {
        cmdToExecute = "sudo";
        argsToExecute = args;
    } else {
        cmdToExecute = command;
        argsToExecute = args;
    }

    return new Promise((resolve, reject) => {
        const child = spawn(cmdToExecute, argsToExecute, {
            stdio: stdin ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"], // Enable stdin pipe if needed
            cwd, // Pass the working directory
        });

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
            resolve({
                stdout,
                stderr,
                exitCode: code,
            });
        });

        child.on("error", (err) => {
            reject(
                new Error(
                    `Failed to start command "${cmdToExecute} ${argsToExecute.join(" ")}": ${err.message}`
                )
            );
        });
    });
}
