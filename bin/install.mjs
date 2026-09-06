#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STAMP_NAME = '.air-skill.json';
export const SOURCE_ID = 'air-skill';
export const AGENT_IDS = ['cursor', 'claude', 'codex', 'opencode', 'github'];

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_SOURCE = path.join(PKG_ROOT, 'skills', 'air');

const HELP = `air-skill install

  npx air-skill install
  npx air-skill install -y
  npx air-skill install --providers=cursor,claude --scope global
  npx air-skill update
  npx air-skill uninstall
  npx air-skill list
`;

function packageVersion() {
  return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
}

function detectRoots(id, { cwd, home }) {
  if (id === 'cursor') return [path.join(cwd, '.cursor'), path.join(home, '.cursor')];
  if (id === 'claude') return [path.join(cwd, '.claude'), path.join(home, '.claude')];
  if (id === 'codex') return [path.join(cwd, '.codex'), path.join(cwd, '.agents'), path.join(home, '.codex')];
  if (id === 'opencode') return [path.join(cwd, '.opencode'), path.join(home, '.opencode')];
  if (id === 'github') return [path.join(cwd, '.github')];
  return [];
}

export function destsFor(id, { cwd, home, scope }) {
  if (id === 'github') return [path.join(cwd, '.github', 'skills', 'air')];
  if (scope === 'global') {
    if (id === 'cursor') return [path.join(home, '.cursor', 'skills', 'air')];
    if (id === 'claude') return [path.join(home, '.claude', 'skills', 'air')];
    if (id === 'codex') return [path.join(home, '.codex', 'skills', 'air')];
    if (id === 'opencode') return [path.join(home, '.opencode', 'skills', 'air')];
  }
  if (id === 'cursor') return [path.join(cwd, '.cursor', 'skills', 'air')];
  if (id === 'claude') return [path.join(cwd, '.claude', 'skills', 'air')];
  if (id === 'codex') {
    return [path.join(cwd, '.codex', 'skills', 'air'), path.join(cwd, '.agents', 'skills', 'air')];
  }
  if (id === 'opencode') return [path.join(cwd, '.opencode', 'skills', 'air')];
  return [];
}

export function displayPath(abs, { cwd, home }) {
  if (abs === cwd || abs.startsWith(cwd + path.sep)) {
    return path.relative(cwd, abs).split(path.sep).join('/') || '.';
  }
  if (abs === home || abs.startsWith(home + path.sep)) {
    return `~${abs.slice(home.length).split(path.sep).join('/')}`;
  }
  return abs;
}

export function detectAgents({ cwd, home }) {
  const ctx = { cwd, home };
  const detected = {};
  for (const id of AGENT_IDS) {
    detected[id] = detectRoots(id, ctx)
      .filter((root) => fs.existsSync(root))
      .map((root) => displayPath(root, ctx));
  }
  return detected;
}

export function parseArgv(argv) {
  const flags = {
    _: [],
    yes: false,
    all: false,
    dryRun: false,
    help: false,
    scope: null,
    providers: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      flags._.push(...argv.slice(i + 1));
      break;
    }
    if (token === '-y' || token === '--yes') {
      flags.yes = true;
      continue;
    }
    if (token === '--all') {
      flags.all = true;
      continue;
    }
    if (token === '--dry-run') {
      flags.dryRun = true;
      continue;
    }
    if (token === '-h' || token === '--help') {
      flags.help = true;
      continue;
    }
    if (token === '--scope' || token.startsWith('--scope=')) {
      flags.scope = token.startsWith('--scope=') ? token.slice('--scope='.length) : argv[i + 1];
      if (!token.startsWith('--scope=')) i += 1;
      continue;
    }
    if (token === '--providers' || token.startsWith('--providers=')) {
      const raw = token.startsWith('--providers=') ? token.slice('--providers='.length) : argv[i + 1];
      if (!token.startsWith('--providers=')) i += 1;
      flags.providers = String(raw || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      continue;
    }
    if (token.startsWith('-')) {
      throw new Error(`Unknown flag: ${token}`);
    }
    flags._.push(token);
  }
  return flags;
}

function skipCopy(rel) {
  const normalized = rel.split(path.sep).join('/');
  return normalized === 'scripts/fixtures' || normalized.startsWith('scripts/fixtures/');
}

export function isManaged(dest) {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(dest, STAMP_NAME), 'utf8'));
    return json.source === SOURCE_ID;
  } catch {
    return false;
  }
}

function isEmptyDir(dir) {
  try {
    return fs.readdirSync(dir).length === 0;
  } catch {
    return true;
  }
}

export function copySkill(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (from) => {
      const rel = path.relative(src, from);
      if (!rel || rel === '.') return true;
      return !skipCopy(rel);
    },
  });
}

export function writeStamp(dest, version) {
  fs.writeFileSync(
    path.join(dest, STAMP_NAME),
    `${JSON.stringify(
      { version, source: SOURCE_ID, installedAt: new Date().toISOString() },
      null,
      2,
    )}\n`,
  );
}

export function installInto(dest, { dryRun, version }) {
  if (fs.existsSync(dest) && !isManaged(dest) && !isEmptyDir(dest)) return 'skipped';
  if (dryRun) return 'dry';
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  copySkill(SKILL_SOURCE, dest);
  writeStamp(dest, version);
  return 'ok';
}

export function uninstallDest(dest, { dryRun }) {
  if (!isManaged(dest)) return 'skipped';
  if (dryRun) return 'dry';
  fs.rmSync(dest, { recursive: true, force: true });
  return 'ok';
}

function resolveAgents(flags, detected) {
  if (flags.providers) return flags.providers;
  if (flags.all) return [...AGENT_IDS];
  if (flags.yes || flags.dryRun) return AGENT_IDS.filter((id) => detected[id].length > 0);
  return null;
}

function destsForAgents(agents, ctx) {
  const dests = [];
  for (const id of agents) {
    for (const dest of destsFor(id, ctx)) {
      if (!dests.includes(dest)) dests.push(dest);
    }
  }
  return dests;
}

function formatDestLabel(dest, ctx) {
  const shown = displayPath(dest, ctx);
  return dest.split(path.sep).includes('.github') ? `${shown} (project only)` : shown;
}

export function scopeChoiceLabels(agents, ctx) {
  return {
    project: destsForAgents(agents, { ...ctx, scope: 'project' })
      .map((dest) => displayPath(dest, ctx))
      .join(', '),
    global: destsForAgents(agents, { ...ctx, scope: 'global' })
      .map((dest) => formatDestLabel(dest, ctx))
      .join(', '),
  };
}

function allStampedDests(ctx) {
  const dests = [];
  for (const id of AGENT_IDS) {
    for (const scope of ['project', 'global']) {
      for (const dest of destsFor(id, { ...ctx, scope })) {
        if (isManaged(dest) && !dests.includes(dest)) dests.push(dest);
      }
    }
  }
  return dests;
}

function agentIsManaged(id, ctx) {
  return (
    destsFor(id, { ...ctx, scope: 'project' }).some(isManaged) ||
    destsFor(id, { ...ctx, scope: 'global' }).some(isManaged)
  );
}

async function promptAgents(detected, checkedIf) {
  const { default: checkbox } = await import('@inquirer/checkbox');
  const detectedIds = AGENT_IDS.filter((id) => detected[id].length > 0);
  const rest = AGENT_IDS.filter((id) => detected[id].length === 0);
  const choices = [...detectedIds, ...rest].map((id) => {
    const parts = [id.padEnd(8)];
    if (detected[id].length) parts.push('(detected)', ...detected[id]);
    if (id === 'github') parts.push('(project only)');
    return { name: parts.join('  '), value: id, checked: checkedIf(id) };
  });
  return checkbox({
    message: 'Install /air for which agents? (space to toggle)',
    required: true,
    choices,
  });
}

async function promptScope(agents, ctx) {
  const labels = scopeChoiceLabels(agents, ctx);
  const { default: select } = await import('@inquirer/select');
  return select({
    message: 'Install where?',
    choices: [
      { name: `project   ${labels.project}`, value: 'project' },
      { name: `global    ${labels.global}`, value: 'global' },
    ],
  });
}

async function promptUninstall(dests, ctx) {
  const { default: checkbox } = await import('@inquirer/checkbox');
  return checkbox({
    message: 'Remove which /air installs? (space to toggle)',
    required: true,
    choices: dests.map((dest) => ({
      name: displayPath(dest, ctx),
      value: dest,
      checked: true,
    })),
  });
}

export async function run(argv, env = {}) {
  const cwd = path.resolve(env.cwd || process.cwd());
  const home = path.resolve(env.home || os.homedir());
  const stdinIsTTY = env.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const log = env.log || ((msg) => process.stdout.write(`${msg}\n`));
  const err = env.err || ((msg) => process.stderr.write(`${msg}\n`));
  const ctx = { cwd, home };

  let flags;
  try {
    flags = parseArgv(argv);
  } catch (error) {
    err(error.message);
    return { code: 2, dests: [] };
  }

  if (flags.help) {
    log(HELP);
    return { code: 0, dests: [] };
  }

  const command = flags._[0] || 'install';
  if (!['install', 'update', 'uninstall', 'list'].includes(command)) {
    err(`Unknown command: ${command}`);
    return { code: 2, dests: [] };
  }
  if (flags.scope && flags.scope !== 'project' && flags.scope !== 'global') {
    err('--scope must be project or global');
    return { code: 2, dests: [] };
  }
  if (flags.providers) {
    const unknown = flags.providers.filter((id) => !AGENT_IDS.includes(id));
    if (unknown.length) {
      err(`Unknown provider: ${unknown.join(', ')}`);
      return { code: 2, dests: [] };
    }
  }

  const detected = detectAgents(ctx);
  const version = packageVersion();

  if (command === 'list') {
    const scope = flags.scope || 'project';
    for (const id of AGENT_IDS) {
      const installed = destsFor(id, { ...ctx, scope }).filter((dest) =>
        fs.existsSync(path.join(dest, 'SKILL.md')),
      );
      const mark = detected[id].length ? 'detected' : '—';
      const air = installed.length ? 'air yes' : 'air no';
      const extra = installed.map((dest) => displayPath(dest, ctx)).join(' ');
      log(`${id.padEnd(8)} ${mark.padEnd(10)} ${air}${extra ? `   ${extra}` : ''}`);
    }
    return { code: 0, dests: [] };
  }

  const skipTui = Boolean(flags.yes || flags.providers || flags.all || flags.dryRun);
  if (!skipTui && !stdinIsTTY) {
    err('Refusing to install without -y, --providers, --all, or --dry-run (no TTY).');
    return { code: 2, dests: [] };
  }

  try {
    if (command === 'uninstall') {
      let dests;
      if (skipTui) {
        const agents = resolveAgents(flags, detected);
        if (!agents?.length) {
          err('No agents selected. Pass --providers, --all, or -y with a detected agent.');
          return { code: 2, dests: [] };
        }
        dests = destsForAgents(agents, { ...ctx, scope: flags.scope || 'project' });
      } else {
        dests = allStampedDests(ctx);
        if (!dests.length) {
          log('Nothing to uninstall.');
          return { code: 0, dests: [] };
        }
        dests = await promptUninstall(dests, ctx);
      }
      const acted = [];
      for (const dest of dests) {
        const result = uninstallDest(dest, { dryRun: flags.dryRun });
        if (result === 'skipped') log(`skip unmanaged ${displayPath(dest, ctx)}`);
        if (result === 'dry') log(`would remove ${displayPath(dest, ctx)}`);
        if (result === 'ok') log(`removed ${displayPath(dest, ctx)}`);
        if (result === 'ok' || result === 'dry') acted.push(dest);
      }
      return { code: 0, dests: acted };
    }

    let agents;
    let scope;
    if (skipTui) {
      agents = resolveAgents(flags, detected);
      scope = flags.scope || 'project';
    } else {
      const checkedIf =
        command === 'update' ? (id) => agentIsManaged(id, ctx) : (id) => detected[id].length > 0;
      agents = await (env.promptAgents || promptAgents)(detected, checkedIf);
      scope = flags.scope || (await (env.promptScope || promptScope)(agents, ctx));
    }

    if (!agents?.length) {
      err('No agents selected. Pass --providers, --all, or -y with a detected agent.');
      return { code: 2, dests: [] };
    }

    const dests = destsForAgents(agents, { ...ctx, scope });
    const acted = [];
    log(flags.dryRun ? `Would install air ${version}` : `Installed air ${version}`);
    log('');
    for (const dest of dests) {
      const shown = displayPath(dest, ctx);
      const suffix = dest.split(path.sep).includes('.github') ? '  (project only)' : '';
      const result = installInto(dest, { dryRun: flags.dryRun, version });
      if (result === 'skipped') log(`skip unmanaged ${shown}`);
      if (result === 'dry' || result === 'ok') {
        log(`  ${shown}${suffix}`);
        acted.push(dest);
      }
    }
    if (scope === 'global' && agents.includes('github')) {
      log('');
      log('github is project-only; wrote .github/skills/air in this project.');
    }
    log('');
    log('Reload the harness, then type /air');
    return { code: 0, dests: acted };
  } catch (error) {
    if (error?.name === 'ExitPromptError') {
      err('Cancelled.');
      return { code: 1, dests: [] };
    }
    throw error;
  }
}

const invoked = process.argv[1] && path.basename(process.argv[1]) === 'install.mjs';
if (invoked) {
  run(process.argv.slice(2), {
    cwd: process.cwd(),
    home: os.homedir(),
    stdinIsTTY: Boolean(process.stdin.isTTY),
  }).then((result) => process.exit(result.code));
}