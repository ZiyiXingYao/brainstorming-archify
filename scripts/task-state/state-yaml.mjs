#!/usr/bin/env node
/**
 * state-yaml.mjs —— `.brainstorming-archify/state.yaml` 的序列化 / 解析
 * ============================================================================
 *
 * 本仓库**零依赖**（不装 node_modules），因此这里是一个**形状锁定**的 YAML 子集：
 * 只处理 change-state.mjs 自己发射出来的那一种形状，遇到任何其它形状**失败关闭**
 * （报出首个不符的行号），绝不猜测语义。state.yaml 只允许由 change-state.mjs 编辑，
 * 这个假设是文件头注释与 SKILL.md 共同钉住的契约。
 *
 * 发射的形状（键序固定，字符串一律双引号，反斜杠与引号转义）：
 *
 *     # brainstorming-archify 讨论状态——本文件只允许由 scripts/task-state/change-state.mjs 编辑
 *     schema_version: 1
 *     state: "explore"
 *     files:
 *       - path: "specs/design/01-架构设计.md"
 *         status: "landed"
 *     reopens:
 *       - at: "2026-10-12T13:00:00.000Z"
 *         reason: "新增调度模块"
 *         files:
 *           - "specs/design/03-调度模块.md"
 *     change_list:
 *       path: ".brainstorming-archify/change-lists/20261012T120000Z-report-export.md"
 *       set_at: "2026-10-12T12:00:00.000Z"
 *     log:
 *       - at: "2026-10-12T13:05:00.000Z"
 *         from: "explore"
 *         to: "draft"
 *         reason: ""
 *     task_md:
 *       path: "specs/design/task.md"
 *       generated_at: "2026-10-12T14:00:00.000Z"
 *
 * 空序列发射为 `[]`；空字符串照发。整行注释（首个非空格字符是 `#`）在解析时跳过。
 */

import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA_VERSION = 1;

/** 四级整体状态（有序：explore → draft → confirm → closed）。 */
export const STATES = Object.freeze(['explore', 'draft', 'confirm', 'closed']);

/** 文件三态。confirmed 蕴含 landed（推进判「全部 landed」时 confirmed 算已落盘）。 */
export const FILE_STATUSES = Object.freeze(['discussing', 'landed', 'confirmed']);

/** log 只保留最近这么多条，避免多天讨论无限增长。 */
export const LOG_CAP = 50;

/** state.yaml 相对项目根的位置。 */
export const STATE_REL = path.join('.brainstorming-archify', 'state.yaml');

/** 轮次 change-list 文件的目录（相对项目根，POSIX 形式）。 */
export const CHANGE_LIST_DIR = '.brainstorming-archify/change-lists';

export class StateYamlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateYamlError';
  }
}

// ---------------------------------------------------------------------------
// 值编解码
// ---------------------------------------------------------------------------

/** 拒绝会让行格式坏掉的控制字符（换行、制表符等）。 */
export function assertCleanValue(value, what) {
  if (/[\r\n\t]/.test(value)) {
    throw new StateYamlError(`${what} 含换行或制表符，拒绝写入：${JSON.stringify(value)}`);
  }
}

function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function unquote(raw, lineNo) {
  const text = raw.trim();
  if (!text.startsWith('"')) return text;
  if (!text.endsWith('"') || text.length < 2) {
    throw new StateYamlError(`第 ${lineNo} 行：引号字符串没有正确闭合`);
  }
  const body = text.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '\\') {
      const next = body[i + 1];
      if (next === '\\' || next === '"') {
        out += next;
        i += 1;
      } else {
        throw new StateYamlError(`第 ${lineNo} 行：不认识的转义序列 \\${next ?? ''}`);
      }
    } else {
      out += ch;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 解析（形状锁定）
// ---------------------------------------------------------------------------

function isSkippable(line) {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

/**
 * 解析 state.yaml 文本。形状不符即抛 StateYamlError（带行号）。
 *
 * @param {string} text
 * @returns {{schema_version: number, state: string, files: Array<{path:string,status:string}>,
 *   reopens: Array<{at:string,reason:string,files:string[]}>,
 *   log: Array<{at:string,from:string,to:string,reason:string}>,
 *   task_md: {path:string, generated_at:string}}}
 */
export function parseStateYaml(text) {
  const lines = text.split(/\r?\n/);
  const out = {
    schema_version: 0,
    state: '',
    files: [],
    change_list: { path: '', set_at: '' },
    reopens: [],
    log: [],
    task_md: { path: '', generated_at: '' },
  };
  let i = 0;

  const fail = (no, msg) => {
    throw new StateYamlError(`state.yaml 第 ${no} 行：${msg}`);
  };

  /** 读一个 `key: value` 或 `key:` / `key: []`，返回 {key, value|null}。 */
  const readEntry = (no, line, indent) => {
    const body = line.slice(indent);
    const m = /^([A-Za-z_][A-Za-z0-9_]*):(?:[ \t]+(.*))?$/.exec(body);
    if (!m) fail(no, `不是合法的 "键: 值" 行：${JSON.stringify(line.trim())}`);
    return { key: m[1], value: m[2] === undefined ? null : m[2] };
  };

  const readScalarSeq = (startIdx, itemIndent) => {
    // itemIndent 指向 `- ` 后的内容所在列
    const items = [];
    let j = startIdx;
    while (j < lines.length) {
      const line = lines[j];
      if (isSkippable(line)) { j += 1; continue; }
      const indent = /^[ \t]*/.exec(line)[0].length;
      if (indent < itemIndent - 2) break;
      const m = new RegExp(`^[ ]{${itemIndent - 2}}- (.+)$`).exec(line);
      if (!m) fail(j + 1, `期望列表项 "- <值>"，得到：${JSON.stringify(line.trim())}`);
      items.push(unquote(m[1], j + 1));
      j += 1;
    }
    return { items, next: j };
  };

  // —— 顶层映射 ----
  while (i < lines.length) {
    const line = lines[i];
    if (isSkippable(line)) { i += 1; continue; }
    const no = i + 1;
    const { key, value } = readEntry(no, line, 0);
    if (key === 'schema_version' || key === 'state') {
      if (value === null) fail(no, `${key} 缺值`);
      out[key] = key === 'schema_version' ? Number(unquote(value, no)) : unquote(value, no);
      if (key === 'schema_version' && !Number.isInteger(out.schema_version)) fail(no, 'schema_version 必须是整数');
      i += 1;
      continue;
    }
    if (key === 'files' || key === 'reopens' || key === 'log') {
      if (value !== null && value.trim() !== '[]') fail(no, `${key} 只能是序列或 []`);
      if (value !== null) { out[key] = []; i += 1; continue; }
      // 序列体：从下一行开始，列表项缩进 2
      i += 1;
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (isSkippable(l)) { i += 1; continue; }
        const indent = /^[ \t]*/.exec(l)[0].length;
        if (indent === 0) break;
        const m = /^ {2}- (.+)$/.exec(l);
        if (!m) fail(i + 1, `期望 "  - ..." 列表项，得到：${JSON.stringify(l.trim())}`);
        const itemNo = i + 1;
        const first = m[1];
        i += 1;
        if (key === 'files') {
          //  - path: "..."  随后   status: "..."
          const pm = /^path:[ \t]+(.+)$/.exec(first);
          if (!pm) fail(itemNo, 'files 列表项第一行必须是 path');
          const item = { path: unquote(pm[1], itemNo), status: '' };
          // 读后续同属该 item 的键（缩进 4）
          while (i < lines.length) {
            const l2 = lines[i];
            if (isSkippable(l2)) { i += 1; continue; }
            if (!/^ {4}[A-Za-z_]/.test(l2)) break;
            const e = readEntry(i + 1, l2, 4);
            if (e.key === 'status') {
              if (e.value === null) fail(i + 1, 'status 缺值');
              item.status = unquote(e.value, i + 1);
            } else {
              fail(i + 1, `files 列表项不认识的键：${e.key}`);
            }
            i += 1;
          }
          if (!item.status) fail(itemNo, 'files 列表项缺 status');
          items.push(item);
          continue;
        }
        if (key === 'reopens') {
          //  - at: "..."  reason: "..."  files:（标量序列或 []）
          const am = /^at:[ \t]+(.+)$/.exec(first);
          if (!am) fail(itemNo, 'reopens 列表项第一行必须是 at');
          const item = { at: unquote(am[1], itemNo), reason: '', files: [] };
          while (i < lines.length) {
            const l2 = lines[i];
            if (isSkippable(l2)) { i += 1; continue; }
            if (!/^ {4}[A-Za-z_]/.test(l2)) break;
            const e = readEntry(i + 1, l2, 4);
            if (e.key === 'reason') {
              if (e.value === null) fail(i + 1, 'reason 缺值');
              item.reason = unquote(e.value, i + 1);
            } else if (e.key === 'files') {
              if (e.value !== null && e.value.trim() !== '[]') fail(i + 1, 'reopens.files 只能是序列或 []');
              if (e.value === null) {
                i += 1;
                const seq = readScalarSeq(i, 8);
                item.files = seq.items;
                i = seq.next;
                continue;
              }
            } else {
              fail(i + 1, `reopens 列表项不认识的键：${e.key}`);
            }
            i += 1;
          }
          items.push(item);
          continue;
        }
        // log
        const lm = /^at:[ \t]+(.+)$/.exec(first);
        if (!lm) fail(itemNo, 'log 列表项第一行必须是 at');
        const item = { at: unquote(lm[1], itemNo), from: '', to: '', reason: '' };
        while (i < lines.length) {
          const l2 = lines[i];
          if (isSkippable(l2)) { i += 1; continue; }
          if (!/^ {4}[A-Za-z_]/.test(l2)) break;
          const e = readEntry(i + 1, l2, 4);
          if (['from', 'to', 'reason'].includes(e.key)) {
            if (e.value === null) fail(i + 1, `${e.key} 缺值`);
            item[e.key] = unquote(e.value, i + 1);
          } else {
            fail(i + 1, `log 列表项不认识的键：${e.key}`);
          }
          i += 1;
        }
        items.push(item);
      }
      out[key] = items;
      continue;
    }
    if (key === 'task_md' || key === 'change_list') {
      if (value !== null) fail(no, `${key} 必须是映射`);
      i += 1;
      const fields = key === 'task_md' ? ['path', 'generated_at'] : ['path', 'set_at'];
      while (i < lines.length) {
        const l2 = lines[i];
        if (isSkippable(l2)) { i += 1; continue; }
        if (!/^ {2}[A-Za-z_]/.test(l2)) break;
        const e = readEntry(i + 1, l2, 2);
        if (fields.includes(e.key)) {
          if (e.value === null) fail(i + 1, `${e.key} 缺值`);
          out[key][e.key] = unquote(e.value, i + 1);
        } else {
          fail(i + 1, `${key} 不认识的键：${e.key}`);
        }
        i += 1;
      }
      continue;
    }
    fail(no, `不认识的顶层键：${key}`);
  }

  if (out.schema_version !== SCHEMA_VERSION) {
    throw new StateYamlError(`schema_version 必须是 ${SCHEMA_VERSION}，实际为 ${out.schema_version}`);
  }
  if (!STATES.includes(out.state)) {
    throw new StateYamlError(`state 取值非法：${JSON.stringify(out.state)}（合法值：${STATES.join(' / ')}）`);
  }
  for (const f of out.files) {
    if (!FILE_STATUSES.includes(f.status)) {
      throw new StateYamlError(`文件 ${f.path} 的 status 取值非法：${JSON.stringify(f.status)}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 发射
// ---------------------------------------------------------------------------

/**
 * 把状态对象发射为 state.yaml 文本（键序固定、确定性强，便于测试与 diff）。
 *
 * @param {{schema_version?:number, state:string, files:Array<{path:string,status:string}>,
 *   reopens?:Array<{at:string,reason:string,files:string[]}>,
 *   log?:Array<{at:string,from:string,to:string,reason:string}>,
 *   task_md?:{path:string, generated_at:string}}} state
 * @returns {string}
 */
export function emitStateYaml(state) {
  const L = [];
  L.push('# brainstorming-archify 讨论状态——本文件只允许由 scripts/task-state/change-state.mjs 编辑');
  L.push(`schema_version: ${state.schema_version ?? SCHEMA_VERSION}`);
  L.push(`state: ${quote(state.state)}`);
  if (!state.files?.length) {
    L.push('files: []');
  } else {
    L.push('files:');
    for (const f of state.files) {
      L.push(`  - path: ${quote(f.path)}`);
      L.push(`    status: ${quote(f.status)}`);
    }
  }
  const reopens = state.reopens ?? [];
  if (reopens.length === 0) {
    L.push('reopens: []');
  } else {
    L.push('reopens:');
    for (const r of reopens) {
      L.push(`  - at: ${quote(r.at)}`);
      L.push(`    reason: ${quote(r.reason)}`);
      if (!r.files?.length) {
        L.push('    files: []');
      } else {
        L.push('    files:');
        for (const f of r.files) L.push(`      - ${quote(f)}`);
      }
    }
  }
  const changeList = state.change_list ?? { path: '', set_at: '' };
  L.push('change_list:');
  L.push(`  path: ${quote(changeList.path)}`);
  L.push(`  set_at: ${quote(changeList.set_at)}`);
  const log = (state.log ?? []).slice(-LOG_CAP);
  if (log.length === 0) {
    L.push('log: []');
  } else {
    L.push('log:');
    for (const e of log) {
      L.push(`  - at: ${quote(e.at)}`);
      L.push(`    from: ${quote(e.from)}`);
      L.push(`    to: ${quote(e.to)}`);
      L.push(`    reason: ${quote(e.reason)}`);
    }
  }
  const taskMd = state.task_md ?? { path: '', generated_at: '' };
  L.push('task_md:');
  L.push(`  path: ${quote(taskMd.path)}`);
  L.push(`  generated_at: ${quote(taskMd.generated_at)}`);
  return `${L.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// 文件层小工具（读 + 原子写）
// ---------------------------------------------------------------------------

export function readStateFile(root) {
  const full = path.join(root, STATE_REL);
  if (!fs.existsSync(full)) return null;
  return parseStateYaml(fs.readFileSync(full, 'utf8'));
}

/**
 * 原子写 state.yaml：先写同目录临时文件，再 rename。失败不留半成品。
 *
 * @param {string} root
 * @param {object} state
 * @returns {string} 写入的路径
 */
export function writeStateFile(root, state) {
  const full = path.join(root, STATE_REL);
  const dir = path.dirname(full);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.state.yaml.tmp-${process.pid}`);
  try {
    fs.writeFileSync(tmp, emitStateYaml(state), 'utf8');
    fs.renameSync(tmp, full);
  } catch (error) {
    if (fs.existsSync(tmp)) {
      try { fs.unlinkSync(tmp); } catch { /* 清理失败不盖原错误 */ }
    }
    throw error;
  }
  return full;
}
