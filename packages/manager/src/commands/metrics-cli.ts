/**
 * Metrics CLI - htop-style terminal view
 * Displays live-updating system and application metrics
 */

import { Command } from "commander";
import { collectMetrics, type MetricsResult } from "./metrics";
import type { SystemMetrics } from "../utils/systemMetrics";
import type { AppMetrics } from "../utils/appMetrics";

// ANSI escape codes
const ESC = "\x1b";
const BOLD = `${ESC}[1m`;
const RESET = `${ESC}[0m`;
const DIM = `${ESC}[2m`;
const GREEN = `${ESC}[32m`;
const RED = `${ESC}[31m`;
const YELLOW = `${ESC}[33m`;
const BLUE = `${ESC}[34m`;
const CYAN = `${ESC}[36m`;
const MAGENTA = `${ESC}[35m`;

function progressBar(percent: number, width: number = 20, filled = "█", empty = "░"): string {
    const filledCount = Math.round((percent / 100) * width);
    const emptyCount = width - filledCount;
    return filled.repeat(Math.max(0, filledCount)) + empty.repeat(Math.max(0, emptyCount));
}

function getStatusColor(status: string): string {
    switch (status) {
        case "running":
            return GREEN;
        case "stopped":
            return DIM;
        case "failed":
            return RED;
        default:
            return RESET;
    }
}

function padRight(str: string, len: number): string {
    return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
    return str.length >= len ? str.slice(0, len) : " ".repeat(len - str.length) + str;
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visibleLength(input: string): number {
    return input.replace(ANSI_RE, "").length;
}

function truncateAnsi(input: string, max: number): string {
    let out = "";
    let visible = 0;
    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        if (char === "\x1b") {
            const match = input.slice(i).match(/^\x1b\[[0-9;]*m/);
            if (match) {
                out += match[0];
                i += match[0].length - 1;
                continue;
            }
        }
        if (visible >= max) break;
        out += char;
        visible += 1;
    }
    if (visible >= max) {
        out += RESET;
    }
    return out;
}

function padAnsi(input: string, width: number): string {
    const len = visibleLength(input);
    if (len === width) return input;
    if (len > width) return truncateAnsi(input, width);
    return input + " ".repeat(width - len);
}

function getTerminalWidth(): number {
    return Math.max(80, Math.min(140, process.stdout.columns || 100));
}

function makeBox(title: string, lines: string[], width: number): string {
    const innerWidth = width - 2;
    const safeTitle = title.length > innerWidth - 2 ? title.slice(0, innerWidth - 2) : title;
    const top = `┌${"─".repeat(innerWidth)}┐`;
    const titleLine = `│ ${padAnsi(`${BOLD}${safeTitle}${RESET}`, innerWidth - 2)} │`;
    const divider = `├${"─".repeat(innerWidth)}┤`;
    const content = lines.map((line) => `│ ${padAnsi(line, innerWidth - 2)} │`);
    const bottom = `└${"─".repeat(innerWidth)}┘`;
    return [top, titleLine, divider, ...content, bottom].join("\n");
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes)) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let idx = 0;
    let value = Math.max(0, bytes);
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)} ${units[idx]}`;
}

function formatRate(bytesPerSec: number): string {
    return `${formatBytes(bytesPerSec)}/s`;
}

function formatPercent(value: number, digits = 1): string {
    if (!Number.isFinite(value)) return "-";
    return `${value.toFixed(digits)}%`;
}

function formatGbFromMb(valueMb: number): string {
    if (!Number.isFinite(valueMb)) return "-";
    return `${(valueMb / 1024).toFixed(1)} GB`;
}

function renderSystemOverview(system: SystemMetrics): string {
    const lines: string[] = [];

    const width = getTerminalWidth();
    const barWidth = Math.max(12, Math.min(30, Math.floor((width - 40) / 2)));
    const cpuBar = progressBar(system.cpu.usage, barWidth);
    const cpuColor = system.cpu.usage > 80 ? RED : system.cpu.usage > 50 ? YELLOW : GREEN;
    lines.push(
        `CPU: ${cpuColor}${cpuBar}${RESET} ${padLeft(system.cpu.usage.toFixed(1), 5)}%  ${system.cpu.cores} cores @ ${system.cpu.speed}MHz  Steal ${formatPercent(system.cpu.steal)}`
    );
    lines.push(`Model: ${system.cpu.model}`);

    const memBar = progressBar(system.memory.percent, barWidth);
    const memColor = system.memory.percent > 80 ? RED : system.memory.percent > 50 ? YELLOW : GREEN;
    lines.push(
        `MEM: ${memColor}${memBar}${RESET} ${padLeft(system.memory.percent.toFixed(1), 5)}%  ${formatGbFromMb(system.memory.used)} / ${formatGbFromMb(system.memory.total)}  Free ${formatGbFromMb(system.memory.free)}  Avail ${formatGbFromMb(system.memory.available)}`
    );

    const swapBar = progressBar(system.swap.percent, barWidth);
    const swapColor = system.swap.percent > 80 ? RED : system.swap.percent > 50 ? YELLOW : GREEN;
    lines.push(
        `SWP: ${swapColor}${swapBar}${RESET} ${padLeft(system.swap.percent.toFixed(1), 5)}%  ${formatGbFromMb(system.swap.used)} / ${formatGbFromMb(system.swap.total)}  In ${system.swap.inRate.toFixed(1)} MB/m  Out ${system.swap.outRate.toFixed(1)} MB/m`
    );

    const loadLine = `${system.load.avg1.toFixed(2)} ${system.load.avg5.toFixed(2)} ${system.load.avg15.toFixed(2)}`;
    const bootLine = system.health.bootTime
        ? new Date(system.health.bootTime * 1000).toLocaleString()
        : "-";
    lines.push(`Load: ${loadLine}  Uptime: ${system.uptime.readable}  Boot: ${bootLine}`);

    lines.push(
        `Disk I/O: R ${formatRate(system.disk.io.readPerSec)}  W ${formatRate(system.disk.io.writePerSec)}  Busy ${formatPercent(system.disk.io.busyPercent)}  Lat ${system.disk.io.latencyMs.toFixed(1)}ms`
    );
    const blocks: string[] = [];
    blocks.push(makeBox("System Overview", lines, width));

    const diskLines: string[] = [];
    if (system.disk.mounts.length === 0) {
        diskLines.push(`${DIM}No mount data available.${RESET}`);
    } else {
        diskLines.push(
            `${DIM}${padRight("MOUNT", 18)} ${padLeft("USED", 10)} ${padLeft("TOTAL", 10)} ${padLeft("%", 6)} ${padLeft("FREE", 10)} ${padLeft("INODES%", 8)}${RESET}`
        );
        for (const mount of system.disk.mounts) {
            diskLines.push(
                `${padRight(mount.mount, 18)} ${padLeft(formatBytes(mount.used), 10)} ${padLeft(formatBytes(mount.total), 10)} ${padLeft(formatPercent(mount.percent, 0), 6)} ${padLeft(formatBytes(mount.free), 10)} ${padLeft(formatPercent(mount.inodesPercent, 0), 8)}`
            );
        }
    }
    blocks.push(makeBox("Disk Mounts", diskLines, width));

    const networkLines: string[] = [];
    networkLines.push(
        `Totals: RX ${formatRate(system.network.totalRxPerSec)}  TX ${formatRate(system.network.totalTxPerSec)}  Active ${system.network.activeConnections}  Retransmits ${Number.isFinite(system.network.retransmits) ? system.network.retransmits : "-"}`
    );
    if (system.network.interfaces.length === 0) {
        networkLines.push(`${DIM}No interface data available.${RESET}`);
    } else {
        networkLines.push(
            `${DIM}${padRight("IFACE", 10)} ${padLeft("RX", 10)} ${padLeft("TX", 10)} ${padLeft("RXERR", 6)} ${padLeft("TXERR", 6)} ${padLeft("RXDROP", 7)} ${padLeft("TXDROP", 7)}${RESET}`
        );
        for (const iface of system.network.interfaces) {
            networkLines.push(
                `${padRight(iface.name, 10)} ${padLeft(formatBytes(iface.rxBytes), 10)} ${padLeft(formatBytes(iface.txBytes), 10)} ${padLeft(String(iface.rxErrors), 6)} ${padLeft(String(iface.txErrors), 6)} ${padLeft(String(iface.rxDropped), 7)} ${padLeft(String(iface.txDropped), 7)}`
            );
        }
    }
    blocks.push(makeBox("Network", networkLines, width));

    const healthLines: string[] = [];
    healthLines.push(
        `OOM Kills: ${system.health.oomKills}  Unexpected Reboot: ${system.health.unexpectedReboot ? "yes" : "no"}`
    );
    healthLines.push(
        `File Descriptors: ${system.limits.fileDescriptors.used}/${system.limits.fileDescriptors.total} (${formatPercent(system.limits.fileDescriptors.percent, 0)})`
    );
    blocks.push(makeBox("Health & Limits", healthLines, width));

    return blocks.join("\n\n");
}

function renderAppSummary(apps: AppMetrics[]): string {
    const lines: string[] = [];

    lines.push(
        `${DIM}${padRight("NAME", 22)} ${padLeft("STATUS", 8)} ${padLeft("CPU%", 6)} ${padLeft("MEM%", 6)} ${padRight("UPTIME", 10)} ${padLeft("REQ/S", 7)} ${padLeft("4XX", 5)} ${padLeft("5XX", 5)}${RESET}`
    );

    for (const app of apps) {
        const statusColor = getStatusColor(app.status);
        const name = padRight(app.name, 22);
        const status = padLeft(app.status, 8);
        const cpu =
            app.status === "running" ? padLeft(app.resources.cpu.toFixed(1), 6) : padLeft("-", 6);
        const mem =
            app.status === "running"
                ? padLeft(app.resources.memoryPercent.toFixed(1), 6)
                : padLeft("-", 6);
        const uptime =
            app.status === "running" ? padRight(app.uptime.readable, 10) : padRight("-", 10);
        const reqs =
            app.status === "running"
                ? padLeft(app.traffic.requestsPerSec.toFixed(1), 7)
                : padLeft("-", 7);
        const err4xx =
            app.status === "running"
                ? padLeft(app.traffic.errorRate4xx.toFixed(1), 5)
                : padLeft("-", 5);
        const err5xx =
            app.status === "running"
                ? padLeft(app.traffic.errorRate5xx.toFixed(1), 5)
                : padLeft("-", 5);

        lines.push(
            `${name} ${statusColor}${status}${RESET} ${cpu} ${mem} ${uptime} ${reqs} ${err4xx} ${err5xx}`
        );
    }

    const width = getTerminalWidth();
    return makeBox("Application Summary", lines, width);
}

function renderAppDetail(app: AppMetrics): string {
    const lines: string[] = [];
    lines.push(`Status: ${app.status}  Domain: ${app.domain || "-"}  PID: ${app.pid ?? "-"}`);
    lines.push(`Uptime: ${app.uptime.readable}  Since: ${app.uptime.since || "-"}`);
    lines.push(
        `CPU: ${formatPercent(app.resources.cpu)}  Memory: ${app.resources.memory} MB (${formatPercent(app.resources.memoryPercent)})  Limit: ${app.resources.memoryLimit} MB`
    );
    lines.push(
        `Throttling: ${app.resources.throttling !== undefined ? formatPercent(app.resources.throttling) : "-"}`
    );
    lines.push(`Health: ${app.health.status}  Failing streak: ${app.health.failingStreak}`);
    lines.push(
        `Restarts: ${app.restarts.count}  Last exit: ${app.restarts.lastExitCode ?? "-"}  Reason: ${app.restarts.lastExitReason || "-"}`
    );
    lines.push(`Disk: ${formatBytes(app.disk.used)} used`);
    lines.push(
        `Traffic: Total ${app.traffic.totalRequests}  RPS ${app.traffic.requestsPerSec.toFixed(2)}  4xx ${formatPercent(app.traffic.errorRate4xx)}  5xx ${formatPercent(app.traffic.errorRate5xx)}  P95 ${app.traffic.p95Latency !== undefined ? `${Math.round(app.traffic.p95Latency)}ms` : "-"}`
    );
    const width = getTerminalWidth();
    return makeBox(`App: ${app.name}`, lines, width);
}
function renderFooter(): string {
    return `\n${DIM}Press Ctrl+C to exit • Refreshing every 1s${RESET}\n`;
}

type MetricsGroup = "system" | "apps" | "all";
type AppViewMode = "summary" | "all-detailed" | "single";

type AppViewSelection = {
    mode: AppViewMode;
    appName?: string;
};

async function selectGroup(group?: string): Promise<MetricsGroup> {
    if (group) {
        const normalized = group.toLowerCase() as MetricsGroup;
        if (normalized === "system" || normalized === "apps" || normalized === "all") {
            return normalized;
        }
    }
    const Enquirer = (await import("enquirer")).default;
    const response = await Enquirer.prompt({
        type: "select",
        name: "group",
        message: "Which metrics would you like to view?",
        choices: [
            { name: "system", message: "System metrics" },
            { name: "apps", message: "Application metrics" },
            { name: "all", message: "All metrics" },
        ],
    } as any);
    return (response as any).group as MetricsGroup;
}

async function selectAppView(
    apps: AppMetrics[],
    modeArg?: string,
    appArg?: string
): Promise<AppViewSelection> {
    const normalizedMode = modeArg?.toLowerCase() as AppViewMode | undefined;
    if (normalizedMode === "summary") return { mode: "summary" };
    if (normalizedMode === "all-detailed") return { mode: "all-detailed" };
    if (normalizedMode === "single" && appArg) return { mode: "single", appName: appArg };

    const Enquirer = (await import("enquirer")).default;
    const modeResponse = await Enquirer.prompt({
        type: "select",
        name: "mode",
        message: "How would you like to view application metrics?",
        choices: [
            { name: "summary", message: "Summary table (all apps)" },
            { name: "single", message: "Single app (full detail)" },
            { name: "all-detailed", message: "All apps (full detail)" },
        ],
    } as any);

    const mode = (modeResponse as any).mode as AppViewMode;
    if (mode !== "single") return { mode };

    const appChoices = apps.map((app) => ({
        name: app.name,
        message: `${app.name} (${app.status})`,
    }));
    const appResponse = await Enquirer.prompt({
        type: "select",
        name: "app",
        message: "Select an app:",
        choices: appChoices,
    } as any);
    return { mode: "single", appName: (appResponse as any).app as string };
}

// TUI State Management
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;

type ViewConfig = {
    group: MetricsGroup;
    appView?: AppViewSelection;
    initialMetrics?: MetricsResult;
};

async function resolveViewConfig(
    group?: string,
    appMode?: string,
    appName?: string
): Promise<ViewConfig> {
    const selectedGroup = await selectGroup(group);
    if (selectedGroup === "system") {
        return { group: selectedGroup };
    }

    const initialMetrics = await collectMetrics();
    const appView = await selectAppView(initialMetrics.apps, appMode, appName);
    return { group: selectedGroup, appView, initialMetrics };
}

async function runMetricsLoop(group?: string, appMode?: string, appName?: string): Promise<void> {
    const view = await resolveViewConfig(group, appMode, appName);
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

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    while (running) {
        try {
            const metrics = view.initialMetrics ?? (await collectMetrics());
            view.initialMetrics = undefined;

            // Buffer output to prevent flickering
            let output = "";

            // Clear screen + scrollback buffer + move cursor home
            // [2J clears visible screen, [3J clears scrollback, [H moves cursor
            output += `${ESC}[2J${ESC}[3J${ESC}[H`;

            // Header
            output += `${BOLD}${BLUE}okastr8 metrics${RESET} ${DIM}${new Date().toLocaleTimeString()}${RESET}\n\n`;

            if (view.group === "system" || view.group === "all") {
                output += renderSystemOverview(metrics.system) + "\n";
            }

            if (view.group === "apps" || view.group === "all") {
                if (metrics.apps.length === 0) {
                    output += `${DIM}No applications found.${RESET}\n`;
                } else if (view.appView?.mode === "all-detailed") {
                    for (const app of metrics.apps) {
                        output += renderAppDetail(app) + "\n\n";
                    }
                } else if (view.appView?.mode === "single" && view.appView.appName) {
                    const app = metrics.apps.find((item) => item.name === view.appView?.appName);
                    if (app) {
                        output += renderAppDetail(app) + "\n";
                    } else {
                        output += `${DIM}App not found: ${view.appView.appName}${RESET}\n`;
                    }
                } else {
                    output += renderAppSummary(metrics.apps) + "\n";
                }
            }

            // Footer
            output += renderFooter();

            process.stdout.write(output);
        } catch (error: any) {
            console.error(`${RED}Error collecting metrics: ${error.message}${RESET}`);
        }

        // Wait 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

async function runMetricsOnce(group?: string, appMode?: string, appName?: string): Promise<void> {
    try {
        const view = await resolveViewConfig(group, appMode, appName);
        const metrics = view.initialMetrics ?? (await collectMetrics());

        console.log(
            `${BOLD}${BLUE}okastr8 metrics${RESET} ${DIM}${new Date().toLocaleTimeString()}${RESET}\n`
        );
        if (view.group === "system" || view.group === "all") {
            console.log(renderSystemOverview(metrics.system));
        }
        if (view.group === "apps" || view.group === "all") {
            if (metrics.apps.length === 0) {
                console.log(`${DIM}No applications found.${RESET}`);
            } else if (view.appView?.mode === "all-detailed") {
                for (const app of metrics.apps) {
                    console.log(renderAppDetail(app));
                    console.log("");
                }
            } else if (view.appView?.mode === "single" && view.appView.appName) {
                const targetApp = view.appView.appName;
                const app = metrics.apps.find((item) => item.name === targetApp);
                if (app) {
                    console.log(renderAppDetail(app));
                } else {
                    console.log(`${DIM}App not found: ${targetApp}${RESET}`);
                }
            } else {
                console.log(renderAppSummary(metrics.apps));
            }
        }
    } catch (error: any) {
        console.error(`${RED}Error collecting metrics: ${error.message}${RESET}`);
        process.exit(1);
    }
}

export function addMetricsCommands(program: Command): void {
    program
        .command("metrics")
        .description("Show live system and application metrics (htop-style)")
        .option("-1, --once", "Show metrics once and exit (no live updates)")
        .option("-g, --group <group>", "Metrics group: system, apps, or all")
        .option("--apps-mode <mode>", "Application view: summary, single, all-detailed")
        .option("--app <name>", "Application name (when apps-mode=single)")
        .action(async (options) => {
            if (options.once) {
                await runMetricsOnce(options.group, options.appsMode, options.app);
            } else {
                await runMetricsLoop(options.group, options.appsMode, options.app);
            }
        });
}
