import { readFile } from 'node:fs/promises';
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
});
