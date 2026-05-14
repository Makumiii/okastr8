import { join } from "path";
import { homedir } from "os";
import { readFile } from "fs/promises";
import { load } from "js-yaml";

// Simple script to read a value from system.yaml using dot notation
// Usage: bun read_config.ts setup.user.username

const CONFIG_FILE = join(homedir(), ".okastr8", "system.yaml");

async function getValue(path: string) {
    try {
        const content = await readFile(CONFIG_FILE, "utf-8");
        const config: any = load(content);

        const keys = path.split(".");
        let current = config;

        for (const key of keys) {
            if (current === undefined || current === null) return "";
            current = current[key];
        }

        if (current === undefined || current === null) return "";
        if (typeof current === "object") return JSON.stringify(current);
        return String(current);
    } catch (e) {
        // Silent fail for scripts, return empty string
        return "";
    }
}

const targetPath = process.argv[2];
if (!targetPath) {
    process.exit(1);
}

getValue(targetPath).then((val) => process.stdout.write(val));
