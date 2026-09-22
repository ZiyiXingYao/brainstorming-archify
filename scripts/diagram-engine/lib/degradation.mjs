/**
 * design-diagrams —— 校验硬门的「两轮降级」判定（任务 2.4）
 * ============================================================================
 *
 * 目标错误数口径（本模块的承重定义）
 * ----------------------------------
 * 「目标错误数 = 校验诊断中错误级条目的条数，不含警告」。
 * 落到本驱动 `validate --quality showcase --json` 的实际产物上：
 *
 *   失败：{ schemaVersion, ok:false, stage, type, input, error,
 *           diagnostics:[{ code, severity, message, subject, evidence, supportedFixes }] }
 *   成功：{ schemaVersion, ok:true, command, type, input, checks:[...],
 *           composition:{ summary:{errors,warnings}, issues:[...] } }
 *
 * 因此口径实现为：**`diagnostics[]` 里 `severity === 'error'` 的条数**。
 * 成功产物没有 `diagnostics` 字段，按 0 计。`diagnostics` 里确实可能出现
 * `severity === 'warning'`（渲染器 `renderers/shared/diagnostics.mjs` 与产物检查器
 * `scripts/check-render-output.mjs` 在质量门未强制时会把几何问题降为 warning），
 * 所以「只数 error」是一条有区分度的口径。
 *
 * 两轮降级判定（经用户裁定）
 * --------------------------
 * 第 1 轮为基线；第 2 轮目标错误数 **未低于** 第 1 轮即判「连续两轮未降低」，
 * 在第 2 轮停止并报未解决项。改善（本轮回落到上一轮之下）则继续，不累计惩罚。
 *
 * 轮次状态存哪
 * ------------
 * 按「图类型 + 目标 SVG 绝对路径」为键，落在系统临时目录（`os.tmpdir()`）下的
 * `design-diagrams-progress/`，跨 CLI 调用存活；可用环境变量
 * `DESIGN_DIAGRAMS_STATE_DIR` 覆盖（用例用来隔离）。失败时**不往目标目录写任何
 * 东西**，以保住「校验不过不产出、磁盘无产物」。成功导出会清除该目标的历史。
 *
 * 本文件为**新增文件**，不修改任何上游搬运文件，也不安装任何依赖。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 错误级严重度取值。 */
export const ERROR_SEVERITY = 'error';

/** 停止原因：连续两轮目标错误数未降低。 */
export const STOP_REASON_NO_IMPROVEMENT = 'no-improvement';

/** 停止后交给用户的两个选项（本工具只呈现，不代选）。 */
export const STOP_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'keep-placeholder',
    label: '保留占位继续落盘',
    description: '接受该图当前不合格，在文档中留占位说明并继续落盘其余产物。',
  }),
  Object.freeze({
    id: 'continue-fixing',
    label: '继续修正',
    description: '继续修改该图 IR，再导出一次；目标错误数需实际下降才继续自动修正。',
  }),
]);

/** 覆盖轮次状态目录的环境变量名。 */
export const STATE_DIR_ENV = 'DESIGN_DIAGRAMS_STATE_DIR';

/** 每个目标最多保留的轮次条数（防长期积累）。 */
export const MAX_ROUNDS = 20;

/**
 * 解析本驱动 `validate --json` 的 stdout。
 * @param {string} stdout
 * @returns {object|null} 可解析为对象时返回，否则 null
 */
export function parseValidateReceipt(stdout) {
  if (typeof stdout !== 'string' || stdout.trim() === '') return null;
  try {
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 取出错误级诊断（`severity === 'error'`），归一化成稳定结构。
 * @param {object|null} receipt
 * @returns {Array<{code: string, message: string, subject: object, evidence: object, supportedFixes: string[]}>}
 */
export function errorDiagnostics(receipt) {
  const diagnostics = Array.isArray(receipt?.diagnostics) ? receipt.diagnostics : [];
  return diagnostics
    .filter((entry) => entry && entry.severity === ERROR_SEVERITY)
    .map((entry) => ({
      code: typeof entry.code === 'string' ? entry.code : 'diagnostic/unknown',
      message: typeof entry.message === 'string' ? entry.message : '',
      subject: entry.subject && typeof entry.subject === 'object' ? entry.subject : {},
      evidence: entry.evidence && typeof entry.evidence === 'object' ? entry.evidence : {},
      supportedFixes: Array.isArray(entry.supportedFixes) ? entry.supportedFixes : [],
    }));
}

/**
 * 目标错误数 = 校验诊断中错误级条目的条数（不含警告）。
 * @param {object|null} receipt
 * @returns {number}
 */
export function countTargetErrors(receipt) {
  return errorDiagnostics(receipt).length;
}

/**
 * 推进一轮并给出是否停止。
 *
 * @param {number[]} history 该目标既往各轮的目标错误数（不含本轮）
 * @param {number} currentErrors 本轮目标错误数
 * @returns {{stop: boolean, reason: string|null, round: number, currentErrors: number,
 *   previousErrors: number|null, history: number[]}}
 */
export function decideRound(history, currentErrors) {
  const prior = (Array.isArray(history) ? history : []).filter((value) => Number.isInteger(value) && value >= 0);
  const rounds = [...prior, currentErrors];
  const round = rounds.length;
  const previousErrors = round >= 2 ? rounds[round - 2] : null;
  const stop = round >= 2 && currentErrors >= previousErrors;
  return {
    stop,
    reason: stop ? STOP_REASON_NO_IMPROVEMENT : null,
    round,
    currentErrors,
    previousErrors,
    history: rounds,
  };
}

/**
 * 组装停止时的结构化回执，供调用方（`brainstorming`）解析出选择点。
 *
 * @param {{type: string, input: string, target: string, decision: object, unresolved: object[]}} params
 * @returns {object}
 */
export function buildStopReceipt({ type, input, target, decision, unresolved }) {
  return {
    schemaVersion: 1,
    ok: false,
    command: 'render',
    stage: 'validate',
    type,
    input,
    target,
    decision: {
      stop: true,
      reason: decision.reason,
      round: decision.round,
      currentErrors: decision.currentErrors,
      previousErrors: decision.previousErrors,
      history: decision.history,
    },
    unresolved,
    options: STOP_OPTIONS.map((option) => ({ ...option })),
  };
}

/**
 * 停止时的人类可读摘要（stdout 走结构化 JSON，这段走 stderr）。
 *
 * @param {{type: string, target: string, input: string, decision: object, unresolved: object[]}} params
 * @returns {string}
 */
export function formatDecisionSummary({ type, target, input, decision, unresolved }) {
  const lines = [];
  lines.push(`render: stopped auto-fixing (${decision.reason}).`);
  lines.push(`  diagram: ${type} -> ${target}`);
  lines.push(`  ir: ${input}`);
  lines.push(
    `  current errors ${decision.currentErrors}; previous errors ${decision.previousErrors}; rounds [${decision.history.join(', ')}]`,
  );
  lines.push(`  unresolved items (${unresolved.length}):`);
  for (const item of unresolved) {
    const id = item.subject?.id ? ` id="${item.subject.id}"` : '';
    const label = item.message.includes(`[${item.code}]`) ? '' : `[${item.code}]`;
    lines.push(`    -${id} ${label}${label ? ' ' : ''}${item.message}`);
  }
  lines.push('  choose one (this tool does not choose for you):');
  for (const option of STOP_OPTIONS) {
    lines.push(`    - ${option.label} (${option.id}): ${option.description}`);
  }
  return lines.join('\n');
}

/**
 * 解析状态目录：默认 `<tmpdir>/design-diagrams-progress`，可用环境变量覆盖。
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function defaultStateDir(env = process.env) {
  const override = env ? env[STATE_DIR_ENV] : undefined;
  return override ? path.resolve(String(override)) : path.join(os.tmpdir(), 'design-diagrams-progress');
}

/**
 * 轮次状态的文件键：图类型 + 目标 SVG 绝对路径的 sha256。
 * @param {string} type
 * @param {string} target
 * @returns {string}
 */
export function stateKey(type, target) {
  return crypto.createHash('sha256').update(`${type}\u0000${path.resolve(target)}`).digest('hex');
}

function stateFile(stateDir, key) {
  return path.join(stateDir, `${key}.json`);
}

/**
 * 读取某目标的既往轮次历史。读不到或损坏时按空历史处理。
 * @param {string} stateDir
 * @param {string} key
 * @returns {{rounds: number[], input: string|null}}
 */
export function readHistory(stateDir, key) {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(stateDir, key), 'utf8'));
    const rounds = Array.isArray(parsed?.rounds) ? parsed.rounds.filter((n) => Number.isInteger(n) && n >= 0) : [];
    const input = typeof parsed?.input === 'string' ? parsed.input : null;
    return { rounds, input };
  } catch {
    return { rounds: [], input: null };
  }
}

/**
 * 写入某目标的轮次历史。
 * @param {string} stateDir
 * @param {string} key
 * @param {{type: string, target: string, input: string}} meta
 * @param {number[]} rounds
 * @returns {string} 写入的文件路径
 */
export function writeHistory(stateDir, key, meta, rounds) {
  fs.mkdirSync(stateDir, { recursive: true });
  const file = stateFile(stateDir, key);
  const payload = {
    schemaVersion: 1,
    type: meta.type,
    target: meta.target,
    input: meta.input,
    rounds: rounds.slice(-MAX_ROUNDS),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

/**
 * 清除某目标的轮次历史（成功导出后调用，避免旧账误伤新图）。不存在时静默成功。
 * @param {string} stateDir
 * @param {string} key
 */
export function clearHistory(stateDir, key) {
  fs.rmSync(stateFile(stateDir, key), { force: true });
}
