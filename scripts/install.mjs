#!/usr/bin/env node
/**
 * install.mjs —— 一键安装 brainstorming-archify 技能
 * ============================================================================
 *
 * 用法
 * ----
 *   node scripts/install.mjs                安装到 ~/.codebuddy/skills/brainstorming-archify
 *   node scripts/install.mjs --dry-run      只列出将写入的文件与目标路径，不修改文件系统
 *                                          （同样受 Node 主版本硬门约束）
 *   node scripts/install.mjs --target <dir> 指定技能安装目录（用于演练；不会自动追加 brainstorming-archify/）
 *                                          （默认：~/.codebuddy/skills/brainstorming-archify）
 *   node scripts/install.mjs --help         显示用法
 *
 * 装成什么形态
 * ------------
 *   目标：`<家目录>/.codebuddy/skills/brainstorming-archify`
 *
 *     brainstorming-archify/
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
 *   除技能本体外，安装器还把 **CodeBuddy 命令适配器**部署到
 *   `<家目录>/.codebuddy/commands/bsa/resume.md`（源文件在仓库 `commands/bsa/`，
 *   其中的 `__BSA_ROOT__` 占位符在部署时重写为实际技能根）——它就是 `/bsa:resume`
 *   命令：讨论被中断或跨会话重启后，用它读 `.brainstorming-archify/state.yaml`
 *   恢复现场。`--commands-dir` 可覆盖命令目录（演练用）；该目录下**其他命令原样保留**，
 *   重复安装幂等。
 *
 * 四道行为约束
 * ------------
 *   1. 环境不满足：**启动先在写盘之前**检查 Node 主版本，低于 18 即以非零退出码结束，
 *      明确报出所需版本与当前版本，**不写入任何文件**（`--dry-run` 同样受此硬门约束）。
 *   2. 目标已存在：先把既有目录整体备份为 `brainstorming-archify.bak-<时间戳>`，再写入新内容，
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
export const SKILL_NAME = 'brainstorming-archify';
export const DEFAULT_TARGET_ROOT = path.join(os.homedir(), '.codebuddy', 'skills');
export const DEFAULT_TARGET = path.join(DEFAULT_TARGET_ROOT, SKILL_NAME);

/** 仓库内的 CodeBuddy 命令适配器源目录（部署时重写 `__BSA_ROOT__`）。 */
export const COMMANDS_SRC = path.join(REPO_ROOT, 'commands');

/** 默认 CodeBuddy 命令目录（`/bsa:resume` 的落点）。 */
export const DEFAULT_COMMANDS_DIR = path.join(os.homedir(), '.codebuddy', 'commands');

/** 随安装部署的命令适配器（相对 `commands/` 的路径）。 */
export const COMMAND_FILES = Object.freeze(['bsa/resume.md']);

/** 命令适配器里的技能根占位符，部署时替换为实际技能目录。 */
export const BSA_ROOT_PLACEHOLDER = '__BSA_ROOT__';

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
const SKIP_REL_PREFIXES = Object.freeze([
  // 内核回归集是仓库自测面，不进安装。
  path.join('scripts', 'diagram-engine', 'test'),
  // 仓库维护工具（从上游 clone 后比对 SKILL.md）。安装后的布局里它没有对应物，
  // 且它会 clone 外部仓库，不该出现在用户技能目录。
  path.join('scripts', 'sync-upstream.sh'),
]);

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

  // 两份来源（平铺的 skill/ 与整目录的 templates/、scripts/）写进同一个目标根，
  // 路径撞车会让后写者静默覆盖先写者。备份与版本门都刻意避免覆盖，这里同样失败关闭。
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.rel)) {
      throw new Error(`安装清单出现重复目标路径，拒绝静默覆盖：${entry.rel}`);
    }
    seen.add(entry.rel);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 用法
// ---------------------------------------------------------------------------

export function usage() {
  return `用法：
  node scripts/install.mjs                安装 brainstorming-archify 技能到默认目标
  node scripts/install.mjs --dry-run      只列出将写入的文件与目标路径，不修改文件系统
  node scripts/install.mjs --target <dir> 指定技能安装目录（默认：${DEFAULT_TARGET}）
  node scripts/install.mjs --commands-dir <dir>  指定 CodeBuddy 命令目录（默认：${DEFAULT_COMMANDS_DIR}）
  node scripts/install.mjs --help         显示本用法

行为：
  - 启动先检查 Node 主版本，低于 ${REQUIRED_NODE_MAJOR} 时非零退出且不写入任何文件；
  - 安装到 <目标目录> 本身的根：skill/ 内文件平铺到该目录，templates/ 与 scripts/ 整目录复制。
    '--target' 传的是**技能目录**，不是它的上级——脚本不会自动追加 ${SKILL_NAME}/；
    scripts/sync-upstream.sh 是仓库维护工具，**不随安装复制**（见本文件 SKIP_REL_PREFIXES）；
  - 目标已存在时，先把它整体备份为 <目标目录名>.bak-<时间戳>，再写入；
  - 安装后对已安装副本执行 bin/render.mjs doctor 自检（该链路不依赖 node_modules）；
  - 同批部署命令适配器到 <命令目录>/bsa/resume.md（即 /bsa:resume）：源文件里的
    ${BSA_ROOT_PLACEHOLDER} 重写为实际技能根；命令目录下其他命令原样保留，重复安装幂等。

环境变量：
  BRAINSTORMING_NODE_VERSION  覆盖用于版本判定的版本号（仅测试/诊断用）
`;
}

/**
 * 解析命令行参数。未知参数与 `--target` / `--commands-dir` 缺值都记进 `errors`
 *（由调用方决定退出码）。
 *
 * @param {string[]} argv
 * @returns {{help: boolean, dryRun: boolean, target: string, targetGiven: boolean,
 *   commandsDir: string, errors: string[]}}
 */
export function parseArgs(argv) {
  const options = {
    help: false,
    dryRun: false,
    target: DEFAULT_TARGET,
    targetGiven: false,
    commandsDir: DEFAULT_COMMANDS_DIR,
    errors: [],
  };
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
    } else if (arg === '--commands-dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        options.errors.push('--commands-dir 需要一个目录参数。');
      } else {
        options.commandsDir = path.resolve(value);
        i += 1;
      }
    } else if (arg.startsWith('--commands-dir=')) {
      const value = arg.slice('--commands-dir='.length);
      if (!value) {
        options.errors.push('--commands-dir 需要一个目录参数。');
      } else {
        options.commandsDir = path.resolve(value);
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
export function renderDryRun(manifest, target, commandEntries = []) {
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
  if (commandEntries.length > 0) {
    lines.push('');
    lines.push(`[commands] ${commandEntries.length} 个文件`);
    for (const entry of commandEntries) {
      lines.push(`  ${entry.from} → ${entry.dest}`);
    }
  }
  lines.push('');
  lines.push(`共 ${summaryLine(manifest)}${commandEntries.length ? ` + 命令适配器 ${commandEntries.length} 个文件` : ''} 待写入。`);
  return `${lines.join('\n')}\n`;
}

/**
 * 构建命令适配器清单：读仓库 `commands/` 下的源文件，把 `__BSA_ROOT__` 重写为实际技能根。
 * **只碰清单内点名的文件**——命令目录下的其他命令原样保留。
 *
 * @param {string} target 技能安装目录（写进适配器的绝对路径）
 * @param {string} commandsDir 命令目录（适配器的落点）
 * @returns {{rel: string, from: string, dest: string, body: string}[]}
 */
export function buildCommandEntries(target, commandsDir = DEFAULT_COMMANDS_DIR) {
  return COMMAND_FILES.map((rel) => {
    const from = path.join(COMMANDS_SRC, rel);
    if (!fs.existsSync(from)) {
      throw new Error(`命令适配器源文件缺失：${from}`);
    }
    const raw = fs.readFileSync(from, 'utf8');
    const body = raw.split(BSA_ROOT_PLACEHOLDER).join(target);
    if (body.includes(BSA_ROOT_PLACEHOLDER)) {
      throw new Error(`命令适配器 ${rel} 重写后仍残留占位符 ${BSA_ROOT_PLACEHOLDER}`);
    }
    return { rel, from, dest: path.join(commandsDir, rel), body };
  });
}

/** 把命令适配器写进命令目录（幂等：重复安装覆盖自己那份，不动别人的）。 */
function deployCommands(entries, commandsDir) {
  for (const entry of entries) {
    const dest = path.join(commandsDir, entry.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.body, 'utf8');
  }
  return entries.length;
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
    const commandEntries = buildCommandEntries(target, args.commandsDir);

    if (args.dryRun) {
      stdout(renderDryRun(manifest, target, commandEntries));
      return 0;
    }

    stdout(`开始安装到：${target}\n`);
    const backup = backupExisting(target, options.stamp ?? timestamp());
    if (backup) stdout(`目标已存在，已备份为：${backup}\n`);

    const written = installFiles(manifest, target);
    if (written !== manifest.length) {
      throw new Error(`写入数量与清单不符（清单 ${manifest.length}，实际 ${written}）`);
    }
    stdout(`已写入 ${summaryLine(manifest)}。\n`);

    const selfCheck = runSelfCheck({ installedSkillDir: target });
    const okLines = (selfCheck.stdout.match(/^\[ok\]/gm) ?? []).length;
    stdout(`自检：diagram-engine doctor 通过（${okLines} 项检查全部 ok）\n`);

    // 命令适配器在技能自检通过之后部署：技能没装好就不注册命令。
    const commandCount = deployCommands(commandEntries, args.commandsDir);
    stdout(`已部署命令适配器 ${commandCount} 个文件到：${args.commandsDir}\n`);

    stdout('\n安装完成：\n');
    stdout(`  ${SKILL_NAME} → ${target}\n`);
    stdout(`  入口 SKILL.md → ${path.join(target, 'SKILL.md')}\n`);
    stdout(`  绘图内核     → ${path.join(target, 'scripts', 'diagram-engine')}\n`);
    stdout(`  恢复命令     → ${path.join(args.commandsDir, 'bsa', 'resume.md')}（/bsa:resume）\n`);
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
