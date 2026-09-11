import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateSecrets,
  importPartnerEnv,
  jwksFromDer,
  parseEnvFile,
  renderBackendEnv,
  SECRET_KEYS,
} from './secrets.mjs';

describe('secrets', () => {
  it('generateSecrets returns only upstream secret names', () => {
    const kid = '11111111-1111-4111-8111-111111111111';
    const secrets = generateSecrets({ kid });
    assert.deepEqual(Object.keys(secrets).sort(), [
      'ADMIN_API_KEY',
      'API_KEY',
      'PARTNER_PRIVATE_KEY_DER',
      'PARTNER_PRIVATE_KEY_KID',
      'SD_JWT_JWKS',
      'SEED',
    ]);
    assert.match(secrets.SEED, /^0x[0-9a-f]{64}$/i);
    assert.equal(secrets.PARTNER_PRIVATE_KEY_KID, kid);
    const jwks = JSON.parse(secrets.SD_JWT_JWKS);
    assert.equal(jwks.keys[0].kid, kid);
    assert.equal(jwks.keys[0].alg, 'ES256');
    assert.ok(!('d' in jwks.keys[0]));
    for (const gone of ['PARTNER_PRIVATE_KEY', 'PARTNER_PUBLIC_KEY', 'SIGNING_ALGORITHM', 'PARTNER_PRIVATE_KEY_ALG']) {
      assert.equal(secrets[gone], undefined);
    }
  });

  it('parseEnvFile unwraps quoted SD_JWT_JWKS', () => {
    const env = parseEnvFile("SD_JWT_JWKS='{\"keys\":[{\"kid\":\"x\"}]}'\nSEED=0xabc\n");
    assert.equal(env.SEED, '0xabc');
    assert.equal(JSON.parse(env.SD_JWT_JWKS).keys[0].kid, 'x');
  });

  it('renderBackendEnv matches the upstream key list', () => {
    const text = renderBackendEnv({
      NODE_ENV: 'sandbox',
      DATABASE_URL: '',
      ISSUER_ORIGIN: 'http://localhost:3000',
      SEED: '0x11',
      PARTNER_ID: 'p',
      PARTNER_PRIVATE_KEY_KID: 'k',
      PARTNER_PRIVATE_KEY_DER: 'd',
      SD_JWT_JWKS: '{"keys":[]}',
      API_KEY: 'a',
      ADMIN_API_KEY: 'b',
    });
    for (const name of [
      'NODE_ENV',
      'DATABASE_URL',
      'ISSUER_ORIGIN',
      'SEED',
      'PARTNER_ID',
      'PARTNER_PRIVATE_KEY_KID',
      'PARTNER_PRIVATE_KEY_DER',
      'SD_JWT_JWKS',
      'API_KEY',
      'ADMIN_API_KEY',
    ]) {
      assert.match(text, new RegExp(`^${name}=`, 'm'));
    }
    for (const gone of ['AIR_API_ORIGIN', 'IDEN3_METHOD', 'PARTNER_PUBLIC_KEY', 'SIGNING_ALGORITHM']) {
      assert.equal(text.includes(gone), false);
    }
    assert.match(text, /#SD_JWT_TSL_PARTITION_SIZE=80000/);
  });

  it('importPartnerEnv derives JWKS when omitted', () => {
    const kid = '11111111-1111-4111-8111-111111111111';
    const generated = generateSecrets({ kid });
    const imported = importPartnerEnv({
      SEED: generated.SEED,
      PARTNER_ID: kid,
      PARTNER_PRIVATE_KEY_KID: kid,
      PARTNER_PRIVATE_KEY_DER: generated.PARTNER_PRIVATE_KEY_DER,
      API_KEY: generated.API_KEY,
      ADMIN_API_KEY: generated.ADMIN_API_KEY,
    });
    assert.equal(JSON.parse(imported.SD_JWT_JWKS).keys[0].kid, kid);
    assert.equal(jwksFromDer(generated.PARTNER_PRIVATE_KEY_DER, kid), imported.SD_JWT_JWKS);
  });

  it('importPartnerEnv rejects a bad seed', () => {
    assert.throws(() => importPartnerEnv({
      SEED: 'not-a-seed',
      PARTNER_ID: '11111111-1111-4111-8111-111111111111',
      PARTNER_PRIVATE_KEY_KID: 'k',
      PARTNER_PRIVATE_KEY_DER: 'd',
      API_KEY: 'a',
      ADMIN_API_KEY: 'b',
    }), /SEED/);
  });

  it('SECRET_KEYS no longer includes PARTNER_PRIVATE_KEY', () => {
    assert.deepEqual(SECRET_KEYS, ['SEED', 'PARTNER_PRIVATE_KEY_DER', 'API_KEY', 'ADMIN_API_KEY']);
  });
});
