#!/usr/bin/env bun
/**
 * Test runtime environment detection
 */

import { detectAllRuntimes, scanAndSaveEnvironments } from '../src/commands/env';

async function main() {
    console.log("Testing runtime detection...\n");

    const runtimes = await detectAllRuntimes();

    console.log("\n--- Summary ---");
    for (const [name, info] of Object.entries(runtimes)) {
        const status = info.installed ? `✅ ${info.version}` : "❌ not installed";
        console.log(`${name}: ${status}`);
    }
}

main().catch(console.error);
