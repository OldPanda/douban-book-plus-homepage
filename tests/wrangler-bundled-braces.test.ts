import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

// Exercise emitted code, since a dependency override cannot replace Wrangler's bundle.
function expansion() {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('wrangler/package.json'));
  const file = process.env.WRANGLER_SECURITY_BUNDLE || join(root, 'wrangler-dist/cli.js');
  const source = readFileSync(file, 'utf8');
  function block(name: string) {
    const marker = source.indexOf(`var ${name} = __commonJS({`);
    assert.notEqual(marker, -1, `missing emitted ${name}`);
    const end = source.indexOf('\n// ', marker);
    assert.notEqual(end, -1, 'missing emitted module boundary');
    return source.slice(marker, end);
  }
  const code = `${block('require_balanced_match')}\n${block('require_brace_expansion')}\nrequire_brace_expansion();`;
  return runInNewContext(code, {
    __name: (value: unknown) => value,
    init_import_meta_url() {},
    __commonJS: (callbacks: Record<string, (exports: unknown, module: {exports: unknown}) => void>) => {
      let module: {exports: unknown} | undefined;
      return () => {
        if (!module) { module = {exports: {}}; Object.values(callbacks)[0](module.exports, module); }
        return module.exports;
      };
    },
    process: {platform: 'linux'},
  }, {timeout: 1000}) as (pattern: string, options?: Record<string, number>) => string[];
}

test('Wrangler emitted brace expansion enforces a small output budget', () => {
  const expand = expansion();
  assert.deepEqual(Array.from(expand('{a,b}')), ['a', 'b']);
  const result = Array.from(expand('{1..8}', {max: 3}));
  assert.ok(result.length <= 3, 'emitted brace expansion must enforce the requested max budget');
  assert.deepEqual(result, ['1', '2', '3']);
});
