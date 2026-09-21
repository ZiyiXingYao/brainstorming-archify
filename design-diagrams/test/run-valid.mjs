#!/usr/bin/env node
/**
 * design-diagrams —— 裁剪结构下的「可跑测试子集」验证入口
 * ============================================================================
 *
 * 背景
 * ----
 * `design-diagrams/test/` 是从上游 archify 仓库（见 ../UPSTREAM.md）整包逐字节
 * 搬来的测试集，但技能包被搬入本仓库时是「裁剪结构」：
 *   - 仓库根的 `scripts/`（构建 / CI / 发布 / 站点工具）与 `viewer/` 未搬入；
 *   - 上游三份 `README*.md` 与官网 / docs 站未搬入；
 *   - `benchmarks/` 未搬入；
 *   - 未安装 `node_modules`（上游 devDependencies：ajv / parse5 / saxes / simple-icons）。
 * 因此上游 115 个测试文件里有 37 个在本仓库**结构上不可能通过**——它们不是在
 * 断言本技能的运行时行为，而是在检查上游仓库自身的构建产物、发布门禁、站点、
 * 仓库根元数据。这 37 个文件与原因逐条记在 ../UPSTREAM.md。
 *
 * 本入口做什么
 * ------------
 * 只跑「在裁剪结构里成立」的那批用例，一条命令给出总判定：
 *
 *   node design-diagrams/test/run-valid.mjs
 *
 * 退出码：0 = 清单内全部文件通过；1 = 有文件失败（或清单指向的文件不存在）。
 * 不读取、也不安装 `node_modules`：只用 Node 内置模块 + `node --test`。
 *
 * 为什么用显式清单而不是通配
 * --------------------------
 * 通配（比如 `*.test.mjs`）会把上游以后新增的、或本仓库环境下必红的文件悄悄拉
 * 进来，让「全绿」这个信号失真。显式清单是**测量冻结**的：清单里的每一个文件都
 * 在基准 commit 下逐文件实测过退出码 0。上游换版本时按 ../UPSTREAM.md 的流程整体
 * 重测并替换清单，而不是让边界漂移。
 *
 * 以后怎么加「本次新增能力」的用例（下一波及以后）
 * ------------------------------------------------
 * 本仓库自己新增能力的用例同样放在本目录（`design-diagrams/test/`），但**不属于**
 * 上游清单。加用例只需三步：
 *
 *   1. 在本目录新建 `xxx.test.mjs`（只依赖 Node 内置模块，不要引 `node_modules`）；
 *   2. 把该文件名加进下面的 `LOCAL_TESTS` 数组；
 *   3. 直接 `node design-diagrams/test/run-valid.mjs` 复跑——本地用例与上游用例
 *      在同一个入口里一起跑、一起计入总判定。
 *
 * 两个数组的边界要守住：
 *   - `UPSTREAM_VALID` = 从上游基准实测出来的全绿清单，同步上游时整体替换；
 *   - `LOCAL_TESTS`   = 本仓库自己的用例，同步上游时保持不动。
 * 不要把自己的用例塞进 `UPSTREAM_VALID`，也不要把上游用例塞进 `LOCAL_TESTS`。
 *
 * 忘了登记也不会静默：运行末尾会扫描本目录下所有 `*.test.mjs`，把「既不在上游
 * 清单、也不在本地清单」的文件列为 drift 提示（只提示，不改变退出码）。
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = path.basename(fileURLToPath(import.meta.url));
// 逐文件实测时的调用目录（仓库根），保持一致以免结果依赖调用方 cwd。
const RUN_CWD = path.resolve(HERE, '..', '..');

/**
 * 上游基准（commit 5289f686…，技能包 2.17.0-dev.1）下逐个文件实测退出码为 0 的用例。
 * 顺序照抄实测输出，**不要**在这里加本仓库自己的用例。
 */
export const UPSTREAM_VALID = [
  'animation.test.mjs',
  'architecture-compare-recovery.test.mjs',
  'artifact-receipt-flush.test.mjs',
  'authored-reachability.test.mjs',
  'base-input-compatibility.test.mjs',
  'chapter-delta-preview.test.mjs',
  'chapter-handoff.test.mjs',
  'chapter-rail.test.mjs',
  'cli-output-types.test.mjs',
  'degraded.test.mjs',
  'desktop-reader-browser.test.mjs',
  'diagram-guide.test.mjs',
  'engineering-profile.test.mjs',
  'export-browser.test.mjs',
  'export-cleanup-browser.test.mjs',
  'finder-browser.test.mjs',
  'finder.test.mjs',
  'focus-browser.test.mjs',
  'geometry.test.mjs',
  'grid.test.mjs',
  'guide.test.mjs',
  'guided-views-browser.test.mjs',
  'guided-views.test.mjs',
  'i18n.test.mjs',
  'intent-trace-browser.test.mjs',
  'intent-trace.test.mjs',
  'layout-rules.test.mjs',
  'legend-contract.test.mjs',
  'motion-governor-browser.test.mjs',
  'motion-governor.test.mjs',
  'open-artifact.test.mjs',
  'output-path.test.mjs',
  'presentation.test.mjs',
  'preset-tryon.test.mjs',
  'preview.test.mjs',
  'reader-layout-browser.test.mjs',
  'relationship-direct-explorer.test.mjs',
  'relationship-lens.test.mjs',
  'relationship-permalink.test.mjs',
  'relationship-pulse.test.mjs',
  'render-output-checks.test.mjs',
  'renderer-diagnostic-boundary.test.mjs',
  'repair-receipt.test.mjs',
  'repository-evidence-replacement.test.mjs',
  'repository-evidence.test.mjs',
  'route-journey.test.mjs',
  'route-probe-browser.test.mjs',
  'route-probe.test.mjs',
  'semantic-camera.test.mjs',
  'semantic-flow.test.mjs',
  'semantic-legend-gateway.test.mjs',
  'semantic-lens-browser.test.mjs',
  'semantic-lens.test.mjs',
  'semantic-passport.test.mjs',
  'semantic-radar.test.mjs',
  'semantic-zoom.test.mjs',
  'settled-flow.test.mjs',
  'story-beat-navigator.test.mjs',
  'story-carrier.test.mjs',
  'story-director-strip.test.mjs',
  'story-follow-camera.test.mjs',
  'story-horizon.test.mjs',
  'story-moment-link.test.mjs',
  'story-shelf.test.mjs',
  'story-trail.test.mjs',
  'toolbar-polish.test.mjs',
  'update-contract.test.mjs',
  'update-notifier.test.mjs',
  'v1-compatibility.test.mjs',
  'vertical-edge.test.mjs',
  'viewer-camera-browser.test.mjs',
  'viewer-chrome-layout.test.mjs',
  'viewer-identifiers-browser.test.mjs',
  'visual-check.test.mjs',
  'workflow-compiler-hard-contract.test.mjs',
  'workflow-compiler.test.mjs',
  'workflow-migration.test.mjs',
  'workflow-semantic-contract.test.mjs',
];

/**
 * 本仓库自己新增能力的用例登记处——**初始为空**。
 * 往这里加文件名即可（见文件头的「以后怎么加」三步）。这些文件与上游清单一起跑、
 * 一起计入总判定，但不会被同步上游的流程覆盖。
 */
export const LOCAL_TESTS = [
  // 例：'design-diagrams-smoke.test.mjs',
];

/** 上游全绿清单 + 本地新增清单 = 本入口实际执行的文件。 */
export const VALID_TESTS = [...UPSTREAM_VALID, ...LOCAL_TESTS];

function parseTapCounts(tap) {
  const pick = (key) => {
    const match = tap.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    return match ? Number(match[1]) : 0;
  };
  return { tests: pick('tests'), pass: pick('pass'), fail: pick('fail'), skipped: pick('skipped') };
}

function firstFailure(output) {
  const lines = output.split('\n');
  const notOk = lines.find((line) => line.startsWith('not ok '));
  const errorLine = lines.find((line) =>
    /(^|\s)(Error|AssertionError|TypeError|ReferenceError)\b/.test(line) || line.includes('Cannot find'),
  );
  const parts = [];
  if (notOk) parts.push(notOk.replace(/^not ok \d+ - /, '').trim());
  if (errorLine) parts.push(errorLine.trim());
  const text = parts.join(' — ') || '(no error line captured)';
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

function runOne(file) {
  const absolute = path.join(HERE, file);
  if (!fs.existsSync(absolute)) {
    return { file, ok: false, pass: 0, fail: 0, tests: 0, skipped: 0, detail: `清单指向的文件不存在：${absolute}` };
  }
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', absolute], {
    cwd: RUN_CWD,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const counts = parseTapCounts(stdout);
  const ok = result.status === 0;
  return {
    file,
    ok,
    ...counts,
    detail: ok ? '' : firstFailure(`${stdout}\n${stderr}`),
  };
}

function drift() {
  const registered = new Set(VALID_TESTS);
  return fs
    .readdirSync(HERE)
    .filter((name) => name.endsWith('.test.mjs'))
    .filter((name) => name !== SELF && !registered.has(name))
    .sort();
}

function main() {
  const results = [];
  for (const file of VALID_TESTS) results.push(runOne(file));

  console.log('design-diagrams —— 裁剪结构下的可跑测试子集');
  console.log(
    `清单：上游全绿 ${UPSTREAM_VALID.length} + 本地新增 ${LOCAL_TESTS.length} = ${VALID_TESTS.length} 个文件`,
  );
  console.log('');

  for (const r of results) {
    if (r.ok) {
      console.log(`  ✓ ${r.file} (pass=${r.pass}${r.skipped ? ` skipped=${r.skipped}` : ''})`);
    } else {
      console.log(`  ✗ ${r.file} (pass=${r.pass} fail=${r.fail})`);
      console.log(`      → ${r.detail}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  const totals = results.reduce(
    (acc, r) => ({
      tests: acc.tests + r.tests,
      pass: acc.pass + r.pass,
      fail: acc.fail + r.fail,
      skipped: acc.skipped + r.skipped,
    }),
    { tests: 0, pass: 0, fail: 0, skipped: 0 },
  );

  console.log('');
  console.log(
    `文件：${results.length} 个已跑，${results.length - failed.length} 通过，${failed.length} 失败`,
  );
  console.log(
    `用例：${totals.tests} 个已跑，${totals.pass} 通过，${totals.fail} 失败，${totals.skipped} 跳过`,
  );
  if (failed.length > 0) {
    console.log('');
    console.log('失败文件：');
    for (const r of failed) console.log(`  - ${r.file}`);
  }

  const unregistered = drift();
  if (unregistered.length > 0) {
    console.log('');
    console.log(
      `提示：本目录还有 ${unregistered.length} 个 *.test.mjs 未登记，本入口不会执行它们：`,
    );
    for (const name of unregistered) console.log(`  - ${name}`);
    console.log('  （上游同步产生的文件按 ../UPSTREAM.md 重测后替换 UPSTREAM_VALID；');
    console.log('    本仓库新增用例请加进 LOCAL_TESTS。此提示不影响退出码。）');
  }

  console.log('');
  console.log(failed.length === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exitCode = failed.length === 0 ? 0 : 1;
}

// 若被 `node --test` 当作测试文件发现（NODE_TEST_CONTEXT 由测试运行器注入），
// 只登记为「无事发生」，避免本入口在测试运行器里递归再跑一遍整套。
if (!process.env.NODE_TEST_CONTEXT) {
  main();
} else {
  console.error('run-valid.mjs 被 node --test 发现，已跳过以免递归；请直接 `node design-diagrams/test/run-valid.mjs` 运行。');
}
