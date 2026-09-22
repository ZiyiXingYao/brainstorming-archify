/**
 * engine.test.mjs —— 把绘图内核的回归集接进根目录测试入口
 * ============================================================================
 *
 * 为什么要有这个文件
 * ------------------
 * 内核回归集住在 `scripts/diagram-engine/test/`，**不能搬**到 `tests/` 下：那 13 个用例都
 * 用「自己所在目录的上一级」当内核根（`from '../renderers/…'`、`path.join(HERE, '..', …)`、
 * `new URL('../…')` 三种写法之一），搬出去即系统性失效（此前整包搬动实测 85 个文件全红）。
 *
 * 但只跑 `node --test tests/*.test.mjs` 又会漏掉它。所以本文件在根目录入口里**唤起**那个
 * 入口，并断言它真的跑了、真的全过——这样「跑根目录测试」就等于「跑全部测试」。
 *
 * 只用 Node 内置模块，不依赖 node_modules。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ENTRY = path.join(ROOT, 'scripts', 'diagram-engine', 'test', 'run-valid.mjs');

/**
 * 跑一次内核回归集入口，结果缓存——本文件多个用例都要看它，跑一遍就够。
 *
 * @returns {{status: number|null, output: string}}
 */
let cached = null;
function engineSuite() {
  if (cached) return cached;
  // 必须剥掉 NODE_TEST_CONTEXT：run-valid.mjs 见到它（说明自己是被 node --test 发现的）
  // 会做防递归跳过，于是这里就变成「空跑」——正是本文件要防的那种静默失效。
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [ENTRY], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
  cached = { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  return cached;
}

test('内核回归集入口存在', () => {
  assert.ok(fs.existsSync(ENTRY), `缺少内核回归集入口：${ENTRY}`);
});

test('内核回归集全部通过，且确实跑了（不是空跑）', () => {
  const { status, output } = engineSuite();

  assert.equal(status, 0, `内核回归集应退出码 0\n${output}`);
  assert.match(output, /RESULT: PASS/, '入口应报告 PASS');

  // 文件级：跑了几个就通过几个，失败 0；并用下限兜住「清单被清空」这种静默失效。
  const files = /文件：(\d+) 个已跑，(\d+) 通过，(\d+) 失败/.exec(output);
  assert.ok(files, `应能解析文件级汇总\n${output}`);
  const [, ran, passed, failed] = files.map(Number);
  assert.equal(failed, 0, '失败文件数应为 0');
  assert.equal(ran, passed, '跑到的文件应全部通过');
  assert.ok(ran >= 10, `登记用例不应少于 10 个（当前 ${ran}）——若确实要删，请同批调低本下限`);

  // 用例级：必须有真实用例数，且没有跳过。
  const cases = /用例：(\d+) 个已跑，(\d+) 通过，(\d+) 失败，(\d+) 跳过/.exec(output);
  assert.ok(cases, `应能解析用例级汇总\n${output}`);
  const [, cRan, cPassed, cFailed, cSkipped] = cases.map(Number);
  assert.equal(cFailed, 0, '失败用例数应为 0');
  assert.equal(cSkipped, 0, '不应有用例被跳过');
  assert.equal(cRan, cPassed, '跑到的用例应全部通过');
  assert.ok(cRan >= 200, `用例数不应少于 200（当前 ${cRan}）——若确实要减，请同批调低本下限`);
});

test('被砍掉的能力在内核回归集里有守卫（不是只有 happy path）', () => {
  const { output } = engineSuite();
  // 这三个文件分别守 CLI 面、环境自检与品牌边界；缺任一说明覆盖被削弱。
  for (const name of ['cli-surface.test.mjs', 'doctor.test.mjs', 'brand-marks.test.mjs']) {
    assert.match(output, new RegExp(`✓\\s+${name.replace('.', '\\.')}`), `清单应包含并跑通 ${name}`);
  }
});
