/**
 * Centralized Logging System
 * Stores logs in memory with severity levels for dashboard display
 */

export type LogLevel = "info" | "warning" | "error";

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    service: string;
    message: string;
}

// In-memory log storage (last 100 entries)
const MAX_LOGS = 100;
const logs: LogEntry[] = [];

/**
 * Add a log entry
 */
export function log(level: LogLevel, service: string, message: string): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        service,
        message,
    };

    logs.unshift(entry); // Add to beginning

    // Trim to max size
    if (logs.length > MAX_LOGS) {
        logs.pop();
    }

    // Also log to console with color
    const colors = {
        info: "\x1b[36m", // Cyan
        warning: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
    };
    const reset = "\x1b[0m";
    console.log(`${colors[level]}[${level.toUpperCase()}]${reset} [${service}] ${message}`);
}

/**
 * Convenience methods
 */
export function info(service: string, message: string): void {
    log("info", service, message);
}

export function warning(service: string, message: string): void {
    log("warning", service, message);
}

export function error(service: string, message: string): void {
    log("error", service, message);
}

/**
 * Get recent logs
 */
export function getRecentLogs(count: number = 10): LogEntry[] {
    return logs.slice(0, count);
}

/**
 * Get log counts by level
 */
export function getLogCounts(): { info: number; warning: number; error: number } {
    return {
        info: logs.filter((l) => l.level === "info").length,
        warning: logs.filter((l) => l.level === "warning").length,
        error: logs.filter((l) => l.level === "error").length,
    };
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
    logs.length = 0;
}

/**
 * Get health status based on recent logs
 */
export function getHealthStatus(): "ok" | "warning" | "error" {
    // Check last 10 logs for issues
    const recent = logs.slice(0, 10);

    if (recent.some((l) => l.level === "error")) {
        return "error";
    }
    if (recent.some((l) => l.level === "warning")) {
        return "warning";
    }
    return "ok";
}
