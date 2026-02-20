import { describe, expect, it } from 'bun:test';
import {
  pruneImageReleases,
  selectImageRollbackTarget,
  type ImageReleaseRecord,
} from '../../src/commands/deploy-image';

const releases: ImageReleaseRecord[] = [
  {
    id: 1,
    deployedAt: '2026-02-20T10:00:00.000Z',
    imageRef: 'nginx:1.26-alpine',
    imageDigest: 'sha256:old',
    containerPort: 80,
    hostPort: 18080,
    pullPolicy: 'always',
  },
  {
    id: 2,
    deployedAt: '2026-02-20T10:05:00.000Z',
    imageRef: 'nginx:1.27-alpine',
    imageDigest: 'sha256:new',
    containerPort: 80,
    hostPort: 18080,
    pullPolicy: 'always',
  },
];

describe('selectImageRollbackTarget', () => {
  it('selects previous release when no target is provided', () => {
    const target = selectImageRollbackTarget(releases);
    expect(target?.id).toBe(1);
  });

  it('selects by digest', () => {
    const target = selectImageRollbackTarget(releases, 'sha256:new');
    expect(target?.id).toBe(2);
  });

  it('selects by image ref', () => {
    const target = selectImageRollbackTarget(releases, 'nginx:1.26-alpine');
    expect(target?.id).toBe(1);
  });

  it('returns null when no previous release exists', () => {
    const target = selectImageRollbackTarget([releases[0]!]);
    expect(target).toBeNull();
  });

  it('returns null for unknown target', () => {
    const target = selectImageRollbackTarget(releases, 'sha256:missing');
    expect(target).toBeNull();
  });
});

describe('pruneImageReleases', () => {
  it('keeps all releases when below retention', () => {
    const result = pruneImageReleases(releases, 5);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(1);
    expect(result[1]?.id).toBe(2);
  });

  it('prunes oldest releases when exceeding retention', () => {
    const more: ImageReleaseRecord[] = [
      ...releases,
      {
        id: 3,
        deployedAt: '2026-02-20T10:10:00.000Z',
        imageRef: 'nginx:1.28-alpine',
        imageDigest: 'sha256:newest',
        containerPort: 80,
        hostPort: 18080,
        pullPolicy: 'always',
      },
    ];
    const result = pruneImageReleases(more, 2);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(2);
    expect(result[1]?.id).toBe(3);
  });
});
