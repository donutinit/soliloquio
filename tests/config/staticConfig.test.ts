import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

describe('static deployment policy', () => {
  it('ships a restrictive content security policy', async () => {
    const caddyfile = await readFile(new URL('Caddyfile', root), 'utf8');

    expect(caddyfile).toContain("default-src 'self'");
    expect(caddyfile).toContain("base-uri 'none'");
    expect(caddyfile).toContain("object-src 'none'");
    expect(caddyfile).toContain("script-src 'self'");
    expect(caddyfile).toContain("connect-src 'self'");
    expect(caddyfile).toContain("worker-src 'self'");
  });

  it('prevents browsers and CDNs from retaining update entry points', async () => {
    const caddyfile = await readFile(new URL('Caddyfile', root), 'utf8');

    expect(caddyfile).toContain('@nocache path /sw.js /registerSW.js /manifest.webmanifest');
    expect(caddyfile).toContain('Cache-Control "no-store, no-cache, must-revalidate"');
    expect(caddyfile).toContain('CDN-Cache-Control "no-store"');
  });

  it('pins every GitHub Action to an immutable commit', async () => {
    const workflows = await readdir(new URL('.github/workflows/', root), 'utf8');

    for (const workflow of workflows) {
      const source = await readFile(new URL(`.github/workflows/${workflow}`, root), 'utf8');
      const uses = source.match(/^\s*(?:-\s+)?uses:\s*\S+.*$/gm) ?? [];
      expect(uses.length, workflow).toBeGreaterThan(0);
      for (const line of uses) {
        expect(line, `${workflow}: ${line.trim()}`).toMatch(
          /uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}(?:\s+#\s*\S+)?\s*$/
        );
      }
    }
  });

  it('pins container base images by digest', async () => {
    const dockerfile = await readFile(new URL('Dockerfile', root), 'utf8');
    const fromLines = dockerfile.match(/^FROM\s+\S+.*$/gm) ?? [];

    expect(fromLines.length).toBeGreaterThan(0);
    for (const line of fromLines) {
      expect(line.trim()).toMatch(/^FROM\s+\S+@sha256:[0-9a-f]{64}(?:\s+AS\s+\S+)?$/);
    }
  });
});
