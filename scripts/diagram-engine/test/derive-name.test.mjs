/**
 * design-diagrams —— 图名派生用例（任务 2.5）
 * ============================================================================
 *
 * 被测对象：`design-diagrams/lib/derive-name.mjs`
 *
 * 算法（design.md 决策四 / execution-contract 接口约束 3）：
 *   1. 输入来源名（流程名或章节语义名），输出可用作文件名的 slug；
 *   2. 保留字母、数字与 CJK 字符；
 *   3. 其余字符（空白、标点、路径分隔符等）替换为 `-`；
 *   4. 连续 `-` 折叠为单个 `-`；
 *   5. 去掉首尾 `-`；
 *   6. ASCII 部分小写化（非 ASCII 原样保留）；
 *   7. 派生结果为空时回落到图类型名；
 *   8. 派生结果冲突时追加 `-2`、`-3`（依次递增），并把冲突双方报告出来，不静默改名。
 *
 * 覆盖六类输入：普通名、含标点、含 CJK、全非法字符（落到空）、冲突、空结果回落。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveDiagramSlug, deriveDiagramName, deriveDiagramNames } from '../lib/derive-name.mjs';

test('① 普通名：按空白分词并小写化', () => {
  assert.equal(deriveDiagramSlug('Order Flow', 'workflow'), 'order-flow');
  assert.equal(deriveDiagramSlug('Cache Miss Request', 'sequence'), 'cache-miss-request');
});

test('② 含标点：标点、路径分隔符等替换为 `-`', () => {
  assert.equal(deriveDiagramSlug('API: /users, list!', 'sequence'), 'api-users-list');
  assert.equal(deriveDiagramSlug('auth/login -> token', 'workflow'), 'auth-login-token');
  // 连续分隔符折叠为单个 `-`，并去掉首尾 `-`
  assert.equal(deriveDiagramSlug('  --Order---Flow--  ', 'workflow'), 'order-flow');
});

test('③ 含 CJK：CJK 原样保留，ASCII 部分小写化', () => {
  assert.equal(deriveDiagramSlug('下单流程', 'lifecycle'), '下单流程');
  assert.equal(deriveDiagramSlug('Order 下单 FLOW', 'workflow'), 'order-下单-flow');
  assert.equal(deriveDiagramSlug('用户 2.0 登录', 'sequence'), '用户-2-0-登录');
});

test('④ 全非法字符：派生结果为空时回落到图类型名', () => {
  assert.equal(deriveDiagramSlug('!!!---   ', 'architecture'), 'architecture');
  assert.equal(deriveDiagramSlug('///', 'dataflow'), 'dataflow');
});

test('⑤ 空结果回落：空串与纯空白同样回落', () => {
  assert.equal(deriveDiagramSlug('', 'dataflow'), 'dataflow');
  assert.equal(deriveDiagramSlug('   ', 'workflow'), 'workflow');
  assert.equal(deriveDiagramSlug(null, 'lifecycle'), 'lifecycle');
  assert.equal(deriveDiagramSlug(undefined, 'sequence'), 'sequence');
});

test('数字与字母数字混排保留', () => {
  assert.equal(deriveDiagramSlug('Phase 2 rollout', 'workflow'), 'phase-2-rollout');
  assert.equal(deriveDiagramSlug('S3 -> Lambda', 'dataflow'), 's3-lambda');
});

test('⑥ 冲突：追加 `-2`、`-3` 并报出冲突双方', () => {
  const first = deriveDiagramName('Order Flow', 'workflow', []);
  assert.equal(first.name, 'order-flow');
  assert.equal(first.conflict, null);

  const second = deriveDiagramName('Order Flow', 'workflow', ['order-flow']);
  assert.equal(second.name, 'order-flow-2');
  assert.notEqual(second.conflict, null, '冲突必须被报告，不得静默改名');
  assert.equal(second.conflict.base, 'order-flow');
  assert.equal(second.conflict.collidedWith, 'order-flow');
  assert.equal(second.conflict.attempt, 1);

  const third = deriveDiagramName('order/flow', 'workflow', ['order-flow', 'order-flow-2']);
  assert.equal(third.name, 'order-flow-3');
  assert.equal(third.conflict.collidedWith, 'order-flow');
});

test('⑥ 冲突：批量派生把「冲突双方」都列出来', () => {
  const { entries, conflicts } = deriveDiagramNames([
    { source: 'Order Flow', type: 'workflow' },
    { source: 'order/flow', type: 'workflow' },
    { source: '无关名', type: 'sequence' },
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.name),
    ['order-flow', 'order-flow-2', '无关名'],
  );

  assert.equal(conflicts.length, 1);
  const [conflict] = conflicts;
  assert.equal(conflict.base, 'order-flow');
  assert.deepEqual(
    conflict.sides.map((side) => side.source),
    ['Order Flow', 'order/flow'],
    '冲突双方必须都被报告',
  );
  assert.deepEqual(
    conflict.sides.map((side) => side.name),
    ['order-flow', 'order-flow-2'],
  );
});

test('回落与冲突叠加：回落名同样参与冲突计数', () => {
  const first = deriveDiagramName('!!!', 'architecture', []);
  assert.equal(first.name, 'architecture');
  assert.equal(first.fellBack, true);

  const second = deriveDiagramName('???', 'architecture', ['architecture']);
  assert.equal(second.name, 'architecture-2');
  assert.equal(second.fellBack, true);
  assert.equal(second.conflict.base, 'architecture');
});
