#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { airPath, partnerPath, renderAirTemplate, renderPartnerTemplate } from './lib/partner.mjs';
import { ASSETS, parseArgs, projectRoot, writeText } from './lib/project.mjs';
import { UUID_RE } from './lib/secrets.mjs';

const ROLES = ['issuer', 'verifier', 'both', 'account-only', 'agentic'];
const DBS = ['docker', 'external', 'none'];
const FRONTENDS = ['none', 'next', 'existing'];

const ISSUANCE_BY_ROLE = {
  issuer: 'issueCredential + air-issuer-service',
  both: 'issueCredential + air-issuer-service',
  verifier: 'none',
  'account-only': 'none',
  agentic: 'none',
};

const VERIFY_BY_ROLE = {
  issuer: 'none yet',
  both: 'verifyCredential',
  verifier: 'verifyCredential',
  'account-only': 'none',
  agentic: 'verify-by-agent (wallet skill)',
};

function usage(code = 2) {
  process.stderr.write(`Usage: node init.mjs --role <${ROLES.join('|')}> [options]

Options:
  --partner-id <uuid>      required unless --existing
  --existing               partner already has SEED / keys / DID
  --auth air-login|byo     default: air-login
  --vertical <name>        loyalty|gaming|fintech|events|ads|agents|other
  --custom-auth            BYO auth (issuer/both only)
  --db docker|external|none
  --database-url <url>     required when --db external
  --frontend none|next|existing
  --sdk-version <ver>      default: latest
  --force                  overwrite existing PARTNER.md / AIR.md
  --project <dir>
`);
  process.exit(code);
}

function main() {
  const flags = parseArgs();
  if (flags.help) usage(0);
  const role = String(flags.role || '').toLowerCase();
  const existing = Boolean(flags.existing);
  const partnerId = String(flags['partner-id'] || flags.partnerId || '').trim();
  if (!ROLES.includes(role)) usage(2);
  if (!existing && !partnerId) usage(2);
  if (partnerId && !UUID_RE.test(partnerId)) {
    process.stderr.write('Partner ID must be the Dashboard UUID. Never invent one.\n');
    process.exit(2);
  }

  const db = String(flags.db || 'none').toLowerCase();
  if (!DBS.includes(db)) usage(2);
  if (db === 'external' && !flags['database-url']) {
    process.stderr.write('--database-url is required when --db external.\n');
    process.exit(2);
  }

  const frontend = String(flags.frontend || 'none').toLowerCase();
  if (!FRONTENDS.includes(frontend)) usage(2);

  const root = path.resolve(flags.project || projectRoot());
  const force = Boolean(flags.force);
  const authModel = flags['custom-auth'] || flags.auth === 'byo' ? 'byo' : 'air-login';
  const vertical = flags.vertical || 'unspecified';
  const customAuth = authModel === 'byo' ? 'yes' : 'no';

  const partnerFile = partnerPath(root);
  const airFile = airPath(root);
  if (!force && (fs.existsSync(partnerFile) || fs.existsSync(airFile))) {
    process.stderr.write('PARTNER.md or AIR.md already exists. Pass --force to overwrite.\n');
    process.exit(2);
  }

  const issuerBackend = role === 'issuer' || role === 'both' ? 'air-issuer-service' : 'none';
  const notes = [
    'Init wrote sandbox defaults. Production is a separate partner / DID / program set.',
    existing ? 'Existing partner: do not generate a new SEED. Import the current .env after the backend is cloned.' : '',
    db === 'external' ? 'Pass --database-url to keys.mjs. Do not print the URL.' : '',
  ].filter(Boolean).join(' ');

  const partner = renderPartnerTemplate({
    partnerId,
    issuerDid: '',
    verifierDid: '',
    role,
    existingPartner: existing ? 'yes' : 'no',
    authModel,
    vertical,
    networks: 'sandbox-only',
    customAuth,
    database: db,
    frontend,
    jwksUrl: '',
    signingAlg: 'ES256',
    kid: partnerId,
    issuerBackend,
    schemaIds: '',
    issueProgramIds: '',
    verifyProgramIds: '',
    issuerActivated: 'no',
    jwksRegistered: 'no',
    domainWhitelisted: 'no',
    notes,
  });

  const air = renderAirTemplate({
    sdkVersion: flags['sdk-version'] || 'latest',
    buildEnv: 'SANDBOX',
    credentialNetwork: 'testnet',
    authModel,
    issuancePath: ISSUANCE_BY_ROLE[role],
    verificationPath: VERIFY_BY_ROLE[role],
    paymaster: 'unset — record if the app sponsors gas',
  });

  writeText(partnerFile, partner);
  writeText(airFile, air);
  writeText(path.join(root, '.env.example'), fs.readFileSync(path.join(ASSETS, 'env.example'), 'utf8'));

  process.stdout.write(`Wrote ${partnerFile}\n`);
  process.stdout.write(`Wrote ${airFile}\n`);
  process.stdout.write(`Wrote ${path.join(root, '.env.example')}\n`);
  process.stdout.write(`Existing partner: ${existing ? 'yes' : 'no'}\n`);
  process.stdout.write(`Database: ${db}\n`);
  process.stdout.write(`Frontend: ${frontend}\n`);

  if (role === 'issuer' || role === 'both') {
    if (db === 'docker') {
      process.stdout.write('\nNext (database): docker run --name air-issuer-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=issuer-backend -p 5432:5432 -d postgres:16\n');
    }
    process.stdout.write('Next: node scripts/issue.mjs --clone-backend --yes --install --dir apps/backend\n');
    if (existing) {
      process.stdout.write('Then: node scripts/keys.mjs --env sandbox --import <path-to-existing.env>\n');
    } else {
      process.stdout.write('Then: node scripts/keys.mjs --env sandbox\n');
    }
  } else if (role === 'verifier') {
    process.stdout.write('\nVerifier path: generate JWT keys if you call AIR verify APIs, then /air verify.\n');
    process.stdout.write('No SEED, issuer backend, or activation email.\n');
  } else if (role === 'account-only') {
    process.stdout.write('\nAccount-only: /air account. Login succeeding does not mean issue/verify will work.\n');
  } else {
    process.stdout.write('\nAgentic: /air agent — install air-agentic-wallet-skill. Do not call Privy.\n');
  }
}

main();
