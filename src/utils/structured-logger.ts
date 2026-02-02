import { appendFile, mkdir, stat, rename, unlink } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type LogSource =
    | "manager"
    | "cli"
    | "api"
    | "webhook"
    | "scheduler"
    | "deploy"
    | "system";

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    source: LogSource;
    service: string;
    message: string;
    traceId?: string;
    spanId?: string;
    parentId?: string;
    user?: string;
    app?: {
        name?: string;
        repo?: string;
        branch?: string;
        versionId?: number | string;
    };
    action?: string;
    phase?: string;
    request?: {
        method?: string;
        path?: string;
        status?: number;
        durationMs?: number;
        ip?: string;
        userAgent?: string;
    };
    error?: {
        name?: string;
        message?: string;
        stack?: string;
        code?: string | number;
    };
    data?: Record<string, unknown>;
}

export interface FileLoggerOptions {
    filePath: string;
    source: LogSource;
    service: string;
    maxBytes?: number;
    maxBackups?: number;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_BACKUPS = 3;
const GLOBAL_FLAG = Symbol.for("okastr8.console.logger.installed");
const UNIFIED_LOG_PATH = join(homedir(), ".okastr8", "logs", "unified.log");

function resolveLogPath(filePath: string): string {
    if (filePath.startsWith("~")) {
        return join(homedir(), filePath.slice(1));
    }
    return filePath;
}

function extractError(args: unknown[]): LogEntry["error"] | undefined {
    const err = args.find((arg) => arg instanceof Error) as Error | undefined;
    if (!err) return undefined;
    const anyErr = err as Error & { code?: string | number };
    return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: anyErr.code,
    };
}

function formatMessage(args: unknown[]): string {
    return args
        .map((arg) => {
            if (typeof arg === "string") return arg;
            if (arg instanceof Error) return arg.message;
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        })
        .join(" ");
}

async function rotateIfNeeded(
    filePath: string,
    maxBytes: number,
    maxBackups: number,
    nextBytes: number,
) {
    if (!existsSync(filePath)) return;
    const current = await stat(filePath);
    if (current.size + nextBytes <= maxBytes) return;

    // Remove oldest backup
    const oldest = `${filePath}.${maxBackups}`;
    if (existsSync(oldest)) {
        await unlink(oldest).catch(() => {});
    }

    // Shift backups
    for (let i = maxBackups - 1; i >= 1; i -= 1) {
        const src = `${filePath}.${i}`;
        const dest = `${filePath}.${i + 1}`;
        if (existsSync(src)) {
            await rename(src, dest).catch(() => {});
        }
    }

    // Rotate current -> .1
    await rename(filePath, `${filePath}.1`).catch(() => {});
}

async function writeLogLine(
    filePath: string,
    entry: LogEntry,
    maxBytes: number,
    maxBackups: number,
) {
    const resolved = resolveLogPath(filePath);
    await mkdir(dirname(resolved), { recursive: true });

    const line = `${JSON.stringify(entry)}\n`;
    await rotateIfNeeded(resolved, maxBytes, maxBackups, Buffer.byteLength(line));
    await appendFile(resolved, line, "utf-8");
}

export function createFileLogger(options: FileLoggerOptions) {
    const filePath = options.filePath;
    const source = options.source;
    const service = options.service;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxBackups = options.maxBackups ?? DEFAULT_MAX_BACKUPS;

    const write = (level: LogLevel, message: string, data?: LogEntry["data"], error?: LogEntry["error"]) => {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            source,
            service,
            message,
            data,
            error,
        };
        void writeLogLine(filePath, entry, maxBytes, maxBackups);
    };

    return {
        log: write,
        debug: (message: string, data?: LogEntry["data"]) => write("debug", message, data),
        info: (message: string, data?: LogEntry["data"]) => write("info", message, data),
        warn: (message: string, data?: LogEntry["data"]) => write("warn", message, data),
        error: (message: string, data?: LogEntry["data"], err?: LogEntry["error"]) =>
            write("error", message, data, err),
        fatal: (message: string, data?: LogEntry["data"], err?: LogEntry["error"]) =>
            write("fatal", message, data, err),
    };
}

export async function writeUnifiedEntry(
    entry: LogEntry,
    maxBytes: number = DEFAULT_MAX_BYTES,
    maxBackups: number = DEFAULT_MAX_BACKUPS,
) {
    const payload: LogEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
    };
    await writeLogLine(UNIFIED_LOG_PATH, payload, maxBytes, maxBackups);
}

export function installConsoleLogger(options: FileLoggerOptions) {
    const globalAny = globalThis as { [GLOBAL_FLAG]?: boolean };
    if (globalAny[GLOBAL_FLAG]) return;
    globalAny[GLOBAL_FLAG] = true;

    const logger = createFileLogger(options);

    const original = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
    };

    console.log = (...args: unknown[]) => {
        logger.info(formatMessage(args), undefined, extractError(args));
        original.log(...args);
    };

    console.info = (...args: unknown[]) => {
        logger.info(formatMessage(args), undefined, extractError(args));
        original.info(...args);
    };

    console.warn = (...args: unknown[]) => {
        logger.warn(formatMessage(args), undefined);
        original.warn(...args);
    };

    console.error = (...args: unknown[]) => {
        logger.error(formatMessage(args), undefined, extractError(args));
        original.error(...args);
    };

    console.debug = (...args: unknown[]) => {
        logger.debug(formatMessage(args));
        original.debug(...args);
    };

    process.on("uncaughtException", (err) => {
        logger.fatal("Uncaught exception", undefined, {
            name: err.name,
            message: err.message,
            stack: err.stack,
        });
        original.error(err);
        process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
        if (reason instanceof Error) {
            logger.error("Unhandled rejection", undefined, {
                name: reason.name,
                message: reason.message,
                stack: reason.stack,
            });
        } else {
            logger.error("Unhandled rejection", { reason: String(reason) });
        }
        original.error(reason);
    });
}

export const logPaths = {
    unified: UNIFIED_LOG_PATH,
};
