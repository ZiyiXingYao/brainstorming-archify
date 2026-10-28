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
 * （advance closed --task-md 校验 mtime 晚于最后一次重开；已登记的自验用例须 confirmed 且新鲜）、原子写盘、YAML 往返、
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
const MOD_A = 'specs/design/04-通信模块.md';
const MOD_B = 'specs/design/05-调度模块.md';
const TASK_MD = 'specs/design/task.md';
const SELF_MD = 'specs/design/03-自验用例.md';

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

/** 收口：先按流程把自验用例登记为 confirmed，再 advance closed。 */
function close(root, taskMd = TASK_MD) {
  if (fs.existsSync(path.join(root, SELF_MD))) {
    runChange(root, ['file', SELF_MD, 'confirmed']);
  }
  return runChange(root, ['advance', 'closed', '--task-md', taskMd]);
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
  // 收口要求自验用例先于 task.md：落 task.md 时先补齐（已存在则不动，便于测陈旧）
  if (rel === TASK_MD && !fs.existsSync(path.join(root, SELF_MD))) {
    const cases = path.join(root, SELF_MD);
    fs.mkdirSync(path.dirname(cases), { recursive: true });
    fs.writeFileSync(cases, '# 自验用例\n');
  }
  fs.writeFileSync(full, `# ${path.basename(rel)}\n`);
  return full;
}

/** 把 mtime 设成过去（测 task.md 作废判定用）。 */
function backdate(full, ms) {
  const t = Date.now() - ms;
  fs.utimesSync(full, new Date(t), new Date(t));
}

/** 轮次 change-list 文件所在目录（相对项目根）。 */
const CL_DIR = '.brainstorming-archify/change-lists';

/** 造一个轮次 change-list 文件（含五个小节标题）并返回其相对路径。 */
function makeRoundFile(root, name = '20261012T120000Z-report-export.md') {
  const rel = `${CL_DIR}/${name}`;
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, [
    '# 讨论轮次：报表导出',
    '',
    '## 轮次头',
    '- 主题：报表导出',
    '',
    '## 讨论记录',
    '（问答要点）',
    '',
    '## 重要决策',
    '（尚未落进设计文档的决策）',
    '',
    '## 文件修改台账',
    '| 文档 | 最近更新 | 参与 | 来源 |',
    '|---|---|---|---|',
    '',
    '## 落盘授权',
    '（每次落盘一段）',
    '',
  ].join('\n'));
  return rel;
}

/** 开一轮：建 change-list 文件并把指针指过去（走 closed 的前置）。 */
function openRound(root, name) {
  const rel = makeRoundFile(root, name);
  const r = runChange(root, ['change-list', rel]);
  if (r.status !== 0) throw new Error(`openRound 失败：${r.stderr}`);
  return rel;
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
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  const r = runChange(root, ['advance', 'closed']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--task-md/);

  const r2 = close(root);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /task\.md|不存在/);

  land(root, TASK_MD);
  const r3 = close(root);
  assert.equal(r3.status, 0, r3.stderr);
  assert.match(readState(root), /^state: "closed"$/m);
  assert.match(readState(root), /path: "specs\/design\/task\.md"/);
});

test('resume-state：confirm 态先指向自验用例再指向 task.md', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);

  const r = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(r.state, 'confirm');
  assert.match(r.next_action.reason, /03-自验用例/);
  assert.match(r.next_action.command, /03-自验用例/);
});

test('resume-state：自验用例确认后 next_action 指向收口', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  land(root, SELF_MD);
  runChange(root, ['file', SELF_MD, 'confirmed']);

  const r = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(r.state, 'confirm');
  assert.match(r.next_action.reason, /自验用例已确认/);
  assert.match(r.next_action.command, /advance closed/);
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

test('rename：盘上文件与登记路径一起改，状态不变', () => {
  const root = tmpProject();
  const OLD = 'specs/design/03-旧模块.md';
  const NEW = 'specs/design/04-旧模块.md';
  runChange(root, ['init']);
  openRound(root);
  const oldFull = land(root, OLD);
  runChange(root, ['file', OLD, 'confirmed']);

  const r = runChange(root, ['rename', OLD, NEW]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(oldFull), '旧路径文件应已改名');
  assert.ok(fs.existsSync(path.join(root, NEW)), '新路径文件应在盘上');
  const text = readState(root);
  assert.match(text, new RegExp(`path: "${NEW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(text, new RegExp(`path: "${NEW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*status: "confirmed"`));
  assert.doesNotMatch(text, new RegExp(`path: "${OLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});

test('rename：旧路径未登记或新路径已登记则拒绝', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  land(root, MOD_A);
  runChange(root, ['file', MOD_A, 'landed']);

  assert.equal(runChange(root, ['rename', 'specs/design/03-不存在.md', 'specs/design/04-不存在.md']).status, 1);
  land(root, MOD_B);
  runChange(root, ['file', MOD_B, 'landed']);
  assert.equal(runChange(root, ['rename', MOD_A, MOD_B]).status, 1);
});

// ---------------------------------------------------------------------------
// reopen（closed/confirm/draft 之后重开）
// ---------------------------------------------------------------------------

test('reopen：只翻点名文件回 discussing，整体回 explore，未点名文件不动', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['file', MOD_A, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  close(root);

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
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  const taskMd = land(root, TASK_MD);
  close(root);

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

  // 重新生成自验用例与 task.md（mtime 变新）→ 放行
  land(root, SELF_MD);
  land(root, TASK_MD);
  const r2 = close(root);
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(readState(root), /^state: "closed"$/m);
});

test('advance closed：自验用例不存在则拒绝收口（无需登记）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);

  // 只落 task.md，不落 03
  const taskFull = path.join(root, TASK_MD);
  fs.mkdirSync(path.dirname(taskFull), { recursive: true });
  fs.writeFileSync(taskFull, '# task.md\n');

  const r = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /自验用例不存在/);
});

test('advance closed：自验用例存在但未登记也拒绝', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  land(root, SELF_MD);
  land(root, TASK_MD);

  const r = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /自验用例尚未登记/);
});

test('advance closed：登记过的自验用例未确认则拒绝收口', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);

  land(root, SELF_MD);
  runChange(root, ['file', SELF_MD, 'landed']);
  land(root, TASK_MD);

  const r = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /自验用例尚未确认/);

  runChange(root, ['file', SELF_MD, 'confirmed']);
  const r2 = close(root);
  assert.equal(r2.status, 0, r2.stderr);
});

test('advance closed：重开后自验用例陈旧则拒绝收口', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  const selfMd = land(root, SELF_MD);
  runChange(root, ['file', SELF_MD, 'confirmed']);
  land(root, TASK_MD);
  close(root);

  runChange(root, ['reopen', MOD_B, '--reason', '新增调度模块']);
  runChange(root, ['file', MOD_B, 'landed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['file', MOD_B, 'confirmed']);
  runChange(root, ['advance', 'confirm']);

  backdate(selfMd, 60_000);
  land(root, TASK_MD);
  const r = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /自验用例.*不晚于最后一次重开/);

  land(root, SELF_MD);
  land(root, TASK_MD);
  const r2 = close(root);
  assert.equal(r2.status, 0, r2.stderr);
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
  openRound(root);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  close(root);
  const out = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(out.state, 'closed');
  assert.match(out.next_action.reason, /reopen/);
});

test('reopen：未登记的新文件先登记为 discussing（新增模块场景）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['advance', 'confirm']);
  // 新模块文档从未登记过
  assert.equal(runChange(root, ['reopen', MOD_B, '--reason', '新增调度模块']).status, 0);
  const out = JSON.parse(runChange(root, ['show', '--json']).stdout);
  const entry = out.files.find((f) => f.path === MOD_B);
  assert.ok(entry, 'reopen 未登记文件应把它登记进 files');
  assert.equal(entry.status, 'discussing');
});

test('resume-state：文本输出含 State 与 Next 两行（对齐 ssf resume 口径）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const r = runResume(root, []);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^State: explore$/m);
  assert.match(r.stdout, /^Next: /m);
});

// ---------------------------------------------------------------------------
// change-list（当前轮次文件指针）
// ---------------------------------------------------------------------------

test('change-list：首轮可设当前指针，show --json 能看到', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const rel = makeRoundFile(root);
  const r = runChange(root, ['change-list', rel]);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(runChange(root, ['show', '--json']).stdout);
  assert.equal(out.change_list.path, rel);
  assert.match(readState(root), /change_list:/);
});

test('change-list：重复设同一文件是空操作（追加场景）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const rel = makeRoundFile(root);
  runChange(root, ['change-list', rel]);
  const before = readState(root);
  assert.equal(runChange(root, ['change-list', rel]).status, 0);
  assert.equal(readState(root), before, '同一文件重复设置不应改盘');
});

test('change-list：路径必须在 .brainstorming-archify/change-lists/ 下', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  land(root, 'specs/design/01-架构设计.md');
  const r = runChange(root, ['change-list', 'specs/design/01-架构设计.md']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /change-lists/);
  assert.equal(runChange(root, ['change-list', '/etc/passwd']).status, 2);
});

test('change-list：文件不存在时拒绝', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const r = runChange(root, ['change-list', `${CL_DIR}/20261012T120000Z-nope.md`]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /不存在/);
});

test('change-list：轮次文件缺小节标题时拒绝（恢复内容要有着落）', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const rel = `${CL_DIR}/20261012T120000Z-thin.md`;
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '# 讨论轮次\n\n## 讨论记录\n只有一节\n');
  const r = runChange(root, ['change-list', rel]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /五个|5 个|轮次头/);
  assert.doesNotMatch(readState(root), /20261012T120000Z-thin/, '被拒时不得写指针');

  // 空文件同样拒绝
  fs.writeFileSync(full, '');
  assert.equal(runChange(root, ['change-list', rel]).status, 1);
});

test('change-list：讨论未完成（draft/confirm）不能换文件', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const first = makeRoundFile(root, '20261012T120000Z-round1.md');
  runChange(root, ['change-list', first]);
  land(root, ARCH);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['advance', 'draft']);

  const second = makeRoundFile(root, '20261012T130000Z-round2.md');
  const before = readState(root);
  const r = runChange(root, ['change-list', second]);
  assert.equal(r.status, 1, 'draft 态换文件必须被拒');
  assert.match(r.stderr, /讨论未完成|不能切换/);
  assert.equal(readState(root), before, '被拒时不得改盘');

  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'confirm']);
  assert.equal(runChange(root, ['change-list', second]).status, 1, 'confirm 态换文件同样被拒');
});

test('change-list：closed 后未 reopen 不能换文件；reopen 后可以', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const first = makeRoundFile(root, '20261012T120000Z-round1.md');
  runChange(root, ['change-list', first]);
  land(root, ARCH);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  close(root);

  const second = makeRoundFile(root, '20261012T140000Z-round2.md');
  assert.equal(runChange(root, ['change-list', second]).status, 1, 'closed 未 reopen 不能换');

  assert.equal(runChange(root, ['reopen', MOD_B, '--reason', '新增模块']).status, 0);
  assert.equal(runChange(root, ['change-list', second]).status, 0, 'reopen 后可换新文件');
  const out = JSON.parse(runChange(root, ['show', '--json']).stdout);
  assert.equal(out.change_list.path, second);
});

test('advance closed：必须先设当前 change-list 文件', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  land(root, ARCH);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  const before = readState(root);
  const r = runChange(root, ['advance', 'closed', '--task-md', TASK_MD]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /change-list/);
  assert.equal(readState(root), before);

  const rel = makeRoundFile(root);
  runChange(root, ['change-list', rel]);
  assert.equal(close(root).status, 0);
});

test('resume-state：输出 change_list；当前文件缺失时 blocker', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const rel = makeRoundFile(root);
  runChange(root, ['change-list', rel]);

  const out = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(out.change_list.path, rel);
  assert.ok(
    (out.next_action.load ?? []).some((p) => p.includes(rel)),
    'next_action.load 应含当前 change-list 文件',
  );

  fs.rmSync(path.join(root, rel));
  const out2 = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(out2.ok, false);
  assert.ok(out2.blockers.some((b) => String(b.message ?? b).includes(rel)), '应报当前 change-list 文件缺失');
});

test('resume-state：reopen 后当前指针陈旧时提示开新轮文件', () => {
  const root = tmpProject();
  runChange(root, ['init']);
  const first = makeRoundFile(root, '20261012T120000Z-round1.md');
  runChange(root, ['change-list', first]);
  land(root, ARCH);
  runChange(root, ['file', ARCH, 'landed']);
  runChange(root, ['advance', 'draft']);
  runChange(root, ['file', ARCH, 'confirmed']);
  runChange(root, ['advance', 'confirm']);
  land(root, TASK_MD);
  close(root);
  runChange(root, ['reopen', MOD_B, '--reason', '新增模块']);

  const out = JSON.parse(runResume(root, ['--json']).stdout);
  assert.equal(out.state, 'explore');
  assert.match(out.next_action.reason, /change-list|轮次|新轮/, '应提示开新轮文件');
});


