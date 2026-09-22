/**
 * doc-consistency.test.mjs —— 文档与实况一致性的机械断言
 * ============================================================================
 *
 * 本次把上游「读 SKILL.md 做内容断言」的文档用例随失效测试一起删掉了，文档便再没有
 * 机械看门人。本文件把那部分补回来，锁住本次改写的关键约定，防止后续静默回退：
 *   ① `skill/SKILL.md` 含绘图规划 Gate、三件套、落点/命名硬规则、两行引用、主节点上限、
 *      自审 15 项、修复顺序 ①–⑥，且不含已被裁剪掉的机制名与 `--repo-root`；
 *   ② 三份模板齐备，两份配图模板含三件套与两行引用；
 *   ③ 迁移残留：`skill/`、`templates/` 内不得出现 `design-diagrams`（README 只允许历史条目）；
 *   ④ 接口矩阵状态只在架构模板第 7 节定义一次，其余三份文件只引用、不复述；
 *   ⑤ 内核非测试文档不得再把已删命令（`archify brands` / `archify migrate` /
 *      `archify compare` / `archify validate` / `npm test`）写成现行能力；
 *   ⑥ brand-marks 源码不得残留联网抓取实现。
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
  // 不加 `s` 标志：加了会让 `.` 跨行、`.*` 吞全文，只要三者在文件任意位置按序出现即通过，
  // 断言就形同虚设。三件套必须写在同一处（同一行）。
  assert.match(skill, /\.json.*\.svg.*\.html/, '应说明三件套');
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
 * 状态取值：一处权威定义 + 其余只引用
 *
 * 背景：接口矩阵的状态取值曾在 12 处手抄、写法各异（表格单元格、箭头、一档一行
 * ……），连续多轮 dry-run 都抓到「改了一处、漏了另一处」。把断言提成按段落判断
 * 治不了根——副本仍在，只是漏检变难。根治办法是取消副本：取值含义只在架构模板
 * 第 7 节定义一次，其余文件只写指向它的引用。
 *   - 权威块必须齐全（四档 + `详见` 列的 `待调用方落盘` 标记）且自证唯一；
 *   - 其余三份文件必须出现指向第 7 节的引用。
 * 断言边界：它证明「权威块齐全 + 每份文件都有引用」，不能证明「每一处提及都带了
 * 引用」——那要靠人读。所以引用句写在该文件最显眼的位置（区块开头或整段首句）。
 * ------------------------------------------------------------------------- */

const AUTHORITATIVE = ARCH_TEMPLATE;
const POINTER_FILES = Object.freeze([
  SKILL,
  MODULE_TEMPLATE,
  'skill/design-doc-reviewer-prompt.md',
]);
const MATRIX_STATUSES = Object.freeze(['待提供', '待调用方', '已落地', '有差异']);

test('状态取值只在架构模板第 7 节定义一次', () => {
  const arch = read(AUTHORITATIVE);
  assert.match(arch, /状态枚举（四档，权威定义）/, '权威块应有可辨识的题注');
  assert.match(arch, /唯一权威定义/, '权威块应声明自己是唯一权威');
  for (const value of MATRIX_STATUSES) {
    assert.ok(arch.includes(value), `权威块应包含取值 ${value}`);
  }
  assert.ok(arch.includes('待调用方落盘'), '权威块应同时定义 `详见` 列的标记词');
  assert.match(arch, /章节级\*\*标记/, '应澄清 不适用 是章节级标记、不是状态取值');
});

test('其余三份文件都引用第 7 节', () => {
  for (const rel of POINTER_FILES) {
    assert.match(read(rel), /section 7|第 7 节/, `${rel} 应指向架构模板第 7 节的权威块`);
  }
});

test('修复顺序为 ①–⑥，且 ⑤ 是标签超宽档', () => {
  const section = read(SKILL).split('**Repair order.**')[1]?.split('\n\n')[0] ?? '';
  assert.ok(section.length > 0, '应能定位 Repair order 段');
  for (const mark of ['①', '②', '③', '④', '⑤', '⑥']) {
    assert.ok(section.includes(mark), `修复顺序应含 ${mark}`);
  }
  assert.ok(!section.includes('⑦'), '修复顺序不应超出 ⑥');
  assert.match(section.split('⑤')[1] ?? '', /label/i, '⑤ 应是标签宽于节点框那一档');
});

test('出图时序只有一种说法（校验在门前、渲染在门后）', () => {
  const skill = read(SKILL);
  assert.match(skill, /only after the Change List Gate\s+approves/i, 'SKILL 应给出唯一权威表述');
  assert.match(skill, /"Author the IR; run validate \(writes nothing\)"/, '流程图中应在门前插校验节点');
  // 旧口径不得残留——这条断言正是为了防「改了一处、漏了另一处」再次发生。
  assert.doesNotMatch(skill, /Generate IR; render the diagram triples/, '不应残留旧流程图节点');
  assert.doesNotMatch(skill, /Once\s+the plan is confirmed, generate the IR, render/, '不应残留旧口径');
  for (const rel of [ARCH_TEMPLATE, MODULE_TEMPLATE]) {
    assert.match(read(rel), /待变更清单门批准后/, `${rel} 应采用同一时序`);
  }
});

test('上轮引入的两处错误不得回退：lifecycle 字段语义与门前写盘口径', () => {
  const skill = read(SKILL);
  // lifecycle：step 是有序阶段标签、yOffset 是位置——不要再写成「位置来自 step / 尺寸来自 yOffset」
  assert.doesNotMatch(skill, /place comes from its own `step`/, '不应把 step 写成位置控件');
  assert.match(skill, /`step` is \*\*not\*\* geometry/, '应点明 step 与几何无关');
  assert.match(skill, /state's \*\*place\*\* comes from its own `lane` \/ `col`/, '位置控件应为 lane / col');
  assert.match(skill, /its \*\*size\*\* comes from `width` \/ `height`/, '尺寸控件应为 width / height');
  // 门前写盘：IR 是唯一例外，不得再写「门前不写任何图工件」
  assert.doesNotMatch(skill, /no diagram artifact is written before the gate/, '不应残留旧口径');
  assert.match(
    skill,
    /no `\.svg`, no `\.html` and no document\s+is written before it/,
    '应把门保护的写盘范围写准（只豁免 IR）',
  );
});

test('占位形态与序号口径只有一种说法', () => {
  for (const rel of [ARCH_TEMPLATE, MODULE_TEMPLATE]) {
    const template = read(rel);
    assert.match(template, /占位：<图名> 未通过校验/, `${rel} 应定义固定占位行`);
    assert.match(template, /未按占位形态写明原因/, `${rel} 的「缺图判缺陷」应豁免占位情形`);
    assert.doesNotMatch(template, /本文档即架构总纲，序号为 `01`/, `${rel} 不应残留错误序号口径`);
  }
  assert.match(
    read(ARCH_TEMPLATE),
    /即使按规定登记在本文档第 10 节，也用该模块的序号/,
    '序号应取归属文档（单模块功能流程用该模块的序号）',
  );
  assert.match(read('skill/design-doc-reviewer-prompt.md'), /豁免|exempt/, '审查提示词应豁免占位图');
});

/* ---------------------------------------------------------------------------
 * 内核侧：文档不得再把已删命令写成现行能力；源码不得残留联网抓取
 *
 * `schemas/README.md` 曾把 `archify brands capture`、`archify migrate`、
 * 「renderer requires --repo-root」和 `npm test` 写成现行用法，而四者都已随裁剪
 * 删除——`skill/`、`templates/` 有看门人，`scripts/` 下的文档没有，所以漏了。
 * ------------------------------------------------------------------------- */

const KERNEL = 'scripts/diagram-engine';
const REMOVED_COMMANDS = Object.freeze([
  'archify brands',
  'archify migrate',
  'archify compare',
  'archify validate',
  'npm test',
]);

test('内核非测试文档不再把已删命令写成现行能力', () => {
  const offenders = [];
  const walk = (dir) => {
    // 锚定 ROOT：`read(rel)` 以 ROOT 为基准，遍历也必须一致，否则 cwd 不是仓库根
    // （IDE / 子目录里跑 `node --test`）时这里直接 ENOENT。
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'test') continue;
        walk(rel);
        continue;
      }
      if (!/\.(md|json|html)$/.test(entry.name)) continue;
      const text = read(rel);
      for (const command of REMOVED_COMMANDS) {
        if (text.includes(command)) offenders.push(`${rel}: ${command}`);
      }
    }
  };
  walk(KERNEL);
  assert.deepEqual(offenders, [], `这些内核文档仍在提供已删能力：\n${offenders.join('\n')}`);
});

test('brand-marks 源码不再含联网抓取实现', () => {
  const source = read('scripts/diagram-engine/renderers/shared/brand-marks.mjs');
  const banned = [
    /node:http/, /node:https/, /node:dns/, /node:net/, /node:crypto/, /createHash/,
    // 全局 `fetch()` 与 `XMLHttpRequest` 都不需要 import——只查模块导入会被整条绕过，
    // 而用全局 fetch 写抓取恰恰是最可能出现的那种回归。
    /\bfetch\s*\(/, /XMLHttpRequest/,
    /checkedFetch/, /captureRemoteBrand/, /captureBrandReference/,
    /readLimited/, /iconCandidates/, /isPrivateBrandAddress/, /mapConcurrent/,
    /ARCHIFY_BRAND_ALLOW_PRIVATE/, /ARCHIFY_BRAND_CAPTURE_TIMEOUT_MS/,
  ];
  for (const pattern of banned) {
    assert.doesNotMatch(source, pattern, `不应残留 ${pattern}`);
  }
  assert.match(source, /export async function prepareDiagramBrandMarks/, '应保留品牌解析入口');
  assert.match(source, /never captures a site URL|no network request is reachable/, '应声明无抓取能力');
});
