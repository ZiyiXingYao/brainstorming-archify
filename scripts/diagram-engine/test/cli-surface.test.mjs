/**
 * cli-surface.test.mjs —— 绘图内核驱动的 CLI 面
 * ============================================================================
 *
 * 被测对象：`bin/render-driver.mjs`（上游 archify.mjs 裁到 render/validate/doctor 后的内部驱动）。
 *
 * 断言两件事：
 *   ① 保留的三个子命令可用；
 *   ② 被砍掉的十一个子命令与 `--repo-root` 参数**确实不再被接受**（不是靠人眼 grep 认定）。
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
const DRIVER = path.join(HERE, '..', 'bin', 'render-driver.mjs');
const DRIVER_SRC = path.join(HERE, '..', 'bin', 'render-driver.mjs');

/** 本次裁剪按设计砍掉的十一个子命令。 */
const REMOVED_SUBCOMMANDS = [
  'compare', 'deliver', 'preview', 'migrate', 'inspect',
  'check', 'visual-check', 'guide', 'brands', 'examples', 'demo',
];

function run(args) {
  return spawnSync(process.execPath, [DRIVER, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

test('三个保留子命令出现在用法里', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, `--help 应退出码 0，实际 ${result.status}`);
  for (const command of ['render', 'validate', 'doctor']) {
    assert.match(result.stdout, new RegExp(`\\b${command}\\b`), `用法应列出 ${command}`);
  }
});

test('无参数时打印用法且退出码 0', () => {
  const result = run([]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test('十一个已砍子命令逐个被拒（非零退出）', () => {
  for (const command of REMOVED_SUBCOMMANDS) {
    const result = run([command]);
    assert.notEqual(
      result.status,
      0,
      `已砍子命令 "${command}" 应被拒绝，实际退出码 0。若它仍可用，说明裁剪不完整。`,
    );
    assert.match(result.stderr, /Unknown command/, `${command} 应报未知命令`);
  }
});

test('未知子命令被拒', () => {
  const result = run(['definitely-not-a-command']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown command/);
});

test('render 不接受 --repo-root', () => {
  const result = run(['render', 'architecture', '/nonexistent.json', '/tmp/out', '--repo-root', '/tmp']);
  assert.notEqual(result.status, 0, '--repo-root 应被拒绝');
});

test('validate 不接受 --repo-root', () => {
  const result = run(['validate', 'architecture', '/nonexistent.json', '--repo-root', '/tmp']);
  assert.notEqual(result.status, 0, '--repo-root 应被拒绝');
  assert.match(result.stderr, /Unknown validate option/);
});

test('validate 只接受 --json 与 --layout-json', () => {
  const result = run(['validate', 'architecture', '/nonexistent.json', '--nope']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown validate option/);
});

test('未知 --quality 值被拒', () => {
  const result = run(['render', 'architecture', '/nonexistent.json', '/tmp/out', '--quality', 'bogus']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality/i);
});

test('未知图类型被拒', () => {
  const result = run(['validate', 'classdiagram', '/nonexistent.json']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown diagram type/);
});

test('doctor 不接受未知选项', () => {
  const result = run(['doctor', '--bogus']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown doctor option/);
});

test('驱动源码里不再有代码溯源能力（--repo-root / 证据模块）', () => {
  const source = fs.readFileSync(DRIVER_SRC, 'utf8');
  assert.doesNotMatch(source, /extractRepoRootArgs/, '不应残留 --repo-root 解析函数');
  assert.doesNotMatch(source, /ARCHIFY_REPO_ROOT/, '不应残留溯源环境变量');
  assert.doesNotMatch(source, /verifyRepositoryEvidence/, '不应残留证据校验调用');
  assert.doesNotMatch(source, /repository-evidence\.mjs|repository-location\.mjs/, '不应 import 已删模块');
});

test('驱动源码里不再有已砍子命令的实现体', () => {
  const source = fs.readFileSync(DRIVER_SRC, 'utf8');
  for (const command of REMOVED_SUBCOMMANDS) {
    const fn = `function command${
      command.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
    }`;
    assert.ok(!source.includes(fn), `不应残留 ${fn} 的实现`);
  }
});
