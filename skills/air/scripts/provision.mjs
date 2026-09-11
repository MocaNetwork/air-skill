#!/usr/bin/env node
import path from 'node:path';
import { loadPartner, updatePartnerFields } from './lib/partner.mjs';
import { ensureGitignore, parseArgs, projectRoot, readText, writeText } from './lib/project.mjs';
import { parseEnvFile, upsertEnv } from './lib/secrets.mjs';

const ENVS = ['sandbox', 'production'];
const PHASE2 = new Set(['createPartner', 'createIssuerDid', 'createApiKeys', 'createProgram', 'registerJwksUrl', 'activateIssuer']);

function usage(code = 2) {
  process.stderr.write(`Usage: node provision.mjs --env sandbox|production <action> [options]

v1 actions:
  write-ids              update PARTNER.md IDs and public env (never secrets)

Phase 2 stubs (throw):
  createPartner createIssuerDid createApiKeys createProgram registerJwksUrl activateIssuer

Options:
  --partner-id --issuer-did --verifier-did --jwks-url
  --issue-program-id --verify-program-id --schema-id
  --project <dir>
`);
  process.exit(code);
}

function phase2Stub(action, envName) {
  process.stderr.write(`provision ${action} is not available in v1.

This action needs an allowlisted AIR operator API (OTP partner create, hosted JWKS, remote activate).
Use the Dashboard and /air register instead.

Contract (do not invent curl):
  --env ${envName}
  allowlisted base URL + operator token when Phase 2 ships.

Init path today:
  1. Paste Partner ID from https://developers.sandbox.air3.com/
  2. node issue.mjs --clone-backend --yes --install
  3. node keys.mjs --env ${envName}   # or --import <existing.env>
  4. /air register
`);
  process.exit(2);
}

function writeIds(root, envName, flags) {
  const partner = loadPartner(root);
  if (!partner.exists) {
    process.stderr.write('NO_PARTNER_MD: run init first.\n');
    process.exit(2);
  }

  const updates = {};
  if (flags['partner-id']) updates['Partner ID'] = flags['partner-id'];
  if (flags['issuer-did']) updates['Issuer DID'] = flags['issuer-did'];
  if (flags['verifier-did']) updates['Verifier DID'] = flags['verifier-did'];
  if (flags['jwks-url']) updates['JWKS URL'] = flags['jwks-url'];
  if (flags['issue-program-id']) updates['Issuance program IDs'] = flags['issue-program-id'];
  if (flags['verify-program-id']) updates['Verification program IDs'] = flags['verify-program-id'];
  if (flags['schema-id']) updates['Schema IDs'] = flags['schema-id'];
  if (flags.activated === 'yes') updates['Issuer activated'] = 'yes';
  if (flags['jwks-registered'] === 'yes') updates['JWKS registered'] = 'yes';

  if (Object.keys(updates).length) updatePartnerFields(root, updates);

  const publicEnv = {};
  const after = loadPartner(root).fields;
  if (after['Partner ID']) {
    publicEnv.NEXT_PUBLIC_PARTNER_ID = after['Partner ID'];
    publicEnv.PARTNER_ID = after['Partner ID'];
    publicEnv.PARTNER_PRIVATE_KEY_KID = after.kid || after['Partner ID'];
    publicEnv.PARTNER_ID = after['Partner ID'];
  }
  if (after['Issuer DID']) publicEnv.NEXT_PUBLIC_ISSUER_DID = after['Issuer DID'];
  if (after['Issuance program IDs']) publicEnv.NEXT_PUBLIC_ISSUE_PROGRAM_ID = after['Issuance program IDs'];
  if (after['Verification program IDs']) publicEnv.NEXT_PUBLIC_VERIFY_PROGRAM_ID = after['Verification program IDs'];
  publicEnv.NEXT_PUBLIC_BUILD_ENV = envName === 'production' ? 'production' : 'sandbox';

  const envFile = path.join(root, '.env.local');
  ensureGitignore(root, ['.env', '.env.local']);
  writeText(envFile, upsertEnv(readText(envFile) ?? '', { ...parseEnvFile(readText(envFile)), ...publicEnv }));

  process.stdout.write(`Updated PARTNER.md IDs only (${envName}). Secrets were not written.\n`);
  process.stdout.write(`Public env names updated in ${envFile}\n`);
}

function main() {
  const flags = parseArgs();
  if (flags.help) usage(0);
  const envName = String(flags.env || '').toLowerCase();
  const action = String(flags._[0] || flags.action || '');
  if (!ENVS.includes(envName) || !action) usage(2);

  if (PHASE2.has(action)) phase2Stub(action, envName);

  const root = path.resolve(flags.project || projectRoot());
  if (action === 'write-ids') {
    writeIds(root, envName, flags);
    return;
  }
  usage(2);
}

main();
