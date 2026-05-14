import { appendFile, mkdir, stat, rename, unlink } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type LogSource =
    | "manager"
    | "cli"
    | "api"
    | "auth"
    | "email"
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
    user?: string | { id?: string; email?: string };
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
const SENSITIVE_KEY_RE =
    /(token|secret|password|api[_-]?key|client[_-]?secret|authorization|cookie|access[_-]?token|refresh[_-]?token|private[_-]?key|ssh[_-]?key)/i;
const ENV_KEY_RE = /(env|environment|envvars|environmentvars)/i;
const JWT_RE = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const GITHUB_TOKEN_RE = /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g;
const OKASTR8_SESSION_RE = /okastr8_session=([^;\s]+)/gi;
const TOKEN_VALUE_RE =
    /(token|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|secret|password|authorization|cookie)\s*[:=]\s*([^\s,]+)/gi;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g;

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

function redactString(value: string): string {
    let redacted = value;
    redacted = redacted.replace(PRIVATE_KEY_RE, "[REDACTED_PRIVATE_KEY]");
    redacted = redacted.replace(JWT_RE, "[REDACTED_TOKEN]");
    redacted = redacted.replace(GITHUB_TOKEN_RE, "[REDACTED_TOKEN]");
    redacted = redacted.replace(OKASTR8_SESSION_RE, "okastr8_session=[REDACTED]");
    redacted = redacted.replace(TOKEN_VALUE_RE, (_match, key) => `${key}=[REDACTED]`);
    return redacted;
}

function sanitizeValue(
    value: unknown,
    key?: string,
    depth: number = 0,
    seen: WeakSet<object> = new WeakSet()
): unknown {
    if (depth > 6) return "[REDACTED]";
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
        if (key && (SENSITIVE_KEY_RE.test(key) || ENV_KEY_RE.test(key))) {
            return "[REDACTED]";
        }
        return redactString(value);
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, key, depth + 1, seen));
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (seen.has(obj)) return "[REDACTED]";
        seen.add(obj);

        if (key && ENV_KEY_RE.test(key)) {
            return { keys: Object.keys(obj) };
        }

        const output: Record<string, unknown> = {};
        for (const [childKey, childValue] of Object.entries(obj)) {
            if (SENSITIVE_KEY_RE.test(childKey)) {
                output[childKey] = "[REDACTED]";
                continue;
            }
            if (ENV_KEY_RE.test(childKey)) {
                output[childKey] =
                    typeof childValue === "object" && childValue
                        ? { keys: Object.keys(childValue as Record<string, unknown>) }
                        : "[REDACTED]";
                continue;
            }
            output[childKey] = sanitizeValue(childValue, childKey, depth + 1, seen);
        }
        return output;
    }

    return "[REDACTED]";
}

function sanitizeEntry(entry: LogEntry): LogEntry {
    return {
        ...entry,
        message: redactString(entry.message),
        user: sanitizeValue(entry.user) as LogEntry["user"],
        request: sanitizeValue(entry.request) as LogEntry["request"],
        data: sanitizeValue(entry.data) as LogEntry["data"],
        error: entry.error
            ? {
                  ...entry.error,
                  message: entry.error.message
                      ? redactString(entry.error.message)
                      : entry.error.message,
                  stack: entry.error.stack ? redactString(entry.error.stack) : entry.error.stack,
              }
            : entry.error,
    };
}

async function rotateIfNeeded(
    filePath: string,
    maxBytes: number,
    maxBackups: number,
    nextBytes: number
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
    maxBackups: number
) {
    const resolved = resolveLogPath(filePath);
    await mkdir(dirname(resolved), { recursive: true });

    const line = `${JSON.stringify(sanitizeEntry(entry))}\n`;
    await rotateIfNeeded(resolved, maxBytes, maxBackups, Buffer.byteLength(line));
    await appendFile(resolved, line, "utf-8");
}

export function createFileLogger(options: FileLoggerOptions) {
    const filePath = options.filePath;
    const source = options.source;
    const service = options.service;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxBackups = options.maxBackups ?? DEFAULT_MAX_BACKUPS;

    const write = (
        level: LogLevel,
        message: string,
        data?: LogEntry["data"],
        error?: LogEntry["error"]
    ) => {
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

export async function readUnifiedEntries(
    maxBackups: number = DEFAULT_MAX_BACKUPS
): Promise<LogEntry[]> {
    const resolved = resolveLogPath(UNIFIED_LOG_PATH);
    const paths: string[] = [resolved];
    for (let i = 1; i <= maxBackups; i += 1) {
        paths.push(`${resolved}.${i}`);
    }

    const entries: LogEntry[] = [];
    for (const path of paths) {
        if (!existsSync(path)) continue;
        try {
            const content = await (await import("fs/promises")).readFile(path, "utf-8");
            if (!content.trim()) continue;
            const parsed = content
                .trim()
                .split("\n")
                .map((line) => {
                    try {
                        return JSON.parse(line) as LogEntry;
                    } catch {
                        return null;
                    }
                })
                .filter((entry): entry is LogEntry => !!entry);
            entries.push(...parsed);
        } catch {
            continue;
        }
    }

    return entries;
}

export async function writeUnifiedEntry(
    entry: LogEntry,
    maxBytes: number = DEFAULT_MAX_BYTES,
    maxBackups: number = DEFAULT_MAX_BACKUPS
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
        logger.info(formatMessage(args), undefined);
        original.log(...args);
    };

    console.info = (...args: unknown[]) => {
        logger.info(formatMessage(args), undefined);
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
