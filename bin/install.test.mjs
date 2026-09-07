import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { displayPath, run, scopeChoiceLabels } from './install.mjs';

const TEST_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.tmp-air-install');
const temps = [];

function tempDir(prefix) {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TEST_ROOT, prefix));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length) {
    fs.rmSync(temps.pop(), { recursive: true, force: true });
  }
});

after(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

function setup({ cursorHome = true } = {}) {
  const cwd = tempDir('air-install-cwd-');
  const home = tempDir('air-install-home-');
  if (cursorHome) fs.mkdirSync(path.join(home, '.cursor'));
  const printed = [];
  return {
    cwd,
    home,
    printed,
    env: {
      cwd,
      home,
      stdinIsTTY: false,
      log: (msg) => printed.push(String(msg)),
      err: (msg) => printed.push(String(msg)),
    },
  };
}

describe('install flags', () => {
  it('refuses without -y, --providers, or --all when not a TTY', async () => {
    const { cwd, env } = setup();
    const result = await run(['install'], env);
    assert.equal(result.code, 2);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air')), false);
  });

  it('installs detected agents into the project with -y', async () => {
    const { cwd, env } = setup();
    const result = await run(['install', '-y'], env);
    assert.equal(result.code, 0);
    const dest = path.join(cwd, '.cursor', 'skills', 'air');
    assert.equal(fs.existsSync(path.join(dest, 'SKILL.md')), true);
    assert.equal(fs.lstatSync(path.join(dest, 'SKILL.md')).isSymbolicLink(), false);
    const stamp = JSON.parse(fs.readFileSync(path.join(dest, '.air-dev-skill.json'), 'utf8'));
    assert.equal(stamp.source, 'air-dev-skill');
    assert.equal(fs.existsSync(path.join(dest, 'scripts', 'context.mjs')), true);
    assert.equal(fs.existsSync(path.join(dest, 'scripts', 'fixtures')), false);
  });

  it('--providers installs an undetected agent', async () => {
    const { cwd, env } = setup();
    const result = await run(['install', '--providers=claude', '--scope', 'project'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(cwd, '.claude', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air')), false);
  });

  it('--scope global -y writes into HOME', async () => {
    const { cwd, home, env } = setup();
    const result = await run(['install', '-y', '--scope', 'global'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(home, '.cursor', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air')), false);
  });

  it('codex project scope writes both dests', async () => {
    const { cwd, env } = setup({ cursorHome: false });
    const result = await run(['install', '--providers=codex', '--scope', 'project'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(cwd, '.codex', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.agents', 'skills', 'air', 'SKILL.md')), true);
  });

  it('github with --scope global still writes the project dest', async () => {
    const { cwd, home, env } = setup({ cursorHome: false });
    const result = await run(['install', '--providers=github', '--scope', 'global'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(cwd, '.github', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(home, '.github')), false);
  });

  it('--all writes every project dest', async () => {
    const { cwd, env } = setup({ cursorHome: false });
    const result = await run(['install', '--all', '--scope', 'project'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.claude', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.codex', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.agents', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.opencode', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.github', 'skills', 'air', 'SKILL.md')), true);
  });

  it('--dry-run -y writes nothing', async () => {
    const { cwd, env } = setup();
    const result = await run(['install', '--dry-run', '-y'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air')), false);
  });

  it('uninstall removes a stamped dest and leaves an unmanaged dest', async () => {
    const { cwd, env } = setup();
    await run(['install', '-y'], env);
    const managed = path.join(cwd, '.cursor', 'skills', 'air');
    const unmanaged = path.join(cwd, '.claude', 'skills', 'air');
    fs.mkdirSync(unmanaged, { recursive: true });
    fs.writeFileSync(path.join(unmanaged, 'SKILL.md'), 'hand-copied\n');
    const result = await run(['uninstall', '-y', '--providers=cursor,claude'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(managed), false);
    assert.equal(fs.existsSync(path.join(unmanaged, 'SKILL.md')), true);
  });

  it('list reports detected and installed', async () => {
    const { printed, env } = setup();
    await run(['install', '-y'], env);
    printed.length = 0;
    const result = await run(['list'], env);
    assert.equal(result.code, 0);
    const cursor = printed.find((line) => line.startsWith('cursor'));
    assert.match(cursor, /detected/);
    assert.match(cursor, /air yes/);
  });

  it('--dry-run without -y does not refuse when not a TTY', async () => {
    const { cwd, env } = setup();
    const result = await run(['install', '--dry-run'], env);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air')), false);
  });

  it('TTY install asks where using dests for the selected agents', async () => {
    const { cwd, home, env } = setup();
    const asked = [];
    env.stdinIsTTY = true;
    env.promptAgents = async () => {
      asked.push('agents');
      return ['cursor', 'opencode'];
    };
    env.promptScope = async (agents, ctx) => {
      asked.push('scope');
      assert.deepEqual(agents, ['cursor', 'opencode']);
      const labels = scopeChoiceLabels(agents, ctx);
      assert.equal(labels.project, '.cursor/skills/air, .opencode/skills/air');
      assert.equal(labels.global, '~/.cursor/skills/air, ~/.opencode/skills/air');
      assert.equal(labels.project.includes('.claude'), false);
      return 'global';
    };
    const result = await run(['install'], env);
    assert.deepEqual(asked, ['agents', 'scope']);
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(home, '.cursor', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(home, '.opencode', 'skills', 'air', 'SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'skills', 'air')), false);
  });

  it('scope labels follow the selected agents and mark github project-only', () => {
    const cwd = '/repo';
    const home = '/home';
    const labels = scopeChoiceLabels(['codex', 'github'], { cwd, home });
    assert.equal(labels.project, '.codex/skills/air, .agents/skills/air, .github/skills/air');
    assert.equal(labels.global, '~/.codex/skills/air, .github/skills/air (project only)');
  });

  it('prints project dests relative to cwd when cwd is under HOME', async () => {
    const { cwd, home, printed, env } = setup();
    const dest = path.join(cwd, '.cursor', 'skills', 'air');
    assert.equal(displayPath(dest, { cwd, home }), '.cursor/skills/air');
    const result = await run(['install', '--dry-run', '-y'], env);
    assert.equal(result.code, 0);
    assert.ok(printed.some((line) => line.includes('.cursor/skills/air')));
    assert.equal(
      printed.some((line) => line.includes('.cursor/skills/air') && line.includes('~/')),
      false,
    );
  });
});