#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadPartner, needsIssuer, roleOf } from './lib/partner.mjs';
import { wantsFrontend } from './lib/layout.mjs';
import { parseArgs, projectRoot } from './lib/project.mjs';

const REPO = 'https://github.com/MocaNetwork/air-issuer-service.git';

function usage(code = 2) {
  process.stderr.write(`Usage: node issue.mjs [--clone-backend] [--yes] [--install] [--dir apps/backend] [--project <dir>]

Dry-run prints the issuer scaffold plan. --clone-backend --yes clones air-issuer-service.
--install runs pnpm install in the clone.
`);
  process.exit(code);
}

function main() {
  const flags = parseArgs();
  if (flags.help) usage(0);
  const root = path.resolve(flags.project || projectRoot());
  const partner = loadPartner(root);
  if (!partner.exists) {
    process.stderr.write('NO_PARTNER_MD: run init first.\n');
    process.exit(2);
  }
  const role = roleOf(partner.fields);
  if (!needsIssuer(role)) {
    process.stderr.write(`Role is ${role || 'unset'}. /air issue is for issuer or both.\n`);
    process.exit(2);
  }

  const dest = path.resolve(root, flags.dir || 'apps/backend');
  const frontend = partner.fields.Frontend || 'none';
  process.stdout.write(`Issuer scaffold plan\n`);
  process.stdout.write(`  Role: ${role}\n`);
  process.stdout.write(`  Auth: ${partner.fields['Auth model'] || 'air-login'}\n`);
  process.stdout.write(`  Database: ${partner.fields.Database || 'none'}\n`);
  process.stdout.write(`  Frontend: ${frontend}\n`);
  process.stdout.write(`  Backend dest: ${dest}\n`);
  process.stdout.write(`  Clone: git clone --depth 1 ${REPO} ${dest}\n`);
  process.stdout.write(`  Install: pnpm install (in ${dest})\n`);
  if (wantsFrontend(partner.fields)) {
    process.stdout.write(`  Frontend: ${frontend === 'next' ? 'create-next-app or' : ''} existing app + skill JWKS/JWT stubs + AirService.issueCredential\n`);
  } else {
    process.stdout.write(`  Frontend: skipped (Frontend: none)\n`);
  }
  process.stdout.write(`  Do not clone air-issuer-service-simulator\n`);
  process.stdout.write(`  Custom-auth: ${partner.fields['Custom auth'] === 'yes' ? 'opt-in — docs /recipes/custom-auth-integration' : 'no — use AIR Kit login'}\n`);
  process.stdout.write(`  Do not change /available-vc, /issue-vc, /credential-status/:nonce\n`);
  process.stdout.write(`  Do not set credentialSubject.id in schema classes\n`);
  process.stdout.write(`  Do not ask the user for ISSUER_ORIGIN or claim URLs\n`);

  if (!flags['clone-backend']) {
    process.stdout.write('\nDry-run only. Re-run with --clone-backend --yes [--install] to clone the backend.\n');
    return;
  }
  if (!flags.yes) {
    process.stderr.write('Refusing to clone without --yes.\n');
    process.exit(2);
  }
  if (fs.existsSync(dest) && fs.readdirSync(dest).length) {
    process.stderr.write(`${dest} is not empty.\n`);
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const result = spawnSync('git', ['clone', '--depth', '1', REPO, dest], { stdio: 'inherit' });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
  if (flags.install) {
    const install = spawnSync('pnpm', ['install'], { cwd: dest, stdio: 'inherit' });
    process.exit(install.status ?? 1);
  }
}

main();
