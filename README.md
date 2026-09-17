# CodeBuddy Brainstorming Skill

一个可独立安装到 [CodeBuddy](https://cnb.cool/codebuddy/codebuddy-code) 的头脑风暴技能：**只管对话式设计探讨，最终（经你同意）按固定模板产出一套人类可读的实现级设计文档（一份全局架构总纲 + 每功能模块一份）。**

它不写代码、不接下游技能、不产出 spec 模式文档——讨论结束后生成的文档，交给 `spec-superflow` 之类的流程继续消费。

## 特性

- **三路径分类**：Spike（探路）/ Bounded（有界）/ Architectural（架构级），按复杂度缩放流程；有界改动只在已有设计文档集时走增量，不为小改动制造整套文档
- **落盘门（Persist Gate）**：讨论收敛后先问你要不要存成文件；只是随口问问就到此结束，不留垃圾文件
- **两套模板**：架构总纲（`architecture-doc-template.md`）+ 功能模块（`module-doc-template.md`），章节结构锁定，产出即实现级设计
- **增量落盘**：每次讨论先读盘再判决——只填模块内部细节时架构文档零改动；动了模块划分 / 类归属 / 文件树时才改受影响条目，其余逐字保留
- **变更清单门**：写盘前先给变更清单（新建 / 修改哪些文件、各改哪几节、哪些逐字不动、新增了哪些依赖），批准后才落盘
- **签名级跨模块契约**：未设计模块的依赖按签名级记录（函数名 / 入参 / 返回类型 / 边界语义为硬约束，参数类型等软约束由提供方定），记为「待提供」落到架构接口矩阵，对方模块设计时必须回应
- **端到端流程分层**：架构总纲画跨模块骨架（模块级调用链 + 每跳数据形态 + 结果落地 + 跨模块失败处理），模块文档写本模块内的函数级细节，避免同一条流程在多份文档里重复漂移
- **三道审查**：AI 自审 → 子代理独立审查 → 用户确认
- **零依赖**：纯 Markdown，不需要 Node 或任何运行时
- **可同步上游**：`SKILL.md` 保留英文原文，便于与 superpowers 上游 diff 和同步（见「同步上游」）

## 安装

### 方式一：git clone（推荐）

直接把仓库克隆为 CodeBuddy 技能目录：

```bash
git clone https://github.com/ZiyiXingYao/codebuddy-brainstorming.git \
  ~/.codebuddy/skills/brainstorming
```

### 方式二：下载后拷贝

```bash
# 1. 克隆到临时目录
git clone --depth 1 https://github.com/ZiyiXingYao/codebuddy-brainstorming.git /tmp/codebuddy-brainstorming

# 2. 确保技能目录存在
mkdir -p ~/.codebuddy/skills/brainstorming

# 3. 拷贝技能文件（跳过 .git / README / LICENSE / 同步脚本）
cp /tmp/codebuddy-brainstorming/SKILL.md \
   /tmp/codebuddy-brainstorming/architecture-doc-template.md \
   /tmp/codebuddy-brainstorming/module-doc-template.md \
   /tmp/codebuddy-brainstorming/design-doc-reviewer-prompt.md \
   ~/.codebuddy/skills/brainstorming/

# 4. 清理
rm -rf /tmp/codebuddy-brainstorming
```

### 方式三：从本机源码目录安装（开发者）

```bash
mkdir -p ~/.codebuddy/skills/brainstorming
cp /code/codebuddy-brainstorming/SKILL.md \
   /code/codebuddy-brainstorming/architecture-doc-template.md \
   /code/codebuddy-brainstorming/module-doc-template.md \
   /code/codebuddy-brainstorming/design-doc-reviewer-prompt.md \
   ~/.codebuddy/skills/brainstorming/
```

## 验证安装

```bash
ls ~/.codebuddy/skills/brainstorming/
# 期望输出：SKILL.md  architecture-doc-template.md  module-doc-template.md  design-doc-reviewer-prompt.md

head -4 ~/.codebuddy/skills/brainstorming/SKILL.md
# 期望输出：
# ---
# name: brainstorming
# description: ...
# ---
```

安装后需要**新开一个 CodeBuddy 会话**，技能才会被加载。

## 更新

```bash
cd ~/.codebuddy/skills/brainstorming && git pull
```

（仅「方式一」适用；用「方式二」「方式三」安装的重新执行对应命令覆盖即可）

## 卸载

```bash
rm -rf ~/.codebuddy/skills/brainstorming
```

## 使用

提出新想法、新功能、新组件、行为变更，或需求模糊、需要方案选型时，技能会自动触发，也可以显式调用。流程：

1. AI 分类路径（Spike / Bounded / Architectural）并说明
2. 一问一答澄清意图、约束、取舍
3. 收敛设计
4. **落盘门**：询问是否写入文件——不要就直接结束
5. **变更清单门**：给出将新建 / 修改哪些文件、各改哪几节、哪些逐字不动、新增了哪些未落地依赖、有哪些待裁决差异——批准后才落盘
6. 按模板生成文档到 `specs/design/`
7. AI 自审 → 子代理审查 → **用户审查门**：你确认内容

产出文档的语言跟随对话语言（中文对话产中文文档）。模板保持固定结构，不随语言改变。路径基准为**项目根**。

### 产出物结构

```
specs/design/
├── 01-架构设计.md      架构总纲，全项目唯一一份（固定 01）
├── 02-<功能模块>.md    每个功能模块一份，文件名 = 模块名
└── 03-<功能模块>.md
```

序号**追加不重排**：新增模块排在当前最大序号之后，即使逻辑上应靠前也不插入重排——否则会重命名既有文件、打断文档间引用。

**架构总纲全局唯一**，所有模块的架构级内容（模块划分、类归属、类关系、接口、全局流程、文件树）都累积在这一份里；分模块的详细设计在各自的模块文档里。`specs/design/` 下永远只有一份架构文档，不存在"每个子项目一份架构文档"。

**模块划分粒度**：一个模块要能独立回答"它做什么、怎么用、依赖谁"，且能被一次讨论讲透。类详细设计一屏放不下、或要拆成多次讨论 → 该拆细；两个模块总是一起改、找不到清晰接缝 → 该合并。模块与代码目录不要求一一对应。

**引用与元信息约定**：文档间引用统一写相对项目根的完整路径（如 `specs/design/02-通信模块.md`）；「状态」新建为"草稿"、经你确认后改"已确认"且不再退回；「最近更新」每次落盘刷新为当天，同一次落盘同时更新多份文档时这几份填同一天。

**三道门**：一次会话会问你三次，各管各的、不合并——**落盘门**（要不要写）→ **变更清单门**（写什么，你批）→ **用户审查门**（写得对不对）。前两次几秒可答，只有第三次需要真读。

**模块删除与改名**：删除要连带删模块文档、清单行、以及把它当调用方或提供方的所有接口矩阵行，序号留空洞**不重排**；删除前先扫一遍它欠别人的「待提供」条目并报告（这些缺口将无人认领）。改名要同步更新所有引用——清单的「对应文档」列、矩阵的「详见」列、其他模块文档里的交叉引用，不能留下失效路径。

**模块名全项目唯一**——它同时是文件名主体和所有交叉引用的锚点，两个模块不得同名。

**架构大改的例外**：若某次讨论把模块划分本身推倒重来，几乎每条都"受影响"，这是"只改受影响条目"的合法例外。但要在变更清单里明示"本次为架构大改"，并且仍然**逐条比对**既有文档（不是盲写重生成），仍然成立的内容逐字保留。

首次落盘会先创建 `specs/design/` 目录。

**架构总纲**（`architecture-doc-template.md`，11 节）：背景与问题 / 目标与非目标 / 方案对比与选型 / 整体功能说明 / 功能模块划分 / 跨模块接口矩阵 / 全局端到端流程 / 类归属与类关系 / 代码文件树组织 / 关键决策记录 / 待定问题与风险。

其中**代码文件树必须落到文件级**（只给目录不足以说明代码放哪），并与第 8.1 节类清单的「定义文件」列**双向一致**：树里的源文件要覆盖类清单全部定义文件，类清单也不能漏掉树里出现的源文件。

**功能模块文档**（`module-doc-template.md`，7 节）：模块职责与边界 / 本模块类清单与关系 / 类详细设计（逐类的字段表 + 函数表）/ 对外依赖契约（签名级）/ 端到端业务流程 / 关键决策记录 / 待定问题与风险。

对外依赖契约按调用方定义的硬约束（函数名、入参个数与含义、返回类型、边界语义）与提供方自定的软约束（参数具体类型、错误类型体系、内部结构）分列。

**接口状态只在架构矩阵维护，三段收口**（避免「待提供」永远挂着、也避免两处状态对不上）：

1. **调用方产生** —— 调用方落盘时在矩阵写入条目，状态 `待提供`，同时提示你后续单独讨论提供方模块
2. **提供方翻牌** —— 提供方设计时**必须逐条处理**指向自己的条目：硬约束一致 → `已落地`；不一致 → `有差异` 并列出差异
3. **裁决者收口** —— `有差异` 经你裁决后改文档对齐，状态回 `已落地`；暂时改不了就保持 `有差异` 并在两边「待定问题与风险」各留一条

**模块文档的依赖契约表不写状态**，只写"我需要什么"（提供方、类、期望签名、语义）。原因是状态会因**别人的**落盘而变化，而模块文档无权替别人翻牌——状态收在一处，翻牌就永远不需要改另一个模块的文档。

提供方已设计却仍留 `待提供`，等于缺口无人认领——自审和 reviewer 都会报。

**端到端流程分两层，避免跨模块流程在多份文档里重复漂移**：

- 架构总纲第 7 节画跨模块骨架——模块级调用链 + 每跳数据形态 + 结果落地 + 跨模块的失败处理
- 模块文档第 5 节写本模块内部的函数级细节——触发入口 → 本模块内调用链 → 数据形态变化 → 结果投递给谁 → 异常路径；跨模块的那一跳只写"调用 &lt;模块&gt; 的 &lt;接口&gt;"，骨架不重复

**流程对齐规则**：跨模块流程在架构总纲第 7 节与各参与模块第 5 节**同名出现**；纯模块内部流程只写在模块文档，不登记到架构总纲。

出现分歧时以谁为准（避免两边互相"必须一致"却判不出改哪边）：

| 分歧内容 | 权威 |
|---------|------|
| 依赖签名 | 调用方模块文档第 4 节（接口矩阵只是摘录，跟着改） |
| 有哪些模块 | 架构总纲第 5.1 节 |
| 跨模块接口是否已落地 | 架构总纲第 6 节 |
| 类的归属 | 架构总纲第 8.1 节 |

> 字段表、函数签名表、调用链表、接口矩阵**不算** spec 模式——它们是设计描述，是模板要求的，不是被禁止的验收条件。
>
> 一个 reviewer 子代理同时审两类文档：`01-架构设计.md` 对架构模板，其余对模块模板。写盘集超过 5 份时先审架构总纲，再按模块分批。

## 目录结构

```
.
├── SKILL.md                          技能本体（英文，对齐上游）
├── architecture-doc-template.md      架构设计文档模板（中文骨架，11 节）
├── module-doc-template.md            功能模块设计文档模板（中文骨架，7 节）
├── design-doc-reviewer-prompt.md     子代理审查提示词（英文）
├── sync-upstream.sh                  与 superpowers 上游对比 SKILL.md 的辅助脚本
├── README.md
└── LICENSE
```

## 语言约定

| 文件 | 语言 | 原因 |
|------|------|------|
| `SKILL.md` | 英文 | 这是给 AI 读的行为约束，保持与上游逐句可比，便于同步 |
| `design-doc-reviewer-prompt.md` | 英文 | 同上 |
| `architecture-doc-template.md` | 中文骨架 | 新文件，与上游无关；中文用户产出文档开箱即用 |
| `module-doc-template.md` | 中文骨架 | 同上 |
| 产出的设计文档 | 跟随对话语言 | 人读的文档 |

## 同步上游

本技能的 `SKILL.md` 是 [superpowers](https://github.com/obra/superpowers) `skills/brainstorming/SKILL.md` 的**改造副本**。

**上游基准**：`obra/superpowers` @ `v6.3.0`（commit `b36e082`）

### 用脚本看差异

```bash
# 与上游默认分支对比
./sync-upstream.sh

# 与指定 tag / 分支对比
./sync-upstream.sh --ref v6.3.0
```

脚本会浅克隆上游仓库，打印上游版本信息和 `SKILL.md` 的双向 diff。

### 手动步骤

```bash
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp
diff -u /tmp/sp/skills/brainstorming/SKILL.md ./SKILL.md
rm -rf /tmp/sp
```

### 需要重放的改动清单

上游更新后，在上面 diff 的基础上重新施加以下改动，即可完成同步：

**删除**
1. `Visual Companion` 整节，以及 `visual-companion.md` / `scripts/` 全部内容
2. `spec-document-reviewer-prompt.md` 及其引用
3. 终态衔接 `writing-plans` 技能的全部表述（Checklist、Process Flow、After the Design 节）
4. `elements-of-style:writing-clearly-and-concisely` 引用
5. spec 自审（spec self-review）与 spec 用户审查门

**替换**
6. 「写 spec 到 `docs/superpowers/specs/`」→「写人类可读设计文档到 `specs/design/`（相对项目根），严格遵循 `architecture-doc-template.md` 与 `module-doc-template.md`」
7. Checklist 中 Architectural 路径末项 `invoke writing-plans` → `Move to the Persist Gate`
8. `## Presenting the design` 的 `Cover: architecture, components, data flow, error handling, testing` → 覆盖面以模板章节为准（去掉 `testing`，两份模板都没有测试章节）
9. 「项目过大则拆成子项目，**每个子项目一份设计文档**」→ 「拆成功能模块；`01-架构设计.md` 保持全局唯一、累积所有模块的架构级内容，模块细节各入自己的文档」——否则多份架构文档会全部同名 `01-架构设计.md` 而冲突

**新增**
10. `## Scope` 节：声明边界（不实现、不接下游技能、不产 spec 模式产物）
11. `## The Persist Gate` 节：落盘前单独一条消息征求同意
12. `## Incremental Persist Protocol` 节：落盘前强制读盘 → 判决影响面（模块文档只改本次涉及的条目，绝不整份重写；架构文档仅受影响时改、仅改受影响条目，其余逐字保留含措辞顺序格式，仅额外允许刷新「最近更新」行且同一次落盘用同一天）→ 冲突列差异待裁决 → 未设计模块的依赖记「待提供」并做签名级记录且在提供方落盘时逐条翻牌 → 未设计模块被设计时的登记动作（建文档、翻设计状态、去掉「（待创建）」、不重排序号，一次登记多个模块则逐个执行）→ 依赖引用了从未登记的模块时先登记再记依赖 → **模块删除与改名**的后续动作（删除连带清清单行与矩阵行、序号留空洞不重排、删除前报告它欠别人的「待提供」；改名同步更新清单「对应文档」列、矩阵「详见」列与其他文档的交叉引用），并声明三处唯一事实源
13. `## Change List Gate` 节：写盘前先出变更清单（新建 / 修改 / 逐字不动 / 新增依赖 / 冲突）待批准；首次落盘时「逐字不动」写 `无既有文档`
14. `## The Three Gates` 节：说明落盘门、变更清单门、用户审查门各管什么，一次会话会问三次且不合并
15. `## Writing the Design Document` / `## Document Format Requirements` 节（两份模板、混合式形态、spec 模式边界澄清、`不适用` 例外、路径基准为项目根、文档间引用统一写相对项目根的完整路径）
16. `## Self-Review` 节：逐节核对模板合规的 11 项清单（替换 spec 自审），含增量合并完整性、跨文档一致性（含跨模块流程同名、引用可解析）、接口状态收口、覆盖完整性（含 `不适用` 判定）、落盘前是否真的读了盘
17. `## Subagent Review` 节 + `design-doc-reviewer-prompt.md`：一个子代理审两类文档并做模板路由与权威顺序判定（权威顺序含依赖签名、模块存在性、接口状态、类归属、流程的模块链五类），**传入完整的已批准变更清单而不只是"逐字不动"部分**，写盘集超 5 份时分批；含重跑规则：修订涉及结论 / 决策 / 流程 → 重跑子代理审查，纯措辞或笔误修订 → 只需自审
18. `## User Review Gate` 与 `## Terminal State` 节
19. Red Flags 表新增 10 行（随口问问也落盘 / 自创文档格式 / 模块讨论顺手改架构文档 / 不读盘就写 / 字段表当 spec 模式 / 设计批准当写盘批准 / 待提供未翻牌 / 改名不跟引用 / 聊完就实现 / 落盘门），改写 1 行；全文单数 "design document" 按多文件模型改复数
20. `## Process Flow` 中新增 Persist Gate 与 Change List Gate 分支，并补充「落盘阶段」说明：bounded 与 architectural 共用门禁但产出不同（bounded 只并回受影响的模块文档，或项目尚无文档集时不写）；终态改为 `Done` / `Stop here (no file)`
21. Checklist 的 Bounded 路径：明确已有 `specs/design/` 时走增量合并，项目尚无设计文档集时不制造整套文档
22. 模板侧（两份）：「状态」与「最近更新」的填写与联动规则（含同日规则）、模块划分粒度准则、模块名全项目唯一、模块与代码目录不要求一一对应的说明、「来源」行改为可承载多轮讨论的写法、跨模块流程与纯内部流程的对齐规则
23. 架构大改的例外：模块划分被整体推翻时，在变更清单里明示「本次为架构大改」，但仍逐条比对既有文档、仍成立的内容逐字保留，不得盲写重生成；首次落盘先创建 `specs/design/` 目录
24. 接口状态**只在架构矩阵维护**，模块文档的依赖契约表不写状态——状态会因别人的落盘而变，放在一处就不会出现两处对不上，翻牌也不需要改另一个模块的文档
25. 实测补正：模块文档第 3 节新增类插入中间时，后续类的小节要按顺序改号；待定项解决、风险解除后可以删条目（属「受影响条目」）；代码文件树**必须落到文件级**并与类清单的定义文件双向一致，自审与审查判据同步加检查

## 来源与许可

本技能改编自 [superpowers](https://github.com/obra/superpowers) 的 `brainstorming` 技能
（MIT License, Copyright (c) 2025 Jesse Vincent）。

以 MIT License 发布，详见 [LICENSE](LICENSE)。
