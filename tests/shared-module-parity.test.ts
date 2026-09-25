/*
  The two apps each carry their own copy of the money-handling modules — this
  repo's established pattern for logic shared across web and mobile (see also
  app-data.ts, note-media.ts).

  A copy is only safe while it stays honest. The behavioural tests exercise the
  web copy; this file proves the mobile copy is the same code, so it inherits
  those guarantees. If someone patches one and forgets the other, CI says which
  file drifted.

  Comparing text rather than importing is deliberate: importing mobile source
  makes esbuild resolve mobile/tsconfig.json, which extends expo/tsconfig.base
  and is not installed in the web CI job.
*/
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Everything from the first import onward — ignores the per-app header note. */
function body(path: string): string {
  const src = readFileSync(resolve(__dirname, '..', path), 'utf8');
  const i = src.indexOf('import ');
  expect(i, `${path} should contain an import`).toBeGreaterThan(-1);
  return src.slice(i).replace(/\r\n/g, '\n').trimEnd();
}

describe('web and mobile copies stay in step', () => {
  it.each([
    ['wallet/invoice.ts', 'src/lib/wallet/invoice.ts', 'mobile/src/lib/wallet/invoice.ts'],
    ['wallet/lightning.ts', 'src/lib/wallet/lightning.ts', 'mobile/src/lib/wallet/lightning.ts'],
  ])('%s is identical in both apps', (_name, webPath, mobilePath) => {
    expect(body(mobilePath)).toBe(body(webPath));
  });

  it('both invoice copies actually contain the amount assertion', () => {
    for (const p of ['src/lib/wallet/invoice.ts', 'mobile/src/lib/wallet/invoice.ts']) {
      expect(body(p)).toContain('InvoiceMismatchError');
      expect(body(p)).toContain('export function assertInvoiceAmount');
    }
  });
});
