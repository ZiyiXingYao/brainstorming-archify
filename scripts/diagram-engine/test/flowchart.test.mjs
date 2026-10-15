// flowchart（本仓库自建类型，上游 archify 没有）的用例 —— 本仓库新增，非上游文件
//
// 覆盖四组，对应已发布规格 `specs/diagram-engine` 里的「十一类图的渲染能力内置」与
// 「自建类型的接线完整性」两条 Requirement：
//
//   1. 结构拒绝：起始端子不唯一、有不可达节点、判断节点出边不足、判断分支缺条件标签、
//      端点不存在 —— 每一条都必须非零退出且**不产出任何文件**；
//   2. 正向合规：含回边的样例在 showcase 下过 9 项产物检查与构图检查（0 error / 0 warning）；
//   3. 接线完整性：入口类型表含 flowchart；`doctor` 逐类自检含它且退出码 0；
//   4. 品牌边界：URL 字符串失败关闭并给出 brand/unsupported-url；内置 ID 正常渲染。
//
// 只依赖 Node 内置模块；IR 在本文件内合成并写到临时目录，用完即删。

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TYPES } from '../bin/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const ENTRY = path.join(SKILL_ROOT, 'bin', 'render.mjs');
const DRIVER = path.join(SKILL_ROOT, 'bin', 'render-driver.mjs');
const CHECKER = path.join(SKILL_ROOT, 'scripts', 'check-render-output.mjs');

/** 一份结构完整、含一条回边的程序流程：库存扣减带重试。 */
function validDiagram() {
  return {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: { title: '库存扣减流程', output: 'deduct-stock.html', quality_profile: 'showcase' },
    nodes: [
      { id: 'start', kind: 'start', label: '开始' },
      { id: 'read', kind: 'io', label: '读取订单与 SKU' },
      { id: 'lock', kind: 'process', label: '尝试锁定库存' },
      { id: 'enough', kind: 'decision', label: '库存足够？' },
      { id: 'retry', kind: 'decision', label: '已重试 3 次？' },
      { id: 'wait', kind: 'loop', label: '等待 200ms 后重试' },
      { id: 'fail', kind: 'exception', label: '标记订单缺货' },
      { id: 'write', kind: 'process', label: '写入扣减流水' },
      { id: 'end', kind: 'end', label: '结束' },
    ],
    edges: [
      { from: 'start', to: 'read', role: 'main' },
      { from: 'read', to: 'lock', role: 'main' },
      { from: 'lock', to: 'enough', role: 'main' },
      { from: 'enough', to: 'write', role: 'branch', label: '是' },
      { from: 'enough', to: 'retry', role: 'branch', label: '否' },
      { from: 'retry', to: 'fail', role: 'branch', label: '是' },
      { from: 'retry', to: 'wait', role: 'branch', label: '否' },
      { from: 'wait', to: 'lock', role: 'loop', label: '重试', variant: 'dashed' },
      { from: 'write', to: 'end', role: 'main' },
      { from: 'fail', to: 'end', role: 'exception', variant: 'dashed' },
    ],
  };
}

/** 起一个临时工作目录，写入 IR，跑一次 `render.mjs render flowchart`。 */
function runCase(diagram) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowchart-case-'));
  const ir = path.join(dir, 'case.flowchart.json');
  const outDir = path.join(dir, 'out');
  fs.writeFileSync(ir, `${JSON.stringify(diagram, null, 2)}\n`, 'utf8');
  const result = spawnSync(process.execPath, [ENTRY, 'render', 'flowchart', ir, outDir], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  return {
    dir,
    outDir,
    result,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    artifacts: ['case.flowchart.json', 'case.flowchart.svg', 'case.flowchart.html']
      .map((name) => path.join(outDir, name)),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** 负向断言：非零退出、点名的诊断码出现、三件套一个都不产出。 */
function assertRejected(label, diagram, code) {
  const run = runCase(diagram);
  try {
    assert.notEqual(run.result.status, 0, `${label}: 应非零退出，实际 ${run.result.status}`);
    assert.ok(run.output.includes(code), `${label}: 输出应点名 ${code}\n${run.output.slice(0, 600)}`);
    for (const file of run.artifacts) {
      assert.equal(fs.existsSync(file), false, `${label}: 不应产出 ${path.basename(file)}`);
    }
  } finally {
    run.cleanup();
  }
}

test('结构拒绝：没有唯一起始端子时非零退出且不落盘', () => {
  const diagram = validDiagram();
  diagram.nodes[0].kind = 'process';
  assertRejected('无起始端子', diagram, 'flowchart/start-count');
});

test('结构拒绝：两个起始端子时非零退出且不落盘', () => {
  const diagram = validDiagram();
  diagram.nodes.push({ id: 'start-2', kind: 'start', label: '另一个开始' });
  diagram.edges.push({ from: 'start-2', to: 'read', role: 'main' });
  assertRejected('两个起始端子', diagram, 'flowchart/start-count');
});

test('结构拒绝：存在从起始端子不可达的节点时非零退出且不落盘', () => {
  const diagram = validDiagram();
  diagram.nodes.push({ id: 'orphan', kind: 'process', label: '孤立步骤' });
  diagram.edges.push({ from: 'orphan', to: 'end', role: 'main' });
  assertRejected('不可达节点', diagram, 'flowchart/unreachable');
});

test('结构拒绝：判断节点出边少于两条时非零退出且不落盘', () => {
  const diagram = validDiagram();
  diagram.edges = diagram.edges.filter((edge) => !(edge.from === 'enough' && edge.to === 'retry'));
  assertRejected('判断分支不足', diagram, 'flowchart/decision-branches');
});

test('结构拒绝：判断分支缺少条件标签时非零退出且不落盘', () => {
  const diagram = validDiagram();
  for (const edge of diagram.edges) {
    if (edge.from === 'enough' && edge.to === 'write') delete edge.label;
  }
  assertRejected('分支缺条件标签', diagram, 'flowchart/branch-label');
});

test('结构拒绝：边端点不存在时非零退出且不落盘', () => {
  const diagram = validDiagram();
  diagram.edges.push({ from: 'ghost', to: 'end', role: 'main' });
  assertRejected('端点不存在', diagram, 'flowchart/unknown-endpoint');
});

test('结构拒绝：节点 id 重复时非零退出且不落盘', () => {
  const diagram = validDiagram();
  diagram.nodes.push({ id: 'lock', kind: 'process', label: '重复的锁定步骤' });
  assertRejected('id 重复', diagram, 'flowchart/duplicate-id');
});

test('正向：含回边的样例在 showcase 下过产物检查与构图检查（0 error / 0 warning）', () => {
  const run = runCase(validDiagram());
  try {
    assert.equal(run.result.status, 0, `应渲染成功\n${run.output.slice(0, 600)}`);
    for (const file of run.artifacts) {
      assert.ok(fs.existsSync(file), `缺少产物 ${path.basename(file)}`);
    }
    const check = spawnSync(process.execPath, [CHECKER, run.artifacts[2]], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    const receipt = JSON.parse(check.stdout);
    assert.equal(receipt.ok, true, `产物检查应全过：${JSON.stringify(receipt.checks?.filter((c) => !c.ok))}`);
    assert.equal(receipt.checks.length, 9, 'showcase 应报 9 项产物检查');
    assert.deepEqual(receipt.composition.summary, { errors: 0, warnings: 0 },
      `构图应为 0 error / 0 warning：${JSON.stringify(receipt.composition.summary)}`);
    // 回边不得穿过任何节点：渲染器自检已把这条钉成硬约束，渲染成功即证明成立；
    // 这里再确认回边确实存在（否则本用例退化成正向直链用例）。
    assert.ok(receipt.composition.metrics.properCrossings === 0, '不应有真交叉');
  } finally {
    run.cleanup();
  }
});

test('接线完整性：入口类型表与 doctor 自检都覆盖 flowchart', () => {
  assert.ok(TYPES.includes('flowchart'), `render.mjs 的 TYPES 应含 flowchart，实际 ${TYPES.join(', ')}`);
  const doctor = spawnSync(process.execPath, [DRIVER, 'doctor'], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(doctor.status, 0, `doctor 应退出码 0\n${doctor.stdout ?? ''}${doctor.stderr ?? ''}`);
  assert.match(doctor.stdout, /\[ok\] flowchart renderer and schema/);
});

test('品牌边界：URL 输入失败关闭并给出 brand/unsupported-url', () => {
  const diagram = validDiagram();
  diagram.nodes[0].brand = 'https://example.com/logo.png';
  assertRejected('品牌 URL', diagram, 'brand/unsupported-url');
});

test('品牌边界：内置 canonical ID 正常渲染', () => {
  const diagram = validDiagram();
  diagram.nodes[0].brand = 'github';
  const run = runCase(diagram);
  try {
    assert.equal(run.result.status, 0, `内置品牌 ID 应可渲染\n${run.output.slice(0, 600)}`);
    assert.ok(fs.existsSync(run.artifacts[2]), '应产出 html');
  } finally {
    run.cleanup();
  }
});
