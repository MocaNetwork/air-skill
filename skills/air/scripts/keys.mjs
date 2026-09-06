#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadPartner, presentId, updatePartnerFields } from './lib/partner.mjs';
import { ensureGitignore, parseArgs, projectRoot, readText, writeText } from './lib/project.mjs';
import { generateSecrets, parseEnvFile, upsertEnv } from './lib/secrets.mjs';

const ENVS = ['sandbox', 'production'];

function usage(code = 2) {
  process.stderr.write(`Usage: node keys.mjs --env sandbox|production [--partner-id <uuid>] [--force] [--issuer-origin <url>] [--project <dir>]

Writes secrets to .env.local (and apps/backend/.env when present).
Prints issuer DID only when it can be fetched. Never prints private keys or SEED.
`);
  process.exit(code);
}

async function fetchIssuerDid(origin) {
  if (!origin) return null;
  const url = `${String(origin).replace(/\/$/, '')}/.well-known/issuer-did`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = await res.json();
    return body.did || body.issuerDid || null;
  } catch {
    return null;
  }
}

function confirmNoSeedRotation(env, force) {
  if (force) return;
  if (env.SEED && /^0x[0-9a-f]{64}$/i.test(env.SEED)) {
    process.stderr.write('SEED already present. Refusing to rotate. Pass --force only if this DID was never registered.\n');
    process.exit(2);
  }
}

function writeEnvFiles(root, values) {
  const targets = [path.join(root, '.env.local')];
  const backendEnv = path.join(root, 'apps', 'backend', '.env');
  const standaloneEnv = path.join(root, '.env');
  if (fs.existsSync(path.dirname(backendEnv))) targets.push(backendEnv);
  else if (fs.existsSync(path.join(root, 'src', 'issuer')) || fs.existsSync(path.join(root, 'mikro-orm.config.ts'))) {
    targets.push(standaloneEnv);
  }

  const written = [];
  for (const file of targets) {
    const prev = parseEnvFile(readText(file));
    writeText(file, upsertEnv(readText(file) ?? '', { ...prev, ...values }));
    written.push(file);
  }
  return written;
}

async function main() {
  const flags = parseArgs();
  if (flags.help) usage(0);
  const envName = String(flags.env || '').toLowerCase();
  if (!ENVS.includes(envName)) usage(2);

  const root = path.resolve(flags.project || projectRoot());
  const partner = loadPartner(root);
  if (!partner.exists) {
    process.stderr.write('NO_PARTNER_MD: run init first.\n');
    process.exit(2);
  }

  const partnerId = String(flags['partner-id'] || partner.fields['Partner ID'] || '').trim();
  if (!partnerId) {
    process.stderr.write('Partner ID required. Paste it from Dashboard → Account → General.\n');
    process.exit(2);
  }

  const existing = {
    ...parseEnvFile(readText(path.join(root, '.env'))),
    ...parseEnvFile(readText(path.join(root, '.env.local'))),
  };
  confirmNoSeedRotation(existing, Boolean(flags.force));

  const secrets = generateSecrets({ kid: partnerId, alg: 'ES256' });
  const publicValues = {
    NEXT_PUBLIC_PARTNER_ID: partnerId,
    NEXT_PUBLIC_BUILD_ENV: envName === 'production' ? 'production' : 'sandbox',
    PARTNER_ID: partnerId,
    PARTNER_PRIVATE_KEY_KID: partnerId,
    SIGNING_ALGORITHM: 'ES256',
    PARTNER_PRIVATE_KEY_ALG: 'ES256',
    IDEN3_METHOD: 'air',
    IDEN3_BLOCKCHAIN: 'id',
    IDEN3_NETWORK_ID: envName === 'production' ? 'mainnet' : 'testnet',
  };

  ensureGitignore(root, ['.env', '.env.local', '.env.*.local', 'apps/backend/.env']);
  const written = writeEnvFiles(root, { ...publicValues, ...secrets });

  const did = await fetchIssuerDid(flags['issuer-origin']);
  const partnerUpdates = {
    'Partner ID': partnerId,
    kid: partnerId,
    'Signing algorithm': 'ES256',
  };
  if (did) partnerUpdates['Issuer DID'] = did;
  updatePartnerFields(root, partnerUpdates);

  process.stdout.write(`Environment: ${envName}\n`);
  process.stdout.write(`kid / Partner ID: ${partnerId}\n`);
  process.stdout.write(`Wrote secrets (not printed) to:\n`);
  for (const file of written) process.stdout.write(`  ${file}\n`);
  process.stdout.write('Confirmed .gitignore includes .env and .env.local\n');
  if (did) {
    process.stdout.write(`Issuer DID: ${did}\n`);
    process.stdout.write('Copy this DID into the Credential Dashboard / AIR activation pack.\n');
  } else {
    process.stdout.write('Issuer DID: pending — boot air-issuer-service and GET /.well-known/issuer-did\n');
    process.stdout.write('Then: node provision.mjs --env ' + envName + ' write-ids --issuer-did <did>\n');
  }
  process.stdout.write('\nNever rotate SEED after that DID is registered.\n');
}

main();
