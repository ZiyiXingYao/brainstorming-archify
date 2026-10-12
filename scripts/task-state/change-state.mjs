#!/usr/bin/env node
/**
 * change-state.mjs —— `.brainstorming-archify/state.yaml` 的**唯一写入口**
 * ============================================================================
 *
 * 讨论状态库的四级状态机：
 *
 *     explore（纯讨论，无产物落盘）
 *       → draft（草稿已落盘，人工校验中）     前置：全部登记文件 landed（confirmed 算已落盘）
 *       → confirm（全部确认，只差生成 task.md）前置：全部登记文件 confirmed
 *       → closed（task.md 已生成，结束）      前置：--task-md 指向的文件存在，且 mtime
 *                                              晚于最后一次重开（重开会作废 task.md）
 *
 * 文件三态：discussing / landed / confirmed。
 *
 * 子命令：
 *   init                                       建库（已存在即拒绝，不覆盖）
 *   file <path> <discussing|landed|confirmed>  登记 / 更新一个文件的状态
 *   change-list <path>                         设置**当前轮次**的 change-list 文件（唯一指针）
 *   advance <explore|draft|confirm|closed>     推进（正向只能走一步；回退必须 --reason）
 *                                              closed 额外要求 --task-md <path> 与已设 change-list
 *   reopen <path>... --reason "<原因>"         重开：点名文件翻回 discussing（未点名的不动），
 *                                              整体退回 explore，记一条重开事件
 *   show [--json]                              打印当前状态（只读）
 *
 * 规则：
 *   - state.yaml 只允许由本命令编辑（SKILL.md 与文件头注释同此口径）；
 *   - 每次写入都是原子写（临时文件 + rename），失败不留半成品；
 *   - 退出码：0 = 成功；1 = 状态/环境错误（含前置条件不满足）；2 = 用法错误。
 *
 * change-list 指针的切换规则（用户裁定）：一个讨论没完成（draft/confirm/closed 且未重开）时
 * MUST NOT 换文件；只有 reopen 开了新轮次（或还没有当前文件）才能指向新文件。
 * 指向同一个文件（轮内追加）随时允许。
 *
 * 项目根定位：--root <dir> 显式指定；否则从 cwd 向上找含 `.brainstorming-archify/state.yaml`
 * 的目录（init 时向上找含 `.brainstorming-archify/` 或直接用 cwd）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  STATES,
  FILE_STATUSES,
  CHANGE_LIST_DIR,
  StateYamlError,
  assertCleanValue,
  readStateFile,
  writeStateFile,
} from './state-yaml.mjs';

const USAGE = `用法：
  node scripts/task-state/change-state.mjs [--root <项目根>] init
  node scripts/task-state/change-state.mjs [--root <项目根>] file <路径> <discussing|landed|confirmed>
  node scripts/task-state/change-state.mjs [--root <项目根>] change-list <路径>
  node scripts/task-state/change-state.mjs [--root <项目根>] advance <explore|draft|confirm|closed> [--task-md <路径>] [--reason "<原因>"]
  node scripts/task-state/change-state.mjs [--root <项目根>] reopen <路径>... --reason "<原因>"
  node scripts/task-state/change-state.mjs [--root <项目根>] show [--json]

状态机：explore → draft → confirm → closed（正向只能走一步，回退必须 --reason）。
reopen 只翻点名文件回 discussing、整体回 explore；closed 下重开会作废 task.md。
change-list 只记当前轮次那一个文件；讨论未完成不能换文件，reopen 开了新轮次才能换。`;

class UsageError extends Error {}
class StateError extends Error {}

// ---------------------------------------------------------------------------
// 项目根定位
// ---------------------------------------------------------------------------

function hasStateFile(dir) {
  return fs.existsSync(path.join(dir, '.brainstorming-archify', 'state.yaml'));
}

function findRoot(explicit) {
  if (explicit) {
    const root = path.resolve(explicit);
    if (!fs.existsSync(root)) throw new UsageError(`--root 指向的目录不存在：${root}`);
    return root;
  }
  let dir = process.cwd();
  while (true) {
    if (hasStateFile(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new UsageError(
    '找不到 .brainstorming-archify/state.yaml（已从当前目录向上找到文件系统根）。'
    + '先用 init 建库，或用 --root 指定项目根。',
  );
}

function findRootForInit(explicit) {
  if (explicit) {
    const root = path.resolve(explicit);
    if (!fs.existsSync(root)) throw new UsageError(`--root 指向的目录不存在：${root}`);
    return root;
  }
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, '.brainstorming-archify'))) return dir;
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

/** 设计文档路径：项目内相对 POSIX 路径，拒绝绝对路径 / 盘符 / `..` / 控制字符。 */
function checkDocPath(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new UsageError('文件路径不能为空');
  }
  assertCleanValue(value, '文件路径');
  if (path.isAbsolute(value) || value.startsWith('/')) {
    throw new UsageError(`文件路径必须是项目内相对路径，拒绝绝对路径：${value}`);
  }
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    throw new UsageError(`文件路径必须是项目内相对路径，拒绝盘符路径：${value}`);
  }
  if (value.split('/').includes('..')) {
    throw new UsageError(`文件路径不得包含 ..：${value}`);
  }
  if (value.includes('\\')) {
    throw new UsageError(`文件路径请用 POSIX 斜杠：${value}`);
  }
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// 子命令
// ---------------------------------------------------------------------------

function cmdInit(root) {
  const existing = readStateFile(root);
  if (existing) {
    throw new StateError(
      `state.yaml 已存在（state=${existing.state}，登记 ${existing.files.length} 个文件）。`
      + 'init 不覆盖既有状态；确要重来请先删除该文件。',
    );
  }
  const full = writeStateFile(root, {
    state: 'explore',
    files: [],
    change_list: { path: '', set_at: '' },
    reopens: [],
    log: [],
    task_md: { path: '', generated_at: '' },
  });
  process.stdout.write(`已建库：${full}\n状态：explore（纯讨论，无产物落盘）\n`);
  return 0;
}

function cmdFile(root, filePath, status) {
  if (!FILE_STATUSES.includes(status)) {
    throw new UsageError(`status 取值非法：${status}（合法值：${FILE_STATUSES.join(' / ')}）`);
  }
  checkDocPath(filePath);
  const state = readStateFile(root);
  if (!state) throw new StateError('state.yaml 不存在，先跑 init');
  const found = state.files.find((f) => f.path === filePath);
  if (found) {
    found.status = status;
  } else {
    state.files.push({ path: filePath, status });
  }
  writeStateFile(root, state);
  process.stdout.write(`${filePath} → ${status}\n`);
  return 0;
}

function preconditionError(action, offenders) {
  return new StateError(
    `不能推进到 ${action}：${offenders.map((f) => `${f.path}（${f.status}）`).join('、')}。`
    + '请先把这些文件推到目标状态。',
  );
}

/**
 * 设置当前轮次的 change-list 文件（state.yaml 里唯一的 change_list 指针）。
 * 切到**不同**文件只在「还没有当前文件」或「当前 set_at 早于最后一次 reopen」时允许。
 */
function cmdChangeList(root, relPath) {
  checkDocPath(relPath);
  const norm = relPath.replace(/^\.\//, '');
  const dirPrefix = `${CHANGE_LIST_DIR}/`;
  if (!norm.startsWith(dirPrefix)) {
    throw new UsageError(`change-list 文件必须位于 ${dirPrefix} 下：${relPath}`);
  }
  const state = readStateFile(root);
  if (!state) throw new StateError('state.yaml 不存在，先跑 init');
  const current = state.change_list?.path ?? '';
  if (current === norm) {
    process.stdout.write(`当前 change-list 已是该文件（轮内追加无需重设）：${norm}\n`);
    return 0;
  }
  if (current) {
    const lastReopen = state.reopens[state.reopens.length - 1];
    const setMs = Date.parse(state.change_list.set_at);
    const reopenMs = lastReopen ? Date.parse(lastReopen.at) : Number.NaN;
    const newRoundStarted = Number.isFinite(reopenMs) && Number.isFinite(setMs) && reopenMs > setMs;
    if (!newRoundStarted) {
      throw new StateError(
        `讨论未完成，不能切换 change-list 文件（当前：${current}）。`
        + '该轮结束（closed）后 reopen 开了新轮次，才能指向新的 change-list 文件；'
        + '同一轮里请继续追加到当前文件。',
      );
    }
  }
  if (!fs.existsSync(path.join(root, norm))) {
    throw new StateError(`change-list 文件不存在：${norm}。先在轮次开始时创建它（轮次记录），再设置指针。`);
  }
  state.change_list = { path: norm, set_at: nowIso() };
  writeStateFile(root, state);
  process.stdout.write(`当前 change-list：${norm}\n`);
  return 0;
}

function cmdAdvance(root, target, { taskMd, reason }) {
  if (!STATES.includes(target)) {
    throw new UsageError(`目标状态取值非法：${target}（合法值：${STATES.join(' / ')}）`);
  }
  if (target === 'closed' && !taskMd) {
    throw new UsageError('推进到 closed 必须带 --task-md <路径>（收口时刚生成的那份 task.md）。');
  }
  const state = readStateFile(root);
  if (!state) throw new StateError('state.yaml 不存在，先跑 init');
  if (state.state === target) {
    process.stdout.write(`状态已是 ${target}，无需推进。\n`);
    return 0;
  }
  const fromRank = STATES.indexOf(state.state);
  const toRank = STATES.indexOf(target);
  const forward = toRank > fromRank;

  if (forward) {
    if (toRank !== fromRank + 1) {
      throw new StateError(
        `正向推进只能走一步：${state.state} → ${STATES[fromRank + 1]}，不接受直接跳到 ${target}。`,
      );
    }
    if (target === 'draft') {
      if (state.files.length === 0) {
        throw new StateError('不能推进到 draft：还没有登记任何文件。');
      }
      const bad = state.files.filter((f) => f.status === 'discussing');
      if (bad.length) throw preconditionError('draft', bad);
    }
    if (target === 'confirm') {
      if (state.files.length === 0) {
        throw new StateError('不能推进到 confirm：还没有登记任何文件。');
      }
      const bad = state.files.filter((f) => f.status !== 'confirmed');
      if (bad.length) throw preconditionError('confirm', bad);
    }
    if (target === 'closed') {
      checkDocPath(taskMd);
      const full = path.join(root, taskMd);
      if (!fs.existsSync(full)) {
        throw new StateError(`不能推进到 closed：task.md 不存在（${taskMd}）。请先生成它。`);
      }
      const lastReopen = state.reopens[state.reopens.length - 1];
      if (lastReopen) {
        const reopenMs = Date.parse(lastReopen.at);
        const taskMs = fs.statSync(full).mtimeMs;
        if (!(taskMs > reopenMs)) {
          throw new StateError(
            `不能推进到 closed：${taskMd} 的修改时间不晚于最后一次重开（${lastReopen.at}）。`
            + '重开会作废 task.md，请重新生成后再收口。',
          );
        }
      }
      // 收口要求本轮有唯一的 change-list 文件（轮次记录）且在盘上
      const cl = state.change_list?.path ?? '';
      if (!cl) {
        throw new StateError(
          '不能推进到 closed：还没有设置当前 change-list 文件。'
          + '每轮开始时应创建轮次记录文件并跑 change-list <路径>。',
        );
      }
      if (!fs.existsSync(path.join(root, cl))) {
        throw new StateError(`不能推进到 closed：当前 change-list 文件不在盘上（${cl}）。`);
      }
      state.task_md = { path: taskMd, generated_at: nowIso() };
    }
  } else {
    // 回退：多天讨论的修订是常态，但必须留原因
    if (!reason || reason.trim() === '') {
      throw new UsageError(`回退到 ${target} 必须带 --reason "<原因>"。`);
    }
  }

  state.state = target;
  state.log = [...(state.log ?? []), { at: nowIso(), from: STATES[fromRank], to: target, reason: reason ?? '' }];
  writeStateFile(root, state);
  process.stdout.write(`状态：${STATES[fromRank]} → ${target}\n`);
  return 0;
}

function cmdReopen(root, filePaths, reason) {
  if (filePaths.length === 0) {
    throw new UsageError('reopen 至少要点一个文件。');
  }
  if (!reason || reason.trim() === '') {
    throw new UsageError('reopen 必须带 --reason "<原因>"（为什么重开）。');
  }
  const state = readStateFile(root);
  if (!state) throw new StateError('state.yaml 不存在，先跑 init');
  const cleaned = filePaths.map((p) => checkDocPath(p));
  for (const p of cleaned) {
    const found = state.files.find((f) => f.path === p);
    if (found) {
      found.status = 'discussing';
    } else {
      state.files.push({ path: p, status: 'discussing' });
    }
  }
  const from = state.state;
  state.state = 'explore';
  state.reopens = [...(state.reopens ?? []), { at: nowIso(), reason, files: cleaned }];
  state.log = [...(state.log ?? []), { at: nowIso(), from, to: 'explore', reason: `reopen: ${reason}` }];
  writeStateFile(root, state);
  process.stdout.write(
    `已重开 ${cleaned.length} 个文件（其余文件状态不变）：\n`
    + cleaned.map((p) => `  ${p} → discussing`).join('\n')
    + `\n状态：${from} → explore\n`,
  );
  return 0;
}

function cmdShow(root, json) {
  const state = readStateFile(root);
  if (!state) throw new StateError('state.yaml 不存在，先跑 init');
  if (json) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      state: state.state,
      files: state.files,
      change_list: state.change_list,
      reopens: state.reopens.length,
      task_md: state.task_md,
    }, null, 2)}\n`);
    return 0;
  }
  const counts = {};
  for (const f of state.files) counts[f.status] = (counts[f.status] ?? 0) + 1;
  process.stdout.write([
    `State: ${state.state}`,
    `Files: ${state.files.length}（${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' / ') || '无'}）`,
    ...state.files.map((f) => `  ${f.status}\t${f.path}`),
    `ChangeList: ${state.change_list?.path || '（未设置）'}`,
    `Reopens: ${state.reopens.length}`,
    ...(state.task_md.path ? [`Task.md: ${state.task_md.path}（${state.task_md.generated_at}）`] : []),
  ].join('\n') + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

function parse(argv) {
  let root = null;
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) throw new UsageError('--root 需要一个目录参数。');
      root = value;
      i += 1;
    } else if (arg.startsWith('--root=')) {
      root = arg.slice('--root='.length);
      if (!root) throw new UsageError('--root 需要一个目录参数。');
    } else {
      rest.push(arg);
    }
  }
  // 余下参数里的 --json / --task-md / --reason
  let json = false;
  let taskMd = null;
  let reason = null;
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--task-md') {
      const value = rest[i + 1];
      if (!value || value.startsWith('-')) throw new UsageError('--task-md 需要一个路径参数。');
      taskMd = value;
      i += 1;
    } else if (arg.startsWith('--task-md=')) {
      taskMd = arg.slice('--task-md='.length);
      if (!taskMd) throw new UsageError('--task-md 需要一个路径参数。');
    } else if (arg === '--reason') {
      const value = rest[i + 1];
      if (value === undefined) throw new UsageError('--reason 需要一个字符串参数。');
      reason = value;
      i += 1;
    } else if (arg.startsWith('--reason=')) {
      reason = arg.slice('--reason='.length);
    } else if (arg === '--help' || arg === '-h') {
      positional.push('--help');
    } else if (arg.startsWith('-')) {
      throw new UsageError(`未知参数 "${arg}"。`);
    } else {
      positional.push(arg);
    }
  }
  return { root, json, taskMd, reason, positional };
}

export function run(argv = process.argv.slice(2)) {
  try {
    const { root, json, taskMd, reason, positional } = parse(argv);
    const sub = positional[0];
    if (!sub || sub === '--help') {
      process.stdout.write(`${USAGE}\n`);
      return sub === '--help' ? 0 : 2;
    }
    if (sub === 'init') {
      return cmdInit(findRootForInit(root));
    }
    const projectRoot = findRoot(root);
    if (sub === 'file') {
      if (positional.length !== 3) throw new UsageError('file 需要两个参数：<路径> <状态>。');
      return cmdFile(projectRoot, positional[1], positional[2]);
    }
    if (sub === 'change-list') {
      if (positional.length !== 2) throw new UsageError('change-list 需要一个参数：<路径>。');
      return cmdChangeList(projectRoot, positional[1]);
    }
    if (sub === 'advance') {
      if (positional.length !== 2) throw new UsageError('advance 需要一个参数：<目标状态>。');
      return cmdAdvance(projectRoot, positional[1], { taskMd, reason });
    }
    if (sub === 'reopen') {
      return cmdReopen(projectRoot, positional.slice(1), reason);
    }
    if (sub === 'show') {
      return cmdShow(projectRoot, json);
    }
    throw new UsageError(`未知子命令 "${sub}"。`);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    if (error instanceof StateError || error instanceof StateYamlError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    process.stderr.write(`未预期的错误：${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    return 1;
  }
}

// 仅直接执行时跑 CLI；被 import 时不执行（便于用例复用纯函数）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv.slice(2));
}
