#!/usr/bin/env node
/**
 * tests/render.smoke.test.mjs —— 绘图内核冒烟测试
 * ============================================================================
 *
 * 只使用 Node 内置模块与原生 `assert`，**不引入任何第三方依赖**（运行前不需要
 * 安装任何东西）。
 *
 * 做什么
 * ------
 * 读取 `tests/fixtures/` 下五类图各一份样例 IR，逐份调用内核唯一入口
 * `scripts/diagram-engine/bin/render.mjs render <type> <ir> <outdir>`，并断言：
 *
 *   1. `<basename>.json` / `<basename>.svg` / `<basename>.html` 三件套全部生成；
 *   2. `.svg` 非空且含 `<svg` 根元素；
 *   3. `.html` 非空且含查看器代码标记（渲染产物标记 + 内联查看器运行时）。
 *
 * 产物写在系统临时目录，用完即删，不污染仓库。
 *
 * 用法
 * ----
 *   node tests/render.smoke.test.mjs
 *
 * 退出码：0 = 五个用例全部通过；1 = 有用例失败。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RENDER = path.join(ROOT, 'scripts', 'diagram-engine', 'bin', 'render.mjs');

/** 五类图各一份样例。 */
const CASES = Object.freeze([
  ['architecture', 'sample-architecture.json'],
  ['workflow', 'sample-workflow.json'],
  ['sequence', 'sample-sequence.json'],
  ['dataflow', 'sample-dataflow.json'],
  ['lifecycle', 'sample-lifecycle.json'],
]);

/**
 * `.html` 里必须出现的查看器代码标记。
 * - `data-quality-profile`：渲染器写入 SVG 根元素的产物标记；
 * - `syncFromHash`：内联查看器运行时的深链接实现（证明查看器 JS 已内联）。
 */
const VIEWER_MARKERS = Object.freeze(['data-quality-profile', 'syncFromHash']);

/**
 * 渲染一份样例并做全部断言。
 *
 * @param {[string, string]} param0 [图类型, 样例文件名]
 * @returns {{type: string, bytes: {json: number, svg: number, html: number}}}
 */
function checkCase([type, fixture]) {
  const input = path.join(HERE, 'fixtures', fixture);
  const base = path.basename(fixture, '.json');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `render-smoke-${type}-`));
  try {
    const result = spawnSync(process.execPath, [RENDER, 'render', type, input, outDir], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      // 不设 timeout 时，一旦渲染卡死本文件会无限挂起，CI 只能整体超时而非给出可读失败。
      timeout: 120_000,
    });
    assert.equal(
      result.status,
      0,
      `${type}: render 退出码应为 0，实际为 ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );

    const targets = {
      json: path.join(outDir, `${base}.json`),
      svg: path.join(outDir, `${base}.svg`),
      html: path.join(outDir, `${base}.html`),
    };

    const bytes = {};
    for (const [ext, file] of Object.entries(targets)) {
      assert.ok(fs.existsSync(file), `${type}: 缺少产物 ${base}.${ext}`);
      const size = fs.statSync(file).size;
      assert.ok(size > 0, `${type}: 产物 ${base}.${ext} 是空文件`);
      bytes[ext] = size;
    }

    // 契约：`.json` 是源 IR **逐字节**落盘（见 bin/render.mjs 头部注释）。只查存在与非空
    // 的话，IR 被重编码 / 丢字段也不会有任何测试发现。
    assert.ok(
      fs.readFileSync(targets.json).equals(fs.readFileSync(input)),
      `${type}: ${base}.json 应与输入 IR 逐字节一致`,
    );

    const svg = fs.readFileSync(targets.svg, 'utf8');
    assert.ok(svg.includes('<svg'), `${type}: ${base}.svg 不含 <svg 根元素`);

    const html = fs.readFileSync(targets.html, 'utf8');
    for (const marker of VIEWER_MARKERS) {
      assert.ok(html.includes(marker), `${type}: ${base}.html 缺少查看器标记 "${marker}"`);
    }

    return { type, bytes };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

let failures = 0;
console.log('绘图内核冒烟测试：五类图各渲染一次，校验三件套\n');
for (const testCase of CASES) {
  const type = testCase[0];
  try {
    const { bytes } = checkCase(testCase);
    console.log(
      `✓ ${type.padEnd(13)} json ${String(bytes.json).padStart(6)}B  `
      + `svg ${String(bytes.svg).padStart(7)}B  html ${String(bytes.html).padStart(8)}B`,
    );
  } catch (error) {
    failures += 1;
    console.error(`✗ ${type.padEnd(13)} ${error.message}`);
  }
}

console.log('');
if (failures === 0) {
  console.log(`RESULT: PASS（${CASES.length}/${CASES.length}）`);
} else {
  console.error(`RESULT: FAIL（${failures}/${CASES.length} 失败）`);
}
process.exitCode = failures === 0 ? 0 : 1;
