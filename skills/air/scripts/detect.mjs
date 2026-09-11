#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadAir, loadPartner } from './lib/partner.mjs';
import { parseArgs, projectRoot, readText, rel, walkFiles } from './lib/project.mjs';
import { parseEnvFile } from './lib/secrets.mjs';

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.env', '.env.local', '.example'];
const PII_FIELDS = ['dob', 'dateOfBirth', 'ssn', 'socialSecurity', 'fullName', 'legalName'];
const AIR_API_RE = /air\.api\.(sandbox\.)?air3\.com|api\.(sandbox\.)?mocachain\.org/i;
const ISSUER_ROUTE_RE = /\/available-vc|\/issue-vc|\/credential-status/;

function finding(severity, id, file, message) {
  return { severity, id, file, message };
}

function envFiles(root) {
  return [
    path.join(root, '.env'),
    path.join(root, '.env.local'),
    path.join(root, '.env.example'),
    path.join(root, 'apps', 'backend', '.env'),
    path.join(root, 'apps', 'web', '.env.local'),
  ].filter((file) => fs.existsSync(file));
}

export function detect(root) {
  const findings = [];
  const partner = loadPartner(root);
  const air = loadAir(root);
  const files = walkFiles(root, { exts: SOURCE_EXTS });
  const texts = files.map((file) => ({ file, text: safeRead(file) })).filter((x) => x.text !== null);
  const env = {};
  for (const file of envFiles(root)) Object.assign(env, parseEnvFile(readText(file)));

  for (const { file, text } of texts) {
    const display = rel(root, file);
    if (/NEXT_PUBLIC_(PARTNER_PRIVATE_KEY|SEED|API_KEY|ADMIN_API_KEY)/.test(text)) {
      findings.push(finding('P0', 'public-secret-prefix', display, 'Secret env var uses NEXT_PUBLIC_ and will ship to the browser'));
    }
    if (/ISSUER_ORIGIN\s*=\s*https?:\/\/(localhost|127\.0\.0\.1)/i.test(text) || /ISSUER_ORIGIN\s*=\s*http:\/\//i.test(text)) {
      findings.push(finding('P1', 'issuer-origin-not-https', display, 'dev default; replace with the tunnel origin before a real claim'));
    }
    if (/jwks/i.test(text) && /https?:\/\/(localhost|127\.0\.0\.1)/i.test(text)) {
      findings.push(finding('P0', 'jwks-localhost', display, 'JWKS URL points at localhost; AIR cannot fetch it'));
    }
    if (/JWKS[^\n]*http:\/\//i.test(text) || /jwksUrl[^\n]*http:\/\//i.test(text)) {
      findings.push(finding('P0', 'jwks-http', display, 'JWKS URL is http:// — AIR requires HTTPS'));
    }
    if (AIR_API_RE.test(text) && /x-api-key/i.test(text) && !ISSUER_ROUTE_RE.test(text)) {
      findings.push(finding('P0', 'wrong-header-air-api', display, 'AIR / Moca chain APIs need x-partner-auth, not x-api-key'));
    }
    if (ISSUER_ROUTE_RE.test(text) && /x-partner-auth/i.test(text)) {
      findings.push(finding('P0', 'wrong-header-issuer', display, 'Self-hosted issuer routes need x-api-key, not x-partner-auth'));
    }
    if (/credentialSubject/.test(text)) {
      for (const field of PII_FIELDS) {
        if (new RegExp(`(?:['"\`]${field}['"\`]|\\b${field}\\b)\\s*:`).test(text)) {
          findings.push(finding('P1', 'raw-pii-claim', display, `credentialSubject includes raw PII field "${field}" — prefer a boolean or enum`));
        }
      }
      if (/(?:['"`]email['"`]|\bemail\b)\s*:/.test(text)) {
        findings.push(finding('P1', 'email-as-claim', display, 'email in credentialSubject — use a boolean/eligibility claim when a bracket works'));
      }
    }
    if (/issueCredential/.test(text) && /SignJWT/.test(text) && !/scope:\s*['"]issue['"]/.test(text)) {
      findings.push(finding('P0', 'missing-issue-scope', display, 'Issuance JWT is missing scope: "issue"'));
    }
    if (/setExpirationTime\(([^)]+)\)/.test(text)) {
      const raw = text.match(/setExpirationTime\(([^)]+)\)/)?.[1] ?? '';
      if (/h\b|hours|16\s*\*\s*60|20\s*\*\s*60|[2-9]\d\s*\*\s*60/.test(raw) && !/5\s*\*\s*60/.test(raw)) {
        findings.push(finding('P0', 'jwt-exp-too-long', display, 'Partner JWT exp appears longer than 15 minutes'));
      }
    }
    if (/BUILD_ENV\.SANDBOX/.test(text) && /credentialNetwork:\s*['"]mainnet['"]/.test(text)) {
      findings.push(finding('P0', 'network-mismatch', display, 'BUILD_ENV.SANDBOX paired with credentialNetwork mainnet'));
    }
    if (/BUILD_ENV\.SANDBOX/.test(text) && /credentialNetwork:\s*['"]devnet['"]/.test(text)) {
      findings.push(finding('P0', 'devnet-removed', display, 'credentialNetwork: "devnet" was removed; sandbox is Testnet-only'));
    }
    if (/BUILD_ENV\.PRODUCTION/.test(text) && /credentialNetwork:\s*['"]testnet['"]/.test(text)) {
      findings.push(finding('P0', 'network-mismatch-prod', display, 'BUILD_ENV.PRODUCTION paired with credentialNetwork testnet'));
    }
  }

  const jwksKids = [];
  const jwtKids = [];
  for (const { file, text } of texts) {
    if (file.endsWith('.md')) continue;
    const display = rel(root, file);
    const isJwks = /jwks/i.test(display) || /well-known\/jwks|exportJWK/.test(text);
    const isJwt = /setProtectedHeader|SignJWT/.test(text);
    if (isJwks) {
      const kidAssign = text.match(/kid:\s*['"]?([A-Za-z0-9_.]+)/);
      if (kidAssign) jwksKids.push({ file: display, kid: kidAssign[1] });
    }
    if (isJwt) {
      const kidAssign = text.match(/kid:\s*['"]?([A-Za-z0-9_.]+)/);
      if (kidAssign) jwtKids.push({ file: display, kid: kidAssign[1] });
    }
  }
  if (jwksKids.length && jwtKids.length) {
    const jwksExpr = new Set(jwksKids.map((x) => x.kid));
    for (const jwt of jwtKids) {
      if (!jwksExpr.has(jwt.kid)) {
        findings.push(finding('P0', 'kid-mismatch', jwt.file, `JWT kid expression "${jwt.kid}" does not match JWKS kid expressions (${[...jwksExpr].join(', ')})`));
      }
    }
  }

  if (partner.exists) {
    const jwksUrl = partner.fields['JWKS URL'] || '';
    if (/^http:\/\//.test(jwksUrl) || /localhost|127\.0\.0\.1/.test(jwksUrl)) {
      findings.push(finding('P0', 'jwks-url-field', 'PARTNER.md', `JWKS URL is not public HTTPS: ${jwksUrl}`));
    }
  }

  if (air.exists && /SANDBOX/i.test(air.fields.BUILD_ENV || '') && /mainnet/i.test(air.fields.credentialNetwork || '')) {
    findings.push(finding('P0', 'air-md-network', 'AIR.md', 'AIR.md pairs SANDBOX with mainnet'));
  }

  const envKid = env.PARTNER_PRIVATE_KEY_KID;
  const envPartner = env.NEXT_PUBLIC_PARTNER_ID || env.PARTNER_ID;
  if (envKid && envPartner && envKid !== envPartner) {
    findings.push(finding('P1', 'kid-not-partner-id', '.env.local', 'kid differs from Partner ID — both must appear in the published JWKS'));
  }

  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));
  return findings;
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function summarize(findings) {
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const item of findings) counts[item.severity] += 1;
  return counts;
}

function main() {
  const flags = parseArgs();
  const root = path.resolve(flags.project || flags._[0] || projectRoot());
  const findings = detect(root);
  const counts = summarize(findings);
  const report = { ok: counts.P0 === 0, counts, findings };

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`AIR detect  P0=${counts.P0} P1=${counts.P1} P2=${counts.P2} P3=${counts.P3}\n`);
    if (!findings.length) process.stdout.write('No findings.\n');
    for (const item of findings) {
      process.stdout.write(`${item.severity} ${item.id}  ${item.file}\n  ${item.message}\n`);
    }
  }
  process.exit(counts.P0 ? 1 : 0);
}

const invoked = process.argv[1] && path.basename(process.argv[1]) === 'detect.mjs';
if (invoked) main();
