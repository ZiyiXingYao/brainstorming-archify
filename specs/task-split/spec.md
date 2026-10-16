# task-split

## Purpose

定义设计讨论的**进度锚点**与**实现任务清单**产物：讨论状态落在
`.brainstorming-archify/state.yaml`（四级状态机 + 文件三态，唯一写入口是 change-state.mjs，
resume-state.mjs 只读），使跨天/中断的讨论可恢复；全部文档确认后生成 `specs/design/task.md`，
从框架到模块到具体功能拆分实现任务，每任务带勾选框、概要、依赖与四段式 AI 提示词，
并经依赖校验无冲突。

## Requirements

### Requirement: 讨论状态落库 state.yaml

技能 SHALL 把设计讨论的进度落在 `<项目根>/.brainstorming-archify/state.yaml`，作为**进度锚点**：
`specs/design/` 是**内容锚点**（答「讨论了什么」），state.yaml 答「进行到哪了」，
**当前轮次的 change-list 文件**（其路径记在 state.yaml 的 `change_list.path`）答
「这一轮讨论了什么、定了什么、授权了什么」——**恢复一个讨论 SHALL 读这两个文件**。

state.yaml SHALL 记录四级整体状态与每个登记文件的三态：

- 整体状态取值恰为 `explore`（纯讨论，没有**设计文档**落盘；`.brainstorming-archify/` 下的流程簿记
  不算「产物」，故 `explore` 期间轮次记录文件已在写）、`draft`（草稿已落盘、人工校验中）、
  `confirm`（全部确认，只差生成 task.md）、`closed`（task.md 已生成，结束）；
- 文件状态取值恰为 `discussing`、`landed`、`confirmed`，且 `confirmed` 蕴含 `landed`。

状态推进 SHALL 满足：

- 正向推进只能走一步，不得跳级；回退 SHALL 必须给出 `--reason`；
- 推进到 `draft` 的前置条件是全部登记文件已 `landed`；推进到 `confirm` 的前置条件是全部登记文件已
  `confirmed`；推进到 `closed` 的前置条件是 `specs/design/task.md` 存在且其修改时间晚于最后一次重开，
  **且本轮已设当前 change-list 文件、该文件在盘上**；
- `reopen <文件>... --reason` SHALL 只把点名文件翻回 `discussing`（未点名文件状态不变）、整体状态退回
  `explore`，并登记一条重开事件；点名尚未登记的文件时 SHALL 先登记再翻转。

**当前 change-list 指针 SHALL 只有一个，且切换受守卫**：state.yaml SHALL 记录
`change_list: { path, set_at }`；`change-state.mjs change-list <path>` SHALL 要求路径位于
`.brainstorming-archify/change-lists/` 下、文件已存在、且**该文件是形状合法的轮次记录**
（至少含五个 markdown 标题：轮次头 / 讨论记录 / 重要决策 / 文件修改台账 / 落盘授权——恢复靠这几节
取内容，缺节即拒绝并列出应有小节）；指向同一文件（轮内追加）SHALL 允许多次调用；
指向**不同**文件 SHALL 仅当「还没有当前文件」（首轮）或「当前 `set_at` 早于最后一次 `reopen`」
（新轮次已开）——其余情形 SHALL 拒绝并不改盘，因为一个讨论没完成时换文件会让进度记录断链。
`advance closed` SHALL 同样校验当前轮次文件的形状。

`state.yaml` SHALL 只允许由 `scripts/task-state/change-state.mjs` 编辑；`resume-state.mjs` SHALL 为
只读命令：输出当前状态、文件三态、`change_list`（当前轮次文件）、`next_action`
（按四态给出下一步与要加载的文件——`load` SHALL 含当前 change-list 文件）与 `blockers`
（state.yaml 不存在、形状或取值非法、登记为 `landed`/`confirmed` 的文件已不在盘上、
**当前 change-list 文件已不在盘上**）。存在 blocker 时调用方 SHALL 停下并展示修复命令。

（文件头只留标题、修改信息由轮次台账承载的形态口径，见 `design-doc-templates` 能力。）

#### Scenario: 首轮讨论走到收口

- **WHEN** 项目没有 state.yaml 时开始讨论，创建轮次 change-list 文件并设指针，随后落盘设计文档、
  人工逐份确认，最后生成 task.md
- **THEN** 状态依次为 `explore`（init 后）→ 文档登记为 `landed` 且全部落盘后 `advance draft` →
  逐份 `confirmed` 且全部确认后 `advance confirm` → 生成 `specs/design/task.md` 后
  `advance closed --task-md specs/design/task.md` 成功，状态为 `closed`

#### Scenario: 讨论未完成时换 change-list 文件被拒

- **WHEN** 本轮处于 `draft` 或 `confirm`，或处于 `closed` 但未重开，调用
  `change-state.mjs change-list <另一个文件>`
- **THEN** 命令 SHALL 拒绝（非零退出）并提示讨论未完成不能切换，且 state.yaml 一个字节都不改

#### Scenario: closed 之后新增模块换新文件

- **WHEN** 状态为 `closed`，人类要求新增一个功能模块
- **THEN** `reopen <新模块文档> --reason "<原因>"` 只把该文件登记为 `discussing`、既有 `confirmed`
  文件保持原状、整体状态退回 `explore`；此时 `change-list <新轮次文件>` SHALL 成功；
  重走一遍后**旧 task.md 未更新时 `advance closed` 被拒绝**，更新（按「实现任务清单 task.md」的判据：
  全核销则整份重生成，否则就地修改/追加）后才可收口

#### Scenario: 重启后续讨论

- **WHEN** 会话中断数日后重启，运行 `resume-state.mjs --json`
- **THEN** 输出含 `state`、每个文件的 `status`、`change_list` 与按状态给出的 `next_action` 与
  `blockers`；`next_action.load` 含当前 change-list 文件（恢复现场要读它）；若某文件登记为
  `landed`/`confirmed` 但已不在盘上，或当前 change-list 文件已不在盘上，`ok` 为 false 且 blockers
  指名该文件

#### Scenario: 收口时没有轮次记录

- **WHEN** 本轮从未设置当前 change-list 文件（或该文件已被删除），调用 `advance closed`
- **THEN** 命令 SHALL 拒绝，理由是每一轮都应有轮次记录才允许收口

### Requirement: 实现任务清单 task.md

当全部登记文件 `confirmed`（状态 `confirm`）时，技能 SHALL 生成 `specs/design/task.md`——它是一份
**交给下游实现的待办清单**——把本轮已确认的设计（首轮即整份设计；重开轮次即本轮改动的部分）从
**框架 → 模块 → 具体功能**三层拆成实现任务，且 SHALL 在生成前完成依赖校验。

任务分层 SHALL 按下列顺序：**框架任务**（工程骨架、构建与依赖、目录布局、共享基础设施、进程与线程接线）
→ **模块任务**（按架构文档模块清单逐个、按依赖序，含模块内部结构、类与该模块负责的接口侧面）
→ **具体功能任务**（按功能流程或无对应流程的功能点，落在其模块内并走该流程用到的跨模块接口）。

每个任务 SHALL 占一行且结构固定：第一列**勾选框**（`- [ ]`），随后**简短概要**、**依赖**
（前置任务 ID 或 `无`）、以及详细的 **AI 实现提示词**；提示词 SHALL 含且仅含四段，顺序为
`[实现的功能]`—`[任务实现的要求]`—`[实现的约束]`—`[验收标准]`，并 SHALL 自包含——
引用设计文档的具体章节（`§6.2`、`§7`、`§8.1`、接口契约的 `x.2` 条目）而非重述或重新决定已有结论。
任务 ID SHALL 为 `T-01`、`T-02`……按执行序编号。

依赖校验 SHALL 在写盘前完成，且结论 SHALL 写入 task.md 末尾的「依赖校验」小节；下列情形出现任一即
任务清单不合法：任务依赖排在它之后的任务或依赖自身；两个任务修改同一文件却无明确先后；功能任务所依赖的
模块任务未列在它之前；依赖列点名了不存在的 ID。校验小节 SHALL 逐条规则报告「无冲突」或具体违例；
声称「无冲突」而与清单矛盾 SHALL 判缺陷，缺失校验小节同样 SHALL 判缺陷。

**生成范围与写盘方式 SHALL 在写盘前按现有 task.md 的勾选框状态判定**（勾选框即「核销」的机械标识：
`- [x]` 表示该项已核销完成）：

- **首个轮次**（`init`，现有 `specs/design/task.md` 不存在）：技能 SHALL 生成**整份设计**的三层任务；
- **重开轮次**，且现有文件**所有**任务行都已核销（无一行 `- [ ]`）→ 技能 SHALL **整份重生成并覆盖**旧文件，
  内容为**本轮重开所改动的那部分设计**对应的任务点（旧任务都已做完，覆盖不丢工作）；
- **重开轮次**，且现有文件还有**任何**未核销行（`- [ ]`）→ 技能 MUST NOT 重生成或覆盖该文件——上一批任务
  尚未做完，覆盖会丢掉待办——SHALL 改为**就地更新**：只修改受本轮改动影响的条目、**追加**本轮新增任务，
  并**逐字保留**每个既有任务的 ID、文字与勾选状态；MUST NOT 重编号既有任务、MUST NOT 删除未完成任务，
  追加任务的 ID SHALL 顺延既有最大编号；
- 无论走哪条路径，MUST NOT 静默清掉任何勾选状态。

task.md SHALL 属于受审产物（审查提示词按 Task split 判据审它）并 SHALL 纳入向外的交接集。
其存在性与「本轮的更新已发生」以状态库与文件修改时间为准。

#### Scenario: 三层拆分与行结构

- **WHEN** 审查一份生成的 `specs/design/task.md`
- **THEN** 任务按框架 → 模块 → 具体功能三层顺序出现；每个任务行以勾选框开头，含概要、依赖与四段式
  AI 提示词；提示词引用具体章节而非重述设计结论

#### Scenario: 依赖校验抓出前向依赖

- **WHEN** 某功能任务的依赖列点名了排在它之后的模块任务
- **THEN** 该清单不合法，「依赖校验」小节 SHALL 逐条报告该违例；声称「无冲突」与清单矛盾判缺陷

#### Scenario: 文档尚未全部确认

- **WHEN** 轮次内仍有文件未 `confirmed`（状态不为 `confirm`）
- **THEN** task.md 缺席 MUST NOT 被判缺陷；其存在与否以状态库为准，不以人的印象为准

#### Scenario: 有未核销任务时不得重生成覆盖

- **WHEN** 现有 `specs/design/task.md` 中仍有任务行为 `- [ ]`（未核销），本轮收口需要更新它
- **THEN** 技能 MUST NOT 整份重生成覆盖；SHALL 就地修改受影响条目并追加本轮新任务，既有任务的 ID、文字与
  勾选状态逐字保留、追加任务 ID 顺延既有最大编号；丢掉未核销任务或清掉勾选状态的写法 SHALL 判缺陷

#### Scenario: 全部核销后只重生成本轮改动点

- **WHEN** 现有 `specs/design/task.md` 的**所有**任务行都已核销（无一行 `- [ ]`），本轮重开改动了部分设计
- **THEN** 技能 SHALL 整份重生成并覆盖旧文件，且内容只装**本轮改动的那部分设计**对应的任务点，
  而非把整份设计的任务重新列一遍
