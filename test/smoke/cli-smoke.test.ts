import { describe, expect, it } from 'bun:test';

const bunBin = process.execPath;

function runCli(args: string[]) {
  return Bun.spawnSync({
    cmd: [bunBin, 'run', 'src/main.ts', ...args],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  });
}

describe('CLI smoke', () => {
  it('prints help output', () => {
    const result = runCli(['--help']);
    const output = new TextDecoder().decode(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('CLI for orchestrating server environments and deployments');
    expect(output).toContain('Usage:');
  });

  it('prints version output', () => {
    const result = runCli(['--version']);
    const output = new TextDecoder().decode(result.stdout).trim();

    expect(result.exitCode).toBe(0);
    expect(output).toBe('0.0.1');
  });

  it('fails on unknown command', () => {
    const result = runCli(['definitely-unknown-command']);
    const stderr = new TextDecoder().decode(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(stderr).toContain('unknown command');
  });
});
