#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { updatePartnerFields } from './lib/partner.mjs';
import { ASSETS, parseArgs, projectRoot, writeText } from './lib/project.mjs';

function usage(code = 2) {
  process.stderr.write(`Usage:
  node jwks.mjs emit [--target <project>] [--route <relpath>]
  node jwks.mjs --check <url>
`);
  process.exit(code);
}

function defaultRoutes(target) {
  const base = fs.existsSync(path.join(target, 'src', 'app'))
    ? path.join(target, 'src', 'app', 'api')
    : path.join(target, 'app', 'api');
  return {
    jwks: path.join(base, '.well-known', 'jwks', 'route.ts'),
    jwt: path.join(base, 'partner-jwt', 'route.ts'),
  };
}

async function checkUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    process.stderr.write(`Invalid URL: ${url}\n`);
    process.exit(2);
  }
  const findings = [];
  if (parsed.protocol !== 'https:') {
    findings.push({ severity: 'P0', id: 'jwks-not-https', message: `JWKS URL is ${parsed.protocol}// — AIR requires public HTTPS` });
  }
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') {
    findings.push({ severity: 'P0', id: 'jwks-localhost', message: 'JWKS URL is localhost. AIR cannot fetch it.' });
  }
  if (findings.length) {
    process.stdout.write(`${JSON.stringify({ ok: false, findings }, null, 2)}\n`);
    process.exit(1);
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const body = await res.json().catch(() => null);
  const kids = body?.keys?.map((k) => k.kid).filter(Boolean) ?? [];
  if (!res.ok || !Array.isArray(body?.keys) || kids.length === 0) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      findings: [{ severity: 'P0', id: 'jwks-empty', message: `GET ${url} did not return keys[].kid` }],
    }, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, status: res.status, kids }, null, 2)}\n`);
}

function emit(flags) {
  const root = path.resolve(flags.target || flags.project || projectRoot());
  const defaults = defaultRoutes(root);
  const dest = path.resolve(root, flags.route || defaults.jwks);
  const jwtDest = path.resolve(root, flags['jwt-route'] || defaults.jwt);
  writeText(dest, fs.readFileSync(path.join(ASSETS, 'next-jwks-route.ts'), 'utf8'));
  writeText(jwtDest, fs.readFileSync(path.join(ASSETS, 'next-partner-jwt-route.ts'), 'utf8'));
  try {
    updatePartnerFields(root, { 'JWKS URL': '(local stub — register the public HTTPS URL)' });
  } catch {
    // init may not have run in a scratch emit
  }
  process.stdout.write(`Wrote ${dest}\n`);
  process.stdout.write(`Wrote ${jwtDest}\n`);
  process.stdout.write('Tunnel the web app and register the HTTPS JWKS URL in Dashboard → Account → General.\n');
}

async function main() {
  const flags = parseArgs();
  if (flags.help) usage(0);
  if (flags.check) {
    await checkUrl(String(flags.check));
    return;
  }
  if (flags._[0] === 'emit' || flags.emit) {
    emit(flags);
    return;
  }
  usage(2);
}

main();
