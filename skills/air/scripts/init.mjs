#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { airPath, partnerPath, renderAirTemplate, renderPartnerTemplate } from './lib/partner.mjs';
import { ASSETS, parseArgs, projectRoot, writeText } from './lib/project.mjs';

const ROLES = ['issuer', 'verifier', 'both', 'account-only', 'agentic'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  process.stderr.write(`Usage: node init.mjs --role <${ROLES.join('|')}> --partner-id <uuid> [options]

Options:
  --auth air-login|byo     default: air-login
  --vertical <name>        loyalty|gaming|fintech|events|ads|agents|other
  --custom-auth            BYO auth (issuer/both only)
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
  const partnerId = String(flags['partner-id'] || flags.partnerId || '').trim();
  if (!ROLES.includes(role) || !partnerId) usage(2);
  if (!UUID_RE.test(partnerId)) {
    process.stderr.write('Partner ID must be the Dashboard UUID. Never invent one.\n');
    process.exit(2);
  }

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
  const partner = renderPartnerTemplate({
    partnerId,
    issuerDid: '',
    verifierDid: '',
    role,
    authModel,
    vertical,
    networks: 'sandbox-only',
    customAuth,
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
    notes: 'Init wrote sandbox defaults. Production is a separate partner / DID / program set.',
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
  if (role === 'issuer' || role === 'both') {
    process.stdout.write('\nNext: node scripts/keys.mjs --env sandbox\n');
    process.stdout.write('Then tell the user to update the Credential Dashboard with the issuer DID.\n');
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
