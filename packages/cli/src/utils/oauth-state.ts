import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const OAUTH_STATE_FILE = join(homedir(), ".okastr8", "oauth-state.json");
const DEFAULT_TTL_MS = 10 * 60 * 1000;

type OAuthFlow = "login" | "connect";

interface OAuthStateEntry {
    state: string;
    flow: OAuthFlow;
    createdAt: string;
}

interface OAuthStateStore {
    entries: OAuthStateEntry[];
}

function isExpired(createdAt: string, ttlMs: number): boolean {
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return true;
    return Date.now() - created > ttlMs;
}

async function loadStore(ttlMs: number): Promise<OAuthStateStore> {
    if (!existsSync(OAUTH_STATE_FILE)) {
        return { entries: [] };
    }

    try {
        const raw = await readFile(OAUTH_STATE_FILE, "utf-8");
        const parsed = JSON.parse(raw) as OAuthStateStore;
        const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
        return {
            entries: entries.filter(
                (entry) =>
                    entry &&
                    typeof entry.state === "string" &&
                    (entry.flow === "login" || entry.flow === "connect") &&
                    typeof entry.createdAt === "string" &&
                    !isExpired(entry.createdAt, ttlMs)
            ),
        };
    } catch {
        return { entries: [] };
    }
}

async function saveStore(store: OAuthStateStore): Promise<void> {
    const dir = join(homedir(), ".okastr8");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(OAUTH_STATE_FILE, JSON.stringify(store, null, 2), "utf-8");
    await chmod(OAUTH_STATE_FILE, 0o600).catch(() => {});
}

export async function issueOAuthState(flow: OAuthFlow, ttlMs: number = DEFAULT_TTL_MS) {
    const nonce = randomBytes(16).toString("hex");
    const state = `${flow}_${nonce}`;
    const store = await loadStore(ttlMs);
    store.entries.push({ state, flow, createdAt: new Date().toISOString() });
    await saveStore(store);
    return state;
}

export async function consumeOAuthState(
    state: string,
    flow: OAuthFlow,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<boolean> {
    if (!state || typeof state !== "string") return false;
    if (!state.startsWith(`${flow}_`)) return false;

    const store = await loadStore(ttlMs);
    const idx = store.entries.findIndex((entry) => entry.state === state && entry.flow === flow);
    if (idx === -1) {
        await saveStore(store);
        return false;
    }

    store.entries.splice(idx, 1); // one-time use (replay protection)
    await saveStore(store);
    return true;
}
