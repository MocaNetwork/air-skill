#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPartner, updatePartnerFields } from './lib/partner.mjs';
import { backendDir, backendEnvPath, backendInstalled, databaseChoice, existingPartner, wantsFrontend, webEnvPath } from './lib/layout.mjs';
import { ensureGitignore, parseArgs, projectRoot, readText, writeText } from './lib/project.mjs';
import {
  generateSecrets,
  importPartnerEnv,
  parseEnvFile,
  renderBackendEnv,
  SEED_RE,
  upsertEnv,
} from './lib/secrets.mjs';

const ENVS = ['sandbox', 'production'];
const DEFAULT_DOCKER_URL = 'postgres://postgres:postgres@127.0.0.1/issuer-backend';
const DEFAULT_ORIGIN = 'http://localhost:3000';

function usage(code = 2) {
  process.stderr.write(`Usage: node keys.mjs --env sandbox|production [--partner-id <uuid>] [--import <env>] [--issuer-did did:air:...] [--database-url <url>] [--force] [--project <dir>]

Writes upstream secrets to apps/backend/.env (and web .env.local when a frontend exists).
Derives issuer DID via the backend repl when node_modules is present.
Never prints private keys or SEED.
`);
  process.exit(code);
}

function confirmNoSeedRotation(env, force) {
  if (force) return;
  if (env.SEED && SEED_RE.test(env.SEED)) {
    process.stderr.write('SEED already present. Refusing to rotate. Pass --force only if this DID was never registered.\n');
    process.exit(2);
  }
}

function resolveDatabaseUrl(partner, existing, flags) {
  if (flags['database-url']) return flags['database-url'];
  if (existing.DATABASE_URL) return existing.DATABASE_URL;
  const db = databaseChoice(partner.fields);
  if (db === 'none') return '';
  if (db === 'docker') return DEFAULT_DOCKER_URL;
  return existing.DATABASE_URL || '';
}

function writeBackendEnv(file, values) {
  const prevText = readText(file);
  if (!prevText) {
    writeText(file, renderBackendEnv(values));
    return file;
  }
  writeText(file, upsertEnv(prevText, values));
  return file;
}

function writeWebEnv(root, values) {
  const file = webEnvPath(root);
  writeText(file, upsertEnv(readText(file) ?? '', {
    ...parseEnvFile(readText(file)),
    ...values,
  }));
  return file;
}

function tryIssuerDid(root, backend, expectedDid) {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'issuer-did.mjs');
  const args = [script, '--project', root, '--backend', backend];
  if (expectedDid) args.push('--issuer-did', expectedDid);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  return result.status === 0;
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

  const backend = backendDir(root, flags.backend);
  const backendEnvFile = backendEnvPath(root, flags.backend);
  const existing = {
    ...parseEnvFile(readText(path.join(root, '.env'))),
    ...parseEnvFile(readText(path.join(root, '.env.local'))),
    ...parseEnvFile(readText(backendEnvFile)),
  };

  let secrets;
  let partnerId;
  if (flags.import) {
    const importPath = path.resolve(root, flags.import);
    const imported = importPartnerEnv(parseEnvFile(readText(importPath)));
    if (existing.SEED && existing.SEED !== imported.SEED && !flags.force) {
      process.stderr.write('Imported SEED differs from the backend .env. Refusing to overwrite. Pass --force only if this DID was never registered.\n');
      process.exit(2);
    }
    secrets = imported;
    partnerId = String(flags['partner-id'] || imported.PARTNER_ID || partner.fields['Partner ID'] || '').trim();
  } else {
    if (existingPartner(partner.fields)) {
      process.stderr.write('PARTNER.md says Existing partner: yes. Use --import <path-to.env> instead of generating a new SEED.\n');
      process.exit(2);
    }
    confirmNoSeedRotation(existing, Boolean(flags.force));
    partnerId = String(flags['partner-id'] || partner.fields['Partner ID'] || existing.PARTNER_ID || '').trim();
    if (!partnerId) {
      process.stderr.write('Partner ID required. Paste it from Dashboard → Account → General, or pass --import.\n');
      process.exit(2);
    }
    secrets = generateSecrets({ kid: partnerId, alg: 'ES256' });
  }

  const backendValues = {
    NODE_ENV: secrets.NODE_ENV || (envName === 'production' ? 'production' : 'sandbox'),
    DATABASE_URL: resolveDatabaseUrl(partner, { ...existing, ...secrets }, flags),
    ISSUER_ORIGIN: secrets.ISSUER_ORIGIN || existing.ISSUER_ORIGIN || DEFAULT_ORIGIN,
    SEED: secrets.SEED,
    PARTNER_ID: partnerId,
    PARTNER_PRIVATE_KEY_KID: secrets.PARTNER_PRIVATE_KEY_KID || partnerId,
    PARTNER_PRIVATE_KEY_DER: secrets.PARTNER_PRIVATE_KEY_DER,
    SD_JWT_JWKS: secrets.SD_JWT_JWKS,
    API_KEY: secrets.API_KEY,
    ADMIN_API_KEY: secrets.ADMIN_API_KEY,
  };

  ensureGitignore(root, ['.env', '.env.local', '.env.*.local', 'apps/backend/.env']);
  fs.mkdirSync(path.dirname(backendEnvFile), { recursive: true });
  writeBackendEnv(backendEnvFile, backendValues);

  const written = [backendEnvFile];
  if (wantsFrontend(partner.fields) || fs.existsSync(webEnvPath(root))) {
    written.push(writeWebEnv(root, {
      NEXT_PUBLIC_PARTNER_ID: partnerId,
      NEXT_PUBLIC_BUILD_ENV: envName === 'production' ? 'production' : 'sandbox',
      PARTNER_ID: partnerId,
      PARTNER_PRIVATE_KEY_KID: backendValues.PARTNER_PRIVATE_KEY_KID,
      PARTNER_PRIVATE_KEY_DER: backendValues.PARTNER_PRIVATE_KEY_DER,
      SD_JWT_JWKS: backendValues.SD_JWT_JWKS,
    }));
  }

  updatePartnerFields(root, {
    'Partner ID': partnerId,
    kid: backendValues.PARTNER_PRIVATE_KEY_KID,
    'Signing algorithm': 'ES256',
  });

  process.stdout.write(`Environment: ${envName}\n`);
  process.stdout.write(`kid / Partner ID: ${partnerId}\n`);
  process.stdout.write(`Wrote secrets (not printed) to:\n`);
  for (const file of written) process.stdout.write(`  ${file}\n`);
  process.stdout.write('Confirmed .gitignore includes .env and .env.local\n');
  process.stdout.write(`ISSUER_ORIGIN (dev default until tunnel): ${backendValues.ISSUER_ORIGIN}\n`);

  if (backendInstalled(root, flags.backend)) {
    const expectedDid = String(flags['issuer-did'] || '').trim() || undefined;
    const ok = tryIssuerDid(root, backend, expectedDid);
    if (!ok) {
      process.stderr.write('Keys written. issuer DID extraction failed — run issuer-did.mjs after the backend boots.\n');
      process.exit(1);
    }
  } else {
    process.stdout.write('Issuer DID: pending — install the backend, then:\n');
    process.stdout.write(`  pnpm install   # in ${backend}\n`);
    process.stdout.write(`  node ${path.join(path.dirname(fileURLToPath(import.meta.url)), 'issuer-did.mjs')} --backend ${backend}\n`);
  }
  process.stdout.write('\nNever rotate SEED after that DID is registered.\n');
}

main();
