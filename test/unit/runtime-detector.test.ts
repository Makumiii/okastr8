import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectRuntime } from '../../src/utils/runtime-detector';

const tempDirs: string[] = [];

function makeTempProject(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'okastr8-runtime-'));
  tempDirs.push(dir);

  for (const relPath of files) {
    const fullPath = join(dir, relPath);
    const parent = fullPath.slice(0, fullPath.lastIndexOf('/'));
    mkdirSync(parent, { recursive: true });
    writeFileSync(fullPath, 'test');
  }

  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('detectRuntime', () => {
  it('detects node runtime from package.json', async () => {
    const projectDir = makeTempProject(['package.json']);
    await expect(detectRuntime(projectDir)).resolves.toBe('node');
  });

  it('detects python runtime from pyproject.toml', async () => {
    const projectDir = makeTempProject(['pyproject.toml']);
    await expect(detectRuntime(projectDir)).resolves.toBe('python');
  });

  it('throws for unknown runtimes', async () => {
    const projectDir = makeTempProject(['README.md']);
    await expect(detectRuntime(projectDir)).rejects.toThrow('Could not auto-detect runtime');
  });
});
