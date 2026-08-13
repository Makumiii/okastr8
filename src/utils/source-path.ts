import { isAbsolute, relative, resolve } from "path";

/**
 * Normalize and validate a repository subdirectory used as an app source.
 *
 * Source directories come from deployment configuration/API input, so they
 * must never be allowed to escape the checked-out repository.
 */
export function normalizeSourceDir(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;

    const raw = String(value).trim().replaceAll("\\", "/");
    if (!raw || raw === ".") return undefined;
    if (isAbsolute(raw) || /^[A-Za-z]:\//.test(raw)) {
        throw new Error("source_dir must be a relative repository path");
    }

    const parts = raw.split("/").filter(Boolean);
    if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
        throw new Error("source_dir must stay inside the repository");
    }

    return parts.join("/");
}

export function resolveSourcePath(releasePath: string, sourceDir?: unknown): string {
    const root = resolve(releasePath);
    const normalized = normalizeSourceDir(sourceDir);
    const sourcePath = resolve(root, normalized || ".");
    const escaped = relative(root, sourcePath);

    if (escaped.startsWith("..") || isAbsolute(escaped)) {
        throw new Error("source_dir must stay inside the repository");
    }

    return sourcePath;
}
