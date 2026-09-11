#!/usr/bin/env node
import path from 'node:path';
import * as jose from 'jose';
import { loadPartner } from './lib/partner.mjs';
import { backendEnvPath, webEnvPath } from './lib/layout.mjs';
import { parseArgs, projectRoot, readText } from './lib/project.mjs';
import { algFromJwks, parseEnvFile } from './lib/secrets.mjs';

const MAX_EXP_SEC = 15 * 60;
const DEFAULT_EXP_SEC = 5 * 60;

function wrapPrivateKeyPem(body) {
  const trimmed = body.trim();
  if (trimmed.includes('BEGIN')) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`;
}

function usage(code = 2) {
  process.stderr.write(`Usage: node jwt.mjs --scope issue|verify [--exp 300] [--env-file .env.local] [--project <dir>]

Signs a Partner JWT. Refuses exp > 15 minutes. Does not print the private key.
`);
  process.exit(code);
}

async function main() {
  const flags = parseArgs();
  if (flags.help) usage(0);
  const scope = String(flags.scope || '');
  if (scope !== 'issue' && scope !== 'verify') usage(2);

  const expSec = Number(flags.exp ?? DEFAULT_EXP_SEC);
  if (!Number.isFinite(expSec) || expSec <= 0) usage(2);
  if (expSec > MAX_EXP_SEC) {
    process.stderr.write(`Refusing exp=${expSec}s. Partner JWT life must be ≤ 15 minutes (recommend 5).\n`);
    process.exit(2);
  }

  const root = path.resolve(flags.project || projectRoot());
  const envFile = flags['env-file']
    ? path.resolve(root, flags['env-file'])
    : webEnvPath(root);
  const env = {
    ...parseEnvFile(readText(backendEnvPath(root))),
    ...parseEnvFile(readText(path.join(root, '.env'))),
    ...parseEnvFile(readText(envFile)),
  };
  const partner = loadPartner(root);
  const partnerId = env.NEXT_PUBLIC_PARTNER_ID || env.PARTNER_ID || partner.fields['Partner ID'];
  const kid = env.PARTNER_PRIVATE_KEY_KID || partner.fields.kid || partnerId;
  const keyBody = env.PARTNER_PRIVATE_KEY_DER;
  const alg = algFromJwks(env.SD_JWT_JWKS) || 'ES256';

  if (!partnerId || !keyBody) {
    process.stderr.write('Missing partnerId or PARTNER_PRIVATE_KEY_DER. Run /air keys.\n');
    process.exit(2);
  }

  const key = await jose.importPKCS8(wrapPrivateKeyPem(keyBody), alg);
  const now = Math.floor(Date.now() / 1000);
  const token = await new jose.SignJWT({ partnerId, scope })
    .setProtectedHeader({ alg, kid, typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + expSec)
    .sign(key);

  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  process.stdout.write(`${JSON.stringify({ token, header, claims: { partnerId, scope, exp: now + expSec, iat: now } }, null, 2)}\n`);
}

main();
