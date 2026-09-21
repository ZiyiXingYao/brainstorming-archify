/**
 * design-diagrams —— 校验硬门与「两轮降级」用例（任务 2.4）
 * ============================================================================
 *
 * 被测对象：`design-diagrams/bin/design-diagrams.mjs` 的 `svg` 子命令
 *   node design-diagrams/bin/design-diagrams.mjs svg <type> <ir.json> <out.svg>
 *
 * 目标错误数口径（本任务的核心判定）
 * ----------------------------------
 * 「目标错误数 = 校验诊断中错误级条目的条数，不含警告」。落到 `archify validate
 * --json` 的实际结构上：
 *   - 校验失败时产物是 `{ schemaVersion, ok:false, stage, type, input, error,
 *     diagnostics:[{ code, severity, message, subject, evidence, supportedFixes }] }`；
 *   - 目标错误数 = `diagnostics` 里 `severity === 'error'` 的条数；
 *   - 校验成功时的产物没有 `diagnostics` 字段（改为 `checks` / `composition`），
 *     此时目标错误数按 0 处理。
 * `diagnostics` 里确实可能出现 `severity: 'warning'`（渲染器与产物检查器在质量门
 * 未强制时会降级），所以「只数 error」是一条有实际区分的口径，不是同义反复。
 *
 * 两轮降级判定（经用户裁定）
 * --------------------------
 * 第 1 轮为基线；第 2 轮目标错误数 **未低于** 第 1 轮即判「连续两轮未降低」，
 * 在第 2 轮停止并报未解决项。轮次历史按「图类型 + 目标 SVG 绝对路径」为键，落
 * 系统临时目录，跨 CLI 调用存活；失败时不往目标目录写任何东西。
 *
 * 覆盖：
 *   A. 渲染期几何缺陷（连线穿无关节点）→ 非 0 退出、目标目录零产物、既有同名文件不被覆盖、
 *      诊断含该连线的稳定标识（`clean-flow/edge-through-node` + 关系 id）；
 *   B. 同一目标两轮错误数不降 → 第 2 轮停止（退出码 3），stdout 结构化报告含未解决项与两个选项；
 *   C. 一轮改善（错误数下降）不误停，再续一轮不降才停；
 *   D. 成功导出清除该目标轮次历史，避免旧账误伤新图。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXIT_DEGRADED_STOP } from '../bin/design-diagrams.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(SKILL_ROOT, '..');
const CLI = path.join(SKILL_ROOT, 'bin', 'design-diagrams.mjs');
const EXAMPLES = path.join(SKILL_ROOT, 'examples');

/** 一条 `route:"straight"` 的连线穿过无关 component "mid" —— 稳定触发 1 条错误级诊断。 */
function oneErrorIr() {
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title: 'through-node', quality_profile: 'showcase' },
    components: [
      { id: 'a', type: 'backend', label: 'A', pos: [40, 200], size: [120, 60] },
      { id: 'b', type: 'backend', label: 'B', pos: [600, 200], size: [120, 60] },
      { id: 'mid', type: 'database', label: 'Mid', pos: [310, 185], size: [140, 90] },
    ],
    connections: [
      { id: 'a-to-b', from: 'a', to: 'b', route: 'straight', fromSide: 'right', toSide: 'left' },
    ],
  };
}

/** 两条各自穿一个无关节点的连线 —— 稳定触发 2 条错误级诊断。 */
function twoErrorIr() {
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title: 'two-through', quality_profile: 'showcase' },
    components: [
      { id: 'a', type: 'backend', label: 'A', pos: [40, 160], size: [120, 60] },
      { id: 'mid1', type: 'database', label: 'Mid1', pos: [310, 145], size: [140, 90] },
      { id: 'b', type: 'backend', label: 'B', pos: [600, 160], size: [120, 60] },
      { id: 'c', type: 'backend', label: 'C', pos: [40, 400], size: [120, 60] },
      { id: 'mid2', type: 'database', label: 'Mid2', pos: [310, 385], size: [140, 90] },
      { id: 'd', type: 'backend', label: 'D', pos: [600, 400], size: [120, 60] },
    ],
    connections: [
      { id: 'a-to-b', from: 'a', to: 'b', route: 'straight', fromSide: 'right', toSide: 'left' },
      { id: 'c-to-d', from: 'c', to: 'd', route: 'straight', fromSide: 'right', toSide: 'left' },
    ],
  };
}

/**
 * 跑一次 svg 子命令，并把轮次状态目录隔离到 `stateDir`，避免用例之间、用例与开发机之间相互影响。
 * @param {string[]} args
 * @param {string} stateDir
 */
function runCli(args, stateDir) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, DESIGN_DIAGRAMS_STATE_DIR: stateDir },
  });
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('A. 渲染期几何缺陷：非 0 退出、零产物、不覆盖既有文件、诊断含连线稳定标识', () => {
  const dir = mkTmp('dd-degrade-a-');
  const stateDir = mkTmp('dd-degrade-a-state-');
  const clean = mkTmp('dd-degrade-a-clean-');
  try {
    const ir = path.join(dir, 'through.json');
    writeJson(ir, oneErrorIr());

    // 既有同名文件作哨兵：校验不过时不得被覆盖
    const target = path.join(dir, 'out.svg');
    const sidecar = path.join(dir, 'out.json');
    fs.writeFileSync(target, '<!-- EXISTING SVG MUST SURVIVE -->\n');
    fs.writeFileSync(sidecar, '{"existing":true}\n');

    const result = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.notEqual(result.status, 0, '穿节点 IR 必须非 0 退出');
    assert.equal(fs.readFileSync(target, 'utf8'), '<!-- EXISTING SVG MUST SURVIVE -->\n', '既有 out.svg 被覆盖');
    assert.equal(fs.readFileSync(sidecar, 'utf8'), '{"existing":true}\n', '既有 out.json 被覆盖');
    assert.deepEqual(
      fs.readdirSync(dir).filter((name) => name.startsWith('.design-diagrams-svg-')),
      [],
      '失败后残留了 staging 目录',
    );

    // 诊断必须含该连线的稳定标识（诊断码 + 关系 id）
    assert.match(result.stderr, /clean-flow\/edge-through-node/, '诊断缺稳定诊断码');
    assert.match(result.stderr, /a-to-b/, '诊断缺连线 id');

    // 干净目录：不得产出任何文件
    const freshTarget = path.join(clean, 'out.svg');
    const fresh = runCli(['svg', 'architecture', ir, freshTarget], stateDir);
    assert.notEqual(fresh.status, 0);
    assert.deepEqual(fs.readdirSync(clean), [], `校验不过却产出了文件：${fs.readdirSync(clean).join(', ')}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
    fs.rmSync(clean, { recursive: true, force: true });
  }
});

test('B. 同一目标两轮错误数不降：第 2 轮停止、退出码 3、报出未解决项与两个选项', () => {
  const dir = mkTmp('dd-degrade-b-');
  const stateDir = mkTmp('dd-degrade-b-state-');
  try {
    const ir = path.join(dir, 'through.json');
    const target = path.join(dir, 'out.svg');
    writeJson(ir, oneErrorIr());

    // 第 1 轮：基线，记录错误数 1，不停止
    const round1 = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(round1.status, 1, `第 1 轮应为普通失败（非停止）：${round1.stdout}\n${round1.stderr}`);
    assert.match(round1.stderr, /round 1/, '第 1 轮应回报轮次');
    assert.ok(!fs.existsSync(target), '第 1 轮不得产出文件');

    // 第 2 轮：同一目标、错误数未降 → 停止
    const round2 = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(round2.status, EXIT_DEGRADED_STOP, `第 2 轮应停止并返回退出码 ${EXIT_DEGRADED_STOP}`);
    assert.ok(!fs.existsSync(target), '停止时仍不得产出文件');

    let receipt;
    assert.doesNotThrow(() => { receipt = JSON.parse(round2.stdout); }, `停止报告应是结构化 JSON：${round2.stdout}`);
    assert.equal(receipt.ok, false);
    assert.equal(receipt.command, 'svg');
    assert.equal(receipt.stage, 'validate');
    assert.equal(receipt.type, 'architecture');
    assert.equal(receipt.target, target);

    // 停止判定：哪个图 / 当前错误数 / 前两轮错误数
    assert.equal(receipt.decision.stop, true);
    assert.equal(receipt.decision.reason, 'no-improvement');
    assert.equal(receipt.decision.round, 2);
    assert.equal(receipt.decision.currentErrors, 1);
    assert.equal(receipt.decision.previousErrors, 1);
    assert.deepEqual(receipt.decision.history, [1, 1]);

    // 未解决项：哪条诊断 + 稳定标识
    assert.equal(receipt.unresolved.length, 1);
    assert.equal(receipt.unresolved[0].code, 'clean-flow/edge-through-node');
    assert.equal(receipt.unresolved[0].subject.id, 'a-to-b');

    // 选择点：两个选项都在，且不替用户选
    assert.deepEqual(
      receipt.options.map((option) => option.id),
      ['keep-placeholder', 'continue-fixing'],
    );

    // 人类可读摘要同样给出当前错误数与前一轮错误数
    assert.match(round2.stderr, /current errors 1/i);
    assert.match(round2.stderr, /previous.*1/i);
    assert.match(round2.stderr, /保留占位继续落盘/);
    assert.match(round2.stderr, /继续修正/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('C. 一轮改善不误停；再续一轮不降才停', () => {
  const dir = mkTmp('dd-degrade-c-');
  const stateDir = mkTmp('dd-degrade-c-state-');
  try {
    const ir = path.join(dir, 'flow.json');
    const target = path.join(dir, 'out.svg');

    // 第 1 轮：2 条错误
    writeJson(ir, twoErrorIr());
    const round1 = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(round1.status, 1, '第 1 轮应是普通失败');

    // 第 2 轮：同一路径的 IR 被改好一条，错误数降到 1 → 改善，不停止
    writeJson(ir, oneErrorIr());
    const round2 = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(round2.status, 1, '错误数下降时不得停止');

    // 第 3 轮：内容不变，错误数仍为 1（未降）→ 停止
    const round3 = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(round3.status, EXIT_DEGRADED_STOP, '连续未降应在第 3 轮停止');
    const receipt = JSON.parse(round3.stdout);
    assert.deepEqual(receipt.decision.history, [2, 1, 1]);
    assert.equal(receipt.decision.currentErrors, 1);
    assert.equal(receipt.decision.previousErrors, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('D. 成功导出清除该目标轮次历史，旧账不误伤新图', () => {
  const dir = mkTmp('dd-degrade-d-');
  const stateDir = mkTmp('dd-degrade-d-state-');
  try {
    const ir = path.join(dir, 'flow.json');
    const target = path.join(dir, 'out.svg');

    // 先制造一次停止
    writeJson(ir, oneErrorIr());
    assert.equal(runCli(['svg', 'architecture', ir, target], stateDir).status, 1);
    assert.equal(runCli(['svg', 'architecture', ir, target], stateDir).status, EXIT_DEGRADED_STOP);

    // 换成合法 IR 导出成功 → 目标产出、历史被清除
    const valid = fs.readFileSync(path.join(EXAMPLES, 'web-app.architecture.json'), 'utf8');
    fs.writeFileSync(ir, valid);
    const ok = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(ok.status, 0, `合法 IR 应导出成功：${ok.stdout}\n${ok.stderr}`);
    assert.ok(fs.existsSync(target), '成功导出应产出 SVG');
    assert.ok(fs.existsSync(path.join(dir, 'out.json')), '成功导出应产出同名 IR');

    // 再回到坏 IR：历史已清，只算第 1 轮，不得立刻停止
    writeJson(ir, oneErrorIr());
    const after = runCli(['svg', 'architecture', ir, target], stateDir);
    assert.equal(after.status, 1, '成功应清除历史：坏 IR 重新只算第 1 轮');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('E. 不同目标互不串历史', () => {
  const dir = mkTmp('dd-degrade-e-');
  const stateDir = mkTmp('dd-degrade-e-state-');
  try {
    const ir = path.join(dir, 'through.json');
    writeJson(ir, oneErrorIr());

    const target1 = path.join(dir, 'one.svg');
    const target2 = path.join(dir, 'two.svg');

    assert.equal(runCli(['svg', 'architecture', ir, target1], stateDir).status, 1);
    assert.equal(runCli(['svg', 'architecture', ir, target1], stateDir).status, EXIT_DEGRADED_STOP);
    // 另一个目标应是全新的第 1 轮，不得被 target1 的历史牵连
    assert.equal(runCli(['svg', 'architecture', ir, target2], stateDir).status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});
