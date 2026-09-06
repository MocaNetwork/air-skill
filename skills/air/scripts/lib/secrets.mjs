import { generateKeyPairSync, randomBytes } from 'node:crypto';

export const SECRET_KEYS = [
  'SEED',
  'PARTNER_PRIVATE_KEY',
  'PARTNER_PRIVATE_KEY_DER',
  'API_KEY',
  'ADMIN_API_KEY',
];

export function generateSecrets({ kid, alg = 'ES256' } = {}) {
  if (alg !== 'ES256') {
    throw new Error('v1 keys.mjs generates ES256 (P-256) only, matching air-issuer-service bin/generate-secrets');
  }
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const der = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const publicBody = stripPem(publicKey.export({ type: 'spki', format: 'pem' }));
  const { d: _d, ...jwk } = privateKey.export({ format: 'jwk' });
  const jwks = { keys: [{ ...jwk, use: 'sig', alg: 'ES256', kid }] };

  return {
    SEED: `0x${randomBytes(32).toString('hex')}`,
    PARTNER_PRIVATE_KEY_KID: kid,
    PARTNER_PRIVATE_KEY_DER: der,
    PARTNER_PRIVATE_KEY: der,
    PARTNER_PUBLIC_KEY: publicBody,
    SD_JWT_JWKS: JSON.stringify(jwks),
    API_KEY: randomBytes(32).toString('hex'),
    ADMIN_API_KEY: randomBytes(32).toString('hex'),
    SIGNING_ALGORITHM: 'ES256',
    PARTNER_PRIVATE_KEY_ALG: 'ES256',
  };
}

export function stripPem(pem) {
  return pem
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('-----'))
    .join('');
}

export function parseEnvFile(text) {
  const out = {};
  if (!text) return out;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

export function upsertEnv(text, values) {
  const lines = text ? text.split(/\r?\n/) : [];
  const seen = new Set();
  const next = lines.map((line) => {
    const eq = line.indexOf('=');
    if (eq === -1 || line.trimStart().startsWith('#')) return line;
    const key = line.slice(0, eq);
    if (!(key in values)) return line;
    seen.add(key);
    return `${key}=${values[key]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (seen.has(key)) continue;
    next.push(`${key}=${value}`);
  }
  return `${next.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n').replace(/\n*$/, '')}\n`;
}

export function secretPresence(env) {
  const present = [];
  const missing = [];
  for (const key of SECRET_KEYS) {
    if (env[key] && !String(env[key]).startsWith('{{')) present.push(key);
    else missing.push(key);
  }
  return { present, missing };
}

export function redact(value) {
  if (!value) return '(missing)';
  const s = String(value);
  if (s.length <= 8) return '********';
  return `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} chars)`;
}
