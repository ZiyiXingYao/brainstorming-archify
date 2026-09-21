/**
 * design-diagrams —— 独立 SVG 导出入口用例（任务 2.3）
 * ============================================================================
 *
 * 被测对象：`design-diagrams/bin/design-diagrams.mjs` 的 `svg` 子命令
 *   node design-diagrams/bin/design-diagrams.mjs svg <type> <ir.json> <out.svg>
 *
 * 无依赖约束下的良构性断言
 * ------------------------
 * 本仓库未安装 `node_modules`，上游 devDependencies 里的 XML 解析器（saxes / parse5）
 * 不可用。所以这里自带一个**最小 XML 良构校验器**：栈式标签配平（感知引号属性、
 * 注释、CDATA、处理指令）、裸 `&` 检查（只允许合法实体）、单根检查。它只判断
 * 「良构 / 不良构」，不做 schema 校验。
 *
 * 覆盖（与任务简报验收逐条对应）
 * ------------------------------
 *   A. 五类图各导出一份，每份满足：XML 良构 + 含 <style> 与内联样式 + 引用变量零缺失
 *      + 含 @font-face + 含背景 rect（c-bg-rect）+ 同名 .json IR 在位且与输入逐字节一致。
 *   B. 校验不过时不产出任何文件，且既有同名文件不被覆盖（含不留 staging 目录）。
 *   C. 承重不变量：解析出的主题变量必须晚于过滤后的规则注入，且用 `:root, svg`
 *      组合选择器而非仅 `svg`——否则同权重的深色块会反向覆盖浅色（浅色模式失效）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(SKILL_ROOT, '..');
const CLI = path.join(SKILL_ROOT, 'bin', 'design-diagrams.mjs');
const EXAMPLES = path.join(SKILL_ROOT, 'examples');

/** 五类图各自的技能内置示例 IR（与 `archify doctor` 使用同一组）。 */
const CASES = [
  { type: 'architecture', example: 'web-app.architecture.json' },
  { type: 'workflow', example: 'agent-tool-call.workflow.json' },
  { type: 'sequence', example: 'cache-miss-request.sequence.json' },
  { type: 'dataflow', example: 'product-analytics.dataflow.json' },
  { type: 'lifecycle', example: 'agent-run.lifecycle.json' },
];

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * 取根元素的起始标签原文（`<svg ...>`，到第一个不在引号内的 `>`）。
 * @param {string} xml
 * @returns {string}
 */
function rootOpenTag(xml) {
  const start = xml.indexOf('<svg');
  assert.notEqual(start, -1, 'SVG 文件里找不到 <svg 根元素');
  let i = start + 1;
  let quote = null;
  while (i < xml.length) {
    const c = xml[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return xml.slice(start, i + 1);
    }
    i += 1;
  }
  throw new Error('根元素起始标签未闭合');
}

/** 找 `<` 起始标签的结束位置，感知引号（属性值里允许出现 `>`）。 */
function tagEnd(xml, i) {
  let j = i + 1;
  let quote = null;
  while (j < xml.length) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return j;
    }
    j += 1;
  }
  return -1;
}

/**
 * 最小 XML 良构校验器（不依赖第三方库）。
 * @param {string} xml
 * @returns {{ok: boolean, error: string|null}}
 */
function checkWellFormed(xml) {
  const stack = [];
  let roots = 0;
  let i = 0;
  const n = xml.length;
  while (i < n) {
    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i + 2);
      if (end === -1) return { ok: false, error: '未闭合的处理指令' };
      i = end + 2;
      continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      if (end === -1) return { ok: false, error: '未闭合的注释' };
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i + 9);
      if (end === -1) return { ok: false, error: '未闭合的 CDATA' };
      i = end + 3;
      continue;
    }
    if (xml[i] === '<') {
      const end = tagEnd(xml, i);
      if (end === -1) return { ok: false, error: '未闭合的标签' };
      const raw = xml.slice(i, end + 1);
      if (raw.indexOf('<', 1) !== -1) return { ok: false, error: `标签内出现裸 <：${raw.slice(0, 40)}` };
      if (raw.startsWith('</')) {
        const name = raw.slice(2, -1).trim();
        const top = stack.pop();
        if (top !== name) {
          return { ok: false, error: `闭合标签不匹配：</${name}> 对不上 <${top ?? '(空栈)'}>` };
        }
      } else {
        const selfClose = raw.endsWith('/>');
        const name = raw.slice(1, selfClose ? -2 : -1).trim().split(/[\s/]/, 1)[0];
        if (!name) return { ok: false, error: `空标签名：${raw.slice(0, 40)}` };
        if (stack.length === 0) roots += 1;
        if (!selfClose) stack.push(name);
      }
      i = end + 1;
      continue;
    }
    if (xml[i] === '&') {
      const semi = xml.indexOf(';', i + 1);
      const entity = semi === -1 ? '' : xml.slice(i, semi + 1);
      if (!/^&(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);$/.test(entity)) {
        return { ok: false, error: `裸 & 或非法实体（位置 ${i}）：${JSON.stringify(xml.slice(Math.max(0, i - 20), i + 20))}` };
      }
      i = semi + 1;
      continue;
    }
    i += 1;
  }
  if (stack.length) return { ok: false, error: `未闭合标签：<${stack.join('>, <')}>` };
  if (roots !== 1) return { ok: false, error: `根元素数量应为 1，实际 ${roots}` };
  return { ok: true, error: null };
}

/**
 * 收集全部自定义属性引用与定义，返回缺失引用（引用集合 − 定义集合）。
 * @param {string} text
 * @returns {{refs: string[], defs: string[], missing: string[]}}
 */
function collectVars(text) {
  const defs = new Set();
  const refs = new Set();
  for (const m of text.matchAll(/--([A-Za-z0-9_-]+)\s*:/g)) defs.add(`--${m[1]}`);
  for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) refs.add(m[1]);
  const refList = [...refs].sort();
  const defList = [...defs].sort();
  return { refs: refList, defs: defList, missing: refList.filter((name) => !defs.has(name)) };
}

/** 取 `<style>` 内文（本产物只有一个 `<style>`）。 */
function styleText(svg) {
  const start = svg.indexOf('<style');
  assert.notEqual(start, -1, 'SVG 里没有 <style>');
  const openEnd = svg.indexOf('>', start);
  const close = svg.indexOf('</style>', openEnd);
  assert.notEqual(close, -1, '<style> 未闭合');
  return svg.slice(openEnd + 1, close);
}

test('A. 五类图各导出一份，均满足独立 SVG 结构契约', async (t) => {
  const outRoot = mkTmp('dd-svg-export-');
  t.after(() => fs.rmSync(outRoot, { recursive: true, force: true }));

  for (const { type, example } of CASES) {
    await t.test(type, () => {
      const input = path.join(EXAMPLES, example);
      const outSvg = path.join(outRoot, `${type}.svg`);
      const outJson = path.join(outRoot, `${type}.json`);

      const result = runCli(['svg', type, input, outSvg]);
      assert.equal(result.status, 0, `导出退出码应为 0：${result.stdout}\n${result.stderr}`);
      assert.ok(fs.existsSync(outSvg), `未产出 ${outSvg}`);
      assert.ok(fs.existsSync(outJson), `未产出同名 IR ${outJson}`);

      const svg = fs.readFileSync(outSvg, 'utf8');

      // ① XML 良构（自带校验器）
      const wf = checkWellFormed(svg);
      assert.equal(wf.ok, true, `XML 不良构：${wf.error}`);

      // ② XML 声明头（与上游浏览器版一致）
      assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), '缺少 XML 声明头');

      // ③ 根元素：补 xmlns、由 viewBox 推 width/height、移除 data-theme
      const root = rootOpenTag(svg);
      assert.match(root, /\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '根元素缺 xmlns');
      assert.match(root, /\swidth="\d+"/, '根元素缺 width');
      assert.match(root, /\sheight="\d+"/, '根元素缺 height');
      assert.doesNotMatch(root, /\sdata-theme=/, '根元素不应带 data-theme（保持不锁主题）');
      const vb = root.match(/\sviewBox="([\d.\-\s]+)"/);
      assert.ok(vb, '根元素缺 viewBox');
      const [, , vbw, vbh] = vb[1].trim().split(/\s+/).map(Number);
      assert.equal(root.match(/\swidth="(\d+)"/)[1], String(vbw), 'width 应等于 viewBox 宽度');
      assert.equal(root.match(/\sheight="(\d+)"/)[1], String(vbh), 'height 应等于 viewBox 高度');

      // ④ 含 <style> 且含内联样式（内嵌样式表，非外部引用）
      const style = styleText(svg);
      assert.ok(style.trim().length > 0, '<style> 为空');
      assert.ok(/[.#\[]?[A-Za-z_][^{]*\{/.test(style), '<style> 内不含任何样式规则');

      // ⑤ 含 @font-face（内联字体）
      assert.ok(style.includes('@font-face'), '<style> 内缺 @font-face');

      // ⑥ 含背景 rect
      assert.ok(svg.includes('class="c-bg-rect"'), '缺背景 rect（c-bg-rect）');
      assert.ok(style.includes('rect.c-bg-rect'), '缺背景 rect 的填充规则');

      // ⑦ 引用变量零缺失（最重要的一条）
      const vars = collectVars(svg);
      assert.deepEqual(vars.missing, [], `存在未定义变量引用：${vars.missing.join(', ')}`);
      assert.ok(vars.refs.length > 0, '产物里没有任何 var(--x) 引用，说明样式未真正内联');

      // ⑧ 同名 .json IR 在位且与输入逐字节一致
      assert.deepEqual(fs.readFileSync(outJson), fs.readFileSync(input), '同名 IR 应与输入逐字节一致');
    });
  }
});

test('B. 校验不过时不产出任何文件，且既有同名文件不被覆盖', () => {
  const badDir = mkTmp('dd-svg-bad-');
  const cleanDir = mkTmp('dd-svg-clean-');
  try {
    const badIr = path.join(badDir, 'broken.json');
    // 结构上缺 diagram_type，必然通不过 schema 校验（validate 非 0）。
    fs.writeFileSync(badIr, `${JSON.stringify({ schema_version: 1, meta: { title: 'broken' }, nodes: [] })}\n`);

    // 既有同名文件（哨兵）
    const sentinelSvg = path.join(badDir, 'out.svg');
    const sentinelJson = path.join(badDir, 'out.json');
    const svgSentinel = '<!-- EXISTING SVG MUST SURVIVE -->\n';
    const jsonSentinel = '{"existing":true}\n';
    fs.writeFileSync(sentinelSvg, svgSentinel);
    fs.writeFileSync(sentinelJson, jsonSentinel);

    const overwriteAttempt = runCli(['svg', 'architecture', badIr, sentinelSvg]);
    assert.notEqual(overwriteAttempt.status, 0, '校验不过时退出码必须非 0');
    assert.equal(fs.readFileSync(sentinelSvg, 'utf8'), svgSentinel, '既有 out.svg 被覆盖了');
    assert.equal(fs.readFileSync(sentinelJson, 'utf8'), jsonSentinel, '既有 out.json 被覆盖了');
    assert.deepEqual(
      fs.readdirSync(badDir).filter((name) => name.startsWith('.design-diagrams-svg-')),
      [],
      '失败后残留了 staging 目录',
    );

    // 干净目录：不得产出任何文件
    const freshSvg = path.join(cleanDir, 'out.svg');
    const fresh = runCli(['svg', 'architecture', badIr, freshSvg]);
    assert.notEqual(fresh.status, 0, '校验不过时退出码必须非 0');
    assert.deepEqual(
      fs.readdirSync(cleanDir),
      [],
      `校验不过却产出了文件：${fs.readdirSync(cleanDir).join(', ')}`,
    );
  } finally {
    fs.rmSync(badDir, { recursive: true, force: true });
    fs.rmSync(cleanDir, { recursive: true, force: true });
  }
});

test('C. 解析出的主题变量晚于过滤规则注入，且用 `:root, svg`（浅色不被深色反向覆盖）', () => {
  const dir = mkTmp('dd-svg-order-');
  try {
    const input = path.join(EXAMPLES, 'web-app.architecture.json');
    const outSvg = path.join(dir, 'order.svg');
    const result = runCli(['svg', 'architecture', input, outSvg]);
    assert.equal(result.status, 0, `导出退出码应为 0：${result.stderr}`);

    const svg = fs.readFileSync(outSvg, 'utf8');

    // 解析出的变量块必须用 `:root, svg` 组合选择器（而不是仅 `svg`）：
    // 过滤规则里默认深色块选择器是 `:root, [data-theme="dark"]`（权重 0,1,0），
    // 仅用 `svg`（0,0,1）会被它反向覆盖，症状是浅色模式失效。
    assert.ok(svg.includes(':root, svg {'), '解析出的变量块必须用 `:root, svg` 组合选择器');

    // 过滤后的规则（其间含原始 `:root,` 主题块）必须早于我们注入的 `:root, svg {`。
    const idxFilteredRoot = svg.indexOf(':root,');
    const idxInjectedRoot = svg.indexOf(':root, svg {');
    assert.notEqual(idxFilteredRoot, -1, '找不到过滤规则里的 :root 块');
    assert.ok(
      idxFilteredRoot < idxInjectedRoot,
      `解析出的变量必须晚于过滤规则注入（filtered@${idxFilteredRoot} 应 < injected@${idxInjectedRoot}）`,
    );

    // 浅色来源顺序：过滤规则里的 `[data-theme="light"]` → `@media (prefers-color-scheme: light)`
    // → 下游可强制覆盖的 `svg[data-theme="light"]`。
    const idxFilteredLight = svg.indexOf('[data-theme="light"]');
    const idxMediaLight = svg.indexOf('@media (prefers-color-scheme: light)');
    const idxForcedLight = svg.indexOf('svg[data-theme="light"]');
    assert.notEqual(idxFilteredLight, -1, '找不到过滤规则里的 [data-theme="light"]');
    assert.ok(idxFilteredLight < idxMediaLight, '浅色媒体查询必须晚于过滤规则');
    assert.ok(idxMediaLight < idxForcedLight, '强制浅色选择器必须晚于浅色媒体查询');

    // 深色：默认块 → 强制深色。
    const idxForcedDark = svg.indexOf('svg[data-theme="dark"]');
    assert.ok(idxInjectedRoot < idxForcedDark, '默认深色块必须早于强制深色选择器');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
