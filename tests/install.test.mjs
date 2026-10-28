/**
 * install.test.mjs —— 一键安装脚本 `scripts/install.mjs`
 * ============================================================================
 *
 * 被测对象是**用户入口脚本**，四道行为约束逐条锁成回归测试：
 *   ① Node 主版本硬门在任何写盘之前；② 目标已存在先整体 rename 再写入、**成功即清理临时备份**
 *   （失败才保留兜底）；③ 平铺 + 整目录复制规则；④ 装完对已安装副本跑 doctor 自检。
 *   另测 `--dry-run` 与用法错误。
 *
 * 全部动作发生在临时目录，不触碰 `~/.codebuddy`。
 * 只用 Node 内置模块，不依赖 node_modules。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const INSTALL = path.join(ROOT, 'scripts', 'install.mjs');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runInstall(args, env = {}) {
  return spawnSync(process.execPath, [INSTALL, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
}

test('--help 打印用法且退出码 0', () => {
  const result = runInstall(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /安装/);
});

test('未知参数退出码 2', () => {
  const result = runInstall(['--nope']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /未知参数/);
});

test('--target 缺值退出码 2', () => {
  const result = runInstall(['--target']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--target 需要一个目录参数/);
});

test('版本硬门：Node 主版本不足时非零退出且不写任何文件', () => {
  const parent = tmpDir('install-gate-');
  const target = path.join(parent, 'brainstorming-archify');
  try {
    const result = runInstall(['--target', target], { BRAINSTORMING_NODE_VERSION: '16' });
    assert.equal(result.status, 1, '版本不足应退出码 1');
    assert.match(result.stderr, /Node 版本不满足/);
    assert.ok(!fs.existsSync(target), '不满足版本时不应创建目标目录');
    assert.deepEqual(fs.readdirSync(parent), [], '不满足版本时不应写入任何文件');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('--dry-run：列出清单但不落盘', () => {
  const parent = tmpDir('install-dry-');
  const target = path.join(parent, 'brainstorming-archify');
  try {
    const result = runInstall(['--dry-run', '--target', target]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /安装预演/);
    assert.ok(!fs.existsSync(target), '--dry-run 不应创建目标目录');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('实装形态：skill/ 平铺到根，templates/ 与 scripts/ 整目录，并跑过自检', () => {
  const parent = tmpDir('install-real-');
  const target = path.join(parent, 'brainstorming-archify');
  const commandsDir = path.join(parent, 'commands');
  try {
    const result = runInstall(['--target', target, '--commands-dir', commandsDir]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);

    // 平铺
    assert.ok(fs.existsSync(path.join(target, 'SKILL.md')), 'SKILL.md 应平铺在目标根');
    assert.ok(fs.existsSync(path.join(target, 'design-doc-reviewer-prompt.md')));
    // 整目录
    assert.ok(fs.existsSync(path.join(target, 'templates', 'architecture-doc-template.md')));
    assert.ok(fs.existsSync(path.join(target, 'templates', 'module-doc-template.md')));
    assert.ok(fs.existsSync(path.join(target, 'templates', 'interface-contract-template.md')));
    assert.ok(fs.existsSync(path.join(target, 'templates', 'data-model-doc-template.md')));
    assert.ok(fs.existsSync(path.join(target, 'templates', 'self-verification-cases-template.md')));
    assert.ok(fs.existsSync(path.join(target, 'scripts', 'install.mjs')));
    // sync-upstream.sh 是仓库维护工具（会 clone 上游仓库比对 SKILL.md），不该出现在用户技能目录
    assert.ok(
      !fs.existsSync(path.join(target, 'scripts', 'sync-upstream.sh')),
      'sync-upstream.sh 不应进安装',
    );
    // 内核入口
    assert.ok(fs.existsSync(path.join(target, 'scripts', 'diagram-engine', 'bin', 'render.mjs')));
    assert.ok(fs.existsSync(path.join(target, 'scripts', 'diagram-engine', 'bin', 'render-driver.mjs')));
    // 仓库自测面不进安装
    assert.ok(!fs.existsSync(path.join(target, 'tests')), 'tests/ 不应进安装');
    assert.ok(!fs.existsSync(path.join(target, 'scripts', 'diagram-engine', 'test')), '内核回归集不应进安装');

    // 装后自检必须真的跑了检查项（只匹配固定文案的话，自检判定退化时用例仍会绿）
    const selfCheck = /自检：diagram-engine doctor 通过（(\d+) 项检查全部 ok）/.exec(result.stdout);
    assert.ok(selfCheck, `应输出带检查项数的自检结论\n${result.stdout}`);
    assert.ok(Number(selfCheck[1]) > 0, '自检应至少报告一项检查通过');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('目标已存在：成功安装整目录替换且不残留任何备份', () => {
  const parent = tmpDir('install-backup-');
  const target = path.join(parent, 'brainstorming-archify');
  const commandsDir = path.join(parent, 'commands');
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'PREVIOUS.md'), 'OLD-CONTENT');

    const result = runInstall(['--target', target, '--commands-dir', commandsDir]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);

    const backups = fs.readdirSync(parent).filter((name) => name.startsWith('brainstorming-archify.bak-'));
    assert.equal(backups.length, 0, `成功安装后不得残留备份目录，实际：${backups.join(', ')}`);
    assert.match(result.stdout, /已清理临时备份/, '应报告已清理那次临时兜底备份');
    assert.ok(!fs.existsSync(path.join(target, 'PREVIOUS.md')), '旧文件应随整目录替换而消失');
    assert.ok(fs.existsSync(path.join(target, 'SKILL.md')), '新装内容应就位');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('--commands-dir 缺值退出码 2', () => {
  const result = runInstall(['--commands-dir']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--commands-dir 需要一个目录参数/);
});

test('命令适配器：dry-run 列出 bsa\/resume.md 但不落盘', () => {
  const parent = tmpDir('install-cmd-dry-');
  const target = path.join(parent, 'brainstorming-archify');
  const commandsDir = path.join(parent, 'commands');
  try {
    const result = runInstall(['--dry-run', '--target', target, '--commands-dir', commandsDir]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /commands\/bsa\/resume\.md/);
    assert.ok(!fs.existsSync(commandsDir), '--dry-run 不应创建命令目录');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('命令适配器：实装部署 bsa\/resume.md 且 __BSA_ROOT__ 重写为技能根', () => {
  const parent = tmpDir('install-cmd-real-');
  const target = path.join(parent, 'brainstorming-archify');
  const commandsDir = path.join(parent, 'commands');
  try {
    const result = runInstall(['--target', target, '--commands-dir', commandsDir]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const deployed = path.join(commandsDir, 'bsa', 'resume.md');
    assert.ok(fs.existsSync(deployed), '应部署 bsa/resume.md');
    const body = fs.readFileSync(deployed, 'utf8');
    assert.ok(!body.includes('__BSA_ROOT__'), '占位符必须全部重写');
    assert.ok(body.includes(`node "${path.join(target, 'scripts', 'task-state', 'resume-state.mjs')}"`),
      `适配器应指向本次安装的技能根\n${body}`);
    assert.match(body, /不得直接修改 `\.brainstorming-archify\/state\.yaml`/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('命令适配器：命令目录下其他命令原样保留，重复安装幂等', () => {
  const parent = tmpDir('install-cmd-keep-');
  const target = path.join(parent, 'brainstorming-archify');
  const commandsDir = path.join(parent, 'commands');
  try {
    // 别人的命令 + 自己的一份旧适配器
    fs.mkdirSync(path.join(commandsDir, 'ssf'), { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'ssf', 'resume.md'), 'SSF-RESUME');
    fs.mkdirSync(path.join(commandsDir, 'bsa'), { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'bsa', 'resume.md'), 'STALE');

    assert.equal(runInstall(['--target', target, '--commands-dir', commandsDir]).status, 0);
    assert.equal(fs.readFileSync(path.join(commandsDir, 'ssf', 'resume.md'), 'utf8'), 'SSF-RESUME',
      '其他命令必须原样保留');
    const first = fs.readFileSync(path.join(commandsDir, 'bsa', 'resume.md'), 'utf8');
    assert.notEqual(first, 'STALE', '旧适配器应被刷新');

    // 重复安装（目标已存在 → 走整目录替换分支）后命令目录依旧正确
    assert.equal(runInstall(['--target', target, '--commands-dir', commandsDir]).status, 0);
    assert.equal(fs.readFileSync(path.join(commandsDir, 'ssf', 'resume.md'), 'utf8'), 'SSF-RESUME');
    assert.equal(fs.readFileSync(path.join(commandsDir, 'bsa', 'resume.md'), 'utf8'), first,
      '重复安装的适配器内容应一致（幂等）');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('备份目标已存在时拒绝覆盖，不静默吞掉既有备份', async () => {
  const { backupExisting } = await import(pathToFileURL(INSTALL).href);
  const parent = tmpDir('install-backup-clash-');
  const target = path.join(parent, 'brainstorming-archify');
  try {
    fs.mkdirSync(target, { recursive: true });
    const stamp = '20260101-000000';
    assert.equal(backupExisting(target, stamp), `${target}.bak-${stamp}`);
    // 备份目录已被占用：再次以同一 stamp 备份必须报错，而不是覆盖既有备份
    fs.mkdirSync(target, { recursive: true });
    assert.throws(() => backupExisting(target, stamp), /备份目标已存在/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('已安装副本可独立跑 doctor', () => {
  const parent = tmpDir('install-doctor-');
  const target = path.join(parent, 'brainstorming-archify');
  const commandsDir = path.join(parent, 'commands');
  try {
    assert.equal(runInstall(['--target', target, '--commands-dir', commandsDir]).status, 0);
    const entry = path.join(target, 'scripts', 'diagram-engine', 'bin', 'render.mjs');
    const result = spawnSync(process.execPath, [entry, 'doctor'], { encoding: 'utf8' });
    assert.equal(result.status, 0, `安装副本的 doctor 应通过\n${result.stdout}${result.stderr}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
