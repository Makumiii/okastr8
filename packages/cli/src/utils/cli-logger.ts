/**
 * CLI Logger Utility
 * Uses ora for spinners and provides task progress tracking
 */

import ora, { type Ora } from "ora";

const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
};

export class TaskProgress {
    private steps: string[];
    private currentStepKey: string | null = null;
    private spinner: Ora;

    constructor(steps: string[]) {
        this.steps = steps;
        this.spinner = ora({
            spinner: "dots",
            color: "cyan",
        });
    }

    private get currentStepIndex() {
        if (!this.currentStepKey) return 0;
        const index = this.steps.indexOf(this.currentStepKey);
        return index !== -1 ? index + 1 : 0;
    }

    private formatMessage(message: string): string {
        const stepIndex = this.currentStepIndex;
        const stepTotal = this.steps.length;
        const progressPrefix = stepTotal > 0 ? `[${stepIndex}/${stepTotal}] ` : "";
        return `${colors.bold}${progressPrefix}${colors.reset}${message}`;
    }

    /**
     * Start a new step or update current task
     */
    step(key: string, message: string) {
        this.currentStepKey = key;
        const formattedMessage = this.formatMessage(message);

        if (this.spinner.isSpinning) {
            this.spinner.text = formattedMessage;
        } else {
            this.spinner.start(formattedMessage);
        }
    }

    /**
     * Update message for current step without changing step index
     */
    log(message: string) {
        this.spinner.text = this.formatMessage(message);
    }

    /**
     * Finish the entire task successfully
     */
    success(message: string) {
        this.spinner.succeed(this.formatMessage(message));
    }

    /**
     * Fail the task
     */
    fail(message: string) {
        this.spinner.fail(this.formatMessage(message));
    }
}

/**
 * Standard professional loggers
 */
export const cli = {
    info: (msg: string) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
    warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
    error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    bold: (msg: string) => console.log(`${colors.bold}${msg}${colors.reset}`),
};
