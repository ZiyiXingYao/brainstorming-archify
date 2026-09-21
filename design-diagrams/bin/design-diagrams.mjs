#!/usr/bin/env node
/**
 * design-diagrams —— 独立 SVG 导出入口（任务 2.3）
 * ============================================================================
 *
 * 目的
 * ----
 * archify 只产出「装了一整套 HTML 外壳」的产物；它原本只在浏览器里靠
 * `viewer/export.js` 把图抽成可脱离环境独立打开的 SVG（本机没有浏览器）。
 * 本入口在 Node 侧复刻这条链路：
 *
 *   node design-diagrams/bin/design-diagrams.mjs svg <type> <ir.json> <out.svg>
 *
 *   校验（archify validate --quality showcase）→ 子进程渲染到临时 HTML
 *   → 切出 <svg> → 组装（内联字体 + 规则 + 双主题变量 + 背景）→ 原子写入
 *   <out.svg>，并把 IR 逐字节落盘为同目录同名 <out.json>。
 *
 * 为什么按「第一个 <svg> 到第一个 </svg> 加 6」切片
 * ------------------------------------------------
 * 渲染产物 HTML 里 `<svg` 与 `</svg>` 各恰好出现 1 次（已实测），所以切片确定可靠；
 * 若上游结构变化导致次数不为 1，本入口**抛错**而不是猜一个。
 *
 * 注入顺序为什么不能变（与上游浏览器版 viewer/export.js 逐字一致）
 * --------------------------------------------------------------
 * 过滤后的规则里默认深色块选择器是 `:root, [data-theme="dark"]`（权重 0,1,0）。
 * 解析出的变量若放在过滤规则之前、或只用 `svg`（0,0,1）这个选择器，会被那份
 * 深色块**反向覆盖**，症状是「浅色模式失效」。故变量必须放在过滤规则**之后**，
 * 且用 `:root, svg` 组合选择器。上游源码注释点名了这个坑（export.js 的
 * "IMPORTANT: inject the resolved variables AFTER hostStyle ... Keep this order."）。
 *
 * 原子性
 * ------
 * 校验 / 渲染 / 组装任一环节失败都**不动目标文件**（且不留半成品）：候选先写进
 * 目标同目录的 staging 目录，全部就绪后再 rename 提交；提交阶段若第二步失败，
 * 已提交的第一步会回滚、既有文件被还原。
 *
 * 本文件为**新增文件**，不修改 `bin/` 下任何上游搬运文件，也不安装任何依赖。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { extractFontCss, extractSvgCssFromHtml } from '../svg/css-extract.mjs';
import { PRESETS, resolveThemeVarsFromHtml } from '../svg/theme-vars.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const ARCHIFY = path.join(SKILL_ROOT, 'bin', 'archify.mjs');

/** 支持的图类型（与上游 rendererPath 的集合一致）。 */
export const TYPES = Object.freeze(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);

/** XML 声明头：上游浏览器版无条件写，pins UTF-8，防非 ASCII 被猜错编码。 */
const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n';

/** 根元素命名空间。 */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** 上游浏览器版写死的字体族声明（逐字一致）。 */
const SVG_FONT_FAMILY =
  "svg { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, "
  + "'DejaVu Sans Mono', 'Liberation Mono', 'Noto Sans Mono CJK SC', 'PingFang SC', "
  + "'Hiragino Sans GB', 'Microsoft YaHei', monospace; }";

/** 背景 rect 的填充规则（跟随 --bg，随媒体查询切换）。 */
const BG_RECT_RULE = 'rect.c-bg-rect { fill: var(--bg); }';

/** 背景 rect 元素（放在 <style> 之后作为第二个子节点）。 */
const BG_RECT_ELEMENT = '<rect class="c-bg-rect" width="100%" height="100%"/>';

/**
 * XML 文本转义：`&` `<` `>` 与 `\r`。与浏览器 `XMLSerializer` 对 Text 节点的处理一致。
 * 关键用途：字体 CSS 的授权注释里含裸 `&`（"PERMISSION & CONDITIONS"），不转义则
 * 内含 `<style>` 的独立 SVG 不是良构 XML。
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeXmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;');
}

/** 统计子串出现次数。 */
function countOccurrences(haystack, needle) {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * 从渲染产物 HTML 中切出 `<svg>…</svg>`。
 * `<svg` 与 `</svg>` 必须各恰好出现 1 次，否则抛错（不猜）。
 *
 * @param {string} html
 * @returns {string}
 */
export function extractSvgFromHtml(html) {
  const openCount = countOccurrences(html, '<svg');
  const closeCount = countOccurrences(html, '</svg>');
  if (openCount !== 1 || closeCount !== 1) {
    throw new Error(
      `渲染产物里 <svg> 结构不符合预期（<svg=${openCount}, </svg>=${closeCount}，应为 1/1）：上游渲染器结构可能已变更。`,
    );
  }
  const start = html.indexOf('<svg');
  const end = html.indexOf('</svg>') + '</svg>'.length;
  return html.slice(start, end);
}

/** 取 SVG 根元素起始标签原文（到第一个不在引号内的 `>`）。 */
function rootOpenTag(svg) {
  const start = svg.indexOf('<svg');
  if (start === -1) throw new Error('找不到 <svg 根元素。');
  let i = start + 1;
  let quote = null;
  while (i < svg.length) {
    const c = svg[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return svg.slice(start, i + 1);
    }
    i += 1;
  }
  throw new Error('根元素起始标签未闭合。');
}

/**
 * 读根元素 `data-preset`（缺省 `classic`）。渲染器已把预设写到根上。
 * @param {string} rootTag
 * @returns {string}
 */
export function presetFromRootTag(rootTag) {
  const match = rootTag.match(/\sdata-preset\s*=\s*"([^"]*)"/);
  return match && match[1] ? match[1] : 'classic';
}

/**
 * 由 viewBox 推出 width / height（取后两个数）。
 * @param {string} rootTag
 * @returns {{width: string, height: string}}
 */
export function dimensionsFromRootTag(rootTag) {
  const match = rootTag.match(/\sviewBox\s*=\s*"([^"]*)"/);
  if (!match) throw new Error('根元素缺 viewBox，无法推出 width/height。');
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value)) || parts[2] <= 0 || parts[3] <= 0) {
    throw new Error(`根元素 viewBox 非法："${match[1]}"。`);
  }
  return { width: String(parts[2]), height: String(parts[3]) };
}

/**
 * 重写根元素起始标签：移除 `data-theme`，设置 `xmlns` / `width` / `height`
 * （先删同名旧属性再加，避免重复）。`data-preset` 保留。
 *
 * @param {string} rootTag
 * @returns {string}
 */
export function rewriteRootTag(rootTag) {
  const { width, height } = dimensionsFromRootTag(rootTag);
  let inner = rootTag.slice(1, -1); // 去掉首 '<' 与尾 '>'
  inner = inner.replace(/\s+data-theme\s*=\s*("[^"]*"|'[^']*')/g, '');
  inner = inner.replace(/\s+(?:width|height|xmlns)\s*=\s*("[^"]*"|'[^']*')/g, '');
  return `<${inner} width="${width}" height="${height}" xmlns="${SVG_NAMESPACE}">`;
}

/**
 * 变量对象 → CSS 声明串（`name: value;` 以单空格分隔），与上游浏览器版一致。
 * @param {Record<string, string>} vars
 * @returns {string}
 */
export function formatVars(vars) {
  return Object.entries(vars).map(([name, value]) => `${name}: ${value};`).join(' ');
}

/**
 * 组装独立 SVG。
 *
 * @param {string} html 渲染产物 HTML
 * @param {string} [preset] 预设；缺省时读根元素 `data-preset`
 * @returns {string}
 */
export function assembleStandaloneSvg(html, preset) {
  const svg = extractSvgFromHtml(html);
  const rootTag = rootOpenTag(svg);
  const resolvedPreset = preset || presetFromRootTag(rootTag);
  if (!PRESETS.includes(resolvedPreset)) {
    throw new Error(`未知预设 "${resolvedPreset}"。合法取值：${PRESETS.join(', ')}。`);
  }

  const fontCss = extractFontCss(html);
  const hostStyle = extractSvgCssFromHtml(html).css;
  const darkVars = resolveThemeVarsFromHtml(html, resolvedPreset, 'dark');
  const lightVars = resolveThemeVarsFromHtml(html, resolvedPreset, 'light');

  // 顺序承重：字体 CSS → svg 字体族 → 过滤后规则 → 深色（:root, svg）
  // → 浅色媒体查询 → 强制浅色 → 强制深色 → 背景规则。别调。
  const styleText = [
    fontCss,
    SVG_FONT_FAMILY,
    hostStyle,
    `:root, svg { ${formatVars(darkVars)} }`,
    `@media (prefers-color-scheme: light) { :root, svg { ${formatVars(lightVars)} } }`,
    `svg[data-theme="light"] { ${formatVars(lightVars)} }`,
    `svg[data-theme="dark"] { ${formatVars(darkVars)} }`,
    BG_RECT_RULE,
  ].join('\n') + '\n';

  const newRootTag = rewriteRootTag(rootTag);
  const body = svg.slice(rootTag.length); // 子节点 + `</svg>`
  return `${XML_PROLOG}${newRootTag}<style>${escapeXmlText(styleText)}</style>${BG_RECT_ELEMENT}${body}`;
}

/**
 * 目标同目录、同名的 `.json` 路径（`x.svg` → `x.json`；无扩展名则追加 `.json`）。
 * @param {string} outSvgPath
 * @returns {string}
 */
export function deriveJsonPath(outSvgPath) {
  const dir = path.dirname(outSvgPath);
  const ext = path.extname(outSvgPath);
  const base = ext ? path.basename(outSvgPath, ext) : path.basename(outSvgPath);
  return path.join(dir, `${base}.json`);
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: options.cwd || path.resolve(SKILL_ROOT, '..'),
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** 目标存在时必须是普通文件，否则拒绝（避免把目录当文件覆盖）。 */
function assertRegularOrAbsent(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (!stat.isFile()) {
    throw new Error(`既有目标不是普通文件：${target}`);
  }
}

/**
 * 两文件原子提交：先备份既有目标，再 rename 候选进来；失败则回滚。
 * @param {{svgCandidate: string, jsonCandidate: string, outSvg: string, outJson: string}} files
 */
function commitPair({ svgCandidate, jsonCandidate, outSvg, outJson }) {
  const entries = [
    { target: outSvg, candidate: svgCandidate },
    { target: outJson, candidate: jsonCandidate },
  ];
  for (const entry of entries) assertRegularOrAbsent(entry.target);

  const backups = [];
  const committed = [];
  try {
    for (const entry of entries) {
      if (!fs.existsSync(entry.target)) continue;
      const backup = `${entry.target}.design-diagrams-backup-${process.pid}`;
      fs.renameSync(entry.target, backup);
      backups.push({ target: entry.target, backup });
    }
    for (const entry of entries) {
      fs.renameSync(entry.candidate, entry.target);
      committed.push(entry);
    }
  } catch (error) {
    for (const entry of committed.reverse()) {
      try { fs.rmSync(entry.target, { force: true }); } catch { /* best effort */ }
    }
    for (const entry of backups.reverse()) {
      try {
        if (fs.existsSync(entry.target)) fs.rmSync(entry.target, { force: true });
        fs.renameSync(entry.backup, entry.target);
      } catch { /* best effort：还原失败也抛出原始错误 */ }
    }
    throw error;
  }
  for (const entry of backups) {
    try { fs.rmSync(entry.backup, { force: true }); } catch { /* best effort */ }
  }
}

/**
 * `svg` 子命令主流程，返回进程退出码（0 = 成功）。
 *
 * 注意：函数体内一律 `return` 退出码而不调用 `process.exit`——`process.exit`
 * 会立刻终止进程、**跳过 finally**，导致临时 HTML 目录泄漏。
 *
 * @param {string[]} args
 * @returns {number}
 */
function commandSvg(args) {
  if (args.length !== 3) {
    console.error('用法：design-diagrams svg <type> <input.json> <output.svg>');
    return 2;
  }
  const [type, inputArg, outputArg] = args;
  if (!TYPES.includes(type)) {
    console.error(`未知图类型 "${type}"。合法取值：${TYPES.join(', ')}。`);
    return 2;
  }
  const input = path.resolve(inputArg);
  const outSvg = path.resolve(outputArg);
  const outJson = deriveJsonPath(outSvg);
  if (!fs.existsSync(input) || !fs.lstatSync(input).isFile()) {
    console.error(`输入 IR 不可读或是目录：${input}`);
    return 1;
  }
  // 自保：两个输出目标不得互相冲突，也不得覆盖输入 IR。
  if (outSvg === outJson) {
    console.error(`输出路径与 IR sidecar 冲突（.json 输出与 IR 同名）：${outSvg}`);
    return 2;
  }
  if (outSvg === input || outJson === input) {
    console.error(`输出路径不得覆盖输入 IR：${input}`);
    return 2;
  }

  // 1) 校验：不过则立即非 0，不产出任何文件、不覆盖既有同名文件。
  const validate = runNode([ARCHIFY, 'validate', type, input, '--quality', 'showcase', '--json']);
  if (validate.status !== 0) {
    if (validate.stdout) process.stderr.write(validate.stdout);
    if (validate.stderr) process.stderr.write(validate.stderr);
    if (!validate.stdout && !validate.stderr) {
      process.stderr.write(`校验未通过（archify validate 退出码 ${validate.status ?? 1}）。\n`);
    }
    return validate.status || 1;
  }

  // 2) 渲染到临时 HTML；失败不产出任何文件。
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-diagrams-svg-'));
  const tmpHtml = path.join(tmpDir, `${type}.html`);
  try {
    const render = runNode([ARCHIFY, 'render', type, input, tmpHtml]);
    if (render.status !== 0) {
      if (render.stdout) process.stderr.write(render.stdout);
      if (render.stderr) process.stderr.write(render.stderr);
      return render.status || 1;
    }

    const html = fs.readFileSync(tmpHtml, 'utf8');
    const standalone = assembleStandaloneSvg(html);
    const irBytes = fs.readFileSync(input);

    // 3) 目标同目录 staging + 原子提交（校验/渲染/组装都过了才碰目标）。
    const outDir = path.dirname(outSvg);
    fs.mkdirSync(outDir, { recursive: true });
    const stagingDir = fs.mkdtempSync(path.join(outDir, '.design-diagrams-svg-'));
    try {
      const svgCandidate = path.join(stagingDir, 'candidate.svg');
      const jsonCandidate = path.join(stagingDir, 'candidate.json');
      fs.writeFileSync(svgCandidate, standalone);
      fs.writeFileSync(jsonCandidate, irBytes);
      commitPair({ svgCandidate, jsonCandidate, outSvg, outJson });
    } finally {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }

    console.log(`exported standalone svg ${outSvg}`);
    console.log(`ir ${outJson}`);
    return 0;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function usage() {
  return `Usage:
  design-diagrams svg <type> <input.json> <output.svg>

Types:
  architecture, workflow, sequence, dataflow, lifecycle
`;
}

export function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  switch (command) {
    case undefined:
    case '-h':
    case '--help':
    case 'help':
      console.log(usage());
      return;
    case 'svg': {
      const code = commandSvg(args);
      if (code !== 0) process.exitCode = code;
      return;
    }
    default:
      fail(`未知命令 "${command}"。\n\n${usage()}`);
  }
}

// 仅直接执行时跑 CLI；被 import 时不执行（便于用例复用纯函数）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
