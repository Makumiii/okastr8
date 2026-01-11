/**
 * Metrics CLI - htop-style terminal view
 * Displays live-updating system and service metrics
 */

import { Command } from 'commander';
import { collectMetrics } from './metrics';
import type { ServiceMetrics, SystemMetrics } from './metrics';

// ANSI escape codes
const ESC = '\x1b';
const CLEAR = `${ESC}[2J${ESC}[H`;
const BOLD = `${ESC}[1m`;
const RESET = `${ESC}[0m`;
const DIM = `${ESC}[2m`;
const GREEN = `${ESC}[32m`;
const RED = `${ESC}[31m`;
const YELLOW = `${ESC}[33m`;
const BLUE = `${ESC}[34m`;
const CYAN = `${ESC}[36m`;
const MAGENTA = `${ESC}[35m`;

function progressBar(percent: number, width: number = 20, filled = '█', empty = '░'): string {
    const filledCount = Math.round((percent / 100) * width);
    const emptyCount = width - filledCount;
    return filled.repeat(Math.max(0, filledCount)) + empty.repeat(Math.max(0, emptyCount));
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'running': return GREEN;
        case 'stopped': return DIM;
        case 'failed': return RED;
        default: return RESET;
    }
}

function padRight(str: string, len: number): string {
    return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
    return str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str;
}

function renderSystemOverview(system: SystemMetrics): string {
    const lines: string[] = [];

    lines.push(`${BOLD}${CYAN}╭──────────────────────────────────────────────────────────────────╮${RESET}`);
    lines.push(`${BOLD}${CYAN}│${RESET}  ${BOLD}SYSTEM OVERVIEW${RESET}                                               ${CYAN}│${RESET}`);
    lines.push(`${CYAN}├──────────────────────────────────────────────────────────────────┤${RESET}`);

    // CPU
    const cpuBar = progressBar(system.cpu.usage);
    const cpuColor = system.cpu.usage > 80 ? RED : system.cpu.usage > 50 ? YELLOW : GREEN;
    lines.push(`${CYAN}│${RESET}  CPU   ${cpuColor}${cpuBar}${RESET} ${padLeft(system.cpu.usage.toFixed(1), 5)}%  [${system.cpu.cores} cores]                   ${CYAN}│${RESET}`);

    // Memory
    const memBar = progressBar(system.memory.percent);
    const memColor = system.memory.percent > 80 ? RED : system.memory.percent > 50 ? YELLOW : GREEN;
    const memUsed = (system.memory.used / 1024).toFixed(1);
    const memTotal = (system.memory.total / 1024).toFixed(1);
    lines.push(`${CYAN}│${RESET}  MEM   ${memColor}${memBar}${RESET} ${padLeft(system.memory.percent.toString(), 5)}%  [${memUsed}/${memTotal} GB]          ${CYAN}│${RESET}`);

    // Load & Uptime
    lines.push(`${CYAN}│${RESET}  Load: ${system.load.join(' ')}    Uptime: ${system.uptime}                          ${CYAN}│${RESET}`);
    lines.push(`${CYAN}╰──────────────────────────────────────────────────────────────────╯${RESET}`);

    return lines.join('\n');
}

function renderServicesTable(services: ServiceMetrics[]): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(`${BOLD}${MAGENTA}╭──────────────────────────────────────────────────────────────────────────────╮${RESET}`);
    lines.push(`${BOLD}${MAGENTA}│${RESET}  ${BOLD}SERVICE METRICS${RESET}                                                            ${MAGENTA}│${RESET}`);
    lines.push(`${MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${RESET}`);

    // Header with REQ/S column
    lines.push(`${MAGENTA}│${RESET}  ${DIM}${padRight('NAME', 22)} ${padLeft('STATUS', 8)} ${padLeft('CPU%', 6)} ${padLeft('MEM', 8)} ${padRight('UPTIME', 12)} ${padLeft('REQ/S', 8)}${RESET}${MAGENTA}│${RESET}`);
    lines.push(`${MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${RESET}`);

    // Services
    for (const svc of services) {
        const statusColor = getStatusColor(svc.status);
        const name = padRight(svc.name, 22);
        const status = padLeft(svc.status, 8);
        const cpu = svc.status === 'running' ? padLeft(svc.cpu.toFixed(1), 6) : padLeft('-', 6);
        const mem = svc.status === 'running' ? padLeft(svc.memory + ' MB', 8) : padLeft('-', 8);
        const uptime = svc.status === 'running' ? padRight(svc.uptime, 12) : padRight('-', 12);
        const reqs = svc.status === 'running' && svc.requestsPerSec !== undefined
            ? padLeft(svc.requestsPerSec.toFixed(1), 8)
            : padLeft('-', 8);

        lines.push(`${MAGENTA}│${RESET}  ${name} ${statusColor}${status}${RESET} ${cpu} ${mem} ${uptime} ${reqs}${MAGENTA}│${RESET}`);
    }

    lines.push(`${MAGENTA}╰──────────────────────────────────────────────────────────────────────────────╯${RESET}`);

    return lines.join('\n');
}

function renderFooter(): string {
    return `\n${DIM}Press Ctrl+C to exit • Refreshing every 1s${RESET}\n`;
}

// TUI State Management
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;
const CLEAR_SCREEN = `${ESC}[2J`;
const CURSOR_HOME = `${ESC}[H`;

async function runMetricsLoop(): Promise<void> {
    let running = true;

    // Hide cursor for cleaner look
    process.stdout.write(CURSOR_HIDE);

    // cleanup on exit
    const cleanup = () => {
        running = false;
        process.stdout.write(CURSOR_SHOW);
        console.log(`\n${GREEN}Exiting metrics view...${RESET}`);
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    while (running) {
        try {
            const metrics = await collectMetrics();

            // Buffer output to prevent flickering
            let output = '';

            // Clear screen + scrollback buffer + move cursor home
            // [2J clears visible screen, [3J clears scrollback, [H moves cursor
            output += `${ESC}[2J${ESC}[3J${ESC}[H`;

            // Header
            output += `${BOLD}${BLUE}okastr8 metrics${RESET} ${DIM}${new Date().toLocaleTimeString()}${RESET}\n\n`;

            // System overview
            output += renderSystemOverview(metrics.system) + '\n';

            // Services table
            output += renderServicesTable(metrics.services) + '\n';

            // Footer
            output += renderFooter();

            process.stdout.write(output);

        } catch (error: any) {
            console.error(`${RED}Error collecting metrics: ${error.message}${RESET}`);
        }

        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function runMetricsOnce(): Promise<void> {
    try {
        const metrics = await collectMetrics();

        console.log(`${BOLD}${BLUE}okastr8 metrics${RESET} ${DIM}${new Date().toLocaleTimeString()}${RESET}\n`);
        console.log(renderSystemOverview(metrics.system));
        console.log(renderServicesTable(metrics.services));

    } catch (error: any) {
        console.error(`${RED}Error collecting metrics: ${error.message}${RESET}`);
        process.exit(1);
    }
}

export function addMetricsCommands(program: Command): void {
    program
        .command('metrics')
        .description('Show live system and service metrics (htop-style)')
        .option('-1, --once', 'Show metrics once and exit (no live updates)')
        .action(async (options) => {
            if (options.once) {
                await runMetricsOnce();
            } else {
                await runMetricsLoop();
            }
        });
}
