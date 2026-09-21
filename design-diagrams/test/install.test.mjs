/**
 * install.mjs —— 一键安装脚本用例（任务 4.1）
 * ============================================================================
 *
 * 被测对象：仓库根 `install.mjs`
 *   node install.mjs                → 装 brainstorming 与 design-diagrams 到默认目标
 *   node install.mjs --dry-run      → 只列文件与目标路径，不改盘
 *   node install.mjs --target <dir> → 指定安装根目录（演练）
 *   node install.mjs --help         → 用法
 *
 * 覆盖（与任务简报验收逐条对应）
 * ------------------------------
 *   A. 纯函数：Node 主版本判定（17.9.0 不达、18.0.0 恰好达标）、自检 SVG 断言器。
 *   B. `--help`：退出码 0，用法里出现 `--dry-run` / `--target` 与默认目标。
 *   C. `--dry-run --target`：退出码 0，列全两技能待写文件与目标路径，且**目标目录不被创建**。
 *   D. `--dry-run`（默认目标）：列出 `~/.codebuddy/skills`，且**全局技能目录零改动**。
 *   E. 未知参数：非零退出码。
 *   F. Node 主版本 < 18（环境变量注入版本号）：非零退出码，报出所需版本与当前版本，
 *      且**不创建任何目标目录/文件**（硬门在写盘之前）。
 *   G. Node 主版本 = 18：允许（dry-run 退出码 0），证明 18 是最低允许值。
 *   H. `--target` 真实安装：退出码 0；两技能文件齐备且与仓库逐字节一致；
 *      无 `node_modules`；自检通过；全局技能目录零改动。
 *   I. 安装后的技能**独立**渲染：在安装目标（无 `node_modules`）里跑 `svg` 子命令，
 *      产物非空、含根元素、含内联样式——直接证明自检路径不依赖 `node_modules`。
 *
 * 关于 Node 版本判定的验证方式与局限
 * ----------------------------------
 * 本机是 Node v24，无法真的降版本。脚本支持用环境变量
 * `DESIGN_DIAGRAMS_NODE_VERSION` 覆盖「用于版本判定的版本号」（测试/诊断钩子），
 * 用例据此以子进程方式验证非零退出码与「不写文件」。局限：它验证的是脚本的判定
 * 与分支行为，不是真实低版本 Node 运行时下的兼容性（那需要真装一个 Node 16）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..'); // design-diagrams/
const REPO_ROOT = path.resolve(SKILL_ROOT, '..'); // 仓库根
const INSTALL = path.join(REPO_ROOT, 'install.mjs');
const GLOBAL_SKILLS = path.join(os.homedir(), '.codebuddy', 'skills');

/** brainstorming 技能：仓库根这四份文件。 */
const BRAINSTORMING_FILES = [
  'SKILL.md',
  'architecture-doc-template.md',
  'module-doc-template.md',
  'design-doc-reviewer-prompt.md',
];

/** 遍历时一律跳过的目录名（`node_modules` 未安装、`.git` 不属于技能内容）。 */
const SKIP_DIRS = new Set(['node_modules', '.git']);

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** 以子进程方式跑安装脚本；可注入环境变量覆盖版本判定。 */
function runInstall(args, options = {}) {
  return spawnSync(process.execPath, [INSTALL, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

/** 递归列出文件相对路径（排序、跳过 SKIP_DIRS）。 */
function walkFiles(root, rel = '') {
  const out = [];
  const entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walkFiles(root, childRel));
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out.sort();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 顶层清单快照：用于证明全局技能目录未被本次运行改动。 */
function snapshotGlobalSkills() {
  if (!fs.existsSync(GLOBAL_SKILLS)) return null;
  return fs
    .readdirSync(GLOBAL_SKILLS, { withFileTypes: true })
    .map((entry) => {
      const stat = fs.statSync(path.join(GLOBAL_SKILLS, entry.name));
      return `${entry.isDirectory() ? 'd' : '-'} ${entry.name} ${stat.size} ${stat.mtimeMs}`;
    })
    .sort();
}

/** 安装目标里某个技能目录下、与仓库对应目录逐字节一致的比对。 */
function assertTreeIdentical(repoDir, installedDir) {
  const repoFiles = walkFiles(repoDir);
  const installedFiles = walkFiles(installedDir);
  assert.deepEqual(installedFiles, repoFiles, '安装后的文件清单应与仓库一致');
  const mismatched = repoFiles.filter(
    (rel) => sha256(path.join(repoDir, rel)) !== sha256(path.join(installedDir, rel)),
  );
  assert.deepEqual(mismatched, [], `以下文件与仓库不一致：${mismatched.join(', ')}`);
}

// ---------------------------------------------------------------------------
// A. 纯函数
// ---------------------------------------------------------------------------

test('A1. Node 主版本判定：17 不达标、18 恰好达标、非法输入报错', async () => {
  const { checkNodeVersion, REQUIRED_NODE_MAJOR } = await import(pathToFileURL(INSTALL).href);
  assert.equal(REQUIRED_NODE_MAJOR, 18);

  assert.equal(checkNodeVersion('24.19.0').ok, true);
  assert.equal(checkNodeVersion('v24.19.0').major, 24);
  assert.equal(checkNodeVersion('18.0.0').ok, true, '18.0.0 是允许的最低版本');
  assert.equal(checkNodeVersion('v18.1.2').ok, true);
  assert.equal(checkNodeVersion('17.9.9').ok, false, '17 必须被判为不达标');
  assert.equal(checkNodeVersion('16.20.2').ok, false);
  assert.equal(checkNodeVersion('16.20.2').required, 18);
  assert.throws(() => checkNodeVersion('not-a-version'), /版本/);
});

test('A2. 自检 SVG 断言器：非空 / 含根元素 / 含内联样式', async () => {
  const { inspectSelfCheckSvg } = await import(pathToFileURL(INSTALL).href);

  const good = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:red}</style><rect/></svg>';
  const goodResult = inspectSelfCheckSvg(good);
  assert.deepEqual(
    { nonEmpty: goodResult.nonEmpty, hasRootElement: goodResult.hasRootElement, hasInlineStyle: goodResult.hasInlineStyle },
    { nonEmpty: true, hasRootElement: true, hasInlineStyle: true },
  );

  assert.equal(inspectSelfCheckSvg('').nonEmpty, false, '空串必须判为非空断言失败');
  assert.equal(inspectSelfCheckSvg('<html><body></body></html>').hasRootElement, false);
  assert.equal(inspectSelfCheckSvg('<svg><style></style></svg>').hasInlineStyle, false, '空 <style> 不算内联样式');
});

// ---------------------------------------------------------------------------
// B/C/D/E. 用法、预演、默认目标、未知参数
// ---------------------------------------------------------------------------

test('B. `--help`：退出码 0，用法含子命令与默认目标', () => {
  const result = runInstall(['--help']);
  assert.equal(result.status, 0, `--help 退出码应为 0：${result.stderr}`);
  assert.match(result.stdout, /--dry-run/, '用法里应含 --dry-run');
  assert.match(result.stdout, /--target/, '用法里应含 --target');
  assert.ok(
    result.stdout.includes(path.join('.codebuddy', 'skills')),
    `用法里应写出默认目标：${result.stdout}`,
  );
  assert.match(result.stdout, /brainstorming/);
  assert.match(result.stdout, /design-diagrams/);
});

test('C. `--dry-run --target`：列全两技能文件与目标路径，但不创建目标', () => {
  const parent = mkTmp('dd-install-dry-');
  const target = path.join(parent, 'skills');
  try {
    const result = runInstall(['--dry-run', '--target', target]);
    assert.equal(result.status, 0, `--dry-run 退出码应为 0：${result.stderr}`);

    for (const name of BRAINSTORMING_FILES) {
      const dest = path.join(target, 'brainstorming', name);
      assert.ok(result.stdout.includes(dest), `预演应列出 ${dest}`);
    }
    const sample = path.join(target, 'design-diagrams', 'bin', 'design-diagrams.mjs');
    assert.ok(result.stdout.includes(sample), `预演应列出 ${sample}`);

    // 文件数应为两技能之和
    const expected = BRAINSTORMING_FILES.length + walkFiles(SKILL_ROOT).length;
    assert.ok(
      result.stdout.includes(String(expected)),
      `预演应报出待写文件总数 ${expected}：${result.stdout.slice(-400)}`,
    );

    assert.equal(fs.existsSync(target), false, `预演不得创建目标目录：${target}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('D. `--dry-run`（默认目标）：列出 `~/.codebuddy/skills` 且全局目录零改动', () => {
  const before = snapshotGlobalSkills();
  const result = runInstall(['--dry-run']);
  assert.equal(result.status, 0, `--dry-run 退出码应为 0：${result.stderr}`);
  assert.ok(
    result.stdout.includes(path.join(GLOBAL_SKILLS, 'brainstorming', 'SKILL.md')),
    `默认目标应为 ~/.codebuddy/skills：${result.stdout.slice(0, 400)}`,
  );
  assert.deepEqual(snapshotGlobalSkills(), before, '默认目标预演不得改动全局技能目录');
});

test('E. 未知参数：非零退出码并给出用法', () => {
  const result = runInstall(['--nope']);
  assert.notEqual(result.status, 0, '未知参数必须非零退出');
  assert.match(`${result.stdout}${result.stderr}`, /--dry-run|用法|未知/, '应给出用法或未知参数提示');
});

// ---------------------------------------------------------------------------
// F/G. Node 版本硬门
// ---------------------------------------------------------------------------

test('F. Node 主版本 < 18：非零退出、报出所需与当前版本、不写任何文件', () => {
  const parent = mkTmp('dd-install-low-');
  const target = path.join(parent, 'skills');
  const before = snapshotGlobalSkills();
  try {
    const result = runInstall(['--target', target], {
      env: { DESIGN_DIAGRAMS_NODE_VERSION: '16.20.2' },
    });
    const combined = `${result.stdout}${result.stderr}`;
    assert.notEqual(result.status, 0, '版本不达标必须非零退出');
    assert.ok(combined.includes('18'), `应报出所需版本 18：${combined}`);
    assert.ok(combined.includes('16.20.2'), `应报出当前版本：${combined}`);
    assert.equal(fs.existsSync(target), false, `版本不达标不得写任何文件：${target}`);
    assert.deepEqual(snapshotGlobalSkills(), before, '版本不达标不得改动全局技能目录');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('G. Node 主版本 = 18：恰好达标，允许继续', () => {
  const parent = mkTmp('dd-install-min-');
  const target = path.join(parent, 'skills');
  try {
    const result = runInstall(['--dry-run', '--target', target], {
      env: { DESIGN_DIAGRAMS_NODE_VERSION: '18.0.0' },
    });
    assert.equal(result.status, 0, `18.0.0 应达标：${result.stdout}${result.stderr}`);
    assert.equal(fs.existsSync(target), false, '预演仍不得创建目标');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// H/I. 真实安装与安装后自检
// ---------------------------------------------------------------------------

test('H. `--target` 真实安装：两技能齐备、逐字节一致、自检通过、全局目录零改动', () => {
  const parent = mkTmp('dd-install-real-');
  const target = path.join(parent, 'skills');
  const before = snapshotGlobalSkills();
  try {
    const result = runInstall(['--target', target]);
    assert.equal(result.status, 0, `真实安装退出码应为 0：${result.stdout}${result.stderr}`);

    // 打印两个技能路径
    assert.ok(result.stdout.includes(path.join(target, 'brainstorming')), '应打印 brainstorming 路径');
    assert.ok(result.stdout.includes(path.join(target, 'design-diagrams')), '应打印 design-diagrams 路径');

    // 自检结论
    assert.match(result.stdout, /自检[：:].*通过/, `应打印自检通过结论：${result.stdout}`);

    // brainstorming：四份文件逐字节一致
    const installedBrainstorming = path.join(target, 'brainstorming');
    for (const name of BRAINSTORMING_FILES) {
      const dest = path.join(installedBrainstorming, name);
      assert.ok(fs.existsSync(dest), `缺文件：${dest}`);
      assert.equal(sha256(dest), sha256(path.join(REPO_ROOT, name)), `${name} 与仓库不一致`);
    }

    // design-diagrams：整树逐字节一致，且不带 node_modules
    const installedDiagrams = path.join(target, 'design-diagrams');
    assertTreeIdentical(SKILL_ROOT, installedDiagrams);
    assert.equal(fs.existsSync(path.join(installedDiagrams, 'node_modules')), false, '不得安装 node_modules');

    // 边界：不得写全局技能目录
    assert.deepEqual(snapshotGlobalSkills(), before, '真实安装（--target）不得改动全局技能目录');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('I. 安装目标（无 node_modules）里的技能可独立渲染，产物非空/含根元素/含内联样式', () => {
  const parent = mkTmp('dd-install-run-');
  const target = path.join(parent, 'skills');
  const outDir = path.join(parent, 'out');
  try {
    const install = runInstall(['--target', target]);
    assert.equal(install.status, 0, `安装应成功：${install.stdout}${install.stderr}`);

    const installedSkill = path.join(target, 'design-diagrams');
    assert.equal(fs.existsSync(path.join(installedSkill, 'node_modules')), false, '安装目标里不应有 node_modules');

    const cli = path.join(installedSkill, 'bin', 'design-diagrams.mjs');
    const ir = path.join(installedSkill, 'examples', 'web-app.architecture.json');
    const outSvg = path.join(outDir, 'selfcheck.svg');
    const render = spawnSync(process.execPath, [cli, 'svg', 'architecture', ir, outSvg], {
      cwd: installedSkill,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(render.status, 0, `安装后的技能应能独立渲染：${render.stdout}${render.stderr}`);

    const svg = fs.readFileSync(outSvg, 'utf8');
    assert.ok(svg.length > 0, '产物不得为空');
    assert.match(svg, /<svg[\s>]/, '产物应含根元素');
    assert.match(svg, /<style[^>]*>\s*\S/, '产物应含内联样式');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
