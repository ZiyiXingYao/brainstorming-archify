#!/usr/bin/env node
/**
 * resume-state.mjs —— 讨论状态**只读**恢复命令（中断 / 重启后续讨论）
 * ============================================================================
 *
 * 回答一个问题：「这个项目的设计讨论现在进行到哪了，下一步该干什么？」
 * 定位规则对齐 spec-superflow 的 `resolveChangeTarget`：从当前目录向上查找含
 * `.brainstorming-archify/state.yaml` 的项目根（可显式传 --root）。
 *
 * 输出（--json）形状对齐 `ssf resume` 的 Change / State / Next 三要素：
 *   { ok, project_root, state, files, next_action: {reason, command?, load?}, blockers }
 *
 * blockers（有 blocker 时 ok=false，调用方应停下并展示修复命令，不许猜）：
 *   - NO_STATE_FILE  找不到 state.yaml
 *   - INVALID_STATE  state.yaml 形状 / 取值非法
 *   - FILE_MISSING   登记为 landed/confirmed 的文件在盘上已不存在
 *
 * next_action 按四态给下一步：
 *   explore  继续讨论（纯讨论，无产物落盘）
 *   draft    等人工校验；通过后逐文件 `file <path> confirmed`
 *   confirm  生成 specs/design/task.md，再 `advance closed --task-md ...`
 *   closed   已收口；新增 / 修改模块用 `reopen <文件> --reason "<原因>"`
 *
 * **本命令只读**：全程只用 fs 的读函数，不写任何一个字节。state.yaml 的唯一写入口
 * 是 change-state.mjs——`/bsa:resume` 命令适配器也禁止直接改状态文件。
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StateYamlError, readStateFile } from './state-yaml.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHANGE_STATE = path.join(SKILL_ROOT, 'scripts', 'task-state', 'change-state.mjs');

function findRoot(explicit) {
  if (explicit) {
    const root = path.resolve(explicit);
    if (!fs.existsSync(root)) return null;
    return root;
  }
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, '.brainstorming-archify', 'state.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function nextActionFor(state) {
  switch (state) {
    case 'explore':
      return {
        reason: '讨论进行中（explore：纯讨论，还没有产物落盘）。按 SKILL.md 的流程继续提问与收敛。',
        load: ['SKILL.md'],
      };
    case 'draft':
      return {
        reason: '草稿已落盘（draft）：等待人工校验。逐份文档请人类过目，通过一条就把那条标记为 confirmed。',
        command: `node "${CHANGE_STATE}" file <路径> confirmed`,
        load: ['SKILL.md'],
      };
    case 'confirm':
      return {
        reason: '全部已确认（confirm）：只差生成实现任务清单。按 SKILL.md 的 Implementation Task Split 生成 specs/design/task.md，然后收口。',
        command: `node "${CHANGE_STATE}" advance closed --task-md specs/design/task.md`,
        load: ['SKILL.md'],
      };
    case 'closed':
      return {
        reason: '已收口（closed）：没有进行中的讨论。要新增或修改模块，用 reopen 重开点名文件（其余确认文件不动）。',
        command: `node "${CHANGE_STATE}" reopen <路径> --reason "<原因>"`,
        load: ['SKILL.md'],
      };
    default:
      return { reason: `未知状态 ${state}`, load: ['SKILL.md'] };
  }
}

function summarize(root) {
  const state = readStateFile(root);
  const blockers = [];
  if (!state) {
    return {
      ok: false,
      project_root: root,
      state: null,
      files: [],
      next_action: {
        reason: '找不到 .brainstorming-archify/state.yaml——这个项目还没有初始化讨论状态。',
        command: `node "${CHANGE_STATE}" init`,
        load: ['SKILL.md'],
      },
      blockers: [{
        code: 'NO_STATE_FILE',
        message: `在 ${root} 找不到 .brainstorming-archify/state.yaml。开始新的设计讨论前先跑 init。`,
      }],
    };
  }
  for (const f of state.files) {
    if (f.status === 'landed' || f.status === 'confirmed') {
      if (!fs.existsSync(path.join(root, f.path))) {
        blockers.push({
          code: 'FILE_MISSING',
          message: `登记为 ${f.status} 的文件在盘上已不存在：${f.path}。请确认它是被移动/改名/删除了，并用 change-state.mjs 修正登记。`,
        });
      }
    }
  }
  return {
    ok: blockers.length === 0,
    project_root: root,
    state: state.state,
    files: state.files,
    reopens: state.reopens.length,
    task_md: state.task_md.path ? state.task_md : null,
    next_action: nextActionFor(state.state),
    blockers,
  };
}

function printText(summary) {
  const files = summary.files ?? [];
  const counts = {};
  for (const f of files) counts[f.status] = (counts[f.status] ?? 0) + 1;
  const lines = [
    `Project: ${summary.project_root}`,
    `State: ${summary.state ?? 'none'}`,
    `Files: ${files.length}（${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' / ') || '无'}）`,
    ...files.map((f) => `  ${f.status}\t${f.path}`),
    summary.blockers.length === 0
      ? 'Blockers: none'
      : `Blockers: ${summary.blockers.map((b) => b.message).join('; ')}`,
    `Next: ${summary.next_action.reason}`,
  ];
  if (summary.next_action.command) lines.push(`Command: ${summary.next_action.command}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

export function run(argv = process.argv.slice(2)) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      argv,
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        root: { type: 'string' },
      },
    }));
  } catch {
    process.stderr.write('用法：node scripts/task-state/resume-state.mjs [--root <项目根>] [--json]\n');
    return 2;
  }
  if (positionals.length > 0) {
    process.stderr.write(`resume-state 不接受位置参数（收到：${values.positionals.join(' ')}）。\n`);
    return 2;
  }
  const root = findRoot(values.root);
  if (!root) {
    const summary = {
      ok: false,
      project_root: null,
      state: null,
      files: [],
      next_action: {
        reason: '找不到含 .brainstorming-archify/state.yaml 的项目根（已从当前目录向上找到文件系统根）。',
        command: `node "${CHANGE_STATE}" init`,
        load: ['SKILL.md'],
      },
      blockers: [{
        code: 'NO_STATE_FILE',
        message: '从当前目录向上找不到 .brainstorming-archify/state.yaml。开始新的设计讨论前先跑 init。',
      }],
    };
    if (values.json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      printText(summary);
    }
    return 0;
  }
  let summary;
  try {
    summary = summarize(root);
  } catch (error) {
    if (error instanceof StateYamlError) {
      summary = {
        ok: false,
        project_root: root,
        state: null,
        files: [],
        next_action: {
          reason: 'state.yaml 读不出来：形状或取值非法。它只允许由 change-state.mjs 编辑——请检查有没有被手工改坏。',
          command: `node "${CHANGE_STATE}" show`,
          load: ['SKILL.md'],
        },
        blockers: [{ code: 'INVALID_STATE', message: error.message }],
      };
    } else {
      throw error;
    }
  }
  if (values.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    printText(summary);
  }
  return 0;
}

// 仅直接执行时跑 CLI；被 import 时不执行（便于用例复用）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv.slice(2));
}
