#!/usr/bin/env node
/**
 * install.mjs —— 一键安装 brainstorming 与 design-diagrams 两个技能（任务 4.1）
 * ============================================================================
 *
 * 用法
 * ----
 *   node install.mjs                安装两个技能到默认目标 `<家目录>/.codebuddy/skills`
 *   node install.mjs --dry-run      只列出将写入的文件与目标路径，不修改文件系统
 *   node install.mjs --target <dir> 指定安装根目录（用于演练）
 *   node install.mjs --help         显示用法
 *
 * 装什么
 * ------
 *   - `brainstorming` 技能：仓库根的四份文件 `SKILL.md`、`architecture-doc-template.md`、
 *     `module-doc-template.md`、`design-doc-reviewer-prompt.md` → `<目标>/brainstorming/`
 *   - `design-diagrams` 技能：仓库根 `design-diagrams/` **整个目录** → `<目标>/design-diagrams/`
 *
 * 三道行为约束（对应规格「一键安装」的三个场景）
 * ----------------------------------------------
 *   1. 环境不满足：**启动先在写盘之前**检查 Node 主版本，低于 18 即以非零退出码结束，
 *      明确报出所需版本与当前版本，**不写入任何文件**。
 *   2. 安装后自检：用 `design-diagrams` 自带的示例 IR **真实渲染一张 SVG**，断言
 *      产物非空、含根元素、含内联样式；核对通过才报成功。
 *   3. 预演模式：`--dry-run` 只列文件与目标路径，**不创建目录、不写文件**。
 *
 * 自检为什么不依赖 node_modules
 * ----------------------------
 * 安装目录里**没有** `node_modules`（本仓库从不安装依赖）：出图链路（`bin/design-diagrams.mjs`
 * → `bin/archify.mjs` → `schemas/` `assets/`）全部是纯 Node。自检就是对**已安装副本**
 * 跑一次这个链路；安装目录里能出图，本身就是「不依赖 node_modules」的证据。
 *
 * 退出码
 * ------
 *   0 = 成功；1 = 环境不满足 / 安装或自检失败；2 = 用法错误（未知参数、--target 缺值）。
 *
 * 测试钩子
 * --------
 * 环境变量 `DESIGN_DIAGRAMS_NODE_VERSION` 可覆盖「用于版本判定的版本号」，仅供测试/诊断
 * （本机只有 Node 24，无法真降版本）。不设置时用 `process.versions.node`。
 *
 * 本文件为**新增文件**，不修改 `design-diagrams/` 下任何上游搬运文件，也不安装依赖。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = HERE;

/** 出图所需的最低 Node 主版本（与 `design-diagrams/SKILL.md` 第 8 节一致）。 */
export const REQUIRED_NODE_MAJOR = 18;

/** 默认安装根目录（CodeBuddy 的技能目录）。 */
export const DEFAULT_TARGET = path.join(os.homedir(), '.codebuddy', 'skills');

/** brainstorming 技能：仓库根这四份文件。 */
export const BRAINSTORMING_FILES = Object.freeze([
  'SKILL.md',
  'architecture-doc-template.md',
  'module-doc-template.md',
  'design-doc-reviewer-prompt.md',
]);

/** 两个技能在目标根下的目录名。 */
export const BRAINSTORMING_DIR = 'brainstorming';
export const DESIGN_DIAGRAMS_DIR = 'design-diagrams';

/** 安装时一律跳过的目录名：`node_modules` 未安装、`.git` 不属于技能内容。 */
const SKIP_DIRS = new Set(['node_modules', '.git']);

/** 自检用的示例（design-diagrams 自带、`archify doctor` 同款）。 */
const SELF_CHECK_TYPE = 'architecture';
const SELF_CHECK_EXAMPLE = path.join('examples', 'web-app.architecture.json');

// ---------------------------------------------------------------------------
// 版本判定
// ---------------------------------------------------------------------------

/**
 * 从版本串取主版本号。接受 `24.19.0` 与 `v24.19.0`。
 *
 * @param {string} version
 * @returns {number}
 */
export function parseNodeMajor(version) {
  const match = /^v?(\d+)(?:\.|$)/.exec(String(version ?? '').trim());
  if (!match) {
    throw new Error(`无法从 "${version}" 解析 Node 主版本号。`);
  }
  return Number(match[1]);
}

/**
 * 判断当前版本是否达标。
 *
 * @param {string} current 当前版本串（如 `24.19.0`）
 * @param {number} [required] 所需最低主版本
 * @returns {{ok: boolean, current: string, major: number, required: number}}
 */
export function checkNodeVersion(current, required = REQUIRED_NODE_MAJOR) {
  const major = parseNodeMajor(current);
  return { ok: major >= required, current: String(current).trim(), major, required };
}

/** CLI 实际使用的版本号；测试钩子优先。 */
function resolveNodeVersion() {
  const override = process.env.DESIGN_DIAGRAMS_NODE_VERSION;
  return override && override.trim() ? override.trim() : process.versions.node;
}

// ---------------------------------------------------------------------------
// 待安装清单
// ---------------------------------------------------------------------------

/** 递归列出目录下全部文件（相对路径、排序、跳过 SKIP_DIRS）。 */
function walkFiles(root, rel = '') {
  const out = [];
  const entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walkFiles(root, childRel));
    } else if (entry.isFile()) {
      out.push(childRel);
    } else {
      throw new Error(`不支持的条目类型（既非文件也非目录）：${path.join(root, childRel)}`);
    }
  }
  return out.sort();
}

/**
 * 构建安装清单：`[{ skill, rel, from }]`，`rel` 是相对**目标根**的路径。
 *
 * @param {string} [repoRoot]
 * @returns {{skill: string, rel: string, from: string}[]}
 */
export function buildManifest(repoRoot = REPO_ROOT) {
  const entries = [];
  for (const name of BRAINSTORMING_FILES) {
    entries.push({
      skill: BRAINSTORMING_DIR,
      rel: path.join(BRAINSTORMING_DIR, name),
      from: path.join(repoRoot, name),
    });
  }
  const diagramsRoot = path.join(repoRoot, DESIGN_DIAGRAMS_DIR);
  for (const rel of walkFiles(diagramsRoot)) {
    entries.push({
      skill: DESIGN_DIAGRAMS_DIR,
      rel: path.join(DESIGN_DIAGRAMS_DIR, rel),
      from: path.join(diagramsRoot, rel),
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// 用法
// ---------------------------------------------------------------------------

export function usage() {
  return `用法：
  node install.mjs                安装 brainstorming 与 design-diagrams 到默认目标
  node install.mjs --dry-run      只列出将写入的文件与目标路径，不修改文件系统
  node install.mjs --target <dir> 指定安装根目录（默认：${DEFAULT_TARGET}）
  node install.mjs --help         显示本用法

行为：
  - 启动先检查 Node 主版本，低于 ${REQUIRED_NODE_MAJOR} 时非零退出且不写入任何文件；
  - 安装两个技能到 <目标>/${BRAINSTORMING_DIR}/ 与 <目标>/${DESIGN_DIAGRAMS_DIR}/；
  - 安装后用 ${DESIGN_DIAGRAMS_DIR} 自带示例真实渲染一张 SVG 自检
    （断言非空、含根元素、含内联样式；该链路不依赖 node_modules）。

环境变量：
  DESIGN_DIAGRAMS_NODE_VERSION  覆盖用于版本判定的版本号（仅测试/诊断用）
`;
}

/**
 * 解析命令行参数。未知参数与 `--target` 缺值都记进 `errors`（由调用方决定退出码）。
 *
 * @param {string[]} argv
 * @returns {{help: boolean, dryRun: boolean, target: string, targetGiven: boolean, errors: string[]}}
 */
export function parseArgs(argv) {
  const options = { help: false, dryRun: false, target: DEFAULT_TARGET, targetGiven: false, errors: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--target') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        options.errors.push('--target 需要一个目录参数。');
      } else {
        options.target = path.resolve(value);
        options.targetGiven = true;
        i += 1;
      }
    } else if (arg.startsWith('--target=')) {
      const value = arg.slice('--target='.length);
      if (!value) {
        options.errors.push('--target 需要一个目录参数。');
      } else {
        options.target = path.resolve(value);
        options.targetGiven = true;
      }
    } else {
      options.errors.push(`未知参数 "${arg}"。`);
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// 预演与安装
// ---------------------------------------------------------------------------

/** 按技能分组计数，给预演与成功摘要共用。 */
function countsBySkill(manifest) {
  const counts = new Map();
  for (const entry of manifest) counts.set(entry.skill, (counts.get(entry.skill) ?? 0) + 1);
  return counts;
}

function summaryLine(manifest) {
  const counts = countsBySkill(manifest);
  const parts = [...counts.entries()].map(([skill, count]) => `${skill} ${count}`);
  return `${manifest.length} 个文件（${parts.join(' + ')}）`;
}

/** 预演文本：逐个列出「源文件 → 目标路径」。 */
export function renderDryRun(manifest, target) {
  const lines = ['安装预演（--dry-run）：不修改文件系统', `目标根目录：${target}`, ''];
  const counts = countsBySkill(manifest);
  for (const skill of counts.keys()) {
    lines.push(`[${skill}] → ${path.join(target, skill)}`);
    for (const entry of manifest) {
      if (entry.skill !== skill) continue;
      lines.push(`  ${entry.from} → ${path.join(target, entry.rel)}`);
    }
    lines.push('');
  }
  lines.push(`共 ${summaryLine(manifest)} 待写入。`);
  return `${lines.join('\n')}\n`;
}

/** 逐文件写入目标（保留可执行位），返回写入个数。 */
function installFiles(manifest, target) {
  let written = 0;
  for (const entry of manifest) {
    const dest = path.join(target, entry.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(entry.from, dest);
    fs.chmodSync(dest, fs.statSync(entry.from).mode & 0o777);
    written += 1;
  }
  return written;
}

// ---------------------------------------------------------------------------
// 安装后自检（真实渲染一张 SVG）
// ---------------------------------------------------------------------------

/**
 * 对一份 SVG 文本做三项结构断言。
 *
 * @param {string} text
 * @returns {{nonEmpty: boolean, hasRootElement: boolean, hasInlineStyle: boolean}}
 */
export function inspectSelfCheckSvg(text) {
  const source = typeof text === 'string' ? text : '';
  const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(source);
  return {
    nonEmpty: source.length > 0,
    hasRootElement: /<svg[\s>]/.test(source),
    hasInlineStyle: Boolean(style) && style[1].trim().length > 0,
  };
}

/**
 * 用已安装副本自带的示例 IR 真实渲染一次并断言。
 *
 * @param {{installedSkillDir: string}} params
 * @returns {{ok: true, bytes: number, example: string, checks: object}}
 */
export function runSelfCheck({ installedSkillDir }) {
  const cli = path.join(installedSkillDir, 'bin', 'design-diagrams.mjs');
  const example = path.join(installedSkillDir, SELF_CHECK_EXAMPLE);
  if (!fs.existsSync(cli)) throw new Error(`自检所需的出图入口不存在：${cli}`);
  if (!fs.existsSync(example)) throw new Error(`自检所需的示例 IR 不存在：${example}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-diagrams-install-selfcheck-'));
  try {
    const outSvg = path.join(tmpDir, 'selfcheck.svg');
    const result = spawnSync(process.execPath, [cli, 'svg', SELF_CHECK_TYPE, example, outSvg], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(
        `自检渲染失败（退出码 ${result.status}）：\n${result.stdout ?? ''}${result.stderr ?? ''}`,
      );
    }
    const svg = fs.readFileSync(outSvg, 'utf8');
    const checks = inspectSelfCheckSvg(svg);
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length > 0) {
      throw new Error(`自检断言未通过：${failed.join(', ')}`);
    }
    return { ok: true, bytes: Buffer.byteLength(svg), example, checks };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

/**
 * 主入口。**返回**退出码而不调用 `process.exit`（便于用例直接调用与断言）。
 *
 * @param {string[]} argv
 * @param {{stdout?: Function, stderr?: Function, nodeVersion?: string, repoRoot?: string}} [options]
 * @returns {number}
 */
export function run(argv = process.argv.slice(2), options = {}) {
  const stdout = options.stdout ?? ((text) => process.stdout.write(text));
  const stderr = options.stderr ?? ((text) => process.stderr.write(text));

  try {
    const args = parseArgs(argv);
    if (args.help) {
      stdout(usage());
      return 0;
    }
    if (args.errors.length > 0) {
      stderr(`${args.errors.join('\n')}\n\n${usage()}`);
      return 2;
    }

    // 硬门：版本检查在任何写盘动作之前，不满足即非零退出、一个文件都不写。
    const version = checkNodeVersion(options.nodeVersion ?? resolveNodeVersion());
    if (!version.ok) {
      stderr(
        `Node 版本不满足出图要求：需要主版本 >= ${version.required}，当前为 ${version.current}。\n`
        + '请升级 Node 后重试。本次未写入任何文件。\n',
      );
      return 1;
    }

    const manifest = buildManifest(options.repoRoot ?? REPO_ROOT);
    const target = args.target;

    if (args.dryRun) {
      stdout(renderDryRun(manifest, target));
      return 0;
    }

    stdout(`开始安装到：${target}\n`);
    const written = installFiles(manifest, target);
    stdout(`已写入 ${written === manifest.length ? summaryLine(manifest) : `${written} 个文件`}。\n`);

    const brainstormingDir = path.join(target, BRAINSTORMING_DIR);
    const diagramsDir = path.join(target, DESIGN_DIAGRAMS_DIR);

    // 自检：对**已安装副本**跑一次真实渲染。
    const selfCheck = runSelfCheck({ installedSkillDir: diagramsDir });
    stdout(
      `自检：渲染 ${SELF_CHECK_TYPE} 样例 SVG … 通过（非空 ✓ 根元素 ✓ 内联样式 ✓，${selfCheck.bytes} 字节）\n`,
    );
    stdout(`  示例 IR：${selfCheck.example}\n`);

    stdout('\n安装完成：\n');
    stdout(`  brainstorming   → ${brainstormingDir}\n`);
    stdout(`  design-diagrams → ${diagramsDir}\n`);
    return 0;
  } catch (error) {
    stderr(`安装失败：${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

// 仅直接执行时跑 CLI；被 import 时不执行（便于用例复用纯函数）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv.slice(2));
}
