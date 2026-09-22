/**
 * doc-consistency.test.mjs —— 文档与实况一致性的机械断言
 * ============================================================================
 *
 * 本次把上游「读 SKILL.md 做内容断言」的文档用例随失效测试一起删掉了，文档便再没有
 * 机械看门人。本文件把那部分补回来，锁住本次改写的关键约定，防止后续静默回退：
 *   ① `skill/SKILL.md` 含绘图规划 Gate、三件套、落点/命名硬规则、两行引用、主节点上限、
 *      自审 15 项，且不含已被裁剪掉的机制名与 `--repo-root`；
 *   ② 三份模板齐备，两份配图模板含三件套与两行引用；
 *   ③ 迁移残留：`skill/`、`templates/` 内不得出现 `design-diagrams`（README 只允许历史条目）。
 *
 * 只用 Node 内置模块，不依赖 node_modules。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SKILL = 'skill/SKILL.md';
const ARCH_TEMPLATE = 'templates/architecture-doc-template.md';
const MODULE_TEMPLATE = 'templates/module-doc-template.md';

test('技能入口在约定位置', () => {
  for (const rel of [SKILL, 'skill/design-doc-reviewer-prompt.md']) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `缺少 ${rel}`);
  }
});

test('三份模板齐备（接口契约模板不可少）', () => {
  for (const rel of [
    ARCH_TEMPLATE,
    MODULE_TEMPLATE,
    'templates/interface-contract-template.md',
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `缺少 ${rel}`);
  }
});

test('SKILL.md 含绘图规划 Gate 与三件套', () => {
  const skill = read(SKILL);
  assert.match(skill, /Diagram Planning Gate/, '应含绘图规划 Gate');
  assert.match(skill, /\.json.*\.svg.*\.html/s, '应说明三件套');
  assert.match(skill, /render\.mjs/, '应给出唯一入口');
});

test('SKILL.md 含落点、命名与两行引用硬规则', () => {
  const skill = read(SKILL);
  assert.match(skill, /specs\/design\/diagrams\//, '应固定落点');
  assert.match(skill, /<document number>-<diagram name>/, '应固定命名规则');
  assert.match(skill, /打开交互式版本/, '应含交互版链接行');
});

test('SKILL.md 含绘图约束（主节点上限、showcase、修复顺序、间距公式）', () => {
  const skill = read(SKILL);
  assert.match(skill, /12 primary nodes/, '应含单图主节点上限');
  assert.match(skill, /showcase/, '应含 showcase 质量档');
  assert.match(skill, /Repair order/, '应含修复顺序');
  assert.match(skill, /label mask width/, '应含间距公式');
});

test('SKILL.md 品牌条款只允许内置 canonical ID', () => {
  const skill = read(SKILL);
  assert.match(skill, /generated-brand-marks\.mjs/, '应指向内置目录');
  assert.match(skill, /never captures a site URL/, '应声明不抓取站点 URL');
});

test('SKILL.md 自审清单为 15 项', () => {
  const skill = read(SKILL);
  const section = skill.split('## Self-Review')[1]?.split('## Subagent Review')[0] ?? '';
  assert.ok(section.length > 0, '应能定位 Self-Review 段');
  const items = section.match(/^\d+\.\s+\*\*/gm) ?? [];
  assert.equal(items.length, 15, `自审应为 15 项，实际 ${items.length} 项`);
});

test('SKILL.md 不含已被裁剪的机制名与参数', () => {
  const skill = read(SKILL);
  assert.doesNotMatch(skill, /design-diagrams/, '不应残留旧技能名');
  assert.doesNotMatch(skill, /--repo-root/, '不应残留代码溯源参数');
  assert.doesNotMatch(skill, /Invoke the `design-diagrams` skill/, '不应残留 Skill 工具调用口径');
});

test('两份配图模板含三件套与两行引用', () => {
  for (const rel of [ARCH_TEMPLATE, MODULE_TEMPLATE]) {
    const template = read(rel);
    assert.match(template, /三件套/, `${rel} 应说明三件套`);
    assert.match(template, /打开交互式版本/, `${rel} 应含交互版链接行`);
    assert.match(template, /specs\/design\/diagrams\//, `${rel} 应固定落点`);
    assert.match(template, /主节点不超过 12|主节点 ≤ 12/, `${rel} 应含主节点上限`);
  }
});

test('接口契约模板保持“不配图”口径', () => {
  const template = read('templates/interface-contract-template.md');
  assert.match(template, /不配图|不需要\s*`?diagrams\/`?/, '应保留不配图口径');
});

test('skill/ 与 templates/ 内无旧技能名残留', () => {
  const offenders = [];
  for (const dir of ['skill', 'templates']) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      const rel = path.join(dir, name);
      if (!fs.statSync(path.join(ROOT, rel)).isFile()) continue;
      if (/\bdesign-diagrams\b/.test(read(rel))) offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `这些文件仍含旧技能名：${offenders.join(', ')}`);
});

test('README 只允许历史条目提及旧技能名', () => {
  const readme = read('README.md');
  const hits = (readme.match(/design-diagrams/g) ?? []).length;
  assert.ok(hits <= 3, `README 中旧技能名应只剩历史条目（≤3），实际 ${hits} 处`);
});

test('审查提示词含三件套判据', () => {
  const prompt = read('skill/design-doc-reviewer-prompt.md');
  assert.match(prompt, /triple/, '应含三件套判据');
  assert.match(prompt, /12-primary-node|12 primary nodes/, '应含主节点上限判据');
  assert.match(prompt, /打开交互式版本|interactive-version/, '应含交互版链接行判据');
});

/* ---------------------------------------------------------------------------
 * 状态四值的「成套出现」不变式
 *
 * 背景：接口矩阵的状态从三档扩为四档（新增 `待调用方`）时，同一口径散落在四个
 * 文件的多个枚举处（Red Flags 行、变更清单字段写法、自审第 9 项、架构模板的翻牌
 * 规则、模块模板的翻牌提示、审查提示词的依赖覆盖判据）。实跑 dry-run 连续两轮都
 * 抓出「改了一处、漏了另一处」，于是把它变成机械门：
 *   - 任何一行只要枚举了状态（同时出现 `待提供` 与 `已落地`），就必须同时出现 `待调用方`；
 *   - 四个承载该口径的文件都必须出现 `待调用方`。
 * ------------------------------------------------------------------------- */

const MATRIX_STATUS_FILES = Object.freeze([
  SKILL,
  'skill/design-doc-reviewer-prompt.md',
  ARCH_TEMPLATE,
  MODULE_TEMPLATE,
]);

test('矩阵状态枚举必须成套（不漏 待调用方）', () => {
  const offenders = [];
  for (const rel of MATRIX_STATUS_FILES) {
    read(rel).split('\n').forEach((line, index) => {
      if (line.includes('待提供') && line.includes('已落地') && !line.includes('待调用方')) {
        offenders.push(`${rel}:${index + 1}  ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `这些行枚举了接口矩阵状态却漏掉 待调用方（四档为 待提供 / 待调用方 / 已落地 / 有差异）：\n${offenders.join('\n')}`,
  );
});

test('四个承载口径的文件都含 待调用方', () => {
  for (const rel of MATRIX_STATUS_FILES) {
    assert.match(read(rel), /待调用方/, `${rel} 应含 待调用方`);
  }
});
