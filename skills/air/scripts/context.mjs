#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadAir, loadPartner, needsIssuer, needsVerifier, presentId, roleOf } from './lib/partner.mjs';
import { parseArgs, projectRoot, readText, rel, walkFiles } from './lib/project.mjs';
import { parseEnvFile, secretPresence } from './lib/secrets.mjs';

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function collectSignals(root) {
  const partner = loadPartner(root);
  const air = loadAir(root);
  if (!partner.exists) {
    return { ok: false, code: 'NO_PARTNER_MD', root, partner, air };
  }

  const role = roleOf(partner.fields);
  const files = walkFiles(root, { exts: SOURCE_EXTS });
  const envLocal = parseEnvFile(readText(path.join(root, '.env.local')));
  const env = { ...parseEnvFile(readText(path.join(root, '.env'))), ...envLocal };
  const secrets = secretPresence(env);

  const joined = files.map((file) => {
    try {
      return { file, text: fs.readFileSync(file, 'utf8') };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const hasJwksRoute = joined.some(({ text, file }) =>
    ((/well-known\/jwks|exportJWK|keys:\s*\[/.test(text) && /kid/.test(text))
      || /jwks/i.test(rel(root, file))));
  const hasIssueCall = joined.some(({ text }) => /issueCredential|\/issue-vc/.test(text));
  const hasVerifyCall = joined.some(({ text }) => /verifyCredential|verify-by-agent/.test(text));
  const envSplitOk = !joined.some(({ text }) =>
    /NEXT_PUBLIC_(PARTNER_PRIVATE_KEY|SEED|API_KEY|ADMIN_API_KEY)/.test(text));
  const hasPartnerJwtRoute = joined.some(({ text }) => /SignJWT|scope:\s*["']issue["']/.test(text));

  return {
    ok: true,
    root,
    partner: {
      exists: true,
      role,
      partnerId: presentId(partner.fields, 'Partner ID'),
      issuerDid: presentId(partner.fields, 'Issuer DID'),
      jwksUrl: presentId(partner.fields, 'JWKS URL'),
      issuerActivated: /^(yes|true|done)$/i.test(partner.fields['Issuer activated'] || ''),
      jwksRegistered: /^(yes|true|done)$/i.test(partner.fields['JWKS registered'] || ''),
      issuerBackend: partner.fields['Issuer backend'] || '',
      authModel: partner.fields['Auth model'] || air.fields.Model || '',
    },
    air: { exists: air.exists, buildEnv: air.fields.BUILD_ENV || '' },
    scan: {
      hasJwksRoute,
      hasIssueCall,
      hasVerifyCall,
      hasPartnerJwtRoute,
      envSplitOk,
      fileCount: files.length,
    },
    secrets: {
      present: secrets.present,
      missing: secrets.missing,
    },
    needs: {
      issuer: needsIssuer(role),
      verifier: needsVerifier(role),
    },
  };
}

export function recommend(signals) {
  if (!signals.ok) return [{ cmd: '/air init', reason: 'No PARTNER.md — capture partner identity first.' }];
  const picks = [];
  const { partner, scan, needs } = signals;
  if (needs.issuer && !partner.partnerId) {
    picks.push({ cmd: '/air init', reason: 'Issuer role but Partner ID is missing. Paste it from the Dashboard.' });
  }
  if (needs.issuer && partner.partnerId && signals.secrets.missing.includes('SEED')) {
    picks.push({ cmd: '/air keys', reason: 'Partner ID is set; generate the seed and partner keypair next.' });
  }
  if (needs.issuer && !scan.hasJwksRoute) {
    picks.push({ cmd: '/air keys then /air audit', reason: 'No JWKS route in the repo. Issue/verify will 401.' });
  }
  if (needs.issuer && scan.hasJwksRoute && !partner.issuerActivated) {
    picks.push({ cmd: '/air register', reason: 'Keys exist; issuer is not marked activated.' });
  }
  if (needs.issuer && partner.issuerActivated && !scan.hasIssueCall) {
    picks.push({ cmd: '/air issue', reason: 'Issuer is activated but there is no issue call yet.' });
  }
  if ((needs.verifier || scan.hasIssueCall) && !scan.hasVerifyCall && needs.verifier) {
    picks.push({ cmd: '/air verify', reason: 'Issue exists or role is verifier; verification is missing.' });
  }
  if (scan.hasIssueCall || scan.hasVerifyCall || scan.hasJwksRoute) {
    picks.push({ cmd: '/air audit then /air polish', reason: 'Code is present — run detectors, then last-mile hardening.' });
  }
  if (roleOf(signals.partner) === 'account-only') {
    picks.push({ cmd: '/air account', reason: 'Account-only role: embed AirService login. Login ≠ issue/verify.' });
  }
  if (roleOf(signals.partner) === 'agentic') {
    picks.push({ cmd: '/air agent', reason: 'Install air-agentic-wallet-skill; do not call Privy.' });
  }
  const seen = new Set();
  return picks.filter((p) => {
    if (seen.has(p.cmd)) return false;
    seen.add(p.cmd);
    return true;
  }).slice(0, 3);
}

function main() {
  const flags = parseArgs();
  const root = path.resolve(flags.project || projectRoot());
  const signals = collectSignals(root);
  const recs = recommend(signals);

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ signals, recommendations: recs }, null, 2)}\n`);
    process.exit(signals.ok ? 0 : 2);
  }

  if (!signals.ok) {
    process.stdout.write(`NO_PARTNER_MD: no PARTNER.md under ${root}\n`);
    process.stdout.write('Refuse other /air commands. Run /air init.\n');
    process.exit(2);
  }

  process.stdout.write(`# AIR context\n\n`);
  process.stdout.write(`Root: ${root}\n`);
  process.stdout.write(`Role: ${signals.partner.role || '(unset)'}\n`);
  process.stdout.write(`Partner ID: ${signals.partner.partnerId ? 'set' : 'missing'}\n`);
  process.stdout.write(`Issuer DID: ${signals.partner.issuerDid ? 'set' : 'missing'}\n`);
  process.stdout.write(`JWKS route: ${signals.scan.hasJwksRoute}\n`);
  process.stdout.write(`Issue call: ${signals.scan.hasIssueCall}\n`);
  process.stdout.write(`Verify call: ${signals.scan.hasVerifyCall}\n`);
  process.stdout.write(`Env split ok: ${signals.scan.envSplitOk}\n`);
  process.stdout.write(`Secrets present: ${signals.secrets.present.join(', ') || '(none)'}\n`);
  process.stdout.write(`\n## Recommended next\n`);
  for (const rec of recs) {
    process.stdout.write(`- ${rec.cmd} — ${rec.reason}\n`);
  }
}

const invoked = process.argv[1] && path.basename(process.argv[1]) === 'context.mjs';
if (invoked) main();
