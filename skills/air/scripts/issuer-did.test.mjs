import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseIssuerDid } from './issuer-did.mjs';

describe('parseIssuerDid', () => {
  it('extracts did:air from noisy repl output', () => {
    const did = parseIssuerDid('Nest app\n[Nest] starting\ndid:air:id:testnet:2AbCdEfGh123\nundefined\n');
    assert.equal(did, 'did:air:id:testnet:2AbCdEfGh123');
  });

  it('returns null when missing', () => {
    assert.equal(parseIssuerDid('ready'), null);
  });
});
