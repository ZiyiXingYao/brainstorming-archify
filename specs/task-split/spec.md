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
`specs/design/` 是内容锚点（答「讨论了什么」），state.yaml 答「进行到哪了」；
`.brainstorming-archify/change-lists/` 保持过程产物定位（落盘授权的审计流水，不是进度记录）。

state.yaml SHALL 记录四级整体状态与每个登记文件的三态：

- 整体状态取值恰为 `explore`（纯讨论，无产物落盘）、`draft`（草稿已落盘、人工校验中）、
  `confirm`（全部确认，只差生成 task.md）、`closed`（task.md 已生成，结束）；
- 文件状态取值恰为 `discussing`（讨论中）、`landed`（已落盘待校验）、`confirmed`（人类已确认），
  且 `confirmed` 蕴含 `landed`——推进判「全部 landed」时 `confirmed` 的文件算已落盘。

状态推进 SHALL 满足：

- 正向推进只能走一步（`explore → draft → confirm → closed`），不得跳级；
- 推进到 `draft` 的前置条件是全部登记文件已 `landed`；推进到 `confirm` 的前置条件是全部登记文件已
  `confirmed`；推进到 `closed` 的前置条件是 `specs/design/task.md` 存在且其修改时间**晚于**最后一次
  重开（重开会作废 task.md）；
- 向更早状态回退 SHALL 必须给出 `--reason`；
- `reopen <文件>... --reason` SHALL 只把点名文件翻回 `discussing`（未点名文件状态不变）、整体状态退回
  `explore`，并登记一条重开事件（时间、原因、文件）；点名一个尚未登记的文件时 SHALL 先登记再翻转。

`state.yaml` SHALL 只允许由 `scripts/task-state/change-state.mjs` 编辑；`resume-state.mjs` SHALL 为
只读命令，供对话中断或跨会话重启后恢复：从当前目录向上发现项目根，输出当前状态、文件三态、
`next_action`（按四态给出下一步与要加载的技能文件）与 `blockers`（state.yaml 不存在、形状或取值非法、
登记为 `landed`/`confirmed` 的文件在盘上已不存在）。存在 blocker 时调用方 SHALL 停下并展示修复命令，
MUST NOT 猜测继续。

三份设计文档模板的文件头 SHALL NOT 再写「状态」行——文件讨论状态的唯一权威是 state.yaml；
文件头保留 `最近更新` / `参与` / `来源`（模块文档与接口契约另留 `对应架构`）。
架构模板 §6.2 的 `设计状态` 列与 §7 接口矩阵的状态取值是不同概念（模块设计存在性、接口依赖状态），
SHALL NOT 随本次删除。

#### Scenario: 首轮讨论走到收口

- **WHEN** 项目没有 state.yaml 时开始讨论，随后落盘设计文档、人工逐份确认，最后生成 task.md
- **THEN** 状态依次为 `explore`（init 后）→ 文档登记为 `landed` 且全部落盘后 `advance draft` →
  逐份 `confirmed` 且全部确认后 `advance confirm` → 生成 `specs/design/task.md` 后
  `advance closed --task-md specs/design/task.md` 成功，状态为 `closed`

#### Scenario: closed 之后新增模块

- **WHEN** 状态为 `closed`，人类要求新增一个功能模块
- **THEN** `reopen <新模块文档> --reason "<原因>"` 只把该文件登记为 `discussing`、既有 `confirmed`
  文件保持原状、整体状态退回 `explore`；重走「落盘 → draft → 确认 → confirm」后，**旧 task.md 未重新生成时
  `advance closed` 被拒绝**（修改时间不晚于最后一次重开），重新生成 task.md 后才可收口

#### Scenario: 重启后续讨论

- **WHEN** 会话中断数日后重启，运行 `resume-state.mjs --json`
- **THEN** 输出含 `state`、每个文件的 `status`、按状态给出的 `next_action` 与 `blockers`；
  若某文件登记为 `landed`/`confirmed` 但已不在盘上，`ok` 为 false 且 blockers 指名该文件，
  调用方不得绕过

#### Scenario: 状态文件被手工改坏

- **WHEN** state.yaml 的形状或取值不合法（如 state 取值不在四态之内）
- **THEN** 两个命令都以失败关闭处理并报出问题行，MUST NOT 猜测语义后继续

### Requirement: 实现任务清单 task.md

当全部登记文件 `confirmed`（状态 `confirm`）时，技能 SHALL 生成 `specs/design/task.md`，
把已确认的设计从**框架 → 模块 → 具体功能**三层拆成实现任务，且 SHALL 在生成前完成依赖校验。

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

task.md SHALL 为整体重生成的一次性产物，MUST NOT 受「序号追加不重排」规则管辖；重开即作废，
重新收口前 SHALL 重新生成。它 SHALL 属于受审产物（审查提示词按 Task split 判据审它）并 SHALL 纳入
向外的交接集。

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
