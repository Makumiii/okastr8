import { existsSync } from "fs";
import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const RATE_LIMIT_FILE = join(homedir(), ".okastr8", "rate-limit.json");

interface RateEntry {
    count: number;
    windowStart: number;
}

interface RateStore {
    entries: Record<string, RateEntry>;
}

async function loadStore(): Promise<RateStore> {
    if (!existsSync(RATE_LIMIT_FILE)) return { entries: {} };
    try {
        const raw = await readFile(RATE_LIMIT_FILE, "utf-8");
        const parsed = JSON.parse(raw) as RateStore;
        return {
            entries: parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {},
        };
    } catch {
        return { entries: {} };
    }
}

async function saveStore(store: RateStore): Promise<void> {
    const dir = join(homedir(), ".okastr8");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(RATE_LIMIT_FILE, JSON.stringify(store), "utf-8");
    await chmod(RATE_LIMIT_FILE, 0o600).catch(() => {});
}

export async function checkAndBumpRateLimit(options: {
    key: string;
    windowMs: number;
    max: number;
}): Promise<{ limited: boolean; retryAfter?: number }> {
    const { key, windowMs, max } = options;
    const now = Date.now();
    const store = await loadStore();
    const entries = store.entries;

    const pruneBefore = now - windowMs * 4;
    for (const k of Object.keys(entries)) {
        if (entries[k] && entries[k].windowStart < pruneBefore) {
            delete entries[k];
        }
    }

    const current = entries[key];
    if (!current || now - current.windowStart >= windowMs) {
        entries[key] = { count: 1, windowStart: now };
        await saveStore(store);
        return { limited: false };
    }

    current.count += 1;
    entries[key] = current;
    await saveStore(store);
    if (current.count <= max) return { limited: false };

    const elapsed = now - current.windowStart;
    const retryAfter = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    return { limited: true, retryAfter };
}
