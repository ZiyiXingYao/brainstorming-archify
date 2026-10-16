# MAINTAINING —— 维护者手册

> 本文件是**仓库维护手册**，给改这个仓库的人看：同步两个上游、登记后续变更、历次 dry-run 结论。
> 它**不进安装**——`scripts/install.mjs` 只装 `skill/`、`templates/`、`scripts/` 三个目录。
> 使用者请读 [README.md](README.md)；行为基准在 `skill/SKILL.md`，需求基线在 `specs/`。

## 目录

1. [同步上游](#1-同步上游)
   - [上游一：superpowers（`brainstorming`）](#上游一superpowersbrainstorming)（含《需要重放的改动清单》）
   - [上游二：archify（绘图内核）](#上游二archify绘图内核)
2. [后续变更登记](#2-后续变更登记)
3. [历次 dry-run 记录](#3-历次-dry-run-记录)
4. [发布一个版本](#4-发布一个版本)

---

## 1. 同步上游

本仓库有**两个上游**：技能文本来自 `superpowers`，绘图内核来自 `archify`。

| 对象 | 上游仓库 | 基准坐标 | 同步方式 |
|------|---------|---------|---------|
| `skill/SKILL.md` 等技能文本 | [superpowers](https://github.com/obra/superpowers) | `v7.0.0`（commit `bb92a77`） | `./scripts/sync-upstream.sh` 看 diff 后按《需要重放的改动清单》重放 |
| `scripts/diagram-engine/` | [archify](https://github.com/tt-a1i/archify) | `v3.1.0`（commit `1c2b42d`；技能包版本 `3.1.0`） | **无脚本**，按 tag / commit 手工比对 + 跑 `test/run-valid.mjs` 判回归（见下文） |

`./scripts/sync-upstream.sh` **只覆盖 `superpowers`**：它比对的是 `skill/SKILL.md`，与绘图内核无关。

### 上游一：superpowers（`brainstorming`）

本技能的 `SKILL.md` 是 [superpowers](https://github.com/obra/superpowers) `skills/brainstorming/SKILL.md` 的**改造副本**。

**上游基准**：`obra/superpowers` @ `v7.0.0`（commit `bb92a77`）

**上游现状（2026-10-12 实测）**：本仓库**已同步到** `v7.0.0`（commit `bb92a77`）。本仓库最初自上游 `v6.3.0`（commit `b36e082`）分叉；`v6.4.1 → v6.4.2` 对 `skills/brainstorming/SKILL.md` **零改动**，而 `v6.4.2 → v7.0.0` 是**整节重写**（466 行 diff）：删掉 `## Three Paths`（改为 `## Size the Work` 三档表）、删掉 spec 产物与 `spec-document-reviewer-prompt.md`、新增 `builder-check-prompt.md`（子代理「构建者检查」）与更口语化的对话指引（`## Your First Message`、`## The Conversation`、`## Play It Back`）。本仓库**未照抄重写后的版式**——那会丢掉本库赖以成立的三路径、三道门、三模板与绘图内核——而是把 v7.0.0 的**新增内容与措辞**并入本库既有设计模型，并把 v7.0.0 内容在 `SKILL.md` 上的**节级／段落级本地化**登记为第 47 条（见下）。

《需要重放的改动清单》是**活指令**：上游再前移时，须把清单逐条重新施加到新坐标、为新增节判定偏离，再跑 `./sync-upstream.sh --ref <新坐标>` 复验 diff；只改本文件里的版本号不算同步。

#### 用脚本看差异

```bash
# 与上游默认分支对比
./sync-upstream.sh

# 与指定 tag / 分支对比
./sync-upstream.sh --ref v7.0.0
```

脚本会浅克隆上游仓库，打印上游版本信息和 `SKILL.md` 的双向 diff。

#### 手动步骤

```bash
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp
diff -u /tmp/sp/skills/brainstorming/SKILL.md ./skill/SKILL.md
rm -rf /tmp/sp
```

#### 需要重放的改动清单

上游更新后，在上面 diff 的基础上重新施加以下改动，即可完成同步：

**删除**
1. `Visual Companion` 整节，以及 `visual-companion.md` / `scripts/` 全部内容
2. `spec-document-reviewer-prompt.md` 及其引用
3. 删除终态衔接 `writing-plans` 技能的全部表述——v6.4.1 起除 Checklist、Process Flow、After the Design 三处外，还包括新 `<HARD-GATE>` 的 Architectural 先决条件（`written-spec approval only permits invoking writing-plans`）、`## Three Paths` 的 `then the writing-plans skill`，以及 `**Terminal states are path-bound.**` 段中的同名句
4. `elements-of-style:writing-clearly-and-concisely` 引用
5. spec 自审（spec self-review）与 spec 用户审查门

**替换**
6. 「写 spec 到 `docs/superpowers/specs/`」→「写人类可读设计文档到 `specs/design/`（相对项目根），严格遵循 `architecture-doc-template.md`、`module-doc-template.md` 与 `interface-contract-template.md`」；同一替换须覆盖 v6.4.1 新 `<HARD-GATE>` 内的 `the written spec` / `writing the spec`——本仓库没有 spec 产物，该处按 `SKILL.md` 的口径写成「设计呈现与批准 + Persist Gate / Change List Gate / 用户审查门」（第三份模板见第 30–35 条）
7. Checklist 中 Architectural 路径末项 `invoke writing-plans` → `Move to the Persist Gate`
8. `## Presenting the design` 的 `Cover: architecture, components, data flow, error handling, testing` → 改写为「覆盖面以模板章节为准」的六项清单（functional points; module division and its rationale; core classes with their relationships and calls; the file tree; cross-module interfaces; and the global flows），并明确「章节清单由模板决定，自创模板没有的章节名是缺陷」；`error handling` 与 `testing` 均被去掉——三份模板都没有测试章节，失败处理并入各流程节（第三份模板见第 30–35 条）
9. 「项目过大则拆成子项目，**每个子项目一份设计文档**」→ 「拆成功能模块；`01-架构设计.md` 保持全局唯一、累积所有模块的架构级内容，模块细节各入自己的文档」——否则多份架构文档会全部同名 `01-架构设计.md` 而冲突

**新增**
10. `## Scope` 节：声明边界（不实现、不接下游技能、不产 spec 模式产物）
11. `## The Persist Gate` 节：落盘前单独一条消息征求同意
12. `## Incremental Persist Protocol` 节：落盘前强制读盘 → 判决影响面（模块文档只改本次涉及的条目，绝不整份重写；架构文档仅受影响时改、仅改受影响条目，其余逐字保留含措辞顺序格式，仅额外允许刷新「最近更新」行与「来源」行里的最近一次讨论主题——同一次落盘用同一天，且「来源」的主题是**最近一次触及该文档**的讨论主题，日期已是当天或主题已一致时这次刷新是空操作、不额外写声明）→ 冲突列差异待裁决 → 未设计模块的依赖记「待提供」并做签名级记录且在提供方落盘时逐条翻牌 → 未设计模块被设计时的登记动作（建文档、翻设计状态、去掉「（待创建）」、不重排序号，一次登记多个模块则逐个执行）→ 依赖引用了从未登记的模块时先登记再记依赖 → **模块删除与改名**的后续动作（删除连带清清单行与矩阵行、序号留空洞不重排、删除前报告它欠别人的「待提供」；改名同步更新清单「对应文档」列、矩阵「详见」列与其他文档的交叉引用），并声明三处唯一事实源
13. `## Change List Gate` 节：写盘前先出变更清单（新建 / 修改 / 逐字不动 / 新增依赖 / 冲突）待批准；首次落盘时「逐字不动」写 `无既有文档`
14. `## The Three Gates` 节：说明落盘门、变更清单门、用户审查门各管什么，一次会话会问三次且不合并
15. `## Writing the Design Document` / `## Document Format Requirements` 节（三份模板、混合式形态、spec 模式边界澄清、`不适用` 例外、路径基准为项目根、文档间引用统一写相对项目根的完整路径）（第三份模板见第 30–35 条）
16. `## Self-Review` 节：逐节核对模板合规的 **15 项**清单（替换 spec 自审；条数由第 44 条记的 14→15 确定），含增量合并完整性、跨文档一致性（含跨模块流程同名、引用可解析、矩阵函数名与提供方函数表逐字相等）、接口状态收口（含同一写集内不得停留 `待提供`）、覆盖完整性（含 `不适用` 判定）、落盘前是否真的读了盘、接口契约合规（见第 33 条），以及第 14 项**共识理解**——提出特性或方案之前是否已建立对方可评估、可纠正的共识理解并在被纠正后更新（见第 36 条所在的 `## Establish Shared Understanding`）；**占位符扫描只针对需作者填写的正文占位符**——不扫行内反引号中的字面规范（如接口契约命名格式串）、模板固定的 `不适用：<原因>` 与固定占位行、以及模板末尾「使用说明」块
17. `## Subagent Review` 节 + `design-doc-reviewer-prompt.md`：一个子代理审三类文档并做模板路由与权威顺序判定（权威顺序含依赖签名、模块存在性、接口状态、类归属、流程的模块链五类），**传入完整的已批准变更清单而不只是"逐字不动"部分**，写盘集超 5 份时分批；含重跑规则：修订涉及结论 / 决策 / 流程 → 重跑子代理审查，纯措辞或笔误修订 → 只需自审（第三份模板见第 30–35 条）
18. `## User Review Gate` 与 `## Terminal State` 节
19. Red Flags 表新增 **11 行**（随口问问也落盘 / 自创文档格式 / 接口契约按话题判定 / 接口契约起别名 / 模块讨论顺手改架构文档 / 不读盘就写 / 字段表当 spec 模式 / 设计批准当写盘批准 / 待提供未翻牌 / 改名不跟引用 / 聊完就实现），改写 **2 行**——上游 H3 已把「这条太简单不需要设计」一行改为按路径表述，本仓库只把其尾句 `the written spec and planning handoffs` 改成 `the design documents`；另一行把 `skip the spec` 改成 `skip the design doc`；全文单数 `design document` 按多文件模型改复数，含 v6.4.1 新节里的 `the selected path's design artifact`
20. `## Process Flow` 中新增 Persist Gate 与 Change List Gate 分支，并补充「落盘阶段」说明：bounded 与 architectural 共用门禁但产出不同（bounded 只并回受影响的模块文档，或项目尚无文档集时不写）；终态改为 `Done` / `Stop here (no file)`
21. Checklist 的 Bounded 路径：明确已有 `specs/design/` 时走增量合并，项目尚无设计文档集时不制造整套文档
22. 模板侧（三份）：「状态」与「最近更新」的填写与联动规则（含同日规则）、模块划分粒度准则、模块名全项目唯一、模块与代码目录不要求一一对应的说明、「来源」行改为可承载多轮讨论的写法、流程对齐规则（全部功能流程都登记到架构总纲、含只在单个模块内完成的，只有纯模块内部的实现级流程留在模块文档）（第三份模板见第 30–35 条）
23. 架构大改的例外：模块划分被整体推翻时，在变更清单里明示「本次为架构大改」，但仍逐条比对既有文档、仍成立的内容逐字保留，不得盲写重生成；首次落盘先创建 `specs/design/` 目录
24. 接口状态**只在架构矩阵维护**，模块文档的依赖契约表不写状态——状态会因别人的落盘而变，放在一处就不会出现两处对不上，翻牌也不需要改另一个模块的文档；矩阵行的**函数名**须与提供方模块文档第 3 节函数表**逐字相等**（含大小写与驼峰／下划线风格），不一致即硬约束不一致、置「有差异」，不得判「已落地」；**同一写集内双方都已落盘时该行直接翻牌**为「已落地」/「有差异」，不得停留「待提供」
25. 实测补正：模块文档第 3 节新增类插入中间时，后续类的小节要按顺序改号；待定项解决、风险解除后可以删条目（属「受影响条目」）
26. 本轮设计文档体系调整（架构定方向、把细节下压到模块）：架构模板重排为 12 节，功能点需求说明独立成节、其后各节顺延编号（全局功能流程移到第 10 节）；类归属章节改为核心类设计，写入可机械核对的核心类判定标准（出现在全局功能流程某条流程的模块级调用链上，或作为跨模块接口矩阵某行的接口承载者），并声明架构核心类清单是各已设计模块类清单并集的子集、属于未设计模块的核心类先临时登记待其落盘时收口；代码文件树收敛为「模块文件夹 + 核心文件」，只要求可定位全部核心类的定义文件、不要求文件级完备；全局功能流程登记**全部**功能流程（含只在一个模块内完成的），每条标注服务功能点与每跳承担的核心类、只写方向级；模块模板在职责与边界节下新增「1.2 本模块参与的功能点」子节，第 2.1 节类清单升为本模块完整类清单的唯一权威，每条流程增服务功能点标注；技能把澄清指引改为功能点层 / 架构层 / 模块层三层提问清单与「先功能点、再模块划分、再核心类、再文件树、最后流程」的推进顺序，并重写自审第 8、10 项；审查提示词重写类归属判据（核心类可定位、同一个类不跨两个模块、架构核心类清单为各已设计模块类清单并集的子集）、删除「文件树停在目录」校准条，并新增功能点与流程双向覆盖等判据

27. （D-1）`## Incremental Persist Protocol` 新增 `Rule 7`——「A changed entry re-renders its diagram in the same persist」：图是被说明条目的派生产物，属改动这些条目的同一次落盘；改动带图条目（架构 §10 全局流程、模块 §5 流程、§6.3 模块依赖关系）时同批创建 / 重渲染其**图与 IR** 并列入变更清单；**未触及的条目不动其图**（与文字逐字保留同理）；新增流程即新增图，**删除流程即删除其图与 IR**（孤儿图是陈旧产物）；IR 与图同批刷新，不脱节
28. （D-2）新增整节 `## Diagrams in the Design Documents`，与绘图内核的入参契约逐项一致：内核声明（它是技能内部构件、不是独立技能）；出图时机（落盘阶段、待变更清单门批准后渲染、与文档同批落盘、不单独落盘）；IR 由本技能自该节已有内容生成、事实来源限定该节、用户不写 IR；入口命令；五类图选型；落盘路径与图名派生（含冲突报双方、不静默改名）；同名流程共用一份图文件；md 引用形态与正文不得内联 `<svg>`；校验硬门（不过不产出、不覆盖既有同名）；两轮降级口径（目标错误数 = 错误级诊断条数不含警告、基线轮计入两轮、第 2 轮未低于第 1 轮即停且退出码 3、两选项交回用户不代选）；Node < 18 留占位降级且不阻塞落盘
29. （D-3）`## Change List Gate` 清单项新增 `Diagrams` 一栏——「every diagram this persist will create or re-render, each named with the flow or section it belongs to, or `无`；**本栏还列出本次预期新建 / 重渲染、但未通过校验而以占位保留的图，标 `未通过校验` 并写明原因**；未变条目之图不列入也不重渲染」
30. 认清**第三类受管设计文档——接口契约**：技能由「架构总纲 / 功能模块」两类扩为「架构总纲 / 功能模块 / 接口契约」三类，写盘指令同步引用 `interface-contract-template.md`
31. 新增**机械的按需产出判定**：项目命中 MySQL / Redis / MQ / HTTP / gRPC / 动态库 API / TCP 七类对外接口中**任意一类**即必须产出接口契约文档；七类全不命中则不产出，并在变更清单中**逐族**写明不命中的判定依据；禁止以「本次未涉及接口」为由跳过判定
32. 固定接口契约文档的落盘路径为 `specs/design/00-接口契约.md`，文件名为 `00-接口契约.md`，全项目唯一一份；`00-` 是**固定字面前缀**——不参与模块序号序列（架构总纲固定 `01-`、各模块文档为 `02+`），不随模块增删改变，也不受「序号追加不重排」管辖，永不重编号；禁止起别名（无前缀 `接口契约.md`、单零前缀 `0-接口契约.md`、英文别名 `contract.md` 一律判缺陷）、禁止并入架构总纲或模块文档
33. 自审清单新增**接口契约检查项**：七类接口节三段式、清单表含该族口径的可追溯列、Redis 清单表含**数据类型**列且无留空、总则含**四部分**（权威源声明／适用范围与形态／代码侧落地物映射表／**命名规范**——Redis key `<系统>:<域>:<实体>:<用途>:{实体标识}`、MQ topic `<系统>.<域>.<实体>.<用途>.{实体标识}`、HTTP `/<系统>/<域>/<实体>/<用途>`）、七类逐项契约各含**强制示例**（MySQL 建表 SQL、Redis 结构示例、MQ／gRPC 的 proto message、HTTP 请求与响应、动态库头文件签名、TCP 报文帧）、字段表含名称／类型或长度／语义、表格与示例不矛盾、兜底节无硬塞且无漏记，其中明确**不得因该文档没有配图而报缺陷**（接口契约文档不配图是预期形态，报即为校准错误）；审查提示词的接口契约判据行与校准段同步同一组判据
34. 设计呈现覆盖清单由**两类扩为三类**（加入接口契约文档）
35. 模板读取清单与审查子代理派发清单由**两类扩为三类**

**（叠加）v6.4.1 新基准的本地化**

以下两条覆盖 `v6.4.1` 新引入内容在 `SKILL.md` 上的**节级／段落级本地化**。既有第 6、19 条只覆盖了它们外溢的**术语**（`spec` → 设计文档、`<HARD-GATE>` 内的措辞替换），**未**覆盖整段重写本身——新节第三点的落点切换、门的分级结构与条数、`## Checklist` 第 `0.` 步、`## Process Flow` 共用节点、`## Anti-Pattern` 段的逐路径改写，故单列。

36. （叠加）本地化 v6.4.1 新增节 `## Establish Shared Understanding`：新节照上游的三点结构落盘（发现意图／回写理解／把意图带进设计），但**第三点**的落点由上游的 `the written spec` 改指**本仓库设计文档**（架构总纲／模块文档／接口契约，即项目根下 `specs/design/`），**同时保留上游的 `or the in-chat design/probe for bounded work and spikes` 分支**——bounded 与 spike 两支仍落在聊天内的设计／探针，不得把这两支也改指设计文档；并在该分支之后补一句限定 `— a bounded change still reaches the Persist Gate afterwards, where it is persisted as the affected module document, or not persisted at all`，以消除它与 `**Terminal states are path-bound.**` 段／`## Checklist` Bounded 第 5 步「bounded 可落成受影响的模块文档」之间的两种读法；全句不得出现 `spec`；`## Checklist` 的三条路径（Spike／Bounded／Architectural）各在「宣布路径」之后、原有第 1 步 `Explore project context` 之前插入一个**共同的第 `0.` 步**「建立共识理解」，步号写作 `0.`，**既有步号不重排**；`## Process Flow` 的流程图为三条路径新增一个共用前置节点（`Establish shared understanding`），使图与清单一致。
37. （叠加）本地化 v6.4.1 对 `<HARD-GATE>` 与 `## Anti-Pattern` 的改写：`<HARD-GATE>` 整段按上游结构重写为**按 Spike／Bounded／Architectural 分级**（不再是单一泛化条件），其中 Architectural 先决条件以**本仓库实际存在的门禁**表述——设计呈现与批准、Persist Gate、Change List Gate、用户审查门——只**并列名目、不给设计陈述与 Persist Gate 排先后**，也不重复各门内部规则，不得出现 `spec`／`plan`／`writing-plans`；`## Anti-Pattern` 段与 Red Flags 表中「这条太简单不需要设计」那一行按**所选路径**重写（bounded 得到聊天内的短设计，architectural 得到设计文档），与 `<HARD-GATE>` 的分级一致。

**（补登）此前未登记的本地偏离**

以下三条是**本次升级复验（`./sync-upstream.sh --ref v6.4.1` 逐段判读）新发现的既有偏离**：它们由本变更之前的提交（`464c08fe`、`be069343`）引入，长期未登记在清单里，因此照旧清单重放会**静默回退**它们。此处补登，使"照本清单重放即可完成同步"这一说法成立。

38. 本地化 front-matter 的 `description` 行：把上游的 `"You MUST use this before any **creative** work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."` 改为 `"You MUST use this before any **design or implementation** work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation, **and turns the settled design into human-readable design documents**."`——即 `before any creative work` → `before any design or implementation work`，并在末尾追加落盘设计文档这一职责。
39. 改写 `## Three Paths` 的**引入句**与 **Spike／Bounded** 两支（逐项照做，缺一项就会把 `spec` 措辞重新引回）：**①引入句**——上游 `"this looks bounded, so I'll present a short design here rather than write a **spec**"` 里的 `spec` 改为 `**design doc**`；**②Spike 支尾句**——删掉上游 Spike 支的整句 `No design doc, no spec file.`（该句在 `/tmp/sp-641.md` 里跨行写作 `No design` 换行 `doc, no spec file.`，位于 `…as cheaply as correctness allows.` 与 `Report findings as a recommendation; …` 之间），本地只保留 `… Report findings as a recommendation; anything you built stays labeled throwaway.`；**③Bounded 支的判定基准**——由上游 `a well-scoped change to code that already exists in this repo` 改为 `a well-scoped change whose flow is already written down in specs/design/ and can be read`；**④Bounded 支的示例**——由 `a new flag, a small endpoint, a one-file fix` 改为 `a field added to a class, a step inserted into an existing flow, one cross-module interface adjusted`；**⑤Bounded 支的理由段**——由 `Understanding the kind of app is not enough — bounded means the flow you are changing is already here to read. If there is no existing flow to change, the task is not bounded.` 改为 `Bounded is measured against **this repository's design document set, not against whether code exists** — a repository holding only design documents is this skill's normal case, so "there is no code yet" never by itself makes a task architectural. What matters is whether the flow you are changing is already on paper. If it is, …`；**⑥Bounded 支的尾句**——由 `No spec file, no implementation plan document.` 改为 `No document is written at this step; the Persist Gate comes after approval and decides whether anything is persisted at all.`（改写的理由：本仓库常态是只有设计文档、没有代码，按上游"代码已存在"的判据会把一切任务都判成 architectural）。
40. 改写 `## Three Paths` 的 **Architectural** 支（含新增子项，逐项照做）：**①分类器**——在上游 `new projects, new subsystems,` 与 `changes that restructure how components fit together or alter interfaces others depend on` 之间补入 `**designing a module the architecture lists as 未设计**,`；**②尾部**——由上游 `Follow the full process: questions, approaches, sectioned design, written spec, then the writing-plans skill.` 改为 `Follow the full process: questions, approaches, sectioned design, then the Persist Gate.`（`written spec` 与 `writing-plans` 两处都必须替换，不得残留）；**③新增子项**——在该支下新增 `**The approaches step is scoped to what is still open.**`：在已确认的架构内设计某个模块（即通常的增量场景）时，模块划分、依赖与跨模块接口都已冻结，因此只就该模块**仍然未决的取舍**提 2-3 个方案（内部怎么切、检查或失败路径落在哪、哪个协作者承担什么），或声明无此类选择而跳过该步；**绝不**把已确认的架构当作仍未决定来重新打开。

**（裁剪重写）对绘图相关条目的覆盖**

以下四条**覆盖**第 27–29 条对 `SKILL.md` 绘图内容的描述——那三条记录的是上一版形态（内部技能 + SVG/IR 两件 + 按图名命名的自由落点），现已按「裁剪绘图内核 + 绘图规划 Gate + 三件套 + 序号命名」整体重写该节。重放时请按这四条执行。

41. （重写）`## Diagrams in the Design Documents` 整节重写：①新增**绘图规划 Gate**——需求收敛后、生成 IR 前，先呈交「要哪些图／各是什么图类型／落在哪一节」的清单并取得确认；未确认即生成 IR 或渲染判为缺陷，确认结论须与变更清单逐图核对。②调用方式改为直接调内核唯一入口 `node scripts/diagram-engine/bin/render.mjs render <type> <ir.json> <outdir>`，**不再是 Skill 工具调用内部技能**；另两个子命令为 `validate`（只校验、不写产物）与 `doctor`（环境与内核完整性自检）。③产物由「SVG + IR」扩为**三件套** `.json`／`.svg`／`.html`（同一 outdir、同前缀）。④落点硬规则：文档落 `<项目根>/specs/design/`，三件套落其下 `diagrams/` 子目录；不允许放到项目根 `diagrams/` 或其他位置，不允许拆散存放。⑤命名硬规则 `<文档序号>-<图名>.<图类型>.<ext>`，序号取**归属文档**（跨模块流程归架构总纲 `01-`）；**`<图名>` 固定为英文 slug**——来源名为非英文时先译成英文再归一，归一保留 ASCII 字母与数字、其余字符（空格、标点、路径分隔符与任何非 ASCII／中日韩字符）一律当分隔符剥离、连续分隔符合并为一个、首尾剥离并转小写，结果为空回退图类型名；与「冲突追加 `-2`／`-3` 并报双方」共同构成命名规则。⑥md 引用改为**固定两行**（图片行指 `.svg` + 紧随一行链接指同名 `.html`），相对路径相对文档目录、禁止绝对路径与 `../`；正文不得内联 `<svg>` 标签。⑦保留校验硬门（不过不产出、不覆盖既有同名）与两轮降级、Node < 18 降级条款原文。
42. （重写）「五类图选型」由一段列表扩为**类型路由表 + 逐类规范**：路由表给出五类的用途与结构数组；每类各一节，写用途、结构数组、`meta` 字段要点与该类型的布局契约（架构：单一左右主轴、6–12 个主组件、组件类型与变体枚举、legend 键序；工作流：泳道=责任或阶段、`col` `0..5`、新图用 `schema_version: 2`、`semanticChecks`、retry 与异常回路走主廊道之外；时序：参与者按对话角色排序、消息决定纵向顺序、`meta.column_fit` 的 `fixed`／`spread`、不使用 Automatic Port Spread；数据流：stage=转换或保管、row 分离并行流；生命周期：主相位 `col 0..4`、事件与终态列 `0..2` 且列 `N` 对齐主列 `N+2`、可恢复失败需真实回迁转移）。另加「Shared IR structure and `meta` fields」一节，说明必填字段、`additionalProperties: false`，以及 `title`／`subtitle`／`locale`／`animation`／`visual_preset`／`quality_profile`／`views`／`legend`／`output`／`viewBox` 各字段的取值与默认。
43. （新增）「Shared authoring constraints」一节：**单图主节点 ≤ 12**（超出必须拆图）；`meta.quality_profile` 默认 `showcase`（9 项产物检查全过、0 composition error、0 warning）；`visual_preset`／`subtitle` 默认省略；`meta.legend` 按**原则式**处理——省略前须先核对**内核默认图例**与本节节点语义是否一致（图例键与默认标签由渲染器持有、带上游 archify 的领域含义），一致才可省略、不一致须显式给出本节自己的 `meta.legend`，且正文不手抄内核默认标签文本（内核是唯一来源）；产品名与标识符保留原文；**品牌徽标只支持内置 canonical ID，URL 字符串与 `{url,sha256}` 一律拒绝且不联网**（本内核已摘除抓取能力）；关系标签是语义数据，删除有意义的标签不算几何修复；Automatic Port Spread 的适用范围与例外；showcase 节奏（非零段 ≥ 8px、内部段 ≥ 16px、无关共线重叠 ≥ 8px 判失败、穿越无关不透明节点恒为硬失败）；间距公式（`clear gap > label mask width + 8px`，`≈ 6.5px × ASCII units + 13px`，CJK 记两个单位）；**六步修复顺序**（①–⑥，其中第 ⑤ 档是「节点标签宽于节点」——缩短文案或加宽该节点，原标签避让顺延为 ⑥），以及「每次只施加一个被诊断出的几何控制、按 `code`／`subject`／`evidence`／`supportedFixes` 消费诊断」。
44. （新增）`## Self-Review` 由 14 项增至 **15 项**：新增「Diagram triples」——核对三件套齐备、同前缀、同目录且只在 `specs/design/diagrams/`；两行引用成对；图与本节文字不矛盾；同名流程跨文档引用**同一组三件套**与同一类型且用归属文档的序号；主节点不超 12；命名两段俱全；以及**绘图规划 Gate 的确认计划与变更清单逐项对齐**。（第 27–29 条所记的 Rule 7／Diagrams 节／Change List Gate 的 `Diagrams` 栏仍然存在，但其正文以第 41–43 条为准。）

**（补充登记）修正清单时新增的两条**

45. （新增）`## Change List Gate` 增补**变更清单自身的落盘形态与时机**（新增 `### Where the change list itself is persisted` 小节）：清单在门**批准之后**、与文档**同批**写盘到 `<项目根>/.brainstorming-archify/change-lists/<UTC 时间戳>-<主题 slug>.md`（如 `20260922T112442Z-order-module.md`；UTC 时间戳在前，按文件名排序即落盘顺序；主题 slug 取本次落盘**主文档**的语义英文短名，规则同图名 slug——仅 ASCII 字母、数字与 `-`、无中日韩字符，首次或架构级落盘用 `architecture`、单模块落盘用该模块英文名、一次落盘覆盖多份时取序号最小者）；**每次落盘一份**，后次新增自己的文件、绝不覆盖前次；批准前只在对话里重列、不写盘——该门的唯一写盘例外仍只是绘图规划 Gate 点名的源 IR；`.brainstorming-archify/change-lists/` 定性为**过程产物**而非受管设计目录——位于 `specs/design/` 之外、技能从不删除、**不在提交范围内**；`specs/design/` 仍是恢复对话的**唯一锚点**，该目录里的旧文件既不表示「待批准」也不表示「已批准」，恢复的会话照旧重列清单并重新取得批准。
    - **已被第 53 条取代（2026-10-12）**：「每次落盘一份」改为「一轮一份、轮内追加」；文件名的时间戳与 slug 改取**轮次**的开始时间与主题；「`specs/design/` 是恢复对话的唯一锚点」收窄为**内容锚点**（进度锚点是 state.yaml，恢复现场 = state.yaml + 当前轮次 change-list 文件）。本条的其余口径（门批准后写盘、批准前只重列、过程产物定性、不删除、不入提交、旧文件不作批准证据）继续有效。
46. （补登）`## Handoff to a Downstream Process` 整节：交接物是**整个 `specs/design/` 目录**（文档集 + `diagrams/` 三件套；因每份文档都以相对自身的路径引用其图，该目录自包含，交接的是这个目录而非单个文件）；本技能**从不**调用下游流程，是否交接、交给谁由人类决定，被问到时只报出上述产物集即止；接口契约是该集合的一部分而非交接的前置条件——它因机械判定命中而存在，交接不需要重新推导。

**（叠加）v7.0.0 新基准的本地化**

47. （叠加）本地化 v7.0.0 的重写内容。上游 v7.0.0 把 `## Three Paths` 换成 `## Size the Work` 三档表、删掉 spec 产物与 `spec-document-reviewer-prompt.md`、新增 `builder-check-prompt.md`，并重写了对话指引。本仓库**保留本库的三路径（Spike／Bounded／Architectural）与三道门模型**，把 v7.0.0 的增量并入：
   - `## First: What Do You Actually Know?`（v7 新节）：收在 `SKILL.md` 开头，作为「快速清晰的任务 → 说一句就停、本技能结束」的 triage；`## Your First Message`（一句话允许对方跳过提问 + 一个开放式问题）照收，并把「跳过即交回对方常规流程」明确为**本技能不实现**（与 Scope 口径一致）。
   - `## The Conversation` 与 `## Play It Back`：把 v7 的对话指引（一消息一问、把选择说出口、Ground to cover 的领地清单、Questions that work、Offer recon、Think wide privately、spike）并入本库 `## The Process` 的「The conversation／Play it back」两段；**删去 v7 的 `## Visual Companion` 整节与 `visual-companion.md`／`scripts/`**（沿用第 1、2 条裁剪）。本地既有的**三层提问清单**（功能点／架构／模块层）与「一消息一层」保留。
   - `## Size the Work` 三档表：并入 `## Three Paths` 的开头（三档 ↔ 三路径），保留本地路径名与 prerequisite 分级。
   - **Builder check**：v7 新增的「构建者检查」并入本库 `## Subagent Review`，作为审阅子代理之外的**第二支透镜**（把「构建者还缺什么」分三堆：已答／次要／只有人类能答）。
   - 上游删掉的 `spec-document-reviewer-prompt.md` 本库早已用 `design-doc-reviewer-prompt.md` 取代（第 17 条），不回归。
   - `## Red Flags` 表补入 v7 的三行（选项会引导、默认值要说出口、别先讲流程），与本地既有行并存。
   - front-matter `description` 仍按第 38 条；**不予采纳** v7 把适用范围扩到「软件之外（一场演讲、一门生意、一次装修）」的措辞——本技能落点是 `specs/design/` 下的设计文档。
   - **未采纳 v7 版式**：v7 把 `Checklist`／`Process Flow`／`The Persist Gate`／`Incremental Persist Protocol`／`Diagrams`／`Change List Gate`／`Self-Review`／`User Review Gate` 等本库机制整节删除，本库沿用自有版本，不随上游删除。

**（新增）4+1 视图**

48. （新增）架构模板新增 4+1 视图模型中的**运行视图**与**部署视图**，架构模板由 **12 节改为 14 节**：在全局功能流程（§10）之后、关键决策记录之前插入 **§11 运行视图**（运行起来有哪些进程、每个进程有哪些线程、进程与线程之间的关系——含进程清单、线程模型、进程与线程关系三部分）与 **§12 部署视图**（部署目录结构、如何部署、有哪些文件组成——含部署目录结构、部署方式、文件组成三部分），原 §11 关键决策记录、§12 待定问题与风险顺延为 **§13、§14**；**两节不要求配图**（以叙述与表格承载，缺图不判缺陷；确实不适用时保留标题写 `不适用：<原因>`）。技能把两节并入设计呈现覆盖清单、架构层提问清单与自审的**模板合规项**（**自审仍 15 项**，只扩写既有第 1 项，不新增条目）；审查提示词新增两节判据（含「不因其缺图报缺陷」的校准条）。README 的章节数与章节清单、`tests/doc-consistency.test.mjs` 的断言同批改到 14 节。

**（新增）讨论状态库与任务拆分**

49. （新增）新增整节 `## Discussion State`（置于 `## The Persist Gate` 之前）：讨论进度落在 `<项目根>/.brainstorming-archify/state.yaml`——它是**进度锚点**（`specs/design/` 答「讨论了什么」、它答「进行到哪了」）；第 45 条里「`specs/design/` 是恢复对话的唯一锚点」的表述**以本条为准收窄为内容锚点**，`change-lists/` 保持第 45 条的定性（落盘授权的审计流水、不是进度记录）。四级状态机 `explore → draft → confirm → closed`（正向只能走一步、回退必须 `--reason`）与文件三态 `discussing / landed / confirmed`（`confirmed` 蕴含 `landed`）成表；每个时点该跑哪条命令逐条列出（开轮 `init` / `file … discussing` / `reopen`、落盘后同批 `file … landed` 与 `advance draft`、人类批准后 `file … confirmed` 与 `advance confirm`、`confirm` 后生成 task.md 再 `advance closed --task-md`）；**`state.yaml` 只能由 `scripts/task-state/change-state.mjs` 编辑**，`resume-state.mjs` 只读。`## Checklist` 增加**第 0 步**（开库与按讨论进展登记文件，既有步号不重排）；`## Writing the Design Document` 第 5 步补「同批标记 landed」；`## Process Flow` 图补四个节点与边（标记 landed→advance draft、标记 confirmed→advance confirm、生成 task.md、advance closed）；`## User Review Gate` 补「批准记进 state.yaml 而非文档、部分批准只标那些、要改就 reopen」；`## Handoff to a Downstream Process` 交接集纳入 `specs/design/task.md`；`## Terminal State` 由「不创建实现计划」改为「确认文档 + task.md 即终点、不进入实现」（第 3 条的「删除终态衔接 writing-plans」与第 10 条的 Scope 声明**不退回**——task.md 是交接物、不是实现计划，实现仍归下游）。

50. （新增）新增整节 `## Implementation Task Split`（置于 `## User Review Gate` 与 `## Terminal State` 之间）：全部登记文件 `confirmed` 后生成 `specs/design/task.md`，从**框架 → 模块 → 具体功能**三层拆分；每个任务一行——第一列**勾选框**（`- [ ]`）、简短**概要**、**依赖**（前置任务号或 `无`）、详细 **AI 实现提示词**（固定四段 `[实现的功能]`—`[任务实现的要求]`—`[实现的约束]`—`[验收标准]`，自包含、引用具体章节而非重述）；任务 ID `T-01` 起按执行序编号；**依赖校验四条规则**（不得前向/自依赖、两个任务改同一文件须有明确先后、功能任务的模块任务必须列在它之前、依赖 ID 必须存在）与文末**「依赖校验」小节**（逐条规则报「无冲突」或具体违例；清单与校验小节互相矛盾即缺陷）；task.md 是**整体重生成**的一次性产物，**不受「序号追加不重排」管辖**，重开即作废（重新收口前必须重新生成）。审查提示词同步：路由表加 `specs/design/task.md`（无模板、按新增的 `Task split` 判据行审）、Purpose 与分批说明纳入 task.md（搭载最后一批）、新增 `Task split` 判据行（三层层级与顺序、行结构四段式、ID 编制、提示词引用具体章节、依赖校验小节与四规则）。

51. （新增）三份模板**文件头删除「状态」行**（`> **状态**：草稿 / 已确认 —— …`）：文件讨论状态的唯一权威是 `state.yaml`，文档头再写一份就是会对不上的双权威。文件头保留 `最近更新` / `参与` / `来源`（模块文档与接口契约另留 `对应架构`），「增量只刷新最近更新」口径不变。**不删**（不同概念）：架构模板 §6.2 的 `设计状态` 列（模块设计存在性：待设计/已设计）与 §7 接口矩阵四档状态（接口依赖状态）。README 的「引用与元信息」硬规则同步改写；`specs/design-doc-templates` 基线中「文件头元信息（状态／……）」的表述经本变更的 delta 更新。

52. （新增）安装器扩展为**同批部署 CodeBuddy 命令适配器**：仓库新增源文件 `commands/bsa/resume.md`（占位符 `__BSA_ROOT__`），安装时重写为实际技能根并部署到 `<命令目录>/bsa/resume.md`，即 **`/bsa:resume`**；新增 `--commands-dir` 选项（默认 `~/.codebuddy/commands`）。命令目录下**其他命令原样保留**、重复安装**幂等**、只碰自己那份；适配器正文口径对齐 spec-superflow 的 `ssf:resume`：只跑 `resume-state.mjs --json`，只消费 `state`/`files`/`blockers`/`next_action`，有 blocker 即停并展示修复命令，否则按 `next_action`（含 `load` 列表）加载技能文件继续讨论，**禁直接改 state.yaml**。README 的仓库布局、安装形态、可选参数表与验证安装节同步；`tests/install.test.mjs` 新增 4 个用例（dry-run 列清单、实装重写路径、保留其他命令、幂等）。

**（新增）change-list 升级为轮次记录**

53. （改写第 45 条）`### Where the change list itself is persisted` 整体重写为**一次讨论轮次一份**：轮次开始（`init` / `reopen`）即创建 `<项目根>/.brainstorming-archify/change-lists/<UTC 时间戳>-<主题 slug>.md`（时间戳取**轮次开始**、slug 取**轮次主题**），轮内每次落盘的授权清单**追加**到同一文件，不再「每次落盘一份新文件」；文件是**活记录**，含固定五小节——**轮次头**（主题/开始时间/参与者）、**讨论记录**（问答要点与人类纠正）、**重要决策**（explore 阶段做出、尚未落进设计文档的决策先记此处，落进后标「已落入 §x」防丢）、**文件修改台账**（每份文档一行 `路径/最近更新/参与/来源`，**取代文档头的同名三行**）、**落盘授权**（每次落盘一段，九项内容不变）。切换由**机械守卫**：`change-state.mjs change-list <path>` 只在「无当前文件」或「当前 set_at 早于最后一次 reopen」时允许换文件，否则拒绝并提示讨论未完成；`advance closed` 要求已设当前 change-list 且文件在盘上。批准前只重列不写盘的纪律不变（轮次文件在轮次开始时创建，与 Persist Gate 的「设计文档批准前不写」以「流程簿记 vs 设计文档」区分）。

54. （新增）`## Discussion State` 节同步第 53 条：恢复现场 = **state.yaml + 当前轮次 change-list 文件**（`resume-state.mjs` 输出 `change_list` 并把它列进 `next_action.load`，当前文件缺失记为 `CHANGE_LIST_MISSING` blocker，reopen 后指针陈旧时提示创建新轮文件）；状态表 `explore` 行的「无产物落盘」限定为**设计文档**（`.brainstorming-archify/` 下的流程簿记除外）；开轮动作补「创建轮次文件并 `change-list` 设指针、随讨论记重要决策」；落盘动作补「更新台账行并追加授权块」。删去「文档头保留最近更新/参与/来源」的旧句——文件头只留标题（模块文档与接口契约另留「对应架构」）。

55. （新增）三份模板**删掉文件头最近更新/参与/来源三行**（第 51 条已删「状态」行），架构模板提示块「只额外刷新元信息区的最近更新一行」改为指向轮次文件的台账行；`## Incremental Persist Protocol` 与 Change List Gate 的 `Explicitly untouched` 项同步（未触动文档现在是**完全**逐字不变，修改记录在轮次台账里、不在文档里）；审查提示词的 `Incremental merge integrity` 判据按此改写（不得索要头行），变更清单读取位置从「本次落盘写的那份」改为「当前轮次的 change-list 文件」。

56. （新增）**图类型由章节唯一决定，并新增第四份模板**（变更 `diagram-type-by-section`）。三处要点：①**删掉「按流程性质选图类型」**——技能 `Diagram type router` 换成「章节 → 图类型」映射表并声明类型由章节决定；架构总纲 §6.3 与 §12 运行视图固定 `architecture`、§10 全局功能流程固定 `sequence`、新增 §11 业务编排流程固定 `workflow`（判据：参与方含人类角色/外部部门/外部系统且存在责任方交接或人工审批门）；模块 §5 固定 `sequence`、§6 新增本模块实体状态机固定 `lifecycle`、§3.N 功能描述按「**重要∩复杂**」固定 `flowchart`（例外：模块独有且有对外调用顺序时改配 `sequence`）。架构由 14 节扩到 **15 节**、模块由 7 节扩到 **8 节**，新节插在 §10／§5 之后并顺延后续节号。②**新增第四份模板 `data-model-doc-template.md`（实体与数据设计，八节，条件必出）**：命中 MySQL/Redis/MQ 任一类持久化接口或存在显式领域模型时与架构总纲同批产出，否则**整份缺席**；其四张图（领域类图 `class`、实体关系图 `erd`、数据流图 `dataflow`、核心实体状态机 `lifecycle`）**只画关键子集**（类图取架构 §8.1 核心类、ER 取核心领域实体、数据流取跨模块/跨边界/涉敏感链路、状态机取跨模块可见实体），完整性权威仍在模块类清单与接口契约 MySQL 清单。文档编号新增固定前缀 `02-`，**模块序号由 `02+` 改为 `03+`**。③**两处口径翻转**：架构 §8.2/§8.3 由「不做类图、用文字或 mermaid」改为**引用第四份文档的领域类图**（内核 v3.1.0 已带 `class` 类型），审查提示词里「这三节不做类图、不要报缺图」的校准条目随之改写；「同名流程跨文档共用同一组三件套」**删除**，改为**架构画跨模块调用顺序、模块画本模块实现步骤，各画自己那一层**。同批还修了 lifecycle `schema_version` 的旧口径（内核 v3.1.0 只接受 `3`，原文写「新图用 2」）。机械门：`tests/doc-consistency.test.mjs` 新增 11 个断言（先跑红 9 失败 → 改后 61 全过）。
57. （新增）第四份模板随安装器部署：`templates/` 是**整目录复制**，故安装器代码无需枚举清单，只更新了 `scripts/install.mjs` 的注释计数与 `tests/install.test.mjs` 的落盘断言（三份 → 四份）。

58. （新增）清理变更 B 遗留的**图类型口径不一致**（变更 `fix-diagram-leftovers`）。逐项：①`skill/SKILL.md` 绘图规划 Gate 第 2 步仍写「chosen by the nature of what is described」且只列 5 类（`architecture/workflow/sequence/dataflow/lifecycle`）——与本文件 `Diagram type router`（章节决定类型 + 十一类）冲突，改为「取所属章节绑定的类型，取自 type router（十一类）」。②`specs/design-doc-guardrails` 基线里遗留的 Scenario「图类型按性质选定」（与「图类型由章节唯一决定」冲突）经 delta 删除，改为「规划时按章节而非性质定类型」。③`SKILL.md` flowchart 专节曾把 `layout` 列进「不存在的旋钮」——内核 `flowchart.schema.json` 定义并读取 `layout.gapX/gapY/nodeW/nodeH`，已改正并把它写进可用杠杆；本节上方 dry-run 记录（原「D」条）的同款登记同步更正。④审查提示词 Purpose／调度头／图例由「三份文档类型」改为四份，补 `DATA_MODEL_TEMPLATE_PATH` 与 `(data model)` 图例标记。⑤`specs/design-doc-guardrails`、`specs/design-doc-templates` 与 `README.md` 的「三份模板」口径统一改为四份（含 Scenario「模板登记为三套」、「两份配图模板」）。⑥基线「运行视图与部署视图的自审与审查判据」原先写「两节 SHALL NOT 被要求配图」且节号为 11/12 → 改为运行视图须配 `architecture` 图（第 12 节）、部署视图不配图（第 13 节）。⑦架构模板 §10 缺陷判据补单模块功能流程例外。⑧`tests/README.md` 用例计数 123 → 135。机械门：`tests/doc-consistency.test.mjs` 新增 5 条断言（先跑红 5 失败 → 改后 135 全过）。

59. （新增）收口生成 `task.md` 的**范围与写盘方式**按「交给下游的待办清单」语义定（变更 `task-md-preserve-progress`）。勾选框即「核销」的机械标识（`- [x]` = 已核销完成）。写盘前先读现有 `specs/design/task.md`：**首轮**（不存在）生成**整份设计**的三层任务；**重开**且**尚有未核销行**（有 `- [ ]`）时**禁止重生成/覆盖**——上一批没做完，覆盖会丢掉待办——只能**就地修改**受影响条目 + **追加**本轮新任务，逐字保留既有任务的 ID/文字/勾选状态、不重编号、不删未完成任务、追加 ID 顺延既有最大编号；**重开**且**全部已核销**（无 `- [ ]`）时**整份重生成并覆盖**，内容只装**本轮重开改动的那部分设计**对应的任务点（旧任务都做完，覆盖不丢工作），不是把整份设计重列一遍。两条路径都 MUST NOT 静默清掉勾选状态。旧的「task.md 为整体重生成的一次性产物、重开即作废、重新收口前必须总重新生成」口径删除；`closed` 门措辞由「必须重新生成」改为「必须**更新**（全核销则整份重生成本轮改动点，否则就地改/追加）」。规格 `task-split` 基线经 delta 发布（「实现任务清单 task.md」需求改写 + 新增两个 Scenario；「讨论状态落库 state.yaml」场景措辞由「重新生成」同步为「更新（整份重生成或就地修改/追加）」）。机械门：`tests/doc-consistency.test.mjs` 新增 2 条断言（先跑红 2 失败 → 改后 137 全过）。

60. （新增）自建 `flowchart` 渲染器**改由内核共享件组合**（变更 `flowchart-kernel-style`），修掉「画风与内核其它类型两样 + 长标签溢出框」两个缺陷。①**配色**：节点不再只画单层 `c-mask`（底色 + 描边），改为复用内核 tone 调色板——`kind → c-<tone>`（`start`/`end`→frontend、`process`→backend、`decision`→database、`loop`→cloud、`exception`→security、`io`→messagebus，与 `lifecycle` 同源语义），底层 `c-mask` + 上层 tone 实色双层，fill/stroke 由模板主题变量提供（深/浅主题 × 四预设一致）。②**文本自适应**：改用内核 `text-fit` 口径——**放宽**（框宽按单行装下取值并预留角标栏 `RAIL_RESERVE`，让 `nodeLabelLayout` 走「保持居中、右移让开角标」而不是把整行压到角标下方）→ **换行**（超宽按内核 `horizontalPadding` 折行，上限 4 行；矩形按行数加高、菱形判断框按内接矩形扩宽加高）→ **缩字号**（行数超限时整块缩到可读下限）；到下限仍折不进框则报 `flowchart/label-overflow` 拒绝渲染、不落盘。③**风格件同构**：边改用 `arrowClassMap`（删除自造的 `MARKER_BY_VARIANT`/`EDGE_STROKE`）、边标签走 `edgeLabelAccent`，节点接 `renderSemanticSigil` 角标，图例走 `resolveLegend`/`renderLegend`。④**i18n**：新增 `legend.flowchart.{start,end,process,decision,loop,exception,io}` 七键并**五份目录全写**（`translateMessage` 无逐键回退，缺键即抛错）。⑤**规格与技能**：`specs/diagram-engine` 走 delta 补「flowchart 复用 tone / text-fit / 图例」；`SKILL.md` flowchart 专节补「Styling and text reuse the kernel's own types」要点（结构校验与「没有几何旋钮」口径不变）。机械门：`test/flowchart.test.mjs` 新增 3 条（tone 类与图例、长标签折行不越框、超长标签拒绝），内核回归入口 `RESULT: PASS`；`i18n.test.mjs` 因依赖已裁剪的 `examples/` 本就不在回归清单内，其 `missingKeys.length === 10` 断言受 `slice(0, 10)` 封顶影响、不因新增七键而变（核查记录，无需改）。das 侧 7 张 flowchart 图重渲后 9/9 产物检查、0 error / 0 warning。另按本仓库约定对改后的 flowchart 专节做了**作者视角 dry-run**（子代理扮作者，仅凭专节 + schema 造一份 12 节点流程）：**一次通过**，9/9 产物检查、0 error / 0 warning，tone 类/角标/图例齐全、无标签越框。dry-run 摩擦**已消两条**（专节补明「角标与图例由 `kind` 自动生成、不用作者声明」与「本类型默认图例天然合意，故省略 `meta.legend`」）；**登记备查两条**：①共享约束「At most 12 primary nodes」未定义是否含 `start`/`end`（属全类型口径，非本变更范围）；②`routeReview` 会报「建议拉伸 1.35」一类**非阻塞**提示而 repair order 未覆盖该项、也不影响 composition（工具面既有行为）。

### 上游二：archify（绘图内核）

`scripts/diagram-engine/` 是 [archify](https://github.com/tt-a1i/archify) 出图技能包的**裁剪副本**：保留十类上游图类型（architecture / workflow / sequence / dataflow / lifecycle / erd / class / tree / timeline / waterfall）的渲染能力，删掉了全部与出图无关的子命令（compare / deliver / finalize / preview / migrate / inspect / check / visual-check / browser-check / guide / brands / examples / demo）、`--repo-root` 溯源能力、`examples/`、`references/`、`recipes/`、`delta/` 与上游 `SKILL.md`，把入口 `archify.mjs`（7139 行）裁成内部驱动 `render-driver.mjs`（约 900 行，只留 `render`／`validate`／`doctor`），并以本仓库新增的 `render.mjs` 作为唯一对外入口；品牌解析收窄为「只认内置 canonical ID、不联网」。此外**自建 `flowchart` 类型**（程序设计流程图，上游没有），其配色、文本度量、图例与角标均复用内核共享件、与上游十类同构（见第 60 条）。逐项改动与被删清单见 `scripts/diagram-engine/UPSTREAM.md` 第 1 节。

**上游基准**：`tt-a1i/archify` @ `v3.1.0`（commit `1c2b42d`；技能包版本 `3.1.0`，`skill-release.json` 的 `channel` 已是 `stable`）。

**许可证归属**：archify 本体为 MIT（版权方与全文见 `scripts/diagram-engine/LICENSE`）；内联字体 **JetBrains Mono** 依 SIL Open Font License 1.1 授权，完整授权文本随包存放在 `scripts/diagram-engine/assets/JetBrainsMono-OFL.txt`；第三方商标与图标归属见 `scripts/diagram-engine/THIRD_PARTY_NOTICES.md`。

**怎么判回归**：

```bash
node scripts/diagram-engine/test/run-valid.mjs
```

它只跑**在裁剪后成立的那个子集**（当前为上游全绿 48 + 本地 7 = 55 个文件，退出码 `0` = 全过；上游 48 个由 3.1.0 整包 212 个文件逐文件**串行**实测筛出，本地 7 个含 CSS 抽取、主题变量解析、图名派生、驱动 CLI 面、环境自检、品牌边界与自建 `flowchart`）。哪些上游检查项被排除、为什么排除，逐条登记在 `scripts/diagram-engine/UPSTREAM.md` 第 3、4 节。

**注意：`./scripts/sync-upstream.sh` 只覆盖 `superpowers`，不覆盖 archify**——它比对的是 `skill/SKILL.md`，与绘图内核无关；同步 archify 需按上面的基准 tag / commit 手工比对。

**讨论状态库（`scripts/task-state/`）的维护说明**：

- `change-state.mjs` 是 `.brainstorming-archify/state.yaml` 的**唯一写入口**，`resume-state.mjs` **只读**——改状态机行为时两条都要动，且不得给 resume 加写能力。
- 状态文件的读写走 `state-yaml.mjs` 的**形状锁定** YAML 子集（仓库零依赖）：改形状时发射与解析必须同批改，并用 `tests/task-state.test.mjs` 的往返用例兜底；遇非法形状**失败关闭**，不猜语义。
- 回归入口：`node --test tests/task-state.test.mjs`（覆盖四态推进与前置条件、reopen 只翻点名文件、closed 后 task.md 作废、原子写、YAML 往返、resume 只读与 blockers）。
- 命令适配器 `commands/bsa/resume.md` 由 `scripts/install.mjs` 重写 `__BSA_ROOT__` 后部署到 `~/.codebuddy/commands/bsa/resume.md`；改适配器内容后重跑安装即生效，**不要手工编辑部署后的副本**（下次安装会被覆盖）。

## 2. 后续变更登记

以下变更登记为待启动的独立工作。变更目录在 `changes/` 下；由于 `changes/` 被 `.gitignore` 忽略，另在此登记，以免换机或清理工作树后丢失。

| 变更 | 要解决的问题 | 细节所在 |
|------|-------------|---------|
| ~~`backfill-run-valid-cases`~~ | **已于 2026-10-12 关闭**：其前提（按文件级排除粒度回填运行时用例）在内核重搬到 3.0.1 后已消失，且失效用例文件随裁剪删除；用户裁定删除该变更目录（`changes/backfill-run-valid-cases/` 已不存在）。详见下节重估。 | `scripts/diagram-engine/UPSTREAM.md` 第 3、6 节 |

该项是在 `add-interface-contract-template` 变更的归档验证中被实测确认的，当时按该变更的范围边界未处理；
2026-10-12 经用户裁定**关闭并删除目录**，不再有待处置项。

### 2026-10-12 dry-run 暴露的问题（已全部处置）

`resync-upstream-and-add-views` 变更的 dry-run（库存同步服务，三模块，实渲 4 组三件套）结论 `有需猜`（无阻塞），抓出 8 条摩擦：

- **F1（本次引入）/ F2（既有真缺陷）**：随 `resync-upstream-and-add-views` 当批修掉（首条消息改为三项、接口契约判定基准定义为「本次设计覆盖的系统」），各补一条断言。
- **F3–F8（既有）**：由后续变更 `fix-dryrun-friction-f3-f8` 修掉：

| 编号 | 问题 | 修法 |
|------|------|------|
| F3 | §8.1 核心类判定漏 §10 的「触发入口」承担者 | 判定标准增列该情形；审查提示词 Class attribution 行同步；delta 修《核心类设计》 |
| F4 | Redis 全局／聚合 key 无命名口径 | 总则命名规范把末段 `:{实体标识}` 改为**条件式**（实体级带、全局／聚合级不带并写对象范畴）；delta 修《对外接口命名规范》 |
| F5 | 三种配图口径分散三处 | 架构模板顶部加「配图口径速查」（强制 §6.3/§10、可用 mermaid §8、不要求 §11/§12） |
| F6 | 流程图台账负担 | 变更清单 `Diagrams` 列出**去重后的三件套**：同组只记一次并列出全部引用处 |
| F7 | 两轮台账口径藏得深 | 提到《The validation hard gate》开头加粗 |
| F8 | 平台提问上限无对照 | 《One layer per message》补「上限未知就一问一条」 |

以上 F3–F8 均补了机械断言（见 `tests/doc-consistency.test.mjs`），F3/F4 的基线 delta 由 `fix-dryrun-friction-f3-f8` 经 `ssf sync` 发布。

### 2026-10-12 dry-run 复测（设备遥测服务）暴露的修法

F3–F8 修完后用新项目**盲测复跑**一次，仍判 `有需猜`（无阻塞）——但**已验证修复生效**：§8.1 的调度器类这次给出了明确规则、§11/§12 被判「可产出且自然」。复测抓出三处新问题并当场修掉：

- **审查提示词与规格打架**：审查提示词只认「逐段（`x.1`/`x.2`/`x.3`）不适用」，而接口契约模板与已发布规格都允许**整族**用一条 section-level `不适用` → 审查提示词补上该形态并声明「不得向项目不使用的家族索要三段」。
- **Redis 全局 key 的「用途」段无语义**：四段式合法了，但裸锁没有「动作」，作者只能自造填充值 → 总则补「实体段写对象范畴、**用途段写机制或角色**（`mutex`/`incr`/`checkpoint`）」并给锁的例子 `telemetry:rollup:lock:mutex`。
- **单模块流程图的序号易误标 `01-`**：§10 先给「调用链只有一跳、其余参与者是外部系统 → 单模块流程 → 用该模块序号」的判定规则。

另有一条子代理报的「`validate` 缺参时 exit 0 静默成功」**复现不了**（实测 `render.mjs`/`render-driver.mjs` 均 exit 2），记为**误报**。以上三处各补机械断言（用例 54→55）。

### 2026-10-12 dry-run 第三轮复测（发票 OCR 异步任务）暴露的修法

再用新项目盲测一次，仍判 `有需猜`（无阻塞）；确认前两轮的修复继续生效（§8.1 调度器类给了明确规则、锁 key 命名干净、单模块流程序号未再重渲）。抓出三处**上一轮没修干净/新暴露**的问题并修掉：

- **整族不适用只在审查提示词里允许**，而 **SKILL 自审第 13 条**与**接口契约模板正文**仍指向「缺段即缺陷」——上一轮只改了审查提示词，形成三处打架 → 三处统一为「**整族不适用可用一条节级 `不适用` 代替三段**」。
- **术语易混**：「单模块**功能**流程」与模块模板/SKILL 的「纯模块内部**实现级**流程」不是一回事 → §10 改称「单模块功能流程」并点明区别。
- **§7「进程内跨模块接口」**要读者自行推「模块 ≠ 进程」 → §7 补一句「**模块是设计划分、进程是运行单元**」。

以上三处各补机械断言（用例 55→56）。

### 2026-10-12 dry-run 第四轮复测（订单超时关单）暴露的修法

再用新项目盲测一次，仍判 `有需猜`（无阻塞），但**点检全过**——第三轮修的东西（§7 模块≠进程、§10 单模块流程序号、§8.1 调度器类、Redis 锁 key、整族不适用）**都没有再出现**。只剩两处并已修：

- **`meta.output` 口径与 schema 矛盾（真缺陷）**：`SKILL.md` 把 `output` 写成 optional，但五类 schema 的 `meta.required` 都含 `output`，省掉即校验失败 → SKILL 改为「**必填**：portable POSIX-relative `.html` 路径」，并同步「schema 需要哪些字段」那句。
- **接口契约自检 ② 与小节计数矛盾**：模板写死「第 1–7 节合计 21 个三级小节」，与同文件的「整族可用一条节级不适用」冲突（有族不适用时实际是 12） → 改为随实况变：七族都在用时 21，否则 **在用族数 × 3**（文首说明与文末自检两处同改）。

以上两处各补机械断言（用例 56→57）。

### 2026-10-12 dry-run 第五轮复测（优惠券核销）暴露的修法

再用新项目盲测一次，仍判 `有需猜`（无阻塞），点检继续全过（`meta.output` 无缺报错、整族节级 `不适用` 处处可用、§8.1 调度器规则清晰、锁与计数 key 形态干净、单模块流程序号无歧义）。剩 6 条，其中 5 条为真问题并已修、1 条为体验项：

- **编排类算不算核心类（真缺陷）**：§8.1 的「出现在模块级调用链上」未说明是否含**模块内发起/编排该跳的类**（如定时任务触发的关单作业类）→ 判定标准补「任意一跳点名的承担类都算，含模块内发起或编排该跳的类」。
- **矩阵与 §4 的比对粒度（真缺陷）**：调用方对同一提供方有**多条** §4 行时（`readCoupon` + `markRedeemed`），「逐字一致」未定比对口径 → §7 补「**集合级比对**：行的集合对上即可，不要求 1:1 单行」。
- **Process Flow 图与落盘门正文时序相反（体验）**：图把「设计批准」画在 Persist Gate 之前，正文却说落盘门不等设计批准 → 图下加一句「两门独立，图仅为可读性按序画，边不是依赖」。
- **Redis「用途」段两处口径（体验）**：「动作或语义」与「机制或角色」并存 → 统一为「实体级写动作、全局／聚合级写机制或角色」，并补全局级的计数例子。
- **`meta.output` 与三件套同名之惑（本次改动引入）**：第四轮把 `output` 改必填时未说是否须与三件套 `.html` 同名 → 补「它是持久的作者侧输出路径，**不必**等于由 IR 文件名派生的三件套名」。
- **§8 为空时是否保留 `### 8.1`/`### 8.2`（体验，未修）**：属模板细节，登记为体验项。

以上五处各补机械断言（用例 57→58）。

### 2026-10-12 dry-run 第六轮复测（工单分派）暴露的修法

再换新项目盲测，仍判 `有需猜`（无阻塞），点检继续全过（§8.1 调度器/编排类规则清晰、`meta.output` 必填且独立于三件套名）。剩 2 需猜 + 7 体验，两个需猜已修：

- **Redis「用途」段对实体级锁仍靠猜（真缺陷）**：统一口径时写「实体级写动作」，但实体级锁天然是机制词；且全局示例 `…:lock:mutex` 把 `lock`/`mutex` 跨两分支摆，看不出用途段该写哪个 → 用途段口径放宽为「动作或落在该实体上的机制（`state`/`create`/`lock`）」，并补**两态对照示例**：实体级锁 `ticket:dispatch:ticket:lock:{ticketId}`、全局级计数 `ticket:dispatch:counter:incr`。
- **MQ「方向」列在同服务两模块间粒度未定（真缺陷）**：写不出系统级 → 补「两端可以是本服务的模块，同服务内两块之间也写**模块级**，不要写成 `本服务→本服务`」。

另修 4 处体验/继承项：审查提示词的矩阵比对改**集合级**（原文单数「row」与模板「集合级比对」不一致）；审查提示词的命名标准补**全局级** Redis 形态；Process Flow 的 `User approves design? → Persist Gate` 边标签点明「两门独立」；§8.1 补**编排类**示例。剩 2 条体验未修并登记：接口契约 §8 为空时是否保留 `### 8.1/8.2`；升级流程图的图类型 tie-break。

以上六处各补机械断言（用例 58→59）。

> **结论（2026-10-12）**：连续 **6 轮**换项目盲测，**每轮都判 `无阻塞`**（技能可端到端走完、真渲染、自审/审查/用户门都成立）；摩擦集中在**文档精度的长尾**——每个新项目会翻出不同的边角，不是收敛到 0。已按轮次清掉 F1–F8 + 复测 1–6 轮共约 20 处真问题，均配机械断言（59 用例）。**"无阻塞" 是本技能可达到的稳定态；"零摩擦" 不可达**，余项按此登记。

### 2026-10-12 讨论状态库 + 任务拆分 dry-run（报表导出服务）结论

`add-discussion-state-and-task-split` 变更的 dry-run（报表导出服务：HTTP API 进程 + 定时导出 Worker，Redis 锁/计数、MySQL 报表定义、MQ 导出完成事件，三模块、二轮增至四模块）结论 **`无阻塞`**（4 需猜 + 6 体验）。场景结论全部属实：

1. **状态机两轮全干净**：`explore → draft → confirm → closed`，reopen 后再走一遍到 closed；无命令行为异常，正向一步限制、回退需 `--reason`、closed 需 `--task-md` 均按文档生效。
2. **中断/重启**：draft 态全新跑 `resume-state.mjs --json`，输出 state + 逐文件状态 + 带具体命令的 next_action，足以直接续跑、无需猜测。
3. **reopen 语义**：`reopen 01 00 05 --reason …` 后仅这 3 个翻 `discussing`，未点名的 02/03/04 保持 `confirmed`，整体回 `explore`，新文件 05 被登记——与技能声称一致。
4. **过期 task.md 拒绝**：reopen 后未重新生成即 `advance closed` 被拒（exit 1，mtime 不晚于最后重开）；重新生成后同命令成功。
5. **task.md 可产出性**：三层（框架 3 / 模块 4 / 功能 5）、复选框行、四段式提示词、依赖校验节均可按 Implementation Task Split 单独产出。

**本次引入并已修**（各配断言，用例 95→97）：

| 编号 | 问题 | 修法 |
|------|------|------|
| F1 | 「Two file statuses」计数词与三态枚举矛盾 | 改 Three；断言不得残留 Two |
| F5 | reopen 对**未登记新文件**会先登记再翻转，文档未写 | Discussion State 的 reopen 条补明文；task-state 测试锁行为 |
| F6 | Scope 禁「任务清单」却要求 task.md 带 `[验收标准]`，例外未写明 | Scope 补「唯一明文例外是 `specs/design/task.md`」；断言 Scope 含该例外 |
| F7 | 框架任务「one task per seam」的 seam 无判据 | 补「seam 即枚举的那些项；不能独立实现验证的项并入首个使其有意义的任务」 |
| F8 | 依赖校验「同文件」规则没说「只读」能否免 ordering | 补「只读他方写入的文件无需 ordering，但提示词约束段须声明」 |

**登记未修**：F2（sequence spread 下标签盒宽 vs desktop-readability 双约束在 5 参与者 + 长标签时无交集，出路是去掉 sublabel，repair order 未覆盖——几何问题，不可断言，可在引擎测试记禁用 sublabel 的回归）；F3（`validate` 传错图类型输出 schema 噪音而非用法级提示——先前就有，可断言）；F4（架构 §7 状态枚举表/填表规则是否随产物落盘需推断——先前就有，可断言）；F9（explore 态 resume 不知讨论层进度——设计使然， explore 进度锚在对话里）。

### 2026-10-12 轮次记录 dry-run（订阅计费服务）结论

`change-list-round-record` 变更的 dry-run（订阅计费服务：HTTP API + 定时催缴 Worker，Redis 账户锁/重试计数、MySQL 发票、MQ 支付失败事件，三模块、二轮增至四模块；实渲 5 组三件套）结论 **`无阻塞`**（3 需猜 + 4 体验）。场景结论全部属实：

1. **一轮一文件、轮内追加**：第 3 轮拆成两次落盘，两段授权块都追加到同一文件；五小节（轮次头/讨论记录/重要决策/文件修改台账/落盘授权）全程保持。
2. **仅凭 state.yaml + 当前轮次文件恢复**：`resume-state --json` 的 `ok=true`、`blockers=[]`，读当前轮次文件即可重建「讨论了什么、定了什么、授权了什么、各文件什么状态」，**不依赖会话历史**。
3. **切换守卫**：`draft` 与 `confirm` 两态换文件均退出码 1、指针未动；`closed` 后 `reopen` 再换退出码 0；用**旧** task.md 收口被拒、重生成后成功。
4. **explore 决策防丢**：三条关键判定先入文件、落盘后补「已落入 §x」；中断测试证明可取回。
5. **审查口径自洽**：文档头不再有 最近更新/参与/来源 后，审查提示词的 merge-integrity 判据仍成立（已明文改为「修改记录在轮次台账、不得索要头行」）。

**本次引入并已修**（各配断言，用例 109→112）：

| 编号 | 问题 | 修法 |
|------|------|------|
| **F1（真矛盾）** | 轮次文件「轮开始即创建、explore 即记决策」与变更清单门「任何文件创建/修改前须先获批准」相抵触——explore 定义里的豁免只澄清了「算不算落盘」，没澄清「门未开能不能建文件」 | 变更清单门开头明说**只管设计文档、不管流程簿记**：`state.yaml` 与当前轮次文件在讨论进行中（含 explore、门开之前）即维护，这是可恢复性的前提；门保护的是设计文档内容——轮次文件的授权块仍在门批准后写。Writing 第 3 步由「批准前什么都不写」改为「不写设计文档」 |
| **F2（需猜）** | 五小节与授权块无机械校验，占位文件也能过 `change-list`/`closed`/恢复 | `change-list` 与 `advance closed` 校验轮次文件至少 5 个 markdown 标题（轮次头 + 四节），空文件或缺节即拒绝并列出应有小节；SKILL 说明这五节是 markdown 标题且命令会校验 |

**登记未修**：F3（文件名时间戳/slug 靠人打，可用 `date -u +%Y%m%dT%H%M%SZ` 生成——体验，可断言）；F4（台账无校验、「受管文档」集合只由登记文件隐含——体验，可断言）；F5（门前的口头清单与门后写入文件的记录之间无一致性核对——先前就有，不可）；F6（`resume-state` 不内联台账内容，要另读文件——体验）；F7（「已落入 §x」注记无强制——体验）。

### `backfill-run-valid-cases` 的现状重估（2026-10-12，已关闭）

内核重搬到 3.0.1 后，`run-valid.mjs` 的清单已按新基准重测重写（上游全绿 18 + 本地 6 = 24 文件）。上一轮登记的 `backfill-run-valid-cases`（把排除粒度从文件级改为用例级）**前提再次变化**：原拟回填的用例文件已随本次裁剪删除，且新的 18 个上游文件本就是「整文件全绿」，暂无可回填的缺口。

**处置（2026-10-12）**：用户裁定**关闭该变更并删除目录**——`changes/backfill-run-valid-cases/` 已不存在。若将来出现「同一文件内部分用例通过」的新缺口，按届时基准重新立项，不复用该目录。

## 3. 历次 dry-run 记录

### 图类型↔章节绑定后的 dry-run（设备报修工单系统，2026-10-15）

变更 `diagram-type-by-section` 收口前，用**未受污染**的代理按新版 `skill/SKILL.md` 与四份模板实跑了一轮
架构级设计（4 模块、跨责任方编排、MySQL+Redis、双进程多线程），真出 **24 组图三件套**（全部 showcase 通过）、
落盘 7 份设计文档 + `task.md`，状态机 `explore → draft → confirm → closed` 全程走通。
**结论：无阻塞级摩擦（0 阻塞 / 3 需猜 / 6 体验）**，但 A 条（图表命名规则自相矛盾）最接近阻塞。

**本次引入、当批修掉的 5 处**：

- **A（需猜／接近阻塞）图表命名自相矛盾**：`SKILL.md` 的「One flow, one file」说同名流程两处**共用一组三件套**，
  而自审第 15 条与两个模板正文说**各画各一层、文件不同**；更致命的是模块模板又要求「跨模块流程序号归 `01-`」，
  与「文件不同」叠加会推出同名文件而相撞——任何命名都必违一条。→ 改为「**两处各画一层、各取本文档序号**」
  （架构 `01-`、模块 `0N-`），并写明**单模块功能流程的归属反转**（图归模块文档，架构 §10 只写引用）。
  其中「命名相撞」这一半在我自查时已先发现并修掉（提交 `2133943`），本轮补掉 SKILL 正文那一半。
- **B（需猜）功能点↔流程↔模块三角要求「集合相等」**，与架构 §5「参与模块不取整条链」的口径互斥：
  一条跨模块流程服务 3 个功能点时，参与模块的 §1.2 被迫列出它并不负责的功能点。→ 模块 §1.2 改为
  「**按模块那一跳对齐，不要求集合相等**」＋三条硬要求（本模块参与的功能点必须在 §5 找得到；§5 每条流程
  至少有一个属于本模块；不属于本模块的不得抄进 §1.2），单模块流程除外。
- **H（体验）架构模板 §7 的四档状态表与填表规则是否属产物只能猜**。→ 明文标注「整块属于产物，必须原样保留」。
- **E（体验）`change-state.mjs` 等命令的 `<path>` 是项目内相对路径**，正文只说「run from anywhere」，
  传绝对路径会被拒。→ 补一句路径口径，并点明「可任意目录执行」不等于「路径相对 cwd」。
- **C（需猜）`edges[].role` 逐类型不同**（`workflow` 是 `main/branch/async/return/error`，
  `flowchart` 是 `main/branch/loop/exception`），正文只提醒读 `route` 没提 `role`。→ 补「枚举逐类型不同、
  须读各自 schema」，并直接给出这两组反例。

**撞到、但属既有内核行为，一并补进正文覆盖的 2 处**：

- **F** architecture 的 `boundary` 只能圈住自己的成员——未列出却几何落进框内会判失败 → SKILL 补明文。
- **D** `flowchart` 补专节：结构是**校验**而非修补、**没有逐节点几何旋钮**（`pos`/`via`/`labelAt`/`labelDx`/
  `labelDy`/`labelSegment`/`channelX`/`width` 都不存在；唯一的间距控制是**全局 `layout` 块**的
  `gapX`/`gapY`/`nodeW`/`nodeH`，**没有 layout 模式、也没有 grid 块**——本条初稿误把 `layout` 一并写进「都不存在」，
  2026-10-16 的 `fix-diagram-leftovers` 已改正）、repair order 里「挪标签、改路由」的步骤对本类型
  **不适用**、节点书写顺序会改变布局（只用于修正阅读顺序，不得用来凑一次通过的渲染）。

**未修、登记备查的 3 条**：

1. **`flowchart` 在「多个分支回汇到同一节点 / 多个终点」的拓扑下易触发 showcase 段长门**，而该类型没有
   `labelAt`/`via` 一类旋钮，dry-run 的处置是**改设计拓扑**（合并判断、去掉长回汇边、甚至调换节点书写顺序）
   ——即渲染器反过来决定了程序流程图的拓扑。这是内核渲染器的**可用性缺口**，修它要么改它的回汇路由
   （保证合流段长 ≥ 8px/16px），要么给该类型加最小几何旋钮，两者都超出本变更范围。
2. **架构图标签与相邻路由相撞时的修复次序仍需试**：正文说「先挪标签、必要时加宽 grid」，但实操里先加
   `labelDy` 往往撞到别的路由，实际有效的第一步是把 `layout.gapX` 调大。可考虑在正文点明这个次序。
3. **`composition/*` 诊断在渲染输出里重复三遍**（正文 + Fix 行 + 汇总），读起来噪声大。

报告：`/tmp/dryrun-repair-ticket/dryrun-report.md`（沙箱，不入库；要点已摘入本节）。

### 重同步上游 + 4+1 视图后的 dry-run（2026-10-12）

变更 `resync-upstream-and-add-views` 收口前，用**未受污染**的代理按新版 `skill/SKILL.md`（同步到 superpowers v7.0.0、内核重搬到 archify 3.0.1、架构模板 14 节）实跑了一次「三模块 × 多轮」的设计（库存同步服务），结论 `有需猜`（无阻塞）——整个流程可在不向人要授权、不违反任何硬门的前提下走完（含真渲染 4 组三件套、自审、审查、用户评审）。

- 新增的 **§11 运行视图 / §12 部署视图** 被判定**可产出且自然**（文字+表格即可，不需要配图）。
- 摩擦 **F1（首条消息与分类宣告次序冲突）为本次改动引入，已修**；**F2（接口契约判定基准未定义）为既有真缺陷，已修**（基准定为「本次设计覆盖的系统」）。其余 F3–F8 为既有问题，登记在 §2 的处置表。
- 报告：`changes/resync-upstream-and-add-views/dryrun-report.md`（`changes/` 不入库；要点已摘入 §2）。

### 技能 dry-run 暴露的待修问题（2026-09-22）

用**未受污染**的代理按 `skill/SKILL.md` 实跑了一次「三模块 × 四轮」的设计（会议室预约服务），
结论 `有阻塞`。第一轮报 16 条摩擦，其中**本次改动引入的**已修，并**由同一代理在原沙箱之外从零复跑一次**
验证修复：五条宣称修复**全部实测生效**（关键的「IR 命名」与「validate 用法」两处，复跑时代理**不再需要
试错或推导**，照文档照抄即一次通过）；复跑同时抓出**我的修复措辞自己引入**的 4 条新问题，也已修掉——

① `IR 文件名决定三件套名` 的示例只给英文名，中文文档仍须跨节查派生规则 → 补中文示例；
② `validate`/`doctor` 用法未给、showcase 输出样式不明 → 补两个子命令签名与期望输出，并写明
`--quality` 是**覆盖** IR 的 `meta.quality_profile`；
③ 架构段「网格优先」写得像「不需要任何位置信息」→ 改写为「仍需逐组件给逻辑行列」；**但复跑发现该改写
把「几何」说过了头**——节点几何确由渲染器算，**关系标签仍需按修复顺序 ⑤ 人工迭代**（复跑实测 5 次
渲染、其中一次停在 `exit 3`）→ 已把措辞收窄到「节点与路由几何由渲染器算，标签是例外」；
④ 模板「作者不手写 IR」措辞与技能冲突 → 改为「人类作者不手写 IR」；**但该句带的「事实不超出本节」与架构模板 §6.3「图上要给出数据库等」互斥** → 已改为可执行规则
「图上不得出现本节正文没有的组件；若需要，先把事实补进本节正文再出图」；
⑤ 门数边界（三个会话级门 vs 绘图规划窄门）→ 补边界说明，并同步修正 `## The Three Gates` 里
「asked three separate times」一句，避免与窄门并存时被读成四次问询。

复跑后**仍判 `有阻塞`**，但原因不再是本次修的引擎/文档互斥，而是两条**已登记未处理**的 Critical
（接口矩阵状态枚举缺一档、模块模板三条规则在纯内部流程上无解）——它们每次落盘都逼代理在无人可问时
自行拍板。其余登记项复跑逐条核对：**六条全部登记在案、描述与实测相符，无遗漏无错述。**

**这六条已全部修掉**（超出该变更原契约范围，规格 delta 已同批更新）：

| 原发现 | 修法 |
|---|---|
| `interface-matrix-status-gaps`（Critical） | 矩阵状态列由三档扩为**四档**：新增 `待调用方`（提供方已设计、调用方未落盘，合法终态，不是「缺口无人认领」）；并明确架构总纲**首轮**所有模块未设计时由总纲前向登记、状态一律 `待提供`，不属对某模块的越权设计 |
| `module-flow-alignment-unsolvable`（Critical） | 「对应流程」列**只列功能流程**（即同样登记在架构总纲的那批）；纯模块内部实现级流程 MUST NOT 占用该列，只写在第 5 节并标明父流程；功能点与流程的双向覆盖核对口径限定为**功能流程** |
| `matrix-column-authority`（Important） | `详见` 列明确指向**调用方**模块文档第 4 节；调用方未落盘时写 `待调用方落盘`，**不得**指向一个尚不存在的路径（引用必须可解析） |
| `repair-order-label-width`（Important） | 修复顺序插入新的第 ⑤ 档「节点标签宽于节点」（缩短文案或加宽该节点），原标签避让顺延为第 ⑥ 档 |
| `handoff-contract-undefined`（Important） | 新增 `## Handoff to a Downstream Process`：交接物是**整个 `specs/design/` 目录**（文档集 + `diagrams/` 三件套，因引用均为相对路径而自包含）；本技能**从不**调用下游流程，是否交接由人类决定；接口契约是该集合的一部分而非前置条件 |
| `process-flow-diagram-gate-node`（Minor） | `## Process Flow` 流程图补上绘图规划 Gate 节点，并新增「生成 IR 与渲染三件套」节点置于变更清单门**之后**，以保住「不在变更清单之外写图」这条不变式 |

规则改动已同步进 delta 规格（`changes/<change>/specs/design-doc-templates/spec.md`：改写「模块流程的功能点标注与同名对齐」、新增「跨模块接口矩阵的位置与权威方向」），收口 `sync` 后基线不会滞后。

实测**验证成功、无需改动**的三条核心机制：同一流程跨文档共用同一组三件套（`01`/`02`/`03`
三处引用同一组文件，改名后只重渲染一次三处同时更新）、三件套 + 固定两行引用、增量只改受影响条目。

## 4. 发布一个版本

版本号是 **`v` 前缀 + 三位语义化** 的注解 tag（如 `v0.1.0`）。版本号的**权威文字出处是 README 的两处**——
顶部那一行与 `## 版本` 表里的「本仓库 / 本技能的发布版本」；不另设 `VERSION` 文件，免得两处不同步。
（本节命令里的 `v0.1.0` 只是示例，不是版本声明。）

```bash
# 1. 改版本号：README 顶部一行 + `## 版本` 表
# 2. 全量测试必须绿（59 用例，含内核回归集）
node --test tests/*.test.mjs
# 3. 提交并推送
git push origin main
# 4. 打注解 tag 并推送
git tag -a v0.1.0 -m "brainstorming-archify v0.1.0"
git push origin v0.1.0
# 5. 建 release（说明手写中文：这是什么 / 两个来源 / 安装 / 本版包含 / 验证 / 许可）
gh release create v0.1.0 --title "brainstorming-archify v0.1.0" --notes-file <notes.md> --latest
```

**重打已发布的 tag**（例如发版后才发现 README 还要改）——release 与 tag 必须一起删干净再重建，
否则 tag 仍指向旧提交（`gh release edit --target` 改不动已存在的 tag）：

```bash
gh release delete v0.1.0          # 先删 release
git tag -d v0.1.0
git push origin --delete v0.1.0   # 再删远端 tag
# 改完 → 提交推送 → 重新打 tag → 重新 create release（URL 不变）
```

**版本号不写进 `scripts/diagram-engine/skill-release.json`**——那里的 `3.1.0` 是上游 archify
技能包的版本，改它会让内核与上游对不上号。


