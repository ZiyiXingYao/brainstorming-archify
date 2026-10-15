/**
 * doc-consistency.test.mjs —— 文档与实况一致性的机械断言
 * ============================================================================
 *
 * 本次把上游「读 SKILL.md 做内容断言」的文档用例随失效测试一起删掉了，文档便再没有
 * 机械看门人。本文件把那部分补回来，锁住本次改写的关键约定，防止后续静默回退：
 *   ① `skill/SKILL.md` 含绘图规划 Gate、三件套、落点/命名硬规则、两行引用、主节点上限、
 *      自审 15 项、修复顺序 ①–⑥，且不含已被裁剪掉的机制名与 `--repo-root`；
 *   ② 三份模板齐备，两份配图模板含三件套与两行引用；
 *   ③ 迁移残留：活文件不得出现两代历史名与改名前的落盘目录——`skill/`、`templates/` 扫两代名，
 *      `scripts/` 只扫 `codebuddy-brainstorming`（`design-diagrams` 只允许留在 `MAINTAINING.md` 的历史条目里）；
 *   ④ 接口矩阵状态只在架构模板第 7 节定义一次，其余三份文件只引用、不复述；
 *   ⑤ 内核非测试文档不得再把已删命令（`archify brands` / `archify migrate` /
 *      `archify compare` / `archify validate` / `npm test`）写成现行能力；
 *   ⑥ brand-marks 源码不得残留联网抓取实现；
 *   ⑦ 图名固定为英文 slug：SKILL / 规格 / 模板都要求英文图名，不得残留「保留 CJK」
 *      的旧口径与中文图名示例。
 *   ⑧ 接口契约文件名一致为 `00-接口契约.md`：`skill/`、`templates/` 两个活目录内必须引用
 *      规定名，且不得出现无前缀路径 `specs/design/接口契约.md` 与「不带数字前缀」表述
 *      （`specs/` 基线由 delta 合并收口，不纳入断言——纳入会让测试结果依赖合并时点）。
 *   ⑨ 接口契约新口径：Redis `2.1` 清单表含「数据类型」列、总则含「命名规范」与三条命名格式、
 *      七类逐项契约均标「示例（强制）」且旧的「可选附证」口径零命中；技能自审与审查提示词同步。
 *   ⑩ 跨模块矩阵与占位扫描新判据：架构模板 §7 与模块模板 §4 要求函数名逐字一致（含驼峰/下划线风格）、
 *      架构模板 §7 要求同一写集内双方已落盘时不得停留 `待提供`；技能自审第 2 项与审查提示词把占位扫描
 *      限定为需作者填写的正文占位符（排除行内反引号字面规范、`不适用：<原因>` 原文、模板「使用说明」块），
 *      接口契约模板「使用说明」块声明整块不随产物落盘。
 *   ⑪ 架构模板新增 4+1 视图中的运行视图（§11）与部署视图（§12），原关键决策记录、待定问题与风险
 *      顺延为 §13、§14；技能与审查提示词同步提到两节。
 *   ⑫ 首条消息恰含三项（可跳过语 + 分类宣告 + 一个开放问题），且「单层提问」的例外明确包含首条消息；
 *      接口契约的按需产出判定以「本次设计覆盖的系统」为基准，不得残留无基准的旧口径。
 *   ⑬ dry-run 摩擦 F3–F8 的修法：§8.1 核心类判定含「触发入口」承担者、架构模板有配图口径速查、
 *      总则命名规范含 Redis 全局/聚合 key 形态、SKILL 含台账去重口径与两轮台账前置、平台提问上限口径。
 *   ⑭ dry-run 复测的修法：审查提示词允许家族整节不适用（`section-level 不适用`）、总则给出 Redis 全局 key
 *      的「用途」段语义、§10 先给跨模块/单模块的判定规则。
 *   ⑮ dry-run 第三轮复测的修法：整族不适用在技能自审与接口契约模板正文三处一致；
 *      §10 用「单模块功能流程」并与「纯模块内部实现级流程」区分；§7 点明「模块是设计划分、进程是运行单元」。
 *   ⑯ dry-run 第四轮复测的修法：`meta.output` 写成**必填**（五类 schema 都要求，旧口径「optional」不得残留）；
 *      接口契约第 1–7 节的三级小节计数随整族不适用而变（`在用族数 × 3`）。
 *   ⑰ 讨论状态库与任务拆分：SKILL 含四级状态机与「state.yaml 只准 change-state.mjs 编辑」口径、
 *      Terminal State 改为「确认文档 + task.md 即终点」、含 Implementation Task Split 的三层拆分与
 *      四段式提示词；审查提示词含 Task split 判据；三份模板文件头无「状态」行；命令适配器源文件在位。
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

// 改名残留扫描面。技能有两代历史名：先叫 `design-diagrams`，后叫 `codebuddy-brainstorming`，
// 现名 `brainstorming-archify`；落盘目录也曾由 `.brainstorming/change-lists` 改到带 `-archify` 的形态。
// `design-diagrams` 的扫描面只到 `skill/`、`templates/`：`scripts/` 下有多处**合法**出现——
// `UPSTREAM.md` 记录了内核目录 `design-diagrams/` → `scripts/diagram-engine/` 的改名，
// `lib/degradation.mjs` 用 `design-diagrams-progress` 当临时状态目录名，若干内核文件头沿用旧自述；
// 把扫描面扩过去要靠白名单硬撑，不如划清边界。
const RETIRED_NAME_SCOPE = [
  { dirs: ['skill', 'templates'], names: ['design-diagrams', 'codebuddy-brainstorming'] },
  { dirs: ['scripts'], names: ['codebuddy-brainstorming'] },
];
const RETIRED_CHANGE_LIST_DIR = '.brainstorming/change-lists';

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

test('图名固定为英文 slug：规则与模板都不再允许中文图名', () => {
  const skill = read(SKILL);
  assert.match(skill, /English slug/, 'SKILL 应要求图名段为英文 slug');
  // 旧的「保留 CJK」口径与中文图名示例不得残留，否则会诱导代理把中文写进文件名。
  assert.doesNotMatch(skill, /letters, digits and CJK/, '不应残留保留 CJK 的旧口径');
  assert.doesNotMatch(skill, /01-模块依赖关系/, '不应残留中文图名示例');
  assert.match(read('specs/diagram-engine/spec.md'), /英文/, '规格应写明图名为英文');
  for (const rel of [ARCH_TEMPLATE, MODULE_TEMPLATE]) {
    assert.match(read(rel), /英文 slug/, `${rel} 应要求图名为英文 slug`);
  }
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

test('接口契约补齐数据类型、命名规范与七类强制示例', () => {
  const template = read('templates/interface-contract-template.md');
  const skill = read(SKILL);
  const prompt = read('skill/design-doc-reviewer-prompt.md');
  const problems = [];

  // ① Redis 2.1 清单表在「用途」之后含「数据类型」列。
  if (!/\|\s*编号\s*\|\s*名称（key 模式）\s*\|\s*用途\s*\|\s*数据类型\s*\|/.test(template)) {
    problems.push('模板 Redis 2.1 表头缺「数据类型」列（应位于「用途」之后）');
  }
  if (!/数据类型/.test(template)) problems.push('模板不含「数据类型」');

  // ② 总则含「命名规范」块与三条命名格式。
  if (!/命名规范/.test(template)) problems.push('模板总则缺「命名规范」');
  for (const pattern of [
    '<系统>:<域>:<实体>:<用途>:{实体标识}',
    '<系统>.<域>.<实体>.<用途>.{实体标识}',
    '/<系统>/<域>/<实体>/<用途>',
  ]) {
    if (!template.includes(pattern)) problems.push(`模板缺命名格式 ${pattern}`);
  }

  // ③ 七类逐项契约均标「示例（强制）」，且旧的「可选附证」口径零命中。
  const mandatory = (template.match(/示例（强制）/g) ?? []).length;
  if (mandatory !== 7) problems.push(`模板标「示例（强制）」的节数应为 7（七类各一），实际 ${mandatory}`);
  if (template.includes('附证片段（可选）')) problems.push('模板仍含「附证片段（可选）」旧口径');
  if (/不因缺少附证/.test(template)) problems.push('模板仍含「不因缺少附证」旧口径');

  // ④ 技能自审与审查提示词同步同一判据。
  for (const [name, text] of [['SKILL.md', skill], ['审查提示词', prompt]]) {
    if (!/数据类型/.test(text)) problems.push(`${name} 缺数据类型列判据`);
    if (!/命名规范|naming standard/.test(text)) problems.push(`${name} 缺命名规范判据`);
  }

  assert.deepEqual(problems, [], `接口契约新口径不齐全：\n  - ${problems.join('\n  - ')}`);
});

test('跨模块矩阵签名与占位扫描的新判据齐备', () => {
  const arch = read(ARCH_TEMPLATE);
  const mod = read(MODULE_TEMPLATE);
  const contract = read('templates/interface-contract-template.md');
  const skill = read(SKILL);
  const prompt = read('skill/design-doc-reviewer-prompt.md');
  const problems = [];

  // F4：函数名逐字一致（含命名风格）。模板侧用「驼峰」这一显式风格词锁住。
  if (!/驼峰/.test(arch)) problems.push('架构模板 §7 缺「函数名逐字相等（含驼峰/下划线风格）」口径');
  if (!/驼峰/.test(mod)) problems.push('模块模板 §4 缺「函数名逐字相等（含驼峰/下划线风格）」口径');
  if (!/verbatim/i.test(skill)) problems.push('SKILL.md 自审缺「函数名逐字一致」判据');
  if (!/verbatim/i.test(prompt)) problems.push('审查提示词缺「函数名逐字一致」判据');

  // F9：同一写集内双方都已落盘时不得停留 `待提供`。
  if (!/同一写集/.test(arch)) problems.push('架构模板 §7 缺「同一写集内不得停留 `待提供`」例外');

  // F2/F3/F8：占位扫描排除模板强制记法与说明块。
  if (!/backtick/.test(skill)) problems.push('SKILL.md 自审第 2 项未排除行内反引号中的字面规范');
  if (!/不适用：<原因>/.test(skill)) problems.push('SKILL.md 自审第 2 项未点名排除 `不适用：<原因>` 原文');
  if (!/使用说明/.test(skill)) problems.push('SKILL.md 自审第 2 项未点名排除模板「使用说明」块');
  if (!/backtick/.test(prompt)) problems.push('审查提示词未排除行内反引号中的字面规范');
  if (!/不随产物落盘/.test(contract)) problems.push('接口契约模板「使用说明」块未声明整块不随产物落盘');

  assert.deepEqual(problems, [], `跨模块矩阵/占位扫描判据不齐：\n  - ${problems.join('\n  - ')}`);
});

test('活文件无改名残留（两代历史名与旧落盘目录）', () => {
  const offenders = [];
  const scan = (rel, names) => {
    const abs = path.join(ROOT, rel);
    if (fs.statSync(abs).isDirectory()) {
      for (const child of fs.readdirSync(abs)) {
        if (child === 'node_modules') continue;
        scan(path.join(rel, child), names);
      }
      return;
    }
    const text = fs.readFileSync(abs, 'utf8');
    if (names.some((name) => text.includes(name)) || text.includes(RETIRED_CHANGE_LIST_DIR)) {
      offenders.push(rel);
    }
  };
  for (const { dirs, names } of RETIRED_NAME_SCOPE) {
    for (const dir of dirs) scan(dir, names);
  }
  assert.deepEqual(offenders, [], `这些文件仍含改名前的名字：${offenders.join(', ')}`);
});

test('旧技能名只允许留在维护文档的历史条目里', () => {
  const hits = (rel) => (read(rel).match(/design-diagrams/g) ?? []).length;
  assert.equal(hits('README.md'), 0, 'README 不应再出现旧技能名——历史条目已移入 MAINTAINING.md');
  const kept = hits('MAINTAINING.md');
  assert.ok(kept <= 3, `MAINTAINING.md 中旧技能名应只剩历史条目（≤3），实际 ${kept} 处`);
});

test('接口契约文件名一致为 00-接口契约.md（旧形态不得回流）', () => {
  const OFFICIAL = '00-接口契约.md';
  const STALE_PATH = /specs\/design\/接口契约\.md/;
  const STALE_WORDING = '不带数字前缀';
  const readDir = (dir) => {
    const out = [];
    const walk = (rel) => {
      const abs = path.join(ROOT, rel);
      if (fs.statSync(abs).isDirectory()) {
        for (const child of fs.readdirSync(abs)) walk(path.join(rel, child));
      } else {
        out.push([rel, fs.readFileSync(abs, 'utf8')]);
      }
    };
    walk(dir);
    return out;
  };

  // 只守活文件：specs/ 是已发布基线，由 delta 合并收口，纳入断言会让测试结果依赖合并时点。
  // 先把全部问题收集齐再断言，使失败信息一次列出所有待改文件（而不是在第一个问题上就中止）。
  const problems = [];
  for (const dir of ['skill', 'templates']) {
    const entries = readDir(dir);
    if (!entries.some(([, text]) => text.includes(OFFICIAL))) {
      problems.push(`${dir}/：未引用规定名 ${OFFICIAL}`);
    }
    for (const [rel, text] of entries) {
      if (STALE_PATH.test(text)) problems.push(`${rel}：仍含无前缀路径 specs/design/接口契约.md`);
      else if (text.includes(STALE_WORDING)) problems.push(`${rel}：仍含「${STALE_WORDING}」表述`);
    }
  }
  assert.deepEqual(problems, [], `接口契约文件名不一致：\n  - ${problems.join('\n  - ')}`);
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
    /单模块功能流程的图由该流程所在模块的文档拥有/,
    '序号与归属应说清：单模块功能流程的图归该模块文档',
  );
  assert.match(read('skill/design-doc-reviewer-prompt.md'), /豁免|exempt/, '审查提示词应豁免占位图');
});

test('架构模板为 15 节，且含业务编排流程、运行视图与部署视图', () => {
  const arch = read(ARCH_TEMPLATE);
  const headings = [...arch.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(
    headings,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    '架构模板应有 15 个带号二级节，且顺序为 1..15',
  );
  assert.match(arch, /^## 11\. 业务编排流程/m, '第 11 节应为业务编排流程');
  assert.match(arch, /^## 12\. 运行视图/m, '第 12 节应为运行视图');
  assert.match(arch, /^## 13\. 部署视图/m, '第 13 节应为部署视图');
  assert.match(arch, /^## 14\. 关键决策记录/m, '关键决策记录应顺延为第 14 节');
  assert.match(arch, /^## 15\. 待定问题与风险/m, '待定问题与风险应顺延为第 15 节');
  // 运行视图讲进程 / 线程；部署视图讲部署目录结构 / 部署方式 / 文件组成
  assert.match(arch, /进程/, '运行视图应讲进程');
  assert.match(arch, /线程/, '运行视图应讲线程');
  assert.match(arch, /部署目录结构/, '部署视图应讲部署目录结构');
  assert.match(arch, /文件组成/, '部署视图应讲文件组成');
  // 技能与审查提示词同步（技能与提示词为英文，模板为中文）
  assert.match(read(SKILL), /runtime view/i, 'SKILL 应提到运行视图（runtime view）');
  assert.match(read(SKILL), /deployment view/i, 'SKILL 应提到部署视图（deployment view）');
  assert.match(read('skill/design-doc-reviewer-prompt.md'), /运行视图/, '审查提示词应含运行视图判据');
  assert.match(read('skill/design-doc-reviewer-prompt.md'), /部署视图/, '审查提示词应含部署视图判据');
});

test('首条消息与分类宣告已和解，且接口契约判定基准已定义', () => {
  const skill = read(SKILL);
  // F1：首条消息含分类宣告；「单层提问」的例外明确包含首条消息
  assert.match(skill, /Your first message is three things, in this order/, '首条消息应为三项（含分类宣告）');
  assert.match(
    skill,
    /The classification announcement the Checklist requires may share a message with the first message's single open question/,
    '单层提问的例外应含首条消息',
  );
  // F2：接口契约判定基准是「本次设计覆盖的系统」，不是周边代码库
  assert.match(skill, /The base of that test is the system this design covers/, '接口契约判定基准应为本次设计覆盖的系统');
  assert.doesNotMatch(
    skill,
    /If the project has \*\*any one\*\* of the seven interface families/,
    '不得残留无基准的旧口径',
  );
});

test('dry-run 摩擦 F3–F8 的修法已落盘', () => {
  const arch = read(ARCH_TEMPLATE);
  const contract = read('templates/interface-contract-template.md');
  const skill = read(SKILL);
  // F3：§8.1 核心类判定含「触发入口」承担者
  assert.match(arch, /作为第 10 节某条流程\*\*触发入口\*\*的承担者/, 'F3：§8.1 应含触发入口承担者');
  // F5：架构模板顶部配图口径速查
  assert.match(arch, /配图口径速查/, 'F5：架构模板应有配图口径速查');
  // F4：总则命名规范含 Redis 全局/聚合 key 形态
  assert.match(contract, /全局／聚合级/, 'F4：总则命名规范应含 Redis 全局/聚合 key 形态');
  // F6：台账按去重后的三件套记
  assert.match(skill, /deduplicated triple/, 'F6：SKILL 应含台账去重口径');
  // F7：台账口径前置到 hard gate 开头
  assert.match(skill, /The two-round ledger is maintained only by `render`/, 'F7：台账口径应前置');
  // F8：平台提问上限口径
  assert.match(skill, /If the platform's per-call limit is unknown/, 'F8：应补平台提问上限口径');
});

test('dry-run 复测暴露的修法已落盘（整族不适用 / Redis 全局 key 段义 / 单模块流程序号）', () => {
  const contract = read('templates/interface-contract-template.md');
  const reviewer = read('skill/design-doc-reviewer-prompt.md');
  const arch = read(ARCH_TEMPLATE);
  // 整族不适用：审查提示词允许 section-level 不适用（与模板/规格一致）
  assert.match(
    reviewer,
    /single section-level `不适用：<reason>` in place of all three parts/,
    '审查提示词应允许家族整节不适用',
  );
  // Redis 全局 key 的「用途」段语义
  assert.match(contract, /写该 key 承担的机制或角色/, '总则应给全局 key 的「用途」段语义');
  // 单模块流程序号的判定规则（先判是否跨模块）
  assert.match(arch, /先判是否跨模块/, '§10 应先给跨模块/单模块的判定规则');
});

test('dry-run 第三轮复测的修法已落盘（整族不适用三处一致 / 术语 / 进程≠模块）', () => {
  const skill = read(SKILL);
  const contract = read('templates/interface-contract-template.md');
  const arch = read(ARCH_TEMPLATE);
  // 整族不适用：技能自审与模板正文也允许节级不适用（与审查提示词/规格一致）
  assert.match(skill, /never demand three sub-parts from a family the project does not use/, '自审应允许整族不适用');
  assert.match(contract, /代替三个小节/, '模板正文应允许整族不适用');
  // 术语：单模块功能流程 ≠ 纯模块内部实现级流程
  assert.match(arch, /单模块功能流程/, '§10 应用「单模块功能流程」');
  assert.match(arch, /不是\*\*模块模板所说的「纯模块内部\*\*实现级\*\*流程」/, '§10 应点明与「纯模块内部实现级流程」的区别');
  // 进程 ≠ 模块
  assert.match(arch, /模块是设计划分、进程是运行单元/, '§7 应点明模块与进程不是一回事');
});

test('dry-run 第四轮复测的修法已落盘（meta.output 必填 / 三级小节计数随整族不适用）', () => {
  const skill = read(SKILL);
  const contract = read('templates/interface-contract-template.md');
  assert.match(skill, /`output` — \*\*required\*\*/, 'meta.output 应写必填');
  assert.doesNotMatch(skill, /`output`, `viewBox` — optional output name/, '不得残留 output 可选的旧口径');
  assert.match(contract, /在用族数 × 3/, '第 1–7 节三级小节计数应随整族不适用而变');
});

test('dry-run 第五轮复测的修法已落盘（编排类算核心类 / 集合级比对 / 两门独立 / Redis 用途段统一 / output 不必同名）', () => {
  const skill = read(SKILL);
  const arch = read(ARCH_TEMPLATE);
  const contract = read('templates/interface-contract-template.md');
  assert.match(arch, /任一跳点名的承担类都算/, '§8.1 应说明调用链任一跳的承担类都算');
  assert.match(arch, /集合级比对/, '§7 的逐字一致应是集合级比对');
  assert.match(skill, /The Persist Gate does not wait for design approval/, 'SKILL 应说明落盘门不等设计批准');
  assert.match(contract, /ticket:dispatch:counter:incr/, '总则应给出全局级计数的例子（用途段口径统一）');
  assert.match(skill, /need to equal the triple's/, 'meta.output 应说明不必与三件套同名');
});

test('dry-run 第六轮复测的修法已落盘（实体级锁示例 / MQ 方向粒度 / 审查集合级 / 审查命名含全局级 / 两门独立）', () => {
  const skill = read(SKILL);
  const reviewer = read('skill/design-doc-reviewer-prompt.md');
  const contract = read('templates/interface-contract-template.md');
  assert.match(contract, /ticket:dispatch:ticket:lock:\{ticketId\}/, '总则应给实体级锁的例子');
  assert.match(contract, /不要因为「都在本服务内」/, 'MQ 方向应说明两端可以是本服务的模块');
  assert.match(reviewer, /rows as a set/, '审查的矩阵比对应是集合级');
  assert.match(reviewer, /global\/aggregate `<系统>:<域>:<实体>:<用途>`/, '审查的命名标准应含全局级形态');
  assert.match(skill, /the two gates are independent/, '流程图边应点明两门独立');
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

/* ---------------------------------------------------------------------------
 * 变更清单落盘、图例口径与模板提示块声明（fix-gate-artifact-and-hint-blocks）
 *
 * 三条摩擦的规则侧：
 *   ① 变更清单没有落盘形态与生命周期——唯一显然的位置 `specs/design/` 会被审查提示词
 *      判成 routing defect，而该门自定「批准前不得写任何文件」又让清单无处可写；
 *   ③ SKILL 断言「省略 `meta.legend` 时默认即真实」，而内核默认图例带上游 archify
 *      领域语义（`workflow.backend` = `Agent logic` 等），照技能做会产出与正文矛盾的图；
 *   ⑧ 两份配图模板把真规则混进 `<…>` 提示块，却没有像接口契约模板那样声明
 *      「不得把说明段原样留在产物里」。
 * 断言锚点取完整短语以免误伤；负向断言防旧口径回退。
 * ------------------------------------------------------------------------- */

test('SKILL.md 定明变更清单的落盘形态与时机（一轮一份、轮内追加）', () => {
  const skill = read(SKILL);
  assert.match(skill, /\.brainstorming-archify\/change-lists\//, '应给出变更清单落盘目录');
  // 正文按排版硬换行，短语断言须容忍换行（用 \s+ 而非字面空格）。
  assert.match(skill, /After\s+this gate is approved/, '应点明清单落在门批准之后');
  assert.match(skill, /One file per discussion round/, '应点明一轮一份（不再是每次落盘一份）');
  assert.doesNotMatch(skill, /One file per\s+persist/, '不得残留「每次落盘一份」旧口径');
  assert.match(skill, /append\*\* that\s+persist's list to \*\*the current round's change-list file\*\*/, '应点明轮内追加到当前文件');
  for (const section of ['Round header', 'Discussion record', 'Key decisions', 'File modification ledger', 'Persist authorisations']) {
    assert.ok(skill.includes(section), `轮次记录应有小节「${section}」`);
  }
  assert.match(skill, /change-state\.mjs change-list <path>` refuses a different file/, '应点明切换的机械守卫');
});

test('审查提示词声明 .brainstorming-archify/change-lists/ 属非受管文档', () => {
  const prompt = read('skill/design-doc-reviewer-prompt.md');
  assert.match(
    prompt,
    /`\.brainstorming-archify\/change-lists\/` is not a managed design document/,
    '应点名该目录为非受管文档',
  );
  assert.match(
    prompt,
    /read the content from the current round's change-list\s+file/,
    'change-list coverage 判据应从当前轮次的 change-list 文件读取内容',
  );
});

test('SKILL.md 的 legend 口径为原则式，且不手抄内核默认标签', () => {
  const skill = read(SKILL);
  assert.doesNotMatch(
    skill,
    /its default is the truthful one/,
    '不应再断言省略 legend 时默认即真实',
  );
  assert.match(
    skill,
    /Before omitting `meta\.legend`, check/,
    '应要求省略前先核对内核默认图例与本节节点语义是否一致',
  );
  for (const label of ['Agent logic', 'Agent 逻辑', 'Context / trace', '上下文 / 追踪']) {
    assert.ok(!skill.includes(label), `SKILL 正文不得手抄内核默认标签「${label}」`);
  }
});

test('两份配图模板都声明提示块不得原样留在产物里', () => {
  for (const rel of [ARCH_TEMPLATE, MODULE_TEMPLATE]) {
    const template = read(rel);
    assert.match(template, /不得把说明段原样留在产物里/, `${rel} 应含提示块的处置声明`);
    assert.match(template, /「图示与出图约定」整块属提示/, `${rel} 应点名配图约定整块属提示`);
  }
});

test('SKILL.md 含讨论状态库口径：四态、唯一切换入口与 reopen', () => {
  const skill = read(SKILL);
  for (const state of ['explore', 'draft', 'confirm', 'closed']) {
    assert.ok(skill.includes(`\`${state}\``), `SKILL 应含状态 ${state}`);
  }
  assert.match(skill, /\.brainstorming-archify\/state\.yaml/, 'SKILL 应点名 state.yaml 落点');
  assert.match(
    skill,
    /state\.yaml is edited only through `change-state\.mjs`/,
    'SKILL 应钉住 state.yaml 只准 change-state.mjs 编辑',
  );
  assert.match(skill, /resume-state\.mjs/, 'SKILL 应提到只读恢复命令');
  assert.match(skill, /reopen <path>\.\.\. --reason/, 'SKILL 应给出 reopen 用法');
  assert.match(
    skill,
    /--task-md <路径>|--task-md specs\/design\/task\.md/,
    'SKILL 应说明 closed 必须带 --task-md',
  );
});

test('SKILL.md 的 Implementation Task Split：三层、勾选框列与四段式提示词', () => {
  const skill = read(SKILL);
  assert.match(skill, /## Implementation Task Split/, 'SKILL 应有 Implementation Task Split 节');
  assert.match(skill, /框架\*\*（|Framework tasks|framework tasks/i, 'SKILL 应写框架层拆分');
  assert.match(skill, /specs\/design\/task\.md/, 'SKILL 应点名 task.md 落点');
  assert.match(skill, /a checkbox first|- \[ \] \*\*T-03/, 'SKILL 应给出勾选框在首列的任务行示例');
  for (const part of ['[实现的功能]', '[任务实现的要求]', '[实现的约束]', '[验收标准]']) {
    assert.ok(skill.includes(part), `SKILL 的四段式提示词应含「${part}」`);
  }
  assert.match(skill, /依赖校验/, 'SKILL 应要求依赖校验小节');
  assert.match(skill, /depends on a task that comes later|forward or self dependency|前向|依赖排在它之后/, 'SKILL 应列出前向/自依赖禁令');
});

test('Terminal State 改为「确认文档 + task.md 即终点」，不得残留旧口径', () => {
  const skill = read(SKILL);
  assert.doesNotMatch(skill, /Do not create an implementation plan/, '不得残留「不创建实现计划」的旧口径');
  assert.match(skill, /task\.md` is the\s+handoff artifact/, 'Terminal State 应把 task.md 定为交接物');
  assert.match(skill, /## Implementation Task Split/, 'Terminal State 应引用任务拆分节');
});

test('Process Flow 图含状态推进与 task.md 节点', () => {
  const skill = read(SKILL);
  for (const node of [
    'Mark documents landed; advance draft',
    'Mark approved documents confirmed; advance confirm',
    'Generate specs/design/task.md',
    'Advance closed (--task-md)',
  ]) {
    assert.ok(skill.includes(`"${node}"`), `Process Flow 应含节点「${node}」`);
  }
});

test('审查提示词含 task.md 判据', () => {
  const prompt = read('skill/design-doc-reviewer-prompt.md');
  assert.match(prompt, /Task split \*\*\(task\.md\)\*\*/, '审查提示词应有 Task split 判据行');
  assert.match(prompt, /specs\/design\/task\.md/, '审查提示词应点名 task.md 路由');
  for (const part of ['[实现的功能]', '[任务实现的要求]', '[实现的约束]', '[验收标准]']) {
    assert.ok(prompt.includes(part), `Task split 判据应含「${part}」`);
  }
});

test('三份模板文件头只剩标题与对应架构，修改信息改由轮次台账承载', () => {
  for (const rel of [ARCH_TEMPLATE, MODULE_TEMPLATE, 'templates/interface-contract-template.md']) {
    const template = read(rel);
    assert.doesNotMatch(template, /^\> \*\*状态\*\*：/m, `${rel} 文件头不得再有状态行`);
    assert.doesNotMatch(template, /^\> \*\*最近更新\*\*：/m, `${rel} 文件头不得再有最近更新行`);
    assert.doesNotMatch(template, /^\> \*\*参与\*\*：/m, `${rel} 文件头不得再有参与行`);
    assert.doesNotMatch(template, /^\> \*\*来源\*\*：/m, `${rel} 文件头不得再有来源行`);
  }
  // 模块文档与接口契约保留「对应架构」交叉引用行
  assert.match(read(MODULE_TEMPLATE), /\*\*对应架构\*\*/, '模块文档应保留对应架构行');
  assert.match(read('templates/interface-contract-template.md'), /\*\*对应架构\*\*/, '接口契约应保留对应架构行');
  const readme = read('README.md');
  assert.doesNotMatch(readme, /「状态」新建为「草稿」/, 'README 不得残留旧状态口径');
  assert.match(readme, /文件头不再写「状态」|\.brainstorming-archify\/state\.yaml/, 'README 应说明状态改记 state.yaml');
  // 不同概念的两处状态必须保留
  assert.match(read(ARCH_TEMPLATE), /设计状态/, '架构模板 §6.2 设计状态列应保留');
  assert.match(read(ARCH_TEMPLATE), /状态枚举（四档，权威定义）/, '架构模板 §7 矩阵状态枚举应保留');
});

test('命令适配器源文件在位：占位符与禁改口径', () => {
  const src = read('commands/bsa/resume.md');
  assert.match(src, /__BSA_ROOT__/, '适配器源文件应含 __BSA_ROOT__ 占位符');
  assert.match(src, /不得直接修改 `\.brainstorming-archify\/state\.yaml`/, '适配器应禁直接改 state.yaml');
  assert.match(src, /resume-state\.mjs.*--json/s, '适配器应指示跑 resume-state --json');
});

test('Discussion State 收管当前轮次 change-list 文件', () => {
  const skill = read(SKILL);
  assert.match(skill, /change_list\.path/, 'Discussion State 应点名 state.yaml 的 change_list.path');
  assert.match(
    skill,
    /Recovery = those two\s+files read together/,
    '恢复现场应是 state.yaml + 当前轮次 change-list 文件这两个',
  );
  assert.match(
    skill,
    /no \*\*design document\*\* has landed/,
    'explore 的「无产物落盘」应限定为设计文档（流程簿记除外）',
  );
  assert.match(skill, /the round's first act is its\s+round file|round file\*\*/, '开轮动作应含「建轮次文件」');
  assert.match(skill, /update the round file's file-modification ledger/, '落盘动作应含「更新台账行」');
});

test('审查提示词的 merge-integrity 判据不再以「最近更新行」为唯一例外', () => {
  const prompt = read('skill/design-doc-reviewer-prompt.md');
  assert.doesNotMatch(prompt, /the 最近更新 line is the one permitted exception/, '不得残留旧例外口径');
  assert.match(prompt, /do not demand a 最近更新\/参与\/来源 header line/, '应明说不得索要头行');
  assert.match(prompt, /fully\*\* untouched/, '应说明未触动文档完全逐字不变');
});

test('活文件无「每次落盘一份」旧口径（MAINTAINING 的历史条目除外）', () => {
  // MAINTAINING 的重放清单是历史记录：第 45 条原文保留、其「已被第 53 条取代」的注解才是现行口径。
  for (const rel of [SKILL, 'skill/design-doc-reviewer-prompt.md', 'README.md']) {
    assert.doesNotMatch(read(rel), /每次落盘一份/, `${rel} 不得残留「每次落盘一份」旧口径`);
  }
});

test('轮次文件的创建时机与变更清单门不矛盾（F1 修法）', () => {
  const skill = read(SKILL);
  assert.match(
    skill,
    /This gate governs design documents, not process bookkeeping/,
    '变更清单门应明确只管设计文档、不管流程簿记',
  );
  assert.match(skill, /maintained as the\s+discussion proceeds, including during `explore`/, '应说明簿记在 explore 期间即维护');
  assert.match(skill, /No design document is written before that approval/, 'Writing 第 3 步应改为「设计文档」而非「任何文件」');
  assert.doesNotMatch(skill, /Nothing is written before that approval/, '不得残留「批准前什么都不写」的旧口径');
});

test('轮次文件形状被机械校验（F2 修法）', () => {
  const skill = read(SKILL);
  assert.match(skill, /each a markdown heading, in this order/, 'SKILL 应说明五小节是 markdown 标题');
  assert.match(skill, /the `change-list`\s+command checks for them/, 'SKILL 应说明 change-list 命令会校验');
});

test('dry-run 状态库复测的修法已落盘（F1 计数词 / F5 reopen 登记 / F6 Scope 例外）', () => {
  const skill = read(SKILL);
  // F1：「Two file statuses」计数词与三态枚举矛盾
  assert.doesNotMatch(skill, /Two file statuses/, '不得残留「Two file statuses」的计数错误');
  assert.match(skill, /Three file statuses/, '应写 Three file statuses');
  // F5：reopen 对未登记新文件的行为要写明（先登记再翻转）
  assert.match(
    skill,
    /Naming a file that is \*\*not registered yet\*\*[\s\S]*registers it as `discussing` first/,
    '应写明 reopen 未登记文件会先登记为 discussing',
  );
  // F6：Scope 的 spec-mode 禁令要为 task.md 留明文例外
  const scope = /## Scope\n([\s\S]*?)\n## /.exec(skill)?.[1] ?? '';
  assert.match(
    scope,
    /sanctioned exception is `specs\/design\/task\.md`/,
    'Scope 应写明 task.md 是 spec-mode 禁令的唯一明文例外',
  );
  // F7/F8 的口径补强
  assert.match(skill, /\*\*seams\*\* are those items/, '框架任务的 seam 应有判据');
  assert.match(
    skill,
    /only \*\*reads\*\* a file another task writes needs no ordering/,
    '同文件规则应说明「只读」无需 ordering',
  );
});

// --- 图类型 ↔ 章节绑定（变更 diagram-type-by-section）--------------------------------

const DATA_MODEL_TEMPLATE = 'templates/data-model-doc-template.md';
const REVIEWER = 'skill/design-doc-reviewer-prompt.md';
const CONTRACT_TEMPLATE = 'templates/interface-contract-template.md';

test('图类型由章节决定：技能声明该口径，且「按流程性质选」零残留', () => {
  const skill = read(SKILL);
  assert.match(
    skill,
    /The section decides the type — never the nature of the flow/,
    'SKILL 应声明「章节决定图类型，不得按流程性质自选」',
  );
  assert.match(skill, /Do not pick a type because a flow "feels like"/, 'SKILL 应明说不得凭感觉选型');
  for (const rel of [SKILL, ARCH_TEMPLATE, MODULE_TEMPLATE]) {
    const body = read(rel);
    assert.doesNotMatch(body, /按其流程性质选定|按流程性质选/, `${rel} 不应残留「按流程性质选图类型」`);
    assert.doesNotMatch(body, /五类中选定|五类图/, `${rel} 不应残留「五类图」口径`);
  }
});

test('技能的路由表覆盖四份文档的章节 ↔ 图类型', () => {
  const skill = read(SKILL);
  for (const [needle, why] of [
    [/architecture \| §6\.3 module dependency \| `architecture`/, '架构 §6.3 绑 architecture'],
    [/architecture \| §10 global functional flows, each \| `sequence`/, '架构 §10 绑 sequence'],
    [/architecture \| §11 business orchestration \| `workflow`/, '架构 §11 绑 workflow'],
    [/architecture \| §12 runtime view \| `architecture`/, '运行视图绑 architecture'],
    [/module \| §5 end-to-end flows, each \| `sequence`/, '模块 §5 绑 sequence'],
    [/module \| §3\.N class detailed design — function descriptions \| `flowchart`/, '模块功能描述绑 flowchart'],
    [/module \| §6 module entity state machine \| `lifecycle`/, '模块 §6 绑 lifecycle'],
    [/data-model \| §2 domain class \/ §3 entity-relationship \/ §4 data flow \/ §5 core entity state machine/, '第四份文档四节绑四类'],
  ]) {
    assert.match(skill, needle, `SKILL 路由表缺少：${why}`);
  }
  assert.match(skill, /A function gets a `flowchart` when it is \*\*important\*\*/, 'SKILL 应写死 flowchart 的「重要∩复杂」判据');
});

test('架构模板 15 节：新增业务编排流程、运行视图配图、后续顺延', () => {
  const body = read(ARCH_TEMPLATE);
  for (const heading of [
    '## 10. 全局功能流程',
    '## 11. 业务编排流程',
    '## 12. 运行视图',
    '## 13. 部署视图',
    '## 14. 关键决策记录',
    '## 15. 待定问题与风险',
  ]) {
    assert.ok(body.includes(heading), `架构模板缺少 ${heading}`);
  }
  assert.match(body, /本节的每条编排都要配一张[^\n]*\.workflow/, '§11 应要求每条编排配工作流图');
  assert.match(body, /本视图必须配一张[^\n]*\.architecture/, '§12 运行视图应要求配架构图');
  assert.match(body, /本视图\*\*不要求配图\*\*；确实不适用时（例如没有独立部署形态的库）/, '§13 部署视图仍不要求配图');
  assert.doesNotMatch(body, /本视图\*\*不要求配图\*\*，用叙述与表格承载/, '运行视图不应再声明「不要求配图」');
});

test('架构模板 §10 固定时序图，§8.2/§8.3 改引用类图且旧口径零残留', () => {
  const body = read(ARCH_TEMPLATE);
  assert.match(body, /图类型固定为时序图/, '§10 应写死时序图');
  assert.match(body, /本节只回答「谁调用谁、什么顺序、每步返回什么」/, '§10 应说明它回答什么');
  assert.match(body, /引用该文档 §2 领域类图/, '§8.2 应改为引用第四份文档的类图');
  assert.doesNotMatch(body, /不做类图/, '不应再残留「不做类图」的豁免口径');
  assert.doesNotMatch(body, /用文字或 mermaid 图表达/, '不应再以文字或 mermaid 作为类关系的终态');
});

test('模块模板 8 节：函数流程图判据、状态机新节、后续顺延', () => {
  const body = read(MODULE_TEMPLATE);
  for (const heading of [
    '## 5. 端到端业务流程',
    '## 6. 本模块实体状态机',
    '## 7. 关键决策记录',
    '## 8. 待定问题与风险',
  ]) {
    assert.ok(body.includes(heading), `模块模板缺少 ${heading}`);
  }
  assert.match(body, /\*\*重要∩复杂\*\*/, '§3.N 应写死「重要∩复杂」判据');
  assert.match(body, /≥2 个条件分支/, '判据应含分支数量');
  assert.match(body, /当该函数是\*\*本模块独有\*\*/, '应写明模块独有函数的时序图例外');
  assert.match(body, /图类型固定为 `sequence`/, '§5 应写死时序图');
  assert.match(body, /每条状态机都要配一张[^\n]*\.lifecycle/, '§6 应要求每条状态机配生命周期图');
});

test('模块模板不再要求同名流程跨文档共用同一组三件套', () => {
  const body = read(MODULE_TEMPLATE);
  assert.doesNotMatch(body, /引用同一个图文件|共用一份图|引用\*\*同一组三件套\*\*/, '应删除「同名共用一份图」的旧口径');
  assert.match(body, /各画自己那一层/, '应改为「各画自己那一层」');
  assert.doesNotMatch(body, /图类型 MUST 与架构总纲第 10 节同名流程\*\*一致\*\*/, '不应再要求两处图类型一致');
});

test('实体与数据设计模板存在、八节齐备、条件必出且四张图只画关键子集', () => {
  assert.ok(fs.existsSync(path.join(ROOT, DATA_MODEL_TEMPLATE)), '缺少第四份模板');
  const body = read(DATA_MODEL_TEMPLATE);
  for (const heading of [
    '## 1. 数据模式总览',
    '## 2. 领域类图',
    '## 3. 实体关系图',
    '## 4. 数据流图',
    '## 5. 核心实体状态机',
    '## 6. 数据生命周期与保留',
    '## 7. 关键决策记录',
    '## 8. 待定问题与风险',
  ]) {
    assert.ok(body.includes(heading), `第四份模板缺少 ${heading}`);
  }
  assert.match(body, /命中 MySQL \/ Redis \/ MQ 任一类持久化接口/, '应写明条件必出的机械判据');
  assert.match(body, /整份缺席/, '应写明不命中时整份缺席是合法形态');
  assert.match(body, /只画\*\*架构总纲第 8\.1 节核心类清单\*\*/, '领域类图应写死取子判据');
  assert.match(body, /图未覆盖全部类 \/ 全部表/, '应写明不得因图不全判缺陷');
  for (const type of ['.class.svg', '.erd.svg', '.dataflow.svg', '.lifecycle.svg']) {
    assert.ok(body.includes(type), `第四份模板缺少 ${type} 的引用骨架`);
  }
});

test('审查提示词：章节↔图类型一致、第四份文档路由、类图旧豁免口径零残留', () => {
  const body = read(REVIEWER);
  assert.match(body, /Every diagram's type must equal the one its own section binds/, '审查应核章节↔图类型一致');
  assert.match(body, /02-实体与数据设计\.md/, '审查应含第四份文档');
  assert.match(body, /Data-model document \*\*\(data model\)\*\*/, '审查应有第四份文档的判据行');
  assert.match(body, /those two sections must reference the\s+domain class diagram/, '审查应要求 §8.2/§8.3 引用类图');
  assert.doesNotMatch(body, /do not report these three\s+sections as missing an SVG diagram/, '旧的类图豁免口径应删除');
  assert.doesNotMatch(body, /These two sections do\s+\*\*not\*\* require diagrams/, '「运行/部署都不要求配图」的旧口径应删除');
  assert.match(body, /a runtime view with no diagram and no `不适用` reason is a defect/, '审查应把运行视图缺图判为缺陷');
  assert.match(body, /whose number is \*\*03 or above\*\*/, '审查路由应把模块序号改为 03+');
});

test('文档编号：02- 是固定前缀，模块序号为 03+', () => {
  for (const rel of [SKILL, REVIEWER, CONTRACT_TEMPLATE, DATA_MODEL_TEMPLATE]) {
    const body = read(rel);
    assert.doesNotMatch(body, /模块文档.{0,6}`02\+`|模块文档为 `02\+`|modules are `02\+`/, `${rel} 不应再写「模块为 02+」`);
  }
  assert.match(read(SKILL), /the module documents are `03\+`/, 'SKILL 应写明模块为 03+');
  assert.match(read(CONTRACT_TEMPLATE), /各模块文档为 `03\+`/, '接口契约模板应写明模块为 03+');
});

test('接口契约仍不配图，并指向第四份文档的 ER 图', () => {
  const body = read(CONTRACT_TEMPLATE);
  assert.match(body, /本文件不配图/, '接口契约应保持不配图');
  assert.match(body, /02-实体与数据设计\.md/, '接口契约应指明 ER 图在第四份文档');
});

test('lifecycle 只接受 schema_version 3', () => {
  const skill = read(SKILL);
  assert.doesNotMatch(skill, /Start new lifecycle diagrams on `schema_version: 2`/, '不应再写「新图用 2」');
  assert.match(skill, /The kernel\naccepts \*\*only\*\* `3`/, '应写明内核只接受 3');
});

// --- dry-run（设备报修工单系统）抓到的摩擦的修法 ------------------------------------

test('同名流程两处各画一层：SKILL 不再说「共用一份图」，且写明单模块例外', () => {
  const skill = read(SKILL);
  assert.doesNotMatch(skill, /One flow, one file/, '不应再残留「One flow, one file」');
  assert.doesNotMatch(skill, /uses \*\*one\*\* diagram triple/, '不应再说两处共用一组三件套');
  assert.match(skill, /\*\*One flow, two layers — never one shared file\.\*\*/, '应改为「两处各画一层、绝不共用一个文件」');
  assert.match(skill, /\*\*One exception, and it inverts the ownership\.\*\*/, '应写明单模块功能流程的归属例外');
  assert.match(skill, /the module's\n`0N-…​\.sequence`/, '应写明两处各取本文档序号');
});

test('模块 §1.2 与 §5 的功能点对应按「模块那一跳」对齐，不要求集合相等', () => {
  const body = read(MODULE_TEMPLATE);
  assert.match(body, /\*\*按「模块那一跳」对齐，不要求集合相等\*\*/, '应明确不要求集合相等');
  assert.match(body, /MUST \*\*不\*\*出现在本子节/, '应写明不属于本模块的功能点不得抄进本子节');
  assert.doesNotMatch(body, /也必须在本子节里有对应行/, '旧的「反向也必须有对应行」口径应删除');
});

test('SKILL 提醒 role 等枚举逐类型不同，须读各自 schema', () => {
  const skill = read(SKILL);
  assert.match(skill, /Enumerated edge fields differ per type/, '应提醒枚举逐类型不同');
  assert.match(skill, /`workflow` accepts `main` \/ `branch` \/ `async` \/ `return` \//, '应给出 workflow 的 role 取值');
  assert.match(skill, /while `flowchart` accepts `main` \/ `branch` \/ `loop` \/ `exception`/, '应给出 flowchart 的 role 取值');
});

test('SKILL 写明 change-list 等命令的路径是项目内相对路径', () => {
  const skill = read(SKILL);
  assert.match(skill, /Every `<path>` argument is a path relative to the project\nroot, never absolute/, '应写明路径口径');
  assert.match(skill, /Being able to run the command from any\nsubdirectory does not change what the path is relative to\./, '应点明「可任意目录执行」不等于路径相对 cwd');
});

test('架构模板写明 §7 的状态枚举表与填表规则属产物', () => {
  const body = read(ARCH_TEMPLATE);
  assert.match(body, /整块属于产物，必须原样保留在落盘的 `01-架构设计\.md` 里/, '应写明该块随产物落盘');
});

test('SKILL 为 flowchart 写明结构校验与「没有几何旋钮」', () => {
  const skill = read(SKILL);
  assert.match(skill, /### Flowchart diagrams/, '应有 flowchart 的专节');
  assert.match(skill, /Structure is validated, not repaired\./, '应写明结构是校验而非修补');
  assert.match(skill, /There are no per-node geometry knobs and no label-routing controls\./, '应写明没有几何旋钮');
  assert.match(skill, /do not\s+apply here/, '应点明 repair order 里挪标签/改路由的步骤对本类型不适用');
  assert.match(skill, /### Erd, class, tree, timeline and waterfall diagrams/, '应说明其余类型的作者口径');
});

test('SKILL 写明 boundary 只能圈住自己的成员', () => {
  assert.match(
    read(SKILL),
    /\*\*A boundary must enclose only its own members\.\*\*/,
    '应写明 boundary 的几何约束',
  );
});


