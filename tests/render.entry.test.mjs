/**
 * render.entry.test.mjs —— 绘图内核唯一入口 `bin/render.mjs`
 * ============================================================================
 *
 * 冒烟测试（`render.smoke.test.mjs`）只走 happy path；本文件补的是**入口的契约与边界**：
 * 两个透传子命令、参数校验、失败不留半成品、原子提交、两轮降级退出码。
 *
 * 只用 Node 内置模块，不依赖 node_modules。产物写在系统临时目录，用完即删。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RENDER = path.join(ROOT, 'scripts', 'diagram-engine', 'bin', 'render.mjs');
const FIXTURE = path.join(HERE, 'fixtures', 'sample-architecture.json');

/** 一份必定过不了校验的 IR：缺 meta 与 components。 */
const INVALID_IR = '{"schema_version":1,"diagram_type":"architecture"}';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runRender(args, env = {}) {
  return spawnSync(process.execPath, [RENDER, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
}

function listDir(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

test('validate 子命令透传（退出码 0）', () => {
  const result = runRender(['validate', 'architecture', FIXTURE, '--quality', 'showcase']);
  assert.equal(result.status, 0, `validate 应透传成功\n${result.stdout}${result.stderr}`);
});

test('doctor 子命令透传（退出码 0）', () => {
  const result = runRender(['doctor']);
  assert.equal(result.status, 0, `doctor 应透传成功\n${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /diagram-engine is ready/);
});

test('render 一次产出三件套', () => {
  const outDir = tmpDir('render-entry-');
  try {
    const result = runRender(['render', 'architecture', FIXTURE, outDir]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const base = path.basename(FIXTURE, '.json');
    for (const ext of ['json', 'svg', 'html']) {
      const target = path.join(outDir, `${base}.${ext}`);
      assert.ok(fs.existsSync(target), `缺少 ${base}.${ext}`);
      assert.ok(fs.statSync(target).size > 0, `${base}.${ext} 为空`);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('参数个数不对时退出码 2', () => {
  const result = runRender(['render', 'architecture']);
  assert.equal(result.status, 2, '用法错误应为退出码 2');
});

test('非法 IR：非零退出且目标目录不新增任何产物', () => {
  const outDir = tmpDir('render-entry-bad-');
  const irDir = tmpDir('render-entry-ir-');
  try {
    const ir = path.join(irDir, 'broken.architecture.json');
    fs.writeFileSync(ir, INVALID_IR);
    const result = runRender(['render', 'architecture', ir, outDir], {
      DESIGN_DIAGRAMS_STATE_DIR: tmpDir('render-entry-state-'),
    });
    assert.notEqual(result.status, 0, '非法 IR 应非零退出');
    assert.deepEqual(listDir(outDir), [], '目标目录应不新增任何产物');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(irDir, { recursive: true, force: true });
  }
});

test('失败不留半成品：既有同名文件不被覆盖', () => {
  const outDir = tmpDir('render-entry-keep-');
  const irDir = tmpDir('render-entry-ir2-');
  try {
    const ir = path.join(irDir, 'broken.architecture.json');
    fs.writeFileSync(ir, INVALID_IR);
    const sentinel = path.join(outDir, 'broken.architecture.svg');
    fs.writeFileSync(sentinel, 'SENTINEL-ORIGINAL');

    const result = runRender(['render', 'architecture', ir, outDir], {
      DESIGN_DIAGRAMS_STATE_DIR: tmpDir('render-entry-state2-'),
    });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'SENTINEL-ORIGINAL', '既有文件不应被改动');
    // staging / backup 目录不得残留
    const leftovers = listDir(outDir).filter((name) => name.startsWith('.render-'));
    assert.deepEqual(leftovers, [], `不应残留 staging/backup 目录：${leftovers.join(', ')}`);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(irDir, { recursive: true, force: true });
  }
});

test('成功渲染后不留 staging / backup 残留', () => {
  const outDir = tmpDir('render-entry-clean-');
  try {
    assert.equal(runRender(['render', 'architecture', FIXTURE, outDir]).status, 0);
    const leftovers = listDir(outDir).filter((name) => name.startsWith('.render-'));
    assert.deepEqual(leftovers, [], `成功路径不应留残留：${leftovers.join(', ')}`);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('同名 .json 与输入 IR 是同一路径时允许（源件已在目标位置）', () => {
  const outDir = tmpDir('render-entry-same-');
  try {
    const base = 'same-path.architecture';
    const ir = path.join(outDir, `${base}.json`);
    fs.copyFileSync(FIXTURE, ir);
    const result = runRender(['render', 'architecture', ir, outDir]);
    assert.equal(result.status, 0, `应与输入同路径的 .json 视为已就位\n${result.stdout}${result.stderr}`);
    for (const ext of ['json', 'svg', 'html']) {
      assert.ok(fs.existsSync(path.join(outDir, `${base}.${ext}`)), `缺少 ${base}.${ext}`);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('两轮降级：同一目标连续两次未改善即以退出码 3 停下', () => {
  const outDir = tmpDir('render-entry-degrade-');
  const irDir = tmpDir('render-entry-degrade-ir-');
  const stateDir = tmpDir('render-entry-degrade-state-');
  try {
    const ir = path.join(irDir, 'broken.architecture.json');
    fs.writeFileSync(ir, INVALID_IR);
    const env = { DESIGN_DIAGRAMS_STATE_DIR: stateDir };

    const first = runRender(['render', 'architecture', ir, outDir], env);
    assert.notEqual(first.status, 0, '第 1 轮应失败');
    assert.notEqual(first.status, 3, '第 1 轮是基线轮，不应判降级停止');

    const second = runRender(['render', 'architecture', ir, outDir], env);
    assert.equal(second.status, 3, `第 2 轮错误数未下降应退出码 3，实际 ${second.status}\n${second.stdout}${second.stderr}`);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(irDir, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});
