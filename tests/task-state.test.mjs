/**
 * task-state.test.mjs —— 讨论状态库 `.brainstorming-archify/state.yaml` 的两个命令
 * ============================================================================
 *
 * 被测对象：
 *   - `scripts/task-state/change-state.mjs` —— state.yaml 的**唯一写入口**
 *     （init / file / advance / reopen / show）
 *   - `scripts/task-state/resume-state.mjs`  —— **只读**恢复命令（中断/重启后续讨论）
 *
 * 锁定的行为：四态状态机（explore → draft → confirm → closed）与推进前置条件、
 * 文件三态、reopen 只翻点名文件且整体回 explore、closed 后 task.md 作废
 * （advance closed --task-md 校验 mtime 晚于最后一次重开）、原子写盘、YAML 往返、
 * resume 的发现规则与 blockers、resume 全程不写盘。
 *
 * 全部动作发生在临时目录。只用 Node 内置模块，不依赖 node_modules。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CHANGE_STATE = path.join(ROOT, 'scripts', 'task-state', 'change-state.mjs');
const RESUME_STATE = path.join(ROOT, 'scripts', 'task-state', 'resume-state.mjs');

const ARCH = 'specs/design/01-架构设计.md';
const MOD_A = 'specs/design/02-通信模块.md';
const MOD_B = 'specs/design/03-调度模块.md';
const TASK_MD = 'specs/design/task.md';

function tmpProject(prefix = 'bsa-state-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

function runChange(root, args) {
  return spawnSync(process.execPath, [CHANGE_STATE, '--root', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function runResume(cwd, args = []) {
  return spawnSync(process.execPath, [RESUME_STATE, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    cwd,
  });
}

function statePath(root) {
  return path.join(root, '.brainstorming-archify', 'state.yaml');
}

function readState(root) {
  return fs.readFileSync(statePath(root), 'utf8');
}

/** 在项目里落一个设计文档文件（模拟讨论产物落盘）。 */
function land(root, rel) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `# ${path.basename(rel)}\n`);
  return full;
}

/** 把 mtime 设成过去（测 task.md 作废判定用）。 */
function backdate(full, ms) {
  const t = Date.now() - ms;
  fs.utimesSync(full, new Date(t), new Date(t));
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

test('init：建库写 state.yaml，初态 explore、无登记文件', () => {
  const root = tmpProject();
  const r = runChange(root, ['init']);
  assert.equal(r.status, 0, r.stderr);
  const text = readState(root);
  assert.match(text, /^state: "explore"$/m);
  assert.match(text, /^files: \[\]$/m);
  assert.match(text, /schema_version: 1/);
});

test('init：state.yaml 已存在时拒绝，不覆盖既有内容', () => {
  const root = tmpProject();
  assert.equal(runChange(root, ['init']).status, 0);
  const before = readState(root);
  const r = runChange(root, ['init']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /已存在/);
  assert.equal(readState(root), before);
});

test('init：不带 --root 时从 cwd 向上发现项目根（认 .git 标记）', () => {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  const r = spawnSync(process.execPath, [CHANGE_STATE, 'init'], { cwd: nested, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(statePath(root)));
});

// ---------------------------------------------------------------------------
// file
// ---------------------------------------------------------------------------

test('file：登记三态并可按需更新', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  assert.equal(runChange(root, ['file', ARCH, 'landed']).status, 0);
  assert.equal(runChange(root, ['file', MOD_A, 'confirmed']).status, 0);
  const text = readState(root);
  assert.match(text, new RegExp(`path: "${ARCH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "landed"`));
  assert.match(text, new RegExp(`path: "${MOD_A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "confirmed"`));
});

test('file：非法状态值退出码 2 且不改盘', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const before = readState(root);
  const r = runChange(root, ['file', ARCH, 'done']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /discussing|landed|confirmed/);
  assert.equal(readState(root), before);
});

test('file：拒绝绝对路径与盘符路径（状态库只记项目内相对路径）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  assert.equal(runChange(root, ['file', '/etc/passwd', 'landed']).status, 2);
  assert.equal(runChange(root, ['file', 'C:\\x.md', 'landed']).status, 2);
});

test('未知子命令与缺参数：退出码 2', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  assert.equal(runChange(root, ['frobnicate']).status, 2);
  assert.equal(runChange(root, ['file', ARCH]).status, 2);
  assert.equal(runChange(root, ['advance']).status, 2);
});

// ---------------------------------------------------------------------------
// advance 前置条件
// ---------------------------------------------------------------------------

test('advance draft：需全部登记文件 landed（confirmed 算已落盘）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['file', MOD_A, 'confirmed']);
  assert.equal(runChange(root, ['advance', 'draft']).status, 0);
  assert.match(readState(root), /^state: "draft"$/m);
});

test('advance draft：仍有 discussing 文件时拒绝且不改盘', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['file', MOD_A, 'discussing']);
  const before = readState(root);
  const r = runChange(root, ['advance', 'draft']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MOD_A_PLACEHOLDER|discussing|未落盘/);
  assert.equal(readState(root), before);
});

test('advance confirm：需全部登记文件 confirmed', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['file', MOD_A, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  const before = readState(root);
  const r = runChange(root, ['advance', 'confirm']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ARCH_PLACEHOLDER|landed|未确认/);
  assert.equal(readState(root), before);

  runChange(root, ['file', ARCH, 'confirmed']);
  assert.equal(runChange(root, ['advance', 'confirm']).status, 0);
  assert.match(readState(root), /^state: "confirm"$/m);
});

test('advance closed：需 --task-md 且文件存在', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  const r = runChange(root, ['advance', 'closed']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--task-md/);

  const r2 = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /task\.md|不存在/);

  land(root, TASK_MD);
  const r3 = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r3.status, 0, r3.stderr);
  assert.match(readState(root), /^state: "closed"$/m);
  assert.match(readState(root), /path: "specs\/design\/task\.md"/);
});

test('advance：同态推进是空操作，不写 log', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const before = readState(root);
  assert.equal(runChange(root, ['advance', 'explore']).status, 0);
  assert.equal(readState(root), before);
});

test('advance 回退到更早状态：必须带 --reason', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['advance', 'draft']);
  const before = readState(root);
  assert.equal(runChange(root, ['advance', 'explore']).status, 2);
  assert.equal(readState(root), before);
  assert.equal(runChange(root, ['advance', 'explore', '--reason', '推倒重来']).status, 0);
  assert.match(readState(root), /^state: "explore"$/m);
  assert.match(readState(root), /reason: "推倒重来"/);
});

// ---------------------------------------------------------------------------
// reopen（closed/confirm/draft 之后重开）
// ---------------------------------------------------------------------------

test('reopen：只翻点名文件回 discussing，整体回 explore，未点名文件不动', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['file', MOD_A, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);

  // closed 之后新增模块：登记新文件并重开它
  const r = runChange(root, ['reopen', MOD_B, '--reason', '新增调度模块']);
  assert.equal(r.status, 0, r.stderr);
  const text = readState(root);
  assert.match(text, /^state: "explore"$/m);
  // 点名文件变成 discussing
  assert.match(text, new RegExp(`path: "${MOD_B.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "discussing"`));
  // 未点名文件保持 confirmed
  assert.match(text, new RegExp(`path: "${ARCH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "confirmed"`));
  // 记了重开事件
  assert.match(text, /reason: "新增调度模块"/);
});

test('reopen：缺 --reason 拒绝；重开既有 confirmed 文件也只翻它自己', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['file', MOD_A, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);

  assert.equal(runChange(root, ['reopen', MOD_A]).status, 2);
  const before = readState(root);
  assert.equal(readState(root), before);

  assert.equal(runChange(root, ['reopen', MOD_A, '--reason', '改接口']).status, 0);
  const text = readState(root);
  assert.match(text, new RegExp(`path: "${MOD_A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "discussing"`));
  assert.match(text, new RegExp(`path: "${ARCH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "confirmed"`));
});

test('closed 后重开：旧 task.md 不重生成则无法再次收口', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  const taskMd = land(root, TASK_MD);
  runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);

  // 重开（新增模块），走完确认，但**不**重写 task.md
  runChange(root, ['reopen', MOD_B, '--reason', '新增调度模块']);
  runChange(root, ['file', MOD_B, 'landed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['file', MOD_B, 'confirmed']);
  runChange(root, ['advance', 'confirm']);

  // task.md 的 mtime 早于重开 → 拒绝
  backdate(taskMd, 60_000);
  const r = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /重开|重新生成|stale/);

  // 重新生成 task.md（mtime 变新）→ 放行
  land(root, TASK_MD);
  const r2 = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(readState(root), /^state: "closed"$/m);
});

// ---------------------------------------------------------------------------
// 原子写盘与 YAML 往返
// ---------------------------------------------------------------------------

test('原子写盘：写入目标不可用时失败且不留半成品', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  // 把 state.yaml 占成一个目录：rename 必然失败
  fs.rmSync(statePath(root));
  fs.mkdirSync(statePath(root), { recursive: true });
  const r = runChange(root, ['file', ARCH, 'landed']);
  assert.equal(r.status, 1);
  // 不留下 .tmp 半成品
  const leftovers = fs.readdirSync(path.dirname(statePath(root))).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('YAML 往返：中文路径与含冒号/引号/反斜杠的理由', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const weird = 'specs/design/02-通信模块.md';
  assert.equal(runChange(root, ['file', weird, 'landed']).status, 0);
  assert.equal(
    runChange(root, ['reopen', weird, '--reason', '原因: 带"引号"\\反斜杠#井号']).status,
    0,
  );
  const text = readState(root);
  assert.match(text, new RegExp(`path: "${weird.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  // 落盘的是转义形态
  assert.match(text, /reason: "原因: 带\\"引号\\"\\\\反斜杠#井号"/);
  // 往返后仍可解析：再跑一条命令不报形状错误
  assert.equal(runChange(root, ['show']).status, 0);
});

// ---------------------------------------------------------------------------
// resume-state（只读）
// ---------------------------------------------------------------------------

test('resume-state：只读——跑完 state.yaml 一个字节都不变', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'landed']);
  const before = fs.statSync(statePath(root));
  const r = runResume(root, ['--json']);
  assert.equal(r.status, 0, r.stderr);
  const after = fs.statSync(statePath(root));
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.size, before.size);
});

test('resume-state --json：输出形状与四态 next_action', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  land(root, ARCH);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['advance', 'draft']);

  const r = runResume(root, ['--json']);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.state, 'draft');
  assert.deepEqual(out.files, [{ path: ARCH, status: 'landed' }]);
  assert.ok(out.next_action && typeof out.next_action.reason === 'string' && out.next_action.reason.length > 0);
  assert.ok(Array.isArray(out.blockers));
  assert.equal(out.blockers.length, 0);
  assert.ok(Array.isArray(out.next_action.load) && out.next_action.load.length > 0);

  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'confirm']);
  const r2 = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(r2.state, 'confirm');
  assert.match(r2.next_action.reason, /task\.md/);
});

test('resume-state：从子目录向上发现项目根', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const nested = path.join(root, 'x', 'y');
  fs.mkdirSync(nested, { recursive: true });
  const r = runResume(nested, ['--json']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).project_root, root);
});

test('resume-state blocker：找不到 state.yaml', () => {
  const root = tmpProject();
  const r = runResume(root, ['--json']);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.ok(out.blockers.some((b) => /state\.yaml/.test(b.message ?? b)));
});

test('resume-state blocker：登记为 landed/confirmed 的文件在盘上已不存在', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const full = land(root, ARCH);
  runChange(root, ['file', ARCH, 'confirmed']);
  fs.rmSync(full);
  const out = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(out.ok, false);
  assert.ok(out.blockers.some((b) => String(b.message ?? b).includes(ARCH)));
});

test('resume-state：closed 态的 next_action 指向 reopen', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  const out = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(out.state, 'closed');
  assert.match(out.next_action.reason, /reopen/);
});

test('resume-state：文本输出含 State 与 Next 两行（对齐 ssf resume 口径）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const r = runResume(root, []);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^State: explore$/m);
  assert.match(r.stdout, /^Next: /m);
});

