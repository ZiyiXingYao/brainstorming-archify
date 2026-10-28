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
 *   { ok, project_root, state, files, change_list: {path, set_at},
 *     next_action: {reason, command?, load?}, blockers }
 *
 * `change_list` 是当前轮次的轮次记录文件（discussion record / decisions / ledger /
 * persist authorisations）——恢复现场 = state.yaml + 这个文件；`next_action.load` 会把它列进去。
 *
 * blockers（有 blocker 时 ok=false，调用方应停下并展示修复命令，不许猜）：
 *   - NO_STATE_FILE  找不到 state.yaml
 *   - INVALID_STATE  state.yaml 形状 / 取值非法
 *   - FILE_MISSING   登记为 landed/confirmed 的文件在盘上已不存在
 *   - CHANGE_LIST_MISSING  当前 change-list 文件不在盘上（恢复用的轮次记录丢了）
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

function nextActionFor(state, { changeList = '', changeListStale = false, files = [] } = {}) {
  const load = ['SKILL.md'];
  if (changeList) load.push(changeList);
  switch (state) {
    case 'explore':
      if (changeListStale) {
        return {
          reason: '新轮次已开（reopen）：创建本轮的 change-list 轮次记录文件（讨论记录 / 重要决策 / 文件修改台账 / 落盘授权），再跑 change-list <路径> 把指针指过去。',
          command: `node "${CHANGE_STATE}" change-list .brainstorming-archify/change-lists/<UTC 时间戳>-<主题 slug>.md`,
          load,
        };
      }
      return {
        reason: '讨论进行中（explore：纯讨论，还没有设计文档落盘）。按 SKILL.md 的流程继续提问与收敛；'
          + '重要决策先记进当前 change-list 文件，避免会话中断后丢失。',
        load,
      };
    case 'draft':
      return {
        reason: '草稿已落盘（draft）：等待人工校验。逐份文档请人类过目，通过一条就把那条标记为 confirmed。',
        command: `node "${CHANGE_STATE}" file <路径> confirmed`,
        load,
      };
    case 'confirm': {
      const cases = files.find((f) => f.path === 'specs/design/03-自验用例.md');
      if (!cases || cases.status !== 'confirmed') {
        return {
          reason: '全部已确认（confirm）：先生成并评审 specs/design/03-自验用例.md'
            + '（file … landed → 自审/子代理/用户审查 → file … confirmed），确认后再生成 task.md。',
          command: `node "${CHANGE_STATE}" file specs/design/03-自验用例.md landed`,
          load,
        };
      }
      return {
        reason: '自验用例已确认（confirm）：按 SKILL.md 的 Implementation Task Split 生成/更新 specs/design/task.md，'
          + '跑 Task split 审查后再收口。',
        command: `node "${CHANGE_STATE}" advance closed --task-md specs/design/task.md`,
        load,
      };
    }
    case 'closed':
      return {
        reason: '已收口（closed）：没有进行中的讨论。要新增或修改模块，用 reopen 重开点名文件（其余确认文件不动），并为本轮创建新的 change-list 文件。',
        command: `node "${CHANGE_STATE}" reopen <路径> --reason "<原因>"`,
        load,
      };
    default:
      return { reason: `未知状态 ${state}`, load };
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
      change_list: null,
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
  // 当前轮次的 change-list 文件是恢复用的记录，缺失即 blocker
  const changeList = state.change_list?.path ?? '';
  if (changeList && !fs.existsSync(path.join(root, changeList))) {
    blockers.push({
      code: 'CHANGE_LIST_MISSING',
      message: `当前 change-list 文件在盘上已不存在：${changeList}。恢复用的轮次记录丢了——请确认它被移到哪了，并重建后跑 change-list 重新指向。`,
    });
  }
  const lastReopen = state.reopens[state.reopens.length - 1];
  const changeListStale = Boolean(
    changeList
    && lastReopen
    && Date.parse(lastReopen.at) > Date.parse(state.change_list.set_at),
  );
  return {
    ok: blockers.length === 0,
    project_root: root,
    state: state.state,
    files: state.files,
    change_list: state.change_list ?? { path: '', set_at: '' },
    reopens: state.reopens.length,
    task_md: state.task_md.path ? state.task_md : null,
    next_action: nextActionFor(state.state, { changeList, changeListStale, files: state.files }),
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
    `ChangeList: ${summary.change_list?.path || '（未设置）'}`,
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
      change_list: null,
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
        change_list: null,
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
