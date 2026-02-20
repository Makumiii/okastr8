import { describe, expect, it } from 'bun:test';
import { generateDockerfile } from '../../src/utils/dockerfile-generator';
import type { DeployConfig } from '../../src/types';

function baseConfig(overrides: Partial<DeployConfig> = {}): DeployConfig {
  return {
    runtime: 'node',
    buildSteps: [],
    startCommand: 'node server.js',
    port: 3000,
    ...overrides,
  };
}

describe('generateDockerfile', () => {
  it('uses node LTS default image when runtime version is omitted', () => {
    const dockerfile = generateDockerfile(baseConfig({ runtime: 'node' }));
    expect(dockerfile).toContain('FROM node:22-alpine');
  });

  it('uses explicit runtime version when provided', () => {
    const dockerfile = generateDockerfile(baseConfig({ runtime: 'node:20' }));
    expect(dockerfile).toContain('FROM node:20-alpine');
  });

  it('normalizes vite dev command with --host flag', () => {
    const dockerfile = generateDockerfile(baseConfig({ startCommand: 'vite', port: 5173 }));
    expect(dockerfile).toContain('CMD ["vite","--host"]');
  });

  it('normalizes next dev command with host binding', () => {
    const dockerfile = generateDockerfile(baseConfig({ startCommand: 'next dev', port: 3000 }));
    expect(dockerfile).toContain('CMD ["next","dev","-H","0.0.0.0"]');
  });

  it('throws on unsupported runtime', () => {
    expect(() =>
      generateDockerfile(baseConfig({ runtime: 'ruby:3.3' }))
    ).toThrow('Unsupported runtime');
  });
});
