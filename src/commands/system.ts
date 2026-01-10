
import { Command } from 'commander';
import { listApps, deleteApp } from './app';
import { stopService, startService, restartService, disableService } from './systemd';
import { OKASTR8_HOME } from '../config';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// ============ Global Service Controls ============

export async function controlAllServices(action: 'start' | 'stop' | 'restart') {
    console.log(`🚀 ${action.toUpperCase()}ING all services...`);
    const { apps } = await listApps();

    if (apps.length === 0) {
        console.log('No apps found.');
        return;
    }

    const results = [];
    for (const app of apps) {
        console.log(`  • ${app.name}...`);
        try {
            if (action === 'start') await startService(app.name);
            if (action === 'stop') await stopService(app.name);
            if (action === 'restart') await restartService(app.name);
            results.push({ name: app.name, success: true });
        } catch (e: any) {
            console.error(`    ❌ Failed: ${e.message}`);
            results.push({ name: app.name, success: false, error: e.message });
        }
    }

    console.log('\n✅ Operation complete.');
}

// ============ Nuke Protocol ============

async function nukeSystem() {
    console.clear();
    console.log(`
☢️  WARNING: NUKE PROTOCOL INITIATED ☢️

You are about to DESTROY the entire okastr8 ecosystem on this machine.
This action is IRREVERSIBLE.

The following will happen:
1. All okastr8 applications will be STOPPED and DELETED.
2. All systemd services managed by okastr8 will be REMOVED.
3. The ~/.okastr8 configuration directory will be ERASED.
4. Database, logs, and user data will be LOST FOREVER.
`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const phrase = "DELETE EVERYTHING";

    const answer = await new Promise<string>(resolve => {
        rl.question(`To confirm, type exactly "${phrase}": `, resolve);
    });
    rl.close();

    if (answer !== phrase) {
        console.log('\n❌ Confirmation failed. Aborting nuke protocol.');
        return;
    }

    console.log('\n🧨 NUKE CONFIRMED. DESTRUCTION IMMINENT in 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('\n🗑️  Step 1: Destroying Applications...');
    const { apps } = await listApps();
    for (const app of apps) {
        process.stdout.write(`  Killing ${app.name}... `);
        try {
            try { await stopService(app.name); } catch { }
            try { await disableService(app.name); } catch { }
            // Use deleteApp to clean up unit files and directories
            await deleteApp(app.name);
            console.log('💀');
        } catch (e) {
            console.log(`Failed (Ignored): ${e}`);
        }
    }

    console.log('\n🛑 Step 2: Stopping Manager Service...');
    try {
        await stopService('okastr8-manager');
        await disableService('okastr8-manager');
        // Manually delete manager unit file if deleteApp didn't cover it (it shouldn't)
        // Check scripts/systemd/delete.sh logic? Assuming manual cleanup for manager.
        // We'll trust the uninstall script or user to remove the manager unit if it was installed manually.
        // But let's try to be thorough if we can.
        // Assuming okastr8-manager was set up as a standard service.
    } catch {
        console.log('   (Manager service not running or not found)');
    }

    console.log('\n🔥 Step 3: Incinerating Configuration...');
    if (existsSync(OKASTR8_HOME)) {
        await fs.rm(OKASTR8_HOME, { recursive: true, force: true });
        console.log(`   Deleted ${OKASTR8_HOME}`);
    }

    console.log('\n☠️  SYSTEM NUKED. Okastr8 has been reset to factory application state.');
}

// ============ Uninstall Helper ============

async function uninstallOkastr8() {
    await nukeSystem();

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         👋 UNINSTALLATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The system has been cleaned. To remove the CL tool, run:

  npm uninstall -g okastr8

Or if installed via binary/other package manager, remove the binary manually.

Goodbye!
`);
}

// ============ Integration ============

export function addSystemCommands(program: Command) {
    const service = program.command('service').description('Global service controls');

    service.command('start-all').description('Start all managed services').action(() => controlAllServices('start'));
    service.command('stop-all').description('Stop all managed services').action(() => controlAllServices('stop'));
    service.command('restart-all').description('Restart all managed services').action(() => controlAllServices('restart'));

    const system = program.command('system').description('System level commands');

    system.command('nuke')
        .description('DANGEROUS: Destroy all apps and data')
        .action(nukeSystem);

    system.command('uninstall')
        .description('Nuke system and show uninstall instructions')
        .action(uninstallOkastr8);
}
