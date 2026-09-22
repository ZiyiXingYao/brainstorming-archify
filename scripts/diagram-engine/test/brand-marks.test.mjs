/**
 * brand-marks.test.mjs —— 品牌标识的解析与非联网边界
 * ============================================================================
 *
 * 被测对象：`renderers/shared/brand-marks.mjs` 的 `prepareDiagramBrandMarks`。
 *
 * 本次裁剪砍掉了 `brands` 子命令（含 URL 抓取），因此本文件把「内置目录仍可用」
 * 与「URL / 摘要固定对象一律失败关闭、绝不联网」锁成回归测试。
 *
 * 只用 Node 内置模块，不依赖 node_modules。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.join(HERE, '..', 'renderers', 'shared', 'brand-marks.mjs');

const { prepareDiagramBrandMarks, brandMarkFor } = await import(MODULE);

/** 构一份只有品牌字段的最小架构图。 */
function diagramWith(brand) {
  return { components: [{ id: 'node-a', brand }] };
}

test('内置 canonical ID 可以解析', async () => {
  const diagram = diagramWith('postgresql');
  await prepareDiagramBrandMarks('architecture', diagram);
  assert.ok(brandMarkFor(diagram.components[0]), '内置 ID 应解析出品牌标记');
});

test('未知字符串被拒（并给出相近 ID）', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('definitely-not-a-brand-xyz')),
    /is not a built-in brand/,
  );
});

test('URL 字符串失败关闭，且提示不再指向已删除的 brands 命令', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('https://example.com/logo.png')),
    (error) => {
      assert.match(error.message, /is a URL/);
      assert.doesNotMatch(error.message, /brands capture/, '不应再提示运行已被删除的抓取命令');
      assert.doesNotMatch(error.message, /archify brands/, '不应再引用已删除的 CLI');
      return true;
    },
  );
});

test('摘要固定对象失败关闭', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith({
      url: 'https://example.com/logo.png',
      sha256: '0'.repeat(64),
    })),
    /is a pinned URL object/,
  );
});

test('失败关闭时错误是结构化诊断，带稳定 code', async () => {
  try {
    await prepareDiagramBrandMarks('architecture', diagramWith('https://example.com/logo.png'));
    assert.fail('应当抛出');
  } catch (error) {
    const codes = JSON.stringify(error) + String(error.message);
    assert.match(codes, /brand\/unsupported-url/, '应带稳定诊断 code');
  }
});

test('没有任何 brand 字段时不做任何处理', async () => {
  const diagram = { components: [{ id: 'plain' }] };
  await prepareDiagramBrandMarks('architecture', diagram);
  assert.equal(brandMarkFor(diagram.components[0]), null);
});
