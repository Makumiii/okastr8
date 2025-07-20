import { spawn } from 'child_process';

export async function runCommand(command: string, args: string[] = []): Promise<void> {
  let cmdToExecute: string;
  let argsToExecute: string[];

  if (command === 'sudo') {
    // If 'sudo' is the command, the first element of args is the actual script/command
    // and the rest are its arguments.
    cmdToExecute = 'sudo';
    argsToExecute = args; // args will contain [scriptPath, arg1, arg2, ...]
  } else {
    cmdToExecute = command;
    argsToExecute = args;
  }

  try {
    const child = spawn(cmdToExecute, argsToExecute, {
      stdio: 'inherit',
    });

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command "${cmdToExecute} ${argsToExecute.join(' ')}" exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start command "${cmdToExecute} ${argsToExecute.join(' ')}": ${err.message}`));
      });
    });
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    throw error; // Re-throw the error for the caller to handle
  }
}