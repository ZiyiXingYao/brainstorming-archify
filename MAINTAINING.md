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
| `skill/SKILL.md` 等技能文本 | [superpowers](https://github.com/obra/superpowers) | `v6.4.1`（commit `5bf4e78`） | `./scripts/sync-upstream.sh` 看 diff 后按《需要重放的改动清单》重放 |
| `scripts/diagram-engine/` | [archify](https://github.com/tt-a1i/archify) | commit `5289f6867f048a7450ec5718f58459613a84cf41`（技能包 `2.17.0-dev.1`） | **无脚本**，按 commit 手工比对 + 跑 `test/run-valid.mjs` 判回归（见下文） |

`./scripts/sync-upstream.sh` **只覆盖 `superpowers`**：它比对的是 `skill/SKILL.md`，与绘图内核无关。

### 上游一：superpowers（`brainstorming`）

本技能的 `SKILL.md` 是 [superpowers](https://github.com/obra/superpowers) `skills/brainstorming/SKILL.md` 的**改造副本**。

**上游基准**：`obra/superpowers` @ `v6.4.1`（commit `5bf4e78`）

**上游现状（2026-09-22 实测）**：本仓库**已同步到** `v6.4.1`（commit `5bf4e78`）。本仓库最初自上游 `v6.3.0`（commit `b36e082`）分叉；从该版到 `v6.4.1`，`skills/brainstorming/SKILL.md` 实测为 **250 → 285 行、diff 66 行**，新增一节 `## Establish Shared Understanding`——已把《需要重放的改动清单》按新基准逐条复核，并把新增节与上游改写处的**节级／段落级本地化**登记为第 36、37 条（见下）。

《需要重放的改动清单》是**活指令**：上游再前移时，须把清单逐条重新施加到新坐标、为新增节判定偏离，再跑 `./sync-upstream.sh --ref <新坐标>` 复验 diff；只改本文件里的版本号不算同步。

#### 用脚本看差异

```bash
# 与上游默认分支对比
./sync-upstream.sh

# 与指定 tag / 分支对比
./sync-upstream.sh --ref v6.4.1
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
16. `## Self-Review` 节：逐节核对模板合规的 **14 项**清单（替换 spec 自审），含增量合并完整性、跨文档一致性（含跨模块流程同名、引用可解析）、接口状态收口、覆盖完整性（含 `不适用` 判定）、落盘前是否真的读了盘、接口契约合规（见第 33 条），以及第 14 项**共识理解**——提出特性或方案之前是否已建立对方可评估、可纠正的共识理解并在被纠正后更新（见第 36 条所在的 `## Establish Shared Understanding`）
17. `## Subagent Review` 节 + `design-doc-reviewer-prompt.md`：一个子代理审三类文档并做模板路由与权威顺序判定（权威顺序含依赖签名、模块存在性、接口状态、类归属、流程的模块链五类），**传入完整的已批准变更清单而不只是"逐字不动"部分**，写盘集超 5 份时分批；含重跑规则：修订涉及结论 / 决策 / 流程 → 重跑子代理审查，纯措辞或笔误修订 → 只需自审（第三份模板见第 30–35 条）
18. `## User Review Gate` 与 `## Terminal State` 节
19. Red Flags 表新增 **11 行**（随口问问也落盘 / 自创文档格式 / 接口契约按话题判定 / 接口契约起别名 / 模块讨论顺手改架构文档 / 不读盘就写 / 字段表当 spec 模式 / 设计批准当写盘批准 / 待提供未翻牌 / 改名不跟引用 / 聊完就实现），改写 **2 行**——上游 H3 已把「这条太简单不需要设计」一行改为按路径表述，本仓库只把其尾句 `the written spec and planning handoffs` 改成 `the design documents`；另一行把 `skip the spec` 改成 `skip the design doc`；全文单数 `design document` 按多文件模型改复数，含 v6.4.1 新节里的 `the selected path's design artifact`
20. `## Process Flow` 中新增 Persist Gate 与 Change List Gate 分支，并补充「落盘阶段」说明：bounded 与 architectural 共用门禁但产出不同（bounded 只并回受影响的模块文档，或项目尚无文档集时不写）；终态改为 `Done` / `Stop here (no file)`
21. Checklist 的 Bounded 路径：明确已有 `specs/design/` 时走增量合并，项目尚无设计文档集时不制造整套文档
22. 模板侧（三份）：「状态」与「最近更新」的填写与联动规则（含同日规则）、模块划分粒度准则、模块名全项目唯一、模块与代码目录不要求一一对应的说明、「来源」行改为可承载多轮讨论的写法、流程对齐规则（全部功能流程都登记到架构总纲、含只在单个模块内完成的，只有纯模块内部的实现级流程留在模块文档）（第三份模板见第 30–35 条）
23. 架构大改的例外：模块划分被整体推翻时，在变更清单里明示「本次为架构大改」，但仍逐条比对既有文档、仍成立的内容逐字保留，不得盲写重生成；首次落盘先创建 `specs/design/` 目录
24. 接口状态**只在架构矩阵维护**，模块文档的依赖契约表不写状态——状态会因别人的落盘而变，放在一处就不会出现两处对不上，翻牌也不需要改另一个模块的文档
25. 实测补正：模块文档第 3 节新增类插入中间时，后续类的小节要按顺序改号；待定项解决、风险解除后可以删条目（属「受影响条目」）
26. 本轮设计文档体系调整（架构定方向、把细节下压到模块）：架构模板重排为 12 节，功能点需求说明独立成节、其后各节顺延编号（全局功能流程移到第 10 节）；类归属章节改为核心类设计，写入可机械核对的核心类判定标准（出现在全局功能流程某条流程的模块级调用链上，或作为跨模块接口矩阵某行的接口承载者），并声明架构核心类清单是各已设计模块类清单并集的子集、属于未设计模块的核心类先临时登记待其落盘时收口；代码文件树收敛为「模块文件夹 + 核心文件」，只要求可定位全部核心类的定义文件、不要求文件级完备；全局功能流程登记**全部**功能流程（含只在一个模块内完成的），每条标注服务功能点与每跳承担的核心类、只写方向级；模块模板在职责与边界节下新增「1.2 本模块参与的功能点」子节，第 2.1 节类清单升为本模块完整类清单的唯一权威，每条流程增服务功能点标注；技能把澄清指引改为功能点层 / 架构层 / 模块层三层提问清单与「先功能点、再模块划分、再核心类、再文件树、最后流程」的推进顺序，并重写自审第 8、10 项；审查提示词重写类归属判据（核心类可定位、同一个类不跨两个模块、架构核心类清单为各已设计模块类清单并集的子集）、删除「文件树停在目录」校准条，并新增功能点与流程双向覆盖等判据

27. （D-1）`## Incremental Persist Protocol` 新增 `Rule 7`——「A changed entry re-renders its diagram in the same persist」：图是被说明条目的派生产物，属改动这些条目的同一次落盘；改动带图条目（架构 §10 全局流程、模块 §5 流程、§6.3 模块依赖关系）时同批创建 / 重渲染其**图与 IR** 并列入变更清单；**未触及的条目不动其图**（与文字逐字保留同理）；新增流程即新增图，**删除流程即删除其图与 IR**（孤儿图是陈旧产物）；IR 与图同批刷新，不脱节
28. （D-2）新增整节 `## Diagrams in the Design Documents`，与绘图内核的入参契约逐项一致：内核声明（它是技能内部构件、不是独立技能）；出图时机（落盘阶段、待变更清单门批准后渲染、与文档同批落盘、不单独落盘）；IR 由本技能自该节已有内容生成、事实来源限定该节、用户不写 IR；入口命令；五类图选型；落盘路径与图名派生（含冲突报双方、不静默改名）；同名流程共用一份图文件；md 引用形态与正文不得内联 `<svg>`；校验硬门（不过不产出、不覆盖既有同名）；两轮降级口径（目标错误数 = 错误级诊断条数不含警告、基线轮计入两轮、第 2 轮未低于第 1 轮即停且退出码 3、两选项交回用户不代选）；Node < 18 留占位降级且不阻塞落盘
29. （D-3）`## Change List Gate` 清单项新增 `Diagrams` 一栏——「every diagram this persist will create or re-render, each named with the flow or section it belongs to, or `无`；**本栏还列出本次预期新建 / 重渲染、但未通过校验而以占位保留的图，标 `未通过校验` 并写明原因**；未变条目之图不列入也不重渲染」
30. 认清**第三类受管设计文档——接口契约**：技能由「架构总纲 / 功能模块」两类扩为「架构总纲 / 功能模块 / 接口契约」三类，写盘指令同步引用 `interface-contract-template.md`
31. 新增**机械的按需产出判定**：项目命中 MySQL / Redis / MQ / HTTP / gRPC / 动态库 API / TCP 七类对外接口中**任意一类**即必须产出接口契约文档；七类全不命中则不产出，并在变更清单中**逐族**写明不命中的判定依据；禁止以「本次未涉及接口」为由跳过判定
32. 固定接口契约文档的落盘路径为 `specs/design/接口契约.md`，全项目唯一一份且**文件名不带数字前缀**；禁止起别名、禁止并入架构总纲或模块文档
33. 自审清单新增**接口契约检查项**，其中明确**不得因该文档没有配图而报缺陷**（接口契约文档不配图是预期形态，报即为校准错误）
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
46. （补登）`## Handoff to a Downstream Process` 整节：交接物是**整个 `specs/design/` 目录**（文档集 + `diagrams/` 三件套；因每份文档都以相对自身的路径引用其图，该目录自包含，交接的是这个目录而非单个文件）；本技能**从不**调用下游流程，是否交接、交给谁由人类决定，被问到时只报出上述产物集即止；接口契约是该集合的一部分而非交接的前置条件——它因机械判定命中而存在，交接不需要重新推导。

### 上游二：archify（绘图内核）

`scripts/diagram-engine/` 是 [archify](https://github.com/tt-a1i/archify) 出图技能包的**裁剪副本**：按「只保留 5 类图渲染能力」删掉了 10 个子命令、`--repo-root` 溯源能力、`examples/` 等目录，把入口 `archify.mjs` 裁成内部驱动 `render-driver.mjs`（2139 → 562 行）、把 `design-diagrams.mjs` 改造为唯一入口 `render.mjs`。逐项改动与被删清单见 `scripts/diagram-engine/UPSTREAM.md` 第 1 节。

**上游基准**：`tt-a1i/archify` @ commit `5289f6867f048a7450ec5718f58459613a84cf41`（技能包版本 `2.17.0-dev.1`；`skill-release.json` 的 `channel` 是 `development`，该仓库**无稳定 tag**，因此基准按 commit 固定，不按 tag 或 `latest`）。

**许可证归属**：archify 本体为 MIT（版权方与全文见 `scripts/diagram-engine/LICENSE`）；内联字体 **JetBrains Mono** 依 SIL Open Font License 1.1 授权，完整授权文本随包存放在 `scripts/diagram-engine/assets/JetBrainsMono-OFL.txt`；第三方商标与图标归属见 `scripts/diagram-engine/THIRD_PARTY_NOTICES.md`。

**怎么判回归**：

```bash
node scripts/diagram-engine/test/run-valid.mjs
```

它只跑**在裁剪后成立的那个子集**（当前为上游 7 + 本地 6 = 13 个文件，退出码 `0` = 全过；本地 6 个含驱动 CLI 面、环境自检与品牌边界三组新增用例）。哪些上游检查项被排除、为什么排除（三类成因），逐条登记在 `scripts/diagram-engine/UPSTREAM.md` 第 3 节。

**注意：`./scripts/sync-upstream.sh` 只覆盖 `superpowers`，不覆盖 archify**——它比对的是 `skill/SKILL.md`，与绘图内核无关；同步 archify 需按上面的基准 commit 手工比对。

## 2. 后续变更登记

以下变更登记为待启动的独立工作。变更目录在 `changes/` 下；由于 `changes/` 被 `.gitignore` 忽略，另在此登记，以免换机或清理工作树后丢失。

| 变更 | 要解决的问题 | 细节所在 |
|------|-------------|---------|
| `backfill-run-valid-cases` | 把 `run-valid.mjs` 的排除粒度从**文件级**改为**用例级**，才能把「同一文件内部分用例已通过」的运行时用例纳入回归清单。注意：裁剪后该变更原有的核心前提（读 `design-diagrams/SKILL.md` 的文档断言）**已不存在**，且失效用例文件已删除，需与新口径一并重估或直接关闭。 | `scripts/diagram-engine/UPSTREAM.md` 第 3、6 节 |

该项是在 `add-interface-contract-template` 变更的归档验证中被实测确认的，当时按该变更的范围边界未处理。

## 3. 历次 dry-run 记录

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
# 2. 全量测试必须绿（48 用例，含内核回归集）
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

**版本号不写进 `scripts/diagram-engine/skill-release.json`**——那里的 `2.17.0-dev.1` 是上游 archify
技能包的版本，改它会让内核与上游对不上号。


