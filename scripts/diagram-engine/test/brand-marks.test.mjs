/**
 * brand-marks.test.mjs —— 品牌标识的解析与非联网边界
 * ============================================================================
 *
 * 被测对象：`renderers/shared/brand-marks.mjs`。
 *
 * 本次裁剪砍掉了 `brands` 子命令（含 URL 抓取），因此本文件把「内置目录仍可用」
 * 与「任何 URL / 摘要固定对象一律失败关闭、绝不联网」锁成回归测试。
 *
 * 断言绑在**稳定契约**上：`error.archifyDiagnostics[].code`（`brand/unknown` /
 * `brand/unsupported-url`），而不是人工可读的提示文案——文案改写不该让用例变红。
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

/**
 * 五种图型的集合名。这个映射写错不会报错，只会静默跳过品牌校验与顶栏渲染
 * （取到空数组即 no-op），是最需要锁定的失效路径。
 */
const COLLECTION_BY_TYPE = Object.freeze({
  architecture: 'components',
  workflow: 'nodes',
  sequence: 'participants',
  dataflow: 'nodes',
  lifecycle: 'states',
});

/** 按图型构一份只有品牌字段的最小 IR。 */
function diagramWith(brand, type = 'architecture') {
  return { [COLLECTION_BY_TYPE[type]]: [{ id: 'node-a', brand }] };
}

/** 取首个诊断 code（对外稳定契约）。 */
function firstCode(error) {
  return error?.archifyDiagnostics?.[0]?.code;
}

test('内置 canonical ID 可以解析', async () => {
  const diagram = diagramWith('postgresql');
  await prepareDiagramBrandMarks('architecture', diagram);
  assert.ok(brandMarkFor(diagram.components[0]), '内置 ID 应解析出品牌标记');
});

test('五种图型的集合映射都生效', async () => {
  for (const [type, collection] of Object.entries(COLLECTION_BY_TYPE)) {
    const diagram = diagramWith('postgresql', type);
    await prepareDiagramBrandMarks(type, diagram);
    assert.ok(
      brandMarkFor(diagram[collection][0]),
      `${type} 的 ${collection} 应解析出品牌标记（映射写错会静默 no-op）`,
    );
  }
});

test('未知字符串被拒，诊断 code 为 brand/unknown', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('definitely-not-a-brand-xyz')),
    (error) => {
      assert.equal(firstCode(error), 'brand/unknown');
      return true;
    },
  );
});

test('URL 字符串失败关闭，且提示不再指向已删除的 CLI', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('https://example.com/logo.png')),
    (error) => {
      assert.equal(firstCode(error), 'brand/unsupported-url');
      const text = JSON.stringify(error.archifyDiagnostics) + String(error.message);
      assert.doesNotMatch(text, /brands capture/, '不应再提示运行已被删除的抓取命令');
      assert.doesNotMatch(text, /archify brands/, '不应再引用已删除的 CLI');
      return true;
    },
  );
});

test('域名不做映射：URL 形式被拒为 URL，裸域名被拒为未知品牌', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('https://github.com/x')),
    (error) => {
      assert.equal(firstCode(error), 'brand/unsupported-url', '已知品牌域名的 URL 也不接受');
      return true;
    },
  );
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('github.com')),
    (error) => {
      assert.equal(firstCode(error), 'brand/unknown', '裸域名不是品牌 ID');
      return true;
    },
  );
});

test('品牌值里出现 URL 字样不会被误分类为 URL 输入', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('myURL')),
    (error) => {
      assert.equal(firstCode(error), 'brand/unknown', '"myURL" 只是未知 ID，不是 URL 输入');
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
    (error) => {
      assert.equal(firstCode(error), 'brand/unsupported-url');
      return true;
    },
  );
});

test('纯空白品牌值不给出误导性的相近 ID 建议', async () => {
  await assert.rejects(
    () => prepareDiagramBrandMarks('architecture', diagramWith('   ')),
    (error) => {
      assert.equal(firstCode(error), 'brand/unknown');
      assert.doesNotMatch(
        error.archifyDiagnostics[0].message,
        /airtable/,
        '空白输入不应退化成字母序前几个无关 ID',
      );
      return true;
    },
  );
});

test('没有任何 brand 字段时不做任何处理', async () => {
  const diagram = { components: [{ id: 'plain' }] };
  await prepareDiagramBrandMarks('architecture', diagram);
  assert.equal(brandMarkFor(diagram.components[0]), null);
});
