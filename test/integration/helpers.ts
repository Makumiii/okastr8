import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempHomes: string[] = [];

export function createTempHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'okastr8-integration-'));
  tempHomes.push(home);
  return home;
}

export function cleanupTempHomes(): void {
  while (tempHomes.length > 0) {
    const home = tempHomes.pop();
    if (home) {
      rmSync(home, { recursive: true, force: true });
    }
  }
}

export function runIsolatedScript(home: string, scriptBody: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = Bun.spawnSync({
    cmd: [
      process.execPath,
      '--eval',
      `
      (async () => {
        ${scriptBody}
      })().catch((err) => {
        console.error(String(err?.stack || err));
        process.exit(1);
      });
      `,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      BUN_TMPDIR: '/tmp/bun-tmp',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout).trim(),
    stderr: new TextDecoder().decode(result.stderr).trim(),
  };
}
