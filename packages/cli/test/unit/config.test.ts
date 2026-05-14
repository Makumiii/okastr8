import { test, expect, beforeAll, afterAll } from "bun:test";
import { getSystemConfig, saveSystemConfig, reloadSystemConfig } from "../../src/config";
import { rm, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_FILE = join(homedir(), ".okastr8", "system.yaml");

// Warning: this test mutates the local system.yaml for simplicity of the unit tests
// It backs it up and restores it.
let backupConfig: string | null = null;

beforeAll(async () => {
    try {
        const { readFile } = await import("fs/promises");
        backupConfig = await readFile(CONFIG_FILE, "utf-8");
    } catch (e) {
        // File might not exist
    }
});

afterAll(async () => {
    if (backupConfig !== null) {
        await writeFile(CONFIG_FILE, backupConfig, "utf-8");
    } else {
        await rm(CONFIG_FILE, { force: true });
    }
});

test("config > saves and loads cloudflare credentials safely", async () => {
    // Clear out
    await saveSystemConfig({ cloudflare: undefined } as any);
    
    // Save
    await saveSystemConfig({
        cloudflare: {
            apiToken: "cf-token-123",
            accountId: "cf-acc-456",
            zoneId: "cf-zone-789"
        }
    });

    // Load (force reload to bypass cache)
    const loaded = await reloadSystemConfig();
    expect(loaded.cloudflare?.apiToken).toBe("cf-token-123");
    expect(loaded.cloudflare?.accountId).toBe("cf-acc-456");
    expect(loaded.cloudflare?.zoneId).toBe("cf-zone-789");
});
