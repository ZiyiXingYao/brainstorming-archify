#!/usr/bin/env node
/**
 * diagram-engine —— 裁剪结构下的「可跑测试子集」验证入口
 * ============================================================================
 *
 * 背景
 * ----
 * `scripts/diagram-engine/test/` 是上游 archify 仓库根 `test/` 的**整包搬运**（见
 * ../UPSTREAM.md），但技能包被搬入本仓库时是「裁剪结构」：上游仓库根的构建 / CI /
 * 发布 / 站点工具、`viewer/`、`benchmarks/`、`examples/`、`references/` 与三份
 * `README*.md` 都未搬入。
 *
 * 搬入时按本仓库的目录布局做过一次**定位适配**（见 ../UPSTREAM.md 第 1 节的偏离表）：
 * 包根由 `path.resolve(…, '..', 'archify')` 改为 `path.resolve(…, '..')`，
 * import 说明符的前缀 `../archify/` 改为 `../`，入口名 `archify.mjs` 改为
 * `render-driver.mjs`。断言逻辑一字未改。
 *
 * **裁剪后的实况口径**（不要再用裁剪前的统计）：上游基准（commit 1c2b42d，技能包 3.1.0）
 * 下，本目录对上游整包（212 个 `*.test.mjs`）逐文件**串行**实测，只有实测退出码 0
 * 且确有用例通过的那批进入 `UPSTREAM_VALID`；其余按成因登记在 ../UPSTREAM.md 第 4 节，
 * 文件本身仍留在盘上（不删除），入口只在末尾以 drift 提示列出未登记者。
 *
 * 本入口做什么
 * ------------
 * 只跑「在裁剪结构里成立」的那批用例，一条命令给出总判定：
 *
 *   node scripts/diagram-engine/test/run-valid.mjs
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
 * 本仓库自己新增能力的用例同样放在本目录，但**不属于**上游清单。加用例只需三步：
 *
 *   1. 在本目录新建 `xxx.test.mjs`（只依赖 Node 内置模块，不要引 `node_modules`）；
 *   2. 把该文件名加进下面的 `LOCAL_TESTS` 数组；
 *   3. 直接 `node scripts/diagram-engine/test/run-valid.mjs` 复跑——本地用例与上游
 *      用例在同一个入口里一起跑、一起计入总判定。
 *
 * 两个数组的边界要守住：
 *   - `UPSTREAM_VALID` = 从上游基准实测出来的全绿清单，同步上游时整体替换；
 *   - `LOCAL_TESTS`   = 本仓库自己的用例，同步上游时保持不动。
 * 不要把自己的用例塞进 `UPSTREAM_VALID`，也不要把上游用例塞进 `LOCAL_TESTS`。
 *
 * 忘了登记也不会静默：运行末尾会扫描本目录下所有 `*.test.mjs`，把「既不在上游
 * 清单、也不在本地清单」的文件列为 drift 提示（只提示，不改变退出码）。
 *
 * 曾有一段「负载敏感文件宽容」机制，只服务 `update-notifier.test.mjs`。该文件已随
 * 裁剪删除，机制随之移除：现在每个清单内文件只跑一次，失败就是失败——不再有
 * 「已知假红不计入判定」这条会掩盖确定性回归的通道。
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
 * 本内核裁剪后**实测仍然全绿**的上游用例。
 *
 * 上游基准（commit 58ab0b98…，技能包 3.0.1）下，本目录对上游整包（165 个 *.test.mjs）
 * 逐文件**串行**实测（`node --test --test-reporter=tap <file>`），退出码 0 且 pass>0 者入本清单。
 *
 * 本次裁剪按设计删除了：除 render / validate / doctor 之外的全部子命令（compare /
 * deliver / finalize / preview / migrate / inspect / check / visual-check /
 * browser-check / guide / brands / examples / demo）、`--repo-root` 代码溯源能力、
 * `examples/`、`references/`、`recipes/`、`delta/`、`SKILL.md`，把入口 `bin/archify.mjs`
 * 裁成内部驱动 `bin/render-driver.mjs`，并收窄品牌为「只认内置 canonical ID、不联网」。
 * 实测失败的上游用例因此都落在同一批成因上（缺已删入口 / 样例 / 文档 / 参考资料、
 * 未安装的 devDependencies、布局适配未覆盖的路径），逐条分类记在 `../UPSTREAM.md`
 * 第 4 节。**未通过者留在盘上、只在清单之外**；将来需要时从 `../UPSTREAM.md`
 * 第 1 节的基准 commit 重新取。
 * **改动裁剪范围后必须重跑重测**：本清单是「实测全绿」的记录，不是愿望清单。
 */
export const UPSTREAM_VALID = [
  'architecture-component-diagnostics.test.mjs',
  'architecture-leading-space.test.mjs',
  'architecture-readable-routing-labels.test.mjs',
  'architecture-readable-routing.test.mjs',
  'architecture-return-margin.test.mjs',
  'architecture-route-bends.test.mjs',
  'automatic-label-slots.test.mjs',
  'class-first-draft-layout.test.mjs',
  'dataflow-automatic-layout.test.mjs',
  'dataflow-label-capacity.test.mjs',
  'dataflow-label-visibility.test.mjs',
  'erd-first-draft-layout.test.mjs',
  'geometry.test.mjs',
  'grid.test.mjs',
  'legend-contract.test.mjs',
  'lifecycle-junction.test.mjs',
  'native-output-path.test.mjs',
  'path-boundary-contract.test.mjs',
  'path-semantics.test.mjs',
  'portable-path.test.mjs',
  'renderer-diagnostic-boundary.test.mjs',
  'renderer-import-isolation.test.mjs',
  'route-detour.test.mjs',
  'route-quality-grid.test.mjs',
  'sequence-note-wrap.test.mjs',
  'sequence-segment-labels.test.mjs',
  'sequence-self-message.test.mjs',
  'settled-flow.test.mjs',
  'spatial-grid.test.mjs',
  'spread-regression.test.mjs',
  'svg-path-analysis.test.mjs',
  'v1-compatibility.test.mjs',
  'vertical-edge.test.mjs',
  'workflow-absolute-sizing-diagnostics.test.mjs',
  'workflow-action-pinning.test.mjs',
  'workflow-arrival-corridor.test.mjs',
  'workflow-compiler-call-contract.test.mjs',
  'workflow-compiler-hard-contract.test.mjs',
  'workflow-counterflow-spacing.test.mjs',
  'workflow-crossing-repair.test.mjs',
  'workflow-placed-label-evidence.test.mjs',
  'workflow-placement-repair.test.mjs',
  'workflow-port-slot.test.mjs',
  'workflow-route-order.test.mjs',
  'workflow-semantic-contract.test.mjs',
  'workflow-shared-trunks.test.mjs',
  'workflow-straight-reservation.test.mjs',
  'workflow-vertical-label.test.mjs',
];

/**
 * 本仓库自己新增能力的用例登记处。
 *
 * 曾随上游搬入的 `svg-export.test.mjs`、`svg-degrade.test.mjs` 与内核侧 `install.test.mjs`
 * 已随本次裁剪删除（旧入口改名、`install.mjs` 重写为单技能安装）。端到端覆盖改由仓库根
 * `tests/` 承担：`tests/render.smoke.test.mjs` 覆盖三件套产出、`tests/render.entry.test.mjs`
 * 覆盖唯一入口契约、`tests/install.test.mjs` 覆盖安装器。
 */
export const LOCAL_TESTS = [
  // Node 侧 CSS 抽取器（静态复刻 viewer/export.js 的规则抽取）
  'svg-css-extract.test.mjs',
  // 主题变量解析（静态复刻 getComputedStyle 的变量计算语义）
  'svg-theme-vars.test.mjs',
  // 图名派生（保留字母数字与 CJK、折叠去首尾、空结果回落、冲突报双方）
  'derive-name.test.mjs',
  // 驱动 CLI 面：三个保留子命令可用；已砍子命令与 --repo-root 逐个被拒
  'cli-surface.test.mjs',
  // 环境自检：正常退出码 0；运行期必需文件缺失时非零退出并点名
  'doctor.test.mjs',
  // 品牌：内置 canonical ID 可解析；URL 与摘要固定对象失败关闭且不联网
  'brand-marks.test.mjs',
  // 自建 flowchart：结构拒绝（起始端子/可达性/分支标签/端点/id 重复）、showcase 构图合规、
  // 接线完整性（入口类型表与 doctor）、品牌边界
  'flowchart.test.mjs',
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

function failingTestNames(tap) {
  const names = [];
  for (const line of tap.split('\n')) {
    const match = line.match(/^\s*not ok \d+ - (.+?)\s*$/);
    if (match) names.push(match[1]);
  }
  return names;
}

function runOne(file) {
  const absolute = path.join(HERE, file);
  if (!fs.existsSync(absolute)) {
    return {
      file,
      ok: false,
      pass: 0,
      fail: 0,
      tests: 0,
      skipped: 0,
      note: '',
      failedTests: [],
      detail: `清单指向的文件不存在：${absolute}`,
    };
  }
  const raw = spawnSync(process.execPath, ['--test', '--test-reporter=tap', absolute], {
    cwd: RUN_CWD,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = raw.stdout ?? '';
  const stderr = raw.stderr ?? '';
  const ok = raw.status === 0;
  return {
    file,
    ok,
    ...parseTapCounts(stdout),
    note: '',
    failedTests: ok ? [] : failingTestNames(stdout),
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
      console.log(
        `  ✓ ${r.file} (pass=${r.pass}${r.skipped ? ` skipped=${r.skipped}` : ''})`,
      );
      if (r.note) console.log(`      ↻ ${r.note}`);
    } else {
      console.log(`  ✗ ${r.file} (pass=${r.pass} fail=${r.fail})`);
      if (r.note) console.log(`      ↻ ${r.note}`);
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
