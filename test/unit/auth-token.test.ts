import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const createdHomes: string[] = [];

function makeTempHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'okastr8-auth-'));
  createdHomes.push(home);
  return home;
}

function runAuthScript(home: string, scriptBody: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const command = [
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
  ];

  const result = Bun.spawnSync({
    cmd: command,
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
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

afterEach(() => {
  while (createdHomes.length > 0) {
    const home = createdHomes.pop();
    if (home) {
      rmSync(home, { recursive: true, force: true });
    }
  }
});

describe('auth token policy', () => {
  it('generates and validates token for a user', () => {
    const home = makeTempHome();
    const result = runAuthScript(
      home,
      `
        const auth = await import('./src/commands/auth.ts');
        const generated = await auth.generateToken('alice', '1h');
        const validated = await auth.validateToken(generated.token);
        console.log(JSON.stringify({ valid: validated.valid, userId: validated.userId }));
      `
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');

    const data = JSON.parse(result.stdout);
    expect(data).toMatchObject({ valid: true, userId: 'alice' });
  });

  it('revokes prior token when issuing a new token for the same user', () => {
    const home = makeTempHome();
    const result = runAuthScript(
      home,
      `
        const auth = await import('./src/commands/auth.ts');
        const first = await auth.generateToken('alice', '1h');
        const second = await auth.generateToken('alice', '1h');
        const firstValidation = await auth.validateToken(first.token);
        const secondValidation = await auth.validateToken(second.token);
        console.log(JSON.stringify({
          firstValid: firstValidation.valid,
          firstError: firstValidation.error,
          secondValid: secondValidation.valid,
          secondUser: secondValidation.userId,
        }));
      `
    );

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);

    expect(data.firstValid).toBe(false);
    expect(data.firstError).toContain('revoked');
    expect(data.secondValid).toBe(true);
    expect(data.secondUser).toBe('alice');
  });

  it('rejects token durations above security limit', () => {
    const home = makeTempHome();
    const result = runAuthScript(
      home,
      `
        const auth = await import('./src/commands/auth.ts');
        try {
          await auth.generateToken('alice', '2d');
          console.log(JSON.stringify({ allowed: true }));
        } catch (error) {
          console.log(JSON.stringify({ allowed: false, message: String(error?.message || error) }));
        }
      `
    );

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.allowed).toBe(false);
    expect(data.message).toContain('cannot exceed 24 hours');
  });
});
