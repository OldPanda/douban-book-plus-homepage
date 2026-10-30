import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Resolve the Vite instance actually consumed by VitePress under pnpm.
const requireVitePress = createRequire(import.meta.resolve('vitepress'));
const { createServer } = await import(pathToFileURL(requireVitePress.resolve('vite')).href);

test('Vite keeps denied files private when raw/import queries are appended', { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'vite-deny-regression-'));
  const marker = 'DUMMY_VITE_DENIED_VALUE';
  let server;
  try {
    await writeFile(join(root, '.env'), marker);
    await writeFile(join(root, 'public.txt'), 'public fixture');
    server = await createServer({
      configFile: false, root, logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0, fs: { strict: true, allow: [root] } },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const ordinary = await fetch(`${base}/public.txt`);
    assert.equal(ordinary.status, 200);
    assert.equal(await ordinary.text(), 'public fixture');
    for (const query of ['', '?raw', '?import&raw', '?import&url&inline']) {
      const response = await fetch(`${base}/.env${query}`);
      const body = await response.text();
      assert.equal(response.status, 403, `denied file returned ${response.status} for ${query}`);
      assert.ok(!body.includes(marker), `denied file content leaked for ${query}`);
    }
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
