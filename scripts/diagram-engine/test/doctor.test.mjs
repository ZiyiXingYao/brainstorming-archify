/**
 * doctor.test.mjs —— 绘图内核的环境自检
 * ============================================================================
 *
 * 被测对象：`bin/render-driver.mjs doctor`。
 *
 * 规格要求两个场景：环境满足时退出码 0；**运行期必需文件缺失时非零退出并指出缺失路径**。
 * 后者靠临时改名一个必需文件来构造，并在 finally 里恢复——这是唯一能真正走到该分支的办法。
 *
 * **为什么改在副本上做**：仓库的标准跑法是 `node --test tests/*.test.mjs`，node:test 会按
 * 文件并行起子进程，其中 `tests/engine.test.mjs` 会唤起 `run-valid.mjs` 从而**并发**执行
 * 本文件，而 `tests/render.entry.test.mjs` 正在断言这些文件在场时的输出。在源码树上改名，
 * 两个用例集的窗口一重叠就随机假红。所以先把内核整棵复制到临时目录，只改副本。
 *
 * 只用 Node 内置模块，不依赖 node_modules。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(HERE, '..');

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-test-'));
const ROOT = path.join(SANDBOX, 'diagram-engine');
fs.cpSync(SOURCE_ROOT, ROOT, {
  recursive: true,
  filter: (src) => path.basename(src) !== 'node_modules',
});
process.on('exit', () => {
  try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch { /* best effort */ }
});

const DRIVER = path.join(ROOT, 'bin', 'render-driver.mjs');

function runDoctor() {
  return spawnSync(process.execPath, [DRIVER, 'doctor'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/**
 * 在**副本**上临时把某个运行期必需文件改名，跑一次 doctor，再恢复。
 *
 * @param {string} relative 相对内核根的文件路径
 * @returns {{status: number|null, output: string}}
 */
function doctorWithout(relative) {
  const target = path.join(ROOT, relative);
  assert.ok(fs.existsSync(target), `测试前提：${relative} 应存在`);
  const parked = `${target}.doctor-test-parked`;
  fs.renameSync(target, parked);
  try {
    const result = runDoctor();
    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  } finally {
    fs.renameSync(parked, target);
  }
}

test('环境满足时自检通过（退出码 0）', () => {
  const result = runDoctor();
  assert.equal(result.status, 0, `doctor 应退出码 0\n${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /diagram-engine is ready/);
  // 每项检查都应为 ok
  const notOk = (result.stdout.match(/^\[(?!ok\])/gm) ?? []).length;
  assert.equal(notOk, 0, '不应有非 ok 的检查项');
});

test('缺少 schema 校验器时自检失败', () => {
  const { status, output } = doctorWithout(path.join('renderers', 'shared', 'generated-validators.mjs'));
  assert.notEqual(status, 0, '缺少校验器应非零退出');
  assert.match(output, /Standalone schema validators/);
});

test('缺少产物检查器时自检失败', () => {
  const { status, output } = doctorWithout(path.join('scripts', 'check-render-output.mjs'));
  assert.notEqual(status, 0, '缺少产物检查器应非零退出');
  assert.match(output, /Render output checker/);
});

test('缺少交互页模板时自检失败', () => {
  const { status, output } = doctorWithout(path.join('assets', 'template.html'));
  assert.notEqual(status, 0, '缺少交互页模板应非零退出');
  assert.match(output, /Interactive viewer template/);
});

test('缺少某类渲染器时自检失败并点名该类型', () => {
  const { status, output } = doctorWithout(path.join('renderers', 'sequence', 'render-sequence.mjs'));
  assert.notEqual(status, 0, '缺少渲染器应非零退出');
  assert.match(output, /sequence renderer and schema/);
});

test('缺少保留的溯源/许可文件时自检失败', () => {
  const { status, output } = doctorWithout(path.join('UPSTREAM.md'));
  assert.notEqual(status, 0, '缺少 UPSTREAM.md 应非零退出');
  assert.match(output, /Retained provenance and license files/);
});

test('恢复后自检重新通过', () => {
  const result = runDoctor();
  assert.equal(result.status, 0, '测试应已把文件恢复，doctor 应重新通过');
});
