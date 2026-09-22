# design-doc-guardrails

## Purpose

The design-doc-guardrails capability documents the published behavior for users and maintainers.

## Requirements

### Requirement: 分层提问清单

头脑风暴技能 SHALL 在澄清阶段按三个层次提问，并为每层给出必问项：功能点层（有哪些功能点、各自要解决什么、边界与非目标）、架构层（模块如何划分与划分依据、模块间关系与跨模块接口、核心类、文件树）、模块层（每个类的字段与函数、类之间的关系、对外依赖的签名、函数级流程与异常路径）。

#### Scenario: 进入澄清阶段

- **WHEN** 请求被分类为架构级或有界改动并进入澄清
- **THEN** 技能按功能点层、架构层、模块层的顺序逐层提问，不在功能点未问清时进入模块层细节

#### Scenario: 架构层的完备性要求

- **WHEN** 技能提问架构层
- **THEN** 它必须问全全部功能点与全部功能流程；字段、函数、异常等细节问题推迟到模块层再问

### Requirement: 设计推进顺序

技能 SHALL 按"先功能点、再模块划分、再核心类、再文件树、最后流程"的顺序推进设计，每层问透再进入下一层。

#### Scenario: 功能点尚未问全

- **WHEN** 功能点清单仍有缺项或边界未确认
- **THEN** 技能不进入模块划分讨论

#### Scenario: 讲流程时回靠模块与核心类

- **WHEN** 技能讨论全局功能流程
- **THEN** 它基于已定稿的模块划分与核心类设计来讲，逐跳点明由哪个模块、哪个核心类承担

### Requirement: 呈现清单与模板章节对齐

技能中列出设计呈现覆盖项的位置 SHALL 以模板章节为准，且 MUST NOT 出现模板中不存在的独立章节名；覆盖项 SHALL 覆盖**三套**模板的章节，使接口契约文档的章节也在覆盖清单中有对应条目。

#### Scenario: 列出呈现覆盖项

- **WHEN** 技能说明设计要覆盖哪些内容
- **THEN** 覆盖项与三份模板的实际章节一致，不含 `error handling` 这类没有独立章节的条目；失败处理按模板归入流程节

#### Scenario: 接口契约在覆盖清单中缺失

- **WHEN** 技能的呈现覆盖清单只覆盖架构总纲与模块文档两类
- **THEN** 判定为缺陷

### Requirement: 自审判据

技能自审 SHALL 检查：架构文档核心类清单只含核心类且判定标准可用、架构文件树可定位全部核心类的定义文件、功能点与流程双向覆盖、模块文档类清单为完整类清单的唯一权威、模板合规与无占位符。本次产出含接口契约文档时，自审 SHALL 追加检查：七类接口节各自三段式完整、清单表含该族口径的可追溯列（按族口径为准，只需一侧的族以那一侧即为完整）、字段表含名称／类型或长度／语义、表格与附证片段不矛盾、兜底节无硬塞且无漏记、以及**不因该文档没有配图而报缺陷**。此外，自审 SHALL 含一项**共识理解**检查：在提出特性或方案之前是否已建立对方可评估、可纠正的共识理解（对应 `## Establish Shared Understanding` 节），并在被纠正后已更新；未建立即进入特性或方案讨论的，判定为缺陷。

自审 SHALL 另含**图与文字一致性**检查：每张图的三件套齐备且同前缀同目录、图片行与交互版链接行成对、
图中出现的组件／参与者／状态与同节文字表述不矛盾、同一流程跨文档引用同一文件、
落点与命名符合 `specs/design/diagrams/<文档序号>-<图名>.<图类型>.<扩展名>`、
以及单图主节点不超过 12。绘图规划 Gate 的确认结论 SHALL 在自审时与最终落盘的图清单逐图核对。

#### Scenario: 架构文件树停在模块目录

- **WHEN** 架构文档的代码文件树只给出模块文件夹与核心文件
- **THEN** 自审不将其判为缺陷；只有当核心类的定义文件无法在该树中定位时才判缺陷

#### Scenario: 旧判据残留

- **WHEN** 自审仍要求「文件树落到文件级并覆盖类清单全部定义文件」
- **THEN** 判定为规则冲突，必须改为新判据

#### Scenario: 接口契约某个接口节缺段

- **WHEN** 某类接口节缺少 `x.3` 该类规则部分，也没有「不适用」声明
- **THEN** 自审判定为缺陷

#### Scenario: 接口契约表格与附证片段冲突

- **WHEN** 字段表写 `VARCHAR(64)` 而附证 DDL 片段写 `BIGINT`
- **THEN** 自审判定为缺陷，并要求以表格为准修正片段

#### Scenario: 接口契约文档没有配图

- **WHEN** 自审判定 `接口契约.md` 缺少配图
- **THEN** 判定为规则冲突，接口契约文档不要求配图

#### Scenario: 未建立共识理解就进入方案讨论

- **WHEN** 技能在未弄清对方的意图（目的、为谁、什么算成功）之前就开始提出特性或方案
- **THEN** 自审判定为缺陷

#### Scenario: 自审项数与 README 记录一致

- **WHEN** 自审清单增减了条目
- **THEN** README《需要重放的改动清单》中记录该项数的条目必须同批更正

#### Scenario: 图与文字不一致未被自审发现

- **WHEN** 某张图的节点与同节文字表述互相矛盾，而自审未报告
- **THEN** 判定为自审缺陷，一致性检查项必须能拦下此类矛盾

#### Scenario: 三件套缺件未被自审发现

- **WHEN** 某张图缺少 `.html` 交互页，而自审未报告
- **THEN** 判定为自审缺陷

### Requirement: 审查判据

设计文档审查提示词 SHALL 使用与架构模板一致的节号引用，重写类归属判据，且 MUST NOT 保留与新规则矛盾的校准条。该提示词 SHALL 增加**三类模板的路由判据**：审查子代理 SHALL 按文件名与内容把每份待审文档路由到架构模板、模块模板或接口契约模板中的正确一份，MUST NOT 用错模板核对；路由到接口契约模板时 SHALL 按其章节与三段式核对。

#### Scenario: 架构树停在模块目录

- **WHEN** 审查子代理拿到只到模块文件夹与核心文件的架构文件树
- **THEN** 它不报告「文件树停在目录」这一缺陷

#### Scenario: 核心类无归属或跨模块重复

- **WHEN** 某核心类不在任何模块的类清单中，或同一个类出现在两个模块的类清单中
- **THEN** 审查子代理报告缺陷

#### Scenario: 功能点与流程覆盖

- **WHEN** 存在没有任何流程覆盖的功能点，或存在未标注服务功能点的流程
- **THEN** 审查子代理报告缺陷

#### Scenario: 接口契约的路由

- **WHEN** 审查子代理拿到 `specs/design/接口契约.md`
- **THEN** 它路由到接口契约模板，不按架构模板或模块模板核对

#### Scenario: 接口契约缺逐项契约

- **WHEN** 某类接口节只有清单表与该类规则，没有 `x.2` 逐项契约，也没有「不适用」声明
- **THEN** 审查子代理报告缺陷

#### Scenario: 接口契约清单表缺追溯列

- **WHEN** 某类接口的清单表没有该族口径的可追溯列（按族口径为准，只需一侧的族以那一侧即为完整——动态库 API 只有「调用方」、TCP 只有「对端」不算缺列）
- **THEN** 审查子代理报告缺陷

#### Scenario: 因接口契约无图报告缺陷

- **WHEN** 审查子代理因 `接口契约.md` 没有 SVG 配图而报告缺陷
- **THEN** 该判据判定为校准错误，必须从提示词中删除

### Requirement: 节号引用一致性

六份技能文件（`skill/SKILL.md`、`templates/architecture-doc-template.md`、
`templates/module-doc-template.md`、`templates/interface-contract-template.md`、
`skill/design-doc-reviewer-prompt.md`、`README.md`）中对三份模板章节的引用 SHALL 全部指向各模板的实际章节，
不得指向不存在的章节或沿用旧语义；六份文件的位置引用 SHALL 与重排后的仓库布局一致。

#### Scenario: 检索节号引用

- **WHEN** 在上述六份文件中检索所有指向模板章节的引用
- **THEN** 每一条都能对应到所属模板的实际章节标题；不存在把全局功能流程指向旧编号、把接口矩阵指向旧编号、把架构类清单当作全项目类清单、或把接口契约文档当作配图文档的残留引用

#### Scenario: 文件集枚举一致

- **WHEN** 核对「六份技能文件」这一说法在技能、规格与任务中的所指
- **THEN** 三处的枚举一致，均为上列六份，不存在把 `design-doc-reviewer-prompt.md` 排除在外或另行计入第十七份文件的写法

#### Scenario: 文件位置引用与重排后的布局一致

- **WHEN** 检索六份文件的路径引用（含 README 的目录树与安装说明）
- **THEN** 引用的是 `skill/`、`templates/`、`scripts/`、`tests/` 下的实际位置，
  不存在仍指向仓库根平铺位置的残留

### Requirement: README 与上游偏离清单同步

README SHALL 更新架构章节数与章节清单、重写代码文件树说明、更新权威表与流程分层中的节号、更新特性说明，并在《同步上游》偏离清单中逐条登记对 `skill/SKILL.md` 的改动。

以下为**现行状态性要求**（已由此前的变更满足；任何后续变更 MUST NOT 使其退化）：模板登记为**三套**（架构总纲、功能模块、接口契约），含目录树、安装说明的文件清单与特性说明；README **每一处**提及 `node scripts/install.mjs --dry-run` 的位置都写明该模式同样受 **Node 主版本硬门约束**（版本不满足即以非零退出码结束且不写任何文件），措辞统一为「同样受 Node 主版本硬门约束」，不得让任何一处读起来像「预演不受版本限制」；《需要重放的改动清单》是**活指令**，其正文必须与当前技能现状一致，不得保留按旧基准写就的过时措辞。

**本次变更** SHALL 把 README 的目录树、安装命令、模板与文件清单、绘图内核说明全部改写为
重排后的四目录形态（`skill/`、`templates/`、`scripts/`、`tests/`），SHALL 把安装命令统一为
`node scripts/install.mjs`（含 `--dry-run`），SHALL 说明绘图内核的新入口与三件套产物形态，
SHALL 把《需要重放的改动清单》中受重排影响的条目更新为新路径与项数，
SHALL 在 `## 后续变更` 小节登记本次未纳入的相邻工作。

#### Scenario: 运行上游对比脚本

- **WHEN** 运行 `./scripts/sync-upstream.sh`
- **THEN** 脚本仍能输出上游与本地 `SKILL.md` 的双向 diff，不因本次改动而失效

#### Scenario: 阅读偏离清单

- **WHEN** 阅读《同步上游》的改动清单
- **THEN** 本次全部改动都有对应条目，且不存在仍写着「代码文件树必须落到文件级并与类清单双向一致」这类与新规则矛盾的陈述

#### Scenario: 依赖承诺与事实一致

- **WHEN** 阅读 README 的特性说明
- **THEN** 其中不再出现「零依赖：不需要 Node 或任何运行时」这类与出图需要 Node 相矛盾的无条件陈述，而是区分「设计文档本身是纯 Markdown」与「出图需要 Node 及最低版本」

#### Scenario: 第二个上游的同步说明

- **WHEN** 阅读 README 的上游同步章节
- **THEN** 能找到绘图内核所搬运的 `archify` 上游仓库、搬运时的版本标识与许可证归属，以及同步上游版本时如何用 `scripts/diagram-engine/test/run-valid.mjs` 判回归

#### Scenario: 模板登记为三套

- **WHEN** 阅读 README 中模板与安装文件清单相关的描述
- **THEN** 全部为三套模板（架构总纲、功能模块、接口契约），不存在仍写「两套模板」或目录树缺接口契约模板的残留

#### Scenario: 预演模式的版本硬门

- **WHEN** 阅读 README 中任意一处关于 `node scripts/install.mjs --dry-run` 的说明
- **THEN** 该处或其紧邻处写明「同样受 Node 主版本硬门约束」；全文该措辞的出现次数不少于 `--dry-run` 的出现次数

#### Scenario: 目录树与实况一致

- **WHEN** 把 README 的目录树与仓库根目录实际内容逐条对照
- **THEN** 两者一致：顶层只有 `skill/`、`templates/`、`scripts/`、`tests/` 四个目录加仓库级文件，
  且树中列出的文件都实际存在

#### Scenario: 旧路径残留

- **WHEN** 在 README 中检索仓库根平铺路径（根下的 `install.mjs`、根下的模板与技能文件、`design-diagrams/`）
- **THEN** 零命中，或命中处已被改写为重排后的路径

### Requirement: 图的审查判据

审查子代理的判据 SHALL 覆盖图与文档的一致性，包括：三件套齐备同前缀同目录、引用可解析
（图片行指向 `.svg`、紧随一行链接指向同名 `.html`）、图内容与文档表述不矛盾、
同名流程图类型一致、同一流程跨文档引用同一文件、以及落点与命名符合
`specs/design/diagrams/<文档序号>-<图名>.<图类型>.<扩展名>`。

#### Scenario: 三件套缺件

- **WHEN** 某张图只有 `.svg` 与 `.json`，缺少 `.html`，或三件的前缀／目录不一致
- **THEN** 判定为缺陷

#### Scenario: 文档引用的图不存在

- **WHEN** 设计文档引用了 `diagrams/` 下的某个文件，但该文件不存在或路径不可解析
- **THEN** 判定为缺陷

#### Scenario: 缺少交互版链接行

- **WHEN** 文档只有图片行引用 `.svg`，没有紧随的链接行指向同名 `.html`
- **THEN** 判定为缺陷

#### Scenario: 图与文档表述矛盾

- **WHEN** 图中出现的组件、参与者或状态，与文档同一节的文字表述相互矛盾
- **THEN** 判定为缺陷，并指出矛盾的两处

#### Scenario: 同名流程图类型不一致

- **WHEN** 同一流程名在架构文档与模块文档中配了不同类型的图
- **THEN** 判定为缺陷

#### Scenario: 落点或命名违规

- **WHEN** 图落在 `specs/design/diagrams/` 之外，或文件名缺文档序号、缺图类型段
- **THEN** 判定为缺陷

#### Scenario: 正文内联了 SVG

- **WHEN** 设计文档正文中出现 `<svg>` 标签而非图片引用
- **THEN** 判定为缺陷

### Requirement: 出图随变更清单门同批批准

落盘阶段的变更清单 SHALL 列出本次将新建或重渲染的**三件套**图文件（`.json`／`.svg`／`.html`），
与文档改动同批提交用户批准；MUST NOT 在变更清单之外单独落盘图文件。
绘图规划 Gate 的确认结论 SHALL 在该清单中逐图复核，两者不一致时以清单为准并回到规划。

#### Scenario: 落盘前的清单

- **WHEN** 一次落盘将新建或重渲染若干张图
- **THEN** 变更清单中逐个列出这些图的三件套文件、对应流程与所属章节，与文档改动一并获批后才写盘

#### Scenario: 图在校验中失败

- **WHEN** 某张图在落盘前未通过几何校验
- **THEN** 该图不进入竣工产物，并在变更清单中标注其状态与原因

#### Scenario: 规划与清单不一致

- **WHEN** 变更清单中出现的图与绘图规划 Gate 已确认的图清单不一致
- **THEN** 判定为缺陷，必须把差异报告给用户并回到规划

### Requirement: 接口契约文档的按需产出判定

技能 SHALL 按**可机械核对的判据**决定是否产出 `接口契约.md`：项目在 MySQL 数据表、Redis、MQ、HTTP、gRPC、动态库 API、TCP 七类对外接口中**命中任意一类**即必须产出；七类全部不命中时 MUST NOT 产出该文档，并 SHALL 在落盘阶段的变更清单中逐类写明不命中的判定依据。技能 MUST NOT 以「本次讨论未涉及接口」为由跳过产出。

#### Scenario: 项目仅依赖 MySQL

- **WHEN** 项目只在启动时读一个 MySQL 库，没有 Redis、MQ、HTTP、gRPC、动态库 API、TCP
- **THEN** 命中 MySQL 一类，必须产出 `接口契约.md`，其余六类节按「不适用：<原因>」保留标题

#### Scenario: 项目七类全部不命中

- **WHEN** 项目为纯内存计算库，无任何持久化、通道、网络与动态库依赖
- **THEN** 不产出 `接口契约.md`，并在变更清单中逐类写明不命中的判定依据

#### Scenario: 项目存在 TCP 私有协议

- **WHEN** 项目通过 TCP 私有帧协议与外部设备通信
- **THEN** 命中 TCP 一类，必须产出该文档并把协议写入 TCP 接口节

#### Scenario: 以「本次没聊到接口」为由跳过

- **WHEN** 变更清单中记录的跳过理由是「本次讨论未涉及接口」而非逐类不命中判定
- **THEN** 判定为缺陷

### Requirement: 接口契约文档的落盘路径与形态

产出接口契约文档时 SHALL 落在 `<项目根>/specs/design/接口契约.md`，文件名固定为 `接口契约.md`、不带数字前缀；技能 MUST NOT 产出 `0-接口契约.md`、`contract.md` 之类的别名，也 MUST NOT 把接口契约内容并入架构总纲或任一模块文档。

#### Scenario: 检索落盘路径

- **WHEN** 检索技能中接口契约文档的落盘路径
- **THEN** 唯一路径为 `specs/design/接口契约.md`

#### Scenario: 产出为带数字前缀或英文别名

- **WHEN** 产出物命名为 `0-接口契约.md` 或 `specs/design/contract.md`
- **THEN** 判定为缺陷

### Requirement: design-diagrams 上游文档的现状一致性

`scripts/diagram-engine/UPSTREAM.md` 中所有以「`design-diagrams/SKILL.md` 尚未创建／本次有意不建」为排除前提的叙述 SHALL 与当前仓库实况一致。这些位置至少包含：第 4 节组 B 的分组说明与其七个测试文件表、第 5.2 节中依赖组 B 的判据条目、第 5.3 节已知限制里依赖该前提的条目、第 6 节中与之相关的未决点。重核时 SHALL 对七个测试文件**逐个**给出当前实测结论（仍失败／已可转绿）并注明结论的取得方式；对已可转绿者 SHALL 说明是否回填验证入口的通过清单，本次不回填时 SHALL 写明原因。MUST NOT 保留已经过期的叙述。

本次变更 SHALL 另核该文档中一切指向已删文件与已改路径的引用：`examples/`、`references/`、
`migrations/`、`delta/`、`recipes/`、`brand-marks/` 源、内核 `scripts/` 下已删的构建工具、
`bin/design-diagrams.mjs`、`bin/preview.mjs`、`bin/visual-check.mjs`、`bin/open-artifact.mjs`、
`--repo-root` 相关模块，以及 `bin/archify.mjs` → `bin/render-driver.mjs` 的改名、以及「回归集留在
`scripts/diagram-engine/test/` 内、不搬迁」这一事实（规划期曾拟迁 `tests/upstream/`，执行期实测搬迁即
全红而否决，该目录不存在）；每条 SHALL 改为重排后的事实或注明该项已随裁剪移除。
该文档 SHALL NOT 把 `bin/archify.mjs`（及其改名后的 `bin/render-driver.mjs`）描述为已随裁剪移除——
它是 `render` 与 `validate` 子命令的实现体，属保留范围。

#### Scenario: 检索过期陈述

- **WHEN** 在 `scripts/diagram-engine/UPSTREAM.md` 中检索「有意不建」这类以「尚未创建」为前提的陈述
- **THEN** 零命中，或该陈述已被替换为重核后的实测结论

#### Scenario: 逐文件实测结论

- **WHEN** 阅读第 4 节组 B 的测试文件表
- **THEN** 表中七个文件每一个都有当前实测结论与取得方式，不存在只给结论不给取得方式、或仍停留在「未创建」推断的条目

#### Scenario: 其余位置的连带叙述

- **WHEN** 阅读第 5.2 节、第 5.3 节与第 6 节中涉及组 B 的段落
- **THEN** 这些段落同样不以「`SKILL.md` 尚未创建」为前提，且与第 4 节组 B 的重核结论一致

#### Scenario: 把保留的渲染驱动误写为已删

- **WHEN** 该文档把 `bin/archify.mjs` 或其改名后的 `bin/render-driver.mjs` 描述为已随裁剪移除
- **THEN** 判定为缺陷——它是 `render` 与 `validate` 子命令的实现体，属保留范围，须改为改名与裁子命令后的事实

#### Scenario: 已可转绿但本次不回填

- **WHEN** 某测试文件已可整体转绿而本次不改验证入口的通过清单
- **THEN** 该文件处写明「已可转绿，本次不回填」及其原因，避免被读成遗漏

#### Scenario: 指向已删文件的引用

- **WHEN** 检索该文档中对已删树与已删入口的引用
- **THEN** 每条都已改为重排后的事实或注明已随裁剪移除，不存在指向不存在路径的描述

### Requirement: 建立共识理解的必经步骤

`brainstorming-archify/SKILL.md` SHALL 含一节 `## Establish Shared Understanding`，位置在 `## Scope` 之后、`<HARD-GATE>` 之前；该节 SHALL 含三件事：**发现意图**（在提出特性或方案前，用请求与已有上下文弄清意图结果、为谁而做、什么算成功；信息缺失时先问一个聚焦问题）、**回写理解**（把意图结果、相关约束、成功标准写成一段对方可评估的短备忘，区分"对方说的"与"你假设的"，邀请纠正并在被纠正后更新）、**把意图带进设计**（在所选路径的设计产物里保住这份共识，并据此检查拟议的特性与技术选择）。第三点 SHALL 指向本仓库的**设计文档**（架构总纲／模块文档／接口契约），SHALL NOT 指向 spec。`## Checklist` 的三条路径 SHALL 都含一个**共同的第 0 步**：建立共识理解——该步编号写作 `0.`，位于「宣布路径」之后、各路径原有的第 1 步（`Explore project context`）之前，既有步号 SHALL NOT 重排；`## Process Flow` 的流程图中 SHALL 相应有一个三条路径共用的前置节点，使图与清单一致。`## Self-Review` SHALL 含对应的检查项。

#### Scenario: 阅读 SKILL.md 的节顺序

- **WHEN** 检索 `## Establish Shared Understanding` 的位置
- **THEN** 它位于 `## Scope` 之后、`<HARD-GATE>` 之前

#### Scenario: 该节落在所选路径的设计产物上

- **WHEN** 阅读该节的第三点
- **THEN** 它说的是把共识带进设计文档（架构总纲／模块文档／接口契约），不出现 spec 作为落点

#### Scenario: 该步骤在流程里有落点

- **WHEN** 阅读 `## Checklist`
- **THEN** Spike、Bounded、Architectural 三条路径都以编号 `0.` 的"建立共识理解"作为第一步，其后的既有步号未重排；且 `## Process Flow` 的流程图里有一个三条路径共用的前置节点与之对应

#### Scenario: 请求已自带目的与约束

- **WHEN** 请求本身已经给出目的与约束
- **THEN** 该节要求的是把这份理解复述回去，而不是把同样的问题再问一遍

### Requirement: 按路径分级的审批先决条件

`SKILL.md` 的 `<HARD-GATE>` SHALL 按路径给出各自的审批先决条件——Spike 需对方批准问题与探针、Bounded 需对方批准聊天内的短设计、Architectural 需完成**该路径的全部前置门禁**；Architectural 的先决条件 SHALL 以本仓库实际存在的门禁表述（设计呈现与批准、Persist Gate、Change List Gate、用户审查门），SHALL NOT 出现 `spec`、`implementation plan`、`writing-plans` 或任何指向下游技能调用序的措辞；并且 SHALL NOT 在**设计批准与 Persist Gate 之间**强加先后顺序——两者是独立的门，`## The Persist Gate` 已规定落盘门要在结论说得出口时即问、不等设计批准。该门 SHALL 另含三条语义：**一次回复只批准实际呈现的那一阶段**；**批准一个想法或特性范围不等于批准尚不存在的产物**；**先决条件未完成时允许只读的项目探索，且要回到最早未完成的阶段，不得把一次批准当作跳过该路径其余阶段的口径**。`<HARD-GATE>` SHALL NOT 保留上游旧段的收尾句（"the ceremony scales with the task; the approval gate never does"）——该句随被替换的整段一并移除，不得留在门内成为与新分级表述并存的第二套口径。`## Anti-Pattern: "Too Simple To Need Approval"` 段与 Red Flags 表中对应的一行 SHALL 与新的门禁语义一致（逐路径表述，不再用"artifact 随简单度缩放、审批不缩放"这一套措辞）。

#### Scenario: 逐路径的先决条件

- **WHEN** 阅读 `<HARD-GATE>`
- **THEN** Spike、Bounded、Architectural 三条路径各有明确的先决条件，且 Architectural 那一条列出的是本仓库实际存在的门（设计呈现与批准、Persist Gate、Change List Gate、用户审查门）

#### Scenario: 不给两道独立的门强加顺序

- **WHEN** 阅读 `<HARD-GATE>` 的 Architectural 先决条件
- **THEN** 它不把设计批准写成落盘门的前置，也不把落盘门写成设计批准的前置；与 `## The Persist Gate` 的"结论说得出口就问、两门独立"口径一致

#### Scenario: 上游术语残留

- **WHEN** 在 `SKILL.md` 中检索 `spec`、`implementation plan`、`writing-plans`
- **THEN** 这些词不出现在 `<HARD-GATE>` 或与审批先决条件相关的表述里

#### Scenario: 批准不延伸

- **WHEN** 讨论中对方批准了某个想法或特性范围
- **THEN** 该批准不被当作对尚不存在的产物的批准，且要求回到最早未完成的阶段

#### Scenario: 先决条件未完成期间的只读探索

- **WHEN** 审批先决条件尚未完成
- **THEN** 允许只读的项目探索，不允许任何实现动作或下游技能调用

#### Scenario: 反模式段与 Red Flags 行一致

- **WHEN** 阅读 `## Anti-Pattern: "Too Simple To Need Approval"` 段与 Red Flags 表中"这条太简单不需要设计"那一行
- **THEN** 二者都按所选路径表述（bounded 得到聊天内的短设计，architectural 得到设计文档），与 `<HARD-GATE>` 的分级一致

### Requirement: 上游基准坐标与重放清单与实况一致

README SHALL 同时记录**分叉基准**与**已同步到的最新上游坐标**（tag 与 commit），不得只记录分叉基准而让读者以为已同步到最新版本。《需要重放的改动清单》的**正文** SHALL 与当前基准一致——经复核需改写的条目已改写、已由新基准覆盖的条目已删除，SHALL NOT 保留指向过时基准的坐标、示例命令或按旧行文写就的过时措辞；该清单是**活指令**，其每一条在被重放后都应与技能现状相符。仓库内所有「上游坐标」表述 SHALL 采用同一形态——**有稳定 tag 的上游写成「`<tag>`（commit `<短 sha>`）」；无稳定 tag 的上游写成「commit `<全值>`（技能包版本 `<version>`）」，两者缺一不可**。适用范围 SHALL 至少包含：README 上游坐标表格的**两个**单元格、README 的 `--ref` 示例命令、以及 README 与 `design-diagrams/UPSTREAM.md` 中 `archify` 基准的描述。某处本已满足该形态时，该处为 no-op，SHALL 在证据里如实记录而非含糊写"已对齐"。

**本次变更** SHALL 对该清单**逐条**复核（每条给出：仍适用／需改写——并写出改写后的正文／已由新基准覆盖而删除），据此更新清单正文，并把逐条结论作为**变更证据**留存（结论本身不作为永久需求的一部分）；SHALL 跑 `./sync-upstream.sh --ref <新坐标>` 复验，确认输出中不残留未说明的差异。

#### Scenario: 只改坐标不内容

- **WHEN** README 的基准坐标被改为新 tag，但 `SKILL.md` 未按新基准重放改动清单
- **THEN** 判定为缺陷——坐标与内容必须同时到位

#### Scenario: 清单正文与当前基准一致

- **WHEN** 阅读《需要重放的改动清单》
- **THEN** 其正文与当前基准一致：经复核需改写的已改写、已由新基准覆盖的已删除，不存在按旧基准写就的过时措辞

#### Scenario: 复验

- **WHEN** 运行 `./sync-upstream.sh --ref <新坐标>`
- **THEN** 脚本退出码为 0，输出可与本地 `SKILL.md` 双向 diff，且 diff 中只剩已登记的偏离

### Requirement: 绘图规划 Gate

`skill/SKILL.md` SHALL 在需求收敛之后、生成绘图 JSON 之前设一道**绘图规划 Gate**：
先把本次需要的图逐个列出——**要哪些图、每张是什么图类型、落在文档的哪一节**——
呈给用户并取得确认后，才生成绘图 JSON 并调用绘图内核渲染；图与设计文档同批落盘，
并挂接既有的**校验硬门**与**变更清单门**。技能 MUST NOT 在规划未经确认时先生成 IR 或先渲染。

主技能 SHALL 在本节内承载绘图的 JSON 结构、字段说明与绘图约束（并入自上游 `archify` 技能文档），
使绘图规范只有一处来源；MUST NOT 再维护第二份描述绘图的技能文档。

#### Scenario: 收敛后的出图规划

- **WHEN** 一次设计讨论收敛并进入落盘
- **THEN** 技能先给出本次的图清单（图名、图类型、所属文档与章节）并等待确认，
  确认之后才生成 JSON、调渲染器、写盘

#### Scenario: 未确认就渲染

- **WHEN** 技能在规划未获确认时已生成 IR 或已渲染出图
- **THEN** 判定为缺陷

#### Scenario: 图类型按性质选定

- **WHEN** 技能为某条流程或某段结构选图类型
- **THEN** 选择依据是该流程或该段的性质（整体结构→架构图、责任分工与审批分支→工作流图、
  调用顺序→时序图、数据来源处理去向→数据流图、状态迁移与终态→生命周期图），不按作者偏好

#### Scenario: 绘图规范只有一处来源

- **WHEN** 在仓库内检索绘图 JSON 结构与字段说明
- **THEN** 只在 `skill/SKILL.md` 中有描述，`scripts/diagram-engine/` 下不存在第二份技能文档

### Requirement: 变更清单的落盘形态、时机与非受管声明

技能 SHALL 在 `## Change List Gate` 规定变更清单的落盘形态与时机：在**该门批准之后**、与文档同批写盘，落在 `<项目根>/.brainstorming-archify/change-lists/` 下，**每次落盘一份**文件，文件名为 `<UTC 时间戳>-<主题 slug>.md`（时间戳如 `20260922T112442Z`，前缀保字典序即时序；主题 slug 取本次落盘**主文档**的语义英文短名，规则同图名 slug——只含 ASCII 字母、数字与 `-`，首次或架构级落盘取 `architecture`，单模块落盘取该模块的英文名，一次落盘涉多份主文档时取序号最靠前那份，如 `20260922T112442Z-order-module.md`）。技能 MUST NOT 在门批准之前写该次变更清单——该门的唯一写盘例外仍是绘图规划 Gate 的源 IR。该目录位于受管设计目录 `specs/design/` 之外，审查提示词 SHALL 声明其属**非受管文档**（不路由到任何模板、不按其判据评审，其 `<…>` 与占位不计为完整性缺陷）。该目录 SHALL 定性为过程产物：技能不删除其中文件，且提交范围 MUST NOT 包含该目录。`specs/design/` SHALL 仍是恢复对话的唯一锚点；`.brainstorming-archify/` 中已存在的文件 MUST NOT 被当作「待批准」或「已批准」的证据。

#### Scenario: 门批准后与文档同批落盘

- **WHEN** 变更清单门获批并开始写本次文档
- **THEN** 该次清单写入 `<项目根>/.brainstorming-archify/change-lists/<UTC 时间戳>-<主题 slug>.md`，与文档同批落盘，且不落在 `specs/design/` 下

#### Scenario: 文件名可读且保序

- **WHEN** 查看 `.brainstorming-archify/change-lists/` 下的文件名
- **THEN** 每个文件名由 UTC 时间戳前缀与主题 slug 组成（如 `20260922T112442Z-order-module.md`），主题 slug 只含 ASCII 字母、数字与 `-`、不出现中日韩字符，且按文件名排序即落盘先后顺序

#### Scenario: 门批准之前不得写清单

- **WHEN** 变更清单尚未获批
- **THEN** 磁盘上不出现该次落盘的变更清单文件（门的唯一写盘例外仍只是源 IR）

#### Scenario: 多轮落盘各留一份

- **WHEN** 同一项目先后发生两次落盘（例如先后设计两个模块）
- **THEN** 产生两个按时间戳区分的清单文件，后一次 MUST NOT 覆盖前一次

#### Scenario: 退出后恢复对话

- **WHEN** 对话退出后重开，并对同一项目再次落盘
- **THEN** 恢复锚点是 `specs/design/`（按其既有内容做增量落盘），`.brainstorming-archify/` 中既有清单不被当作待批准或已批准的证据，本轮仍照常呈交并取得批准

#### Scenario: 过程产物不删除、不入库

- **WHEN** 本次改动按项目惯例提交
- **THEN** 提交范围只含文档与改动的条目，不含 `.brainstorming-archify/`；技能也不删除该目录

#### Scenario: 审查子代理遇到清单文件

- **WHEN** 审查子代理在项目里看到 `.brainstorming-archify/change-lists/` 下的文件
- **THEN** 它不把该文件路由到任何模板、不按其判据评审，也不因其含提示性文字或占位标记而报告缺陷

#### Scenario: 审查判据依赖变更清单内容

- **WHEN** 审查子代理核对「图是否都在已批准的变更清单内」这类判据
- **THEN** 它从本次落盘对应的那份清单文件读取内容，而不是因清单未落盘而无法核对

### Requirement: 图例默认值的口径

`skill/SKILL.md` MUST NOT 断言省略 `meta.legend` 时「默认即真实」这类无条件说法；它 SHALL 要求作者在省略图例之前先核对内核默认图例与本节节点语义是否一致，不一致时 SHALL 显式给出 `meta.legend`。该要求 MUST NOT 把内核默认图例的具体标签文本抄进 `skill/SKILL.md`——默认标签以内核 `scripts/diagram-engine/renderers/shared/i18n.mjs` 为唯一来源。

#### Scenario: 依赖默认图例而默认与其语义不符

- **WHEN** 一张图的节点类型在内核默认图例下的标签与本节正文语义不一致（如普通工作流节点对应内核的领域化默认标签）
- **THEN** 技能要求作者显式给出 `meta.legend`，而不是依赖省略后的默认

#### Scenario: SKILL 正文不得手抄内核默认标签

- **WHEN** 检查 `skill/SKILL.md`
- **THEN** 其中不出现内核默认图例的具体标签文本（如 `Agent logic`／`Agent 逻辑`、`Context / trace`／`上下文 / 追踪`）
