/**
 * CLI Logger Utility
 * Handles spinners, task progress, and professional formatted output
 */

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

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class TaskProgress {
    private steps: string[];
    private currentStepKey: string | null = null;
    private spinnerIndex = 0;
    private spinnerInterval: any = null;
    private lastMessage = "";
    private isTTY = process.stdout.isTTY ?? false;

    constructor(steps: string[]) {
        this.steps = steps;
    }

    private get currentStepIndex() {
        if (!this.currentStepKey) return 0;
        const index = this.steps.indexOf(this.currentStepKey);
        return index !== -1 ? index + 1 : 0;
    }

    private render(message: string, isFinal = false, status: "success" | "fail" | "progress" = "progress") {
        const stepIndex = this.currentStepIndex;
        const stepTotal = this.steps.length;
        const progressPrefix = stepTotal > 0 ? `[${stepIndex}/${stepTotal}] ` : "";

        let symbol = "";
        if (isFinal) {
            symbol = status === "success"
                ? `${colors.green}DONE${colors.reset}`
                : `${colors.red}FAIL${colors.reset}`;
        } else {
            symbol = `${colors.cyan}${frames[this.spinnerIndex]}${colors.reset}`;
        }

        const content = `${symbol} ${colors.bold}${progressPrefix}${colors.reset}${message}`;

        if (this.isTTY) {
            // TTY: Use carriage return to overwrite same line
            process.stdout.write(`\r\x1b[2K${content}${isFinal ? "\n" : ""}`);
        } else {
            // Non-TTY: Only print on final or when message changes to avoid spam
            if (isFinal || message !== this.lastMessage) {
                console.log(content);
            }
        }
        this.lastMessage = message;
    }

    /**
     * Start a new step or update current task
     */
    step(key: string, message: string) {
        this.currentStepKey = key;
        this.lastMessage = message;

        // Only animate spinner in TTY mode
        if (this.isTTY && !this.spinnerInterval) {
            this.spinnerInterval = setInterval(() => {
                this.spinnerIndex = (this.spinnerIndex + 1) % frames.length;
                this.render(this.lastMessage);
            }, 80);
        }

        this.render(message);
    }

    /**
     * Update message for current step without changing step index
     */
    log(message: string) {
        // Only render if message changed (prevents spam from repeated log calls)
        if (message !== this.lastMessage) {
            this.lastMessage = message;
            this.render(message);
        }
    }

    /**
     * Finish the entire task successfully
     */
    success(message: string) {
        this.stopSpinner();
        this.render(message, true, "success");
    }

    /**
     * Fail the task
     */
    fail(message: string) {
        this.stopSpinner();
        this.render(message, true, "fail");
    }

    private stopSpinner() {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
            this.spinnerInterval = null;
        }
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
