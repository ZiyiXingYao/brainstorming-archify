#!/usr/bin/env node
/**
 * install.mjs —— 一键安装 brainstorming 技能
 * ============================================================================
 *
 * 用法
 * ----
 *   node scripts/install.mjs                安装到 ~/.codebuddy/skills/brainstorming
 *   node scripts/install.mjs --dry-run      只列出将写入的文件与目标路径，不修改文件系统
 *   node scripts/install.mjs --target <dir> 指定安装根目录（用于演练）
 *   node scripts/install.mjs --help         显示用法
 *
 * 装成什么形态
 * ------------
 *   目标：`<家目录>/.codebuddy/skills/brainstorming`
 *
 *     brainstorming/
 *     ├── SKILL.md                        ← skill/ 内文件**平铺**到目标根
 *     ├── design-doc-reviewer-prompt.md
 *     ├── templates/                      ← 整目录复制（三份设计文档模板）
 *     └── scripts/                        ← 整目录复制
 *         ├── install.mjs
 *         ├── sync-upstream.sh
 *         └── diagram-engine/             ← 裁剪后的绘图内核（唯一入口 bin/render.mjs）
 *
 *   仓库根的 `tests/` **不进安装**——它是仓库自测面，不是技能的一部分。
 *
 * 四道行为约束
 * ------------
 *   1. 环境不满足：**启动先在写盘之前**检查 Node 主版本，低于 18 即以非零退出码结束，
 *      明确报出所需版本与当前版本，**不写入任何文件**（`--dry-run` 同样受此硬门约束）。
 *   2. 目标已存在：先把既有目录整体备份为 `brainstorming.bak-<时间戳>`，再写入新内容，
 *      不就地覆盖、不删除用户既有文件。
 *   3. 拷贝规则：`skill/` 内文件平铺到目标根；`templates/` 与 `scripts/` 整目录复制。
 *   4. 安装后自检：对**已安装副本**执行一次 `diagram-engine doctor`，通过才报告成功。
 *
 * 自检为什么不依赖 node_modules
 * ----------------------------
 * 安装目录里**没有** node_modules（本仓库从不安装依赖）：出图链路全部是纯 Node。
 * 自检就是对**已安装副本**跑一次 `bin/render.mjs doctor`；能跑通本身就是
 * 「不依赖 node_modules」的证据。
 *
 * 退出码
 * ------
 *   0 = 成功；1 = 环境不满足 / 安装或自检失败；2 = 用法错误（未知参数、--target 缺值）。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

/** 出图所需的最低 Node 主版本。 */
export const REQUIRED_NODE_MAJOR = 18;

/** 技能目录名与默认安装位置。 */
export const SKILL_NAME = 'brainstorming';
export const DEFAULT_TARGET_ROOT = path.join(os.homedir(), '.codebuddy', 'skills');
export const DEFAULT_TARGET = path.join(DEFAULT_TARGET_ROOT, SKILL_NAME);

/** `skill/` 内文件平铺到目标根。 */
export const FLAT_SRC = 'skill';

/** 需要整目录复制的顶层目录。 */
export const WHOLE_DIRS = Object.freeze(['templates', 'scripts']);

/** 安装时一律跳过的目录名。 */
const SKIP_DIRS = new Set(['node_modules', '.git']);

/**
 * 安装时跳过的相对路径前缀：内核自带的上游回归集是**仓库自测面**，不属于技能运行时
 * （约 2.2 MB / 130 个文件）。它对出图与 doctor 自检都无用途，装进用户技能目录只是负担。
 */
const SKIP_REL_PREFIXES = Object.freeze([path.join('scripts', 'diagram-engine', 'test')]);

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
  if (!match) throw new Error(`无法从 "${version}" 解析 Node 主版本号。`);
  return Number(match[1]);
}

/**
 * 判断当前版本是否达标。
 *
 * @param {string} current
 * @param {number} [required]
 * @returns {{ok: boolean, current: string, major: number, required: number}}
 */
export function checkNodeVersion(current, required = REQUIRED_NODE_MAJOR) {
  const major = parseNodeMajor(current);
  return { ok: major >= required, current: String(current).trim(), major, required };
}

/** CLI 实际使用的版本号；测试钩子优先（本机只有 Node 24，无法真降版本）。 */
function resolveNodeVersion() {
  const override = process.env.BRAINSTORMING_NODE_VERSION;
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
 * 构建安装清单：`[{ rel, from }]`，`rel` 是相对**目标技能根**的路径。
 *
 * @param {string} [repoRoot]
 * @returns {{rel: string, from: string}[]}
 */
export function buildManifest(repoRoot = REPO_ROOT) {
  const entries = [];
  const skipped = (rel) => SKIP_REL_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(`${prefix}${path.sep}`));

  const flatRoot = path.join(repoRoot, FLAT_SRC);
  for (const rel of walkFiles(flatRoot)) {
    if (skipped(rel)) continue;
    entries.push({ rel, from: path.join(flatRoot, rel) });
  }

  for (const dir of WHOLE_DIRS) {
    const wholeRoot = path.join(repoRoot, dir);
    for (const rel of walkFiles(wholeRoot)) {
      const targetRel = path.join(dir, rel);
      if (skipped(targetRel)) continue;
      entries.push({ rel: targetRel, from: path.join(wholeRoot, rel) });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 用法
// ---------------------------------------------------------------------------

export function usage() {
  return `用法：
  node scripts/install.mjs                安装 brainstorming 技能到默认目标
  node scripts/install.mjs --dry-run      只列出将写入的文件与目标路径，不修改文件系统
  node scripts/install.mjs --target <dir> 指定安装根目录（默认：${DEFAULT_TARGET_ROOT}）
  node scripts/install.mjs --help         显示本用法

行为：
  - 启动先检查 Node 主版本，低于 ${REQUIRED_NODE_MAJOR} 时非零退出且不写入任何文件；
  - 安装到 <目标根>/${SKILL_NAME}/：skill/ 内文件平铺到该根，templates/ 与 scripts/ 整目录复制；
  - 目标技能目录已存在时，先整体备份为 ${SKILL_NAME}.bak-<时间戳>；
  - 安装后对已安装副本执行 bin/render.mjs doctor 自检（该链路不依赖 node_modules）。

环境变量：
  BRAINSTORMING_NODE_VERSION  覆盖用于版本判定的版本号（仅测试/诊断用）
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
// 预演 / 备份 / 安装
// ---------------------------------------------------------------------------

function countsByTop(manifest) {
  const counts = new Map();
  for (const entry of manifest) {
    const top = entry.rel.includes(path.sep) ? entry.rel.split(path.sep)[0] : '(技能根)';
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return counts;
}

function summaryLine(manifest) {
  const parts = [...countsByTop(manifest).entries()].map(([top, count]) => `${top} ${count}`);
  return `${manifest.length} 个文件（${parts.join(' + ')}）`;
}

/** 预演文本：逐个列出「源文件 → 目标路径」。 */
export function renderDryRun(manifest, target) {
  const lines = [
    '安装预演（--dry-run）：不修改文件系统',
    `目标技能目录：${target}`,
    '',
  ];
  for (const [top, count] of countsByTop(manifest)) {
    lines.push(`[${top}] ${count} 个文件`);
  }
  lines.push('');
  for (const entry of manifest) {
    lines.push(`  ${entry.from} → ${path.join(target, entry.rel)}`);
  }
  lines.push('');
  lines.push(`共 ${summaryLine(manifest)} 待写入。`);
  return `${lines.join('\n')}\n`;
}

/** `YYYYMMDD-HHMMSS`，用于备份目录名。 */
function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 目标已存在时整体备份，返回备份路径；不存在则返回 null。
 *
 * @param {string} target
 * @param {string} [stamp]
 * @returns {string|null}
 */
export function backupExisting(target, stamp = timestamp()) {
  if (!fs.existsSync(target)) return null;
  const backup = `${target}.bak-${stamp}`;
  if (fs.existsSync(backup)) throw new Error(`备份目标已存在，拒绝覆盖：${backup}`);
  fs.renameSync(target, backup);
  return backup;
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
// 安装后自检（对已安装副本跑 doctor）
// ---------------------------------------------------------------------------

/**
 * 对**已安装副本**执行 `diagram-engine doctor`。
 *
 * @param {{installedSkillDir: string}} params
 * @returns {{ok: true, exitCode: number, stdout: string}}
 */
export function runSelfCheck({ installedSkillDir }) {
  const entry = path.join(installedSkillDir, 'scripts', 'diagram-engine', 'bin', 'render.mjs');
  if (!fs.existsSync(entry)) throw new Error(`自检所需的绘图内核入口不存在：${entry}`);
  const result = spawnSync(process.execPath, [entry, 'doctor'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `自检失败（diagram-engine doctor 退出码 ${result.status}）：\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return { ok: true, exitCode: result.status ?? 0, stdout: result.stdout ?? '' };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

/**
 * 主入口。**返回**退出码而不调用 `process.exit`（便于用例直接调用与断言）。
 *
 * @param {string[]} argv
 * @param {{stdout?: Function, stderr?: Function, nodeVersion?: string, repoRoot?: string, stamp?: string}} [options]
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
    const backup = backupExisting(target, options.stamp ?? timestamp());
    if (backup) stdout(`目标已存在，已备份为：${backup}\n`);

    const written = installFiles(manifest, target);
    stdout(`已写入 ${written === manifest.length ? summaryLine(manifest) : `${written} 个文件`}。\n`);

    const selfCheck = runSelfCheck({ installedSkillDir: target });
    const okLines = (selfCheck.stdout.match(/^\[ok\]/gm) ?? []).length;
    stdout(`自检：diagram-engine doctor 通过（${okLines} 项检查全部 ok）\n`);

    stdout('\n安装完成：\n');
    stdout(`  ${SKILL_NAME} → ${target}\n`);
    stdout(`  入口 SKILL.md → ${path.join(target, 'SKILL.md')}\n`);
    stdout(`  绘图内核     → ${path.join(target, 'scripts', 'diagram-engine')}\n`);
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
