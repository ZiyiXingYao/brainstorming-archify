# CodeBuddy Brainstorming Skill

一个可独立安装到 [CodeBuddy](https://cnb.cool/codebuddy/codebuddy-code) 的头脑风暴技能：**只管对话式设计探讨，最终（经你同意）按固定模板产出一套人类可读的实现级设计文档（一份全局架构总纲 + 每功能模块一份 + 按需产出的接口契约一份）。**

它不写代码、不接下游技能、不产出 spec 模式文档——讨论结束后生成的文档，交给 `spec-superflow` 之类的流程继续消费。

## 特性

- **三路径分类**：Spike（探路）/ Bounded（有界）/ Architectural（架构级），按复杂度缩放流程；有界改动只在已有设计文档集时走增量，不为小改动制造整套文档
- **落盘门（Persist Gate）**：讨论收敛后先问你要不要存成文件；只是随口问问就到此结束，不留垃圾文件
- **三套模板**：架构总纲（`architecture-doc-template.md`）+ 功能模块（`module-doc-template.md`）+ 接口契约（`interface-contract-template.md`），章节结构锁定，产出即实现级设计
- **接口契约按需产出**：数据模型与全部对外接口（MySQL / Redis / MQ / HTTP / gRPC / 动态库 API / TCP 七类）收敛为 `specs/design/接口契约.md` 的唯一权威源；项目命中七类中**任意一类**即必须产出，七类全不命中则不产出、并在变更清单中**逐族**写明不命中的判定依据；该文档**不配图**（不需要 `diagrams/`）
- **增量落盘**：每次讨论先读盘再判决——只填模块内部细节时架构文档零改动；动了模块划分 / 类归属 / 文件树时才改受影响条目，其余逐字保留。带图的条目变更时，其**图与 IR 同批重渲染**并列入变更清单；**未变条目的图不动**（与文字逐字保留同理），条目删除则连带删图
- **变更清单门**：写盘前先给变更清单（新建 / 修改哪些文件、各改哪几节、哪些逐字不动、新增了哪些依赖），批准后才落盘
- **签名级跨模块契约**：未设计模块的依赖按签名级记录（函数名 / 入参 / 返回类型 / 边界语义为硬约束，参数类型等软约束由提供方定），记为「待提供」落到架构接口矩阵，对方模块设计时必须回应
- **端到端流程分层**：架构总纲画**方向级骨架**，登记**全部**功能流程（含只在单个模块内完成的），每条标注**服务的功能点**与**每跳承担的核心类**；模块文档写本模块内的函数级细节，避免同一条流程在多份文档里重复漂移
- **功能点锚点**：架构总纲枚举全部功能点，每条端到端流程标注它服务的功能点，需求与流程双向可查；模块文档第 1.2 节列出本模块参与的功能点
- **核心类串联**：架构总纲只登记串联整体功能的核心类（第 8 节），完整类清单落在各模块文档的类清单里、由它唯一权威；架构核心类清单是**各已设计模块**类清单并集的子集，属于尚未设计模块的核心类先临时登记、待该模块落盘时收口
- **三道审查**：AI 自审 → 子代理独立审查 → 用户确认
- **自动出图**：落盘阶段由内部技能 `design-diagrams` 自动出图（架构图 / 工作流图 / 时序图 / 数据流图 / 生命周期图五类，**不做类图**——上游无此能力），图以同伴 SVG 落在设计文档旁的 `diagrams/` 下、文档用图片语法引用；**用户不单独调用出图技能**，图随文档同批进变更清单门
- **依赖分两层**：设计文档本身是**纯 Markdown**，读写不需要任何运行时；**出图需要 Node，最低 18**——无 Node 或版本过低时跳过出图、在文档中留占位说明，**不阻塞文档落盘**
- **可同步上游**：`SKILL.md` 保留英文原文，便于与 superpowers 上游 diff 和同步；出图技能搬运自 archify 上游，另有独立同步说明（均见「同步上游」）

## 安装

两个技能要分别落到 `~/.codebuddy/skills/brainstorming/` 与 `~/.codebuddy/skills/design-diagrams/`。下面的方式一最省事；手工安装时，**权威文件清单是 `node install.mjs --dry-run` 的输出**（预演模式**同样受 Node 主版本硬门约束**：版本不满足即以非零退出码结束、不写任何文件）。

### 方式一：一键安装（推荐）

仓库根提供 `install.mjs`，一条命令把 `brainstorming` 与 `design-diagrams` 两个技能装到 `~/.codebuddy/skills/`：

```bash
node install.mjs
```

启动即检查 Node 主版本，**低于 18 时以非零退出码结束且不写任何文件**；安装完成后会真实渲染一张样例 SVG 做自检，把「装了但跑不起来」暴露在安装期而不是首次出图时。

| 命令 | 行为 |
|------|------|
| `node install.mjs` | 把 `brainstorming` 与 `design-diagrams` 两个技能装到 `~/.codebuddy/skills/` |
| `node install.mjs --dry-run` | 只列出将写入的文件与目标路径，不改文件系统；该模式**同样受 Node 主版本硬门约束**——版本不满足即以非零退出码结束、不写任何文件 |
| `node install.mjs --target <dir>` | 指定安装根目录 |
| `node install.mjs --help` | 打印用法 |

### 方式二：git clone（brainstorming，并把 design-diagrams 放到同级）

`brainstorming` 的仓库本身就是技能目录，可直接克隆；`design-diagrams` 需作为**同级技能**再放一份：

```bash
git clone https://github.com/ZiyiXingYao/codebuddy-brainstorming.git \
  ~/.codebuddy/skills/brainstorming

# design-diagrams 是本仓库内的子目录，要拷成同级技能才会被加载
# （`design-diagrams/.` 表示拷「目录内容」进已存在的目标目录；少了这个 `/.'`，
#   目标已存在时源目录会被整个放进目标里，形成 design-diagrams/design-diagrams/）
cp -R ~/.codebuddy/skills/brainstorming/design-diagrams/. \
      ~/.codebuddy/skills/design-diagrams/
```

更新时 `git pull` 只更新 `brainstorming`，`design-diagrams` 的同级副本要重新拷一次（见「更新」）。

### 方式三：下载后拷贝

```bash
# 1. 克隆到临时目录
git clone --depth 1 https://github.com/ZiyiXingYao/codebuddy-brainstorming.git /tmp/codebuddy-brainstorming

# 2. 确保技能目录存在
mkdir -p ~/.codebuddy/skills/brainstorming ~/.codebuddy/skills/design-diagrams

# 3. 拷贝 brainstorming 技能文件（跳过 .git / README / LICENSE / 同步脚本）
cp /tmp/codebuddy-brainstorming/SKILL.md \
   /tmp/codebuddy-brainstorming/architecture-doc-template.md \
   /tmp/codebuddy-brainstorming/module-doc-template.md \
   /tmp/codebuddy-brainstorming/interface-contract-template.md \
   /tmp/codebuddy-brainstorming/design-doc-reviewer-prompt.md \
   ~/.codebuddy/skills/brainstorming/

# 4. 拷贝 design-diagrams 技能（整目录搬运：含 bin / renderers / schemas / assets / test 等，
#    缺了任何一部分出图都会跑不起来，不能只拷 SKILL.md）
cp -R /tmp/codebuddy-brainstorming/design-diagrams/. ~/.codebuddy/skills/design-diagrams/

# 5. 清理
rm -rf /tmp/codebuddy-brainstorming
```

两处 `cp` 的目标就是全部需要安装的内容；等价清单也可用 `node install.mjs --dry-run` 打印（预演模式**同样受 Node 主版本硬门约束**：版本不满足即以非零退出码结束、不写任何文件）。

### 方式四：从本机源码目录安装（开发者）

```bash
mkdir -p ~/.codebuddy/skills/brainstorming ~/.codebuddy/skills/design-diagrams
cp /code/codebuddy-brainstorming/SKILL.md \
   /code/codebuddy-brainstorming/architecture-doc-template.md \
   /code/codebuddy-brainstorming/module-doc-template.md \
   /code/codebuddy-brainstorming/interface-contract-template.md \
   /code/codebuddy-brainstorming/design-doc-reviewer-prompt.md \
   ~/.codebuddy/skills/brainstorming/
cp -R /code/codebuddy-brainstorming/design-diagrams/. ~/.codebuddy/skills/design-diagrams/
```

## 验证安装

```bash
ls ~/.codebuddy/skills/brainstorming/
# 期望输出：SKILL.md  architecture-doc-template.md  module-doc-template.md  interface-contract-template.md  design-doc-reviewer-prompt.md

ls ~/.codebuddy/skills/design-diagrams/
# 期望输出应含：SKILL.md  bin  renderers  schemas  assets  test  …（整目录都在，不只是 SKILL.md）

head -4 ~/.codebuddy/skills/brainstorming/SKILL.md
# 期望输出：
# ---
# name: brainstorming
# description: ...
# ---

head -4 ~/.codebuddy/skills/design-diagrams/SKILL.md
# 期望输出：
# ---
# name: design-diagrams
# description: ...
# ---

# 出图能力自检（需 Node ≥ 18；跑技能自带的测试子集，退出码 0 = 清单内全过）
node ~/.codebuddy/skills/design-diagrams/test/run-valid.mjs
```

安装是否完整，看**两个技能目录都在**、且（按「方式一」安装时）`install.mjs` 打印的自动自检通过——即 `自检：渲染 architecture 样例 SVG … 通过`。`run-valid.mjs` 是**仓库内**的回归入口：它同样能在安装副本里跑，但会**跳过**少数需要仓库上下文（技能包之外的文件）的用例——例如 `install.test.mjs` 需要仓库根的 `install.mjs`，安装副本里没有这个文件——这些用例在副本里显示为 `skipped` 而不是 `failed`，属**预期**，不代表安装有问题。用「方式一」安装时，`install.mjs` 已自动做过一次渲染自检。

安装后需要**新开一个 CodeBuddy 会话**，技能才会被加载。

## 更新

```bash
# 方式一（一键安装）安装的：重跑一次，两个技能一起覆盖并重新自检
node install.mjs

# 方式二（git clone）安装的：pull 之后 design-diagrams 的同级副本要重新拷
# （同样必须写 `design-diagrams/.`：目标目录已存在时，少了 `/.'` 只会把源目录
#   嵌套进目标里，design-diagrams 本身并没有被更新）
cd ~/.codebuddy/skills/brainstorming && git pull
cp -R ~/.codebuddy/skills/brainstorming/design-diagrams/. ~/.codebuddy/skills/design-diagrams/
```

（方式三、方式四安装的，重新执行对应拷贝命令覆盖即可）

## 卸载

```bash
rm -rf ~/.codebuddy/skills/brainstorming ~/.codebuddy/skills/design-diagrams
```

## 使用

提出新想法、新功能、新组件、行为变更，或需求模糊、需要方案选型时，技能会自动触发，也可以显式调用。流程：

1. AI 分类路径（Spike / Bounded / Architectural）并说明
2. 一问一答澄清意图、约束、取舍
3. 收敛设计
4. **落盘门**：询问是否写入文件——不要就直接结束
5. **变更清单门**：给出将新建 / 修改哪些文件、各改哪几节、哪些逐字不动、新增了哪些未落地依赖、**本次将新建 / 重渲染哪些图**、有哪些待裁决差异——批准后才落盘
6. 按模板生成文档到 `specs/design/`；落盘阶段**自动出图**（内部技能 `design-diagrams`），图以同伴 SVG 落在 `specs/design/diagrams/` 下，与文档同批写盘
7. AI 自审 → 子代理审查 → **用户审查门**：你确认内容

产出文档的语言跟随对话语言（中文对话产中文文档）。模板保持固定结构，不随语言改变。路径基准为**项目根**。

### 产出物结构

```
specs/design/
├── 01-架构设计.md      架构总纲，全项目唯一一份（固定 01）
├── 02-<功能模块>.md    每个功能模块一份，文件名 = 模块名
├── 03-<功能模块>.md
├── 接口契约.md         接口契约，按需产出且全项目唯一一份（文件名固定，不带数字前缀）
└── diagrams/           同伴图文件：每张图为 <图名>.svg + 同名 .json 的 IR，文档以图片语法引用
```

序号**追加不重排**：新增模块排在当前最大序号之后，即使逻辑上应靠前也不插入重排——否则会重命名既有文件、打断文档间引用。

**架构总纲全局唯一**，所有模块的架构级内容（功能点需求、模块划分、核心类归属、类关系、接口、全局流程、文件树）都累积在这一份里；分模块的详细设计在各自的模块文档里。`specs/design/` 下永远只有一份架构文档，不存在"每个子项目一份架构文档"。同理，**接口契约文档也全项目唯一一份**，文件名固定为 `接口契约.md`、**不带数字前缀**，不参与模块文档的序号排序。

**模块划分粒度**：一个模块要能独立回答"它做什么、怎么用、依赖谁"，且能被一次讨论讲透。类详细设计一屏放不下、或要拆成多次讨论 → 该拆细；两个模块总是一起改、找不到清晰接缝 → 该合并。模块与代码目录不要求一一对应。

**引用与元信息约定**：文档间引用统一写相对项目根的完整路径（如 `specs/design/02-通信模块.md`）；「状态」新建为"草稿"、经你确认后改"已确认"且不再退回；「最近更新」每次落盘刷新为当天，同一次落盘同时更新多份文档时这几份填同一天。

**三道门**：一次会话会问你三次，各管各的、不合并——**落盘门**（要不要写）→ **变更清单门**（写什么，你批）→ **用户审查门**（写得对不对）。前两次几秒可答，只有第三次需要真读。

**模块删除与改名**：删除要连带删模块文档、清单行、以及把它当调用方或提供方的所有接口矩阵行，序号留空洞**不重排**；删除前先扫一遍它欠别人的「待提供」条目并报告（这些缺口将无人认领）。改名要同步更新所有引用——清单的「对应文档」列、矩阵的「详见」列、其他模块文档里的交叉引用，不能留下失效路径。

**模块名全项目唯一**——它同时是文件名主体和所有交叉引用的锚点，两个模块不得同名。

**架构大改的例外**：若某次讨论把模块划分本身推倒重来，几乎每条都"受影响"，这是"只改受影响条目"的合法例外。但要在变更清单里明示"本次为架构大改"，并且仍然**逐条比对**既有文档（不是盲写重生成），仍然成立的内容逐字保留。

首次落盘会先创建 `specs/design/` 目录。

**架构总纲**（`architecture-doc-template.md`，12 节）：背景与问题 / 目标与非目标 / 方案对比与选型 / 整体功能说明 / 功能点需求说明 / 功能模块划分 / 跨模块接口矩阵 / 核心类设计 / 代码文件树组织 / 全局功能流程 / 关键决策记录 / 待定问题与风险。

其中**代码文件树只承载「模块文件夹 + 核心文件」**，不要求文件级完备：它必须能定位第 8.1 节核心类清单里每一个核心类的「定义文件」；非核心类的源文件可以不出现在树里，这不算缺陷——完整的类清单与各类的定义文件由各模块文档的类清单承载。

**功能模块文档**（`module-doc-template.md`，7 节）：模块职责与边界 / 本模块类清单与关系 / 类详细设计（逐类的字段表 + 函数表）/ 对外依赖契约（签名级）/ 端到端业务流程 / 关键决策记录 / 待定问题与风险。其中第 1 节拆为「1.1 职责与边界」与「1.2 本模块参与的功能点」；第 2.1 节类清单是本模块**完整**类清单的唯一权威（架构总纲的核心类清单是各**已设计**模块类清单并集的子集）；第 5 节每条流程都标注**服务功能点**。

对外依赖契约按调用方定义的硬约束（函数名、入参个数与含义、返回类型、边界语义）与提供方自定的软约束（参数具体类型、错误类型体系、内部结构）分列。

**接口契约文档**（`interface-contract-template.md`）：**按需产出**——项目命中 MySQL / Redis / MQ / HTTP / gRPC / 动态库 API / TCP 七类对外接口中**任意一类**即必须产出；七类全不命中则不产出，并在变更清单中**逐族**写明不命中的判定依据（禁止以"本次未涉及接口"为由跳过判定）。落盘路径固定为 `specs/design/接口契约.md`，全项目唯一一份、**文件名不带数字前缀**，禁止起别名或并入其它文档。章节形状：`## 总则`（**不编号**）+ `## 1.` 至 `## 10.`，共 **11** 个二级标题（其中带号节 10 个）；七个接口类节（`1.` MySQL 数据表 / `2.` Redis key 与结构 / `3.` MQ 消息通道 / `4.` HTTP 接口 / `5.` gRPC 接口 / `6.` 动态库 API / `7.` TCP 接口）各含 `x.1` 清单表 / `x.2` 逐项契约 / `x.3` 该类规则三段，其后为第 8 节其他对外接口（兜底）、第 9 节跨类别共同约定、第 10 节待定问题与风险。该文档**不配图**，不需要 `diagrams/` 目录。

**接口状态只在架构矩阵维护，三段收口**（避免「待提供」永远挂着、也避免两处状态对不上）：

1. **调用方产生** —— 调用方落盘时在矩阵写入条目，状态 `待提供`，同时提示你后续单独讨论提供方模块
2. **提供方翻牌** —— 提供方设计时**必须逐条处理**指向自己的条目：硬约束一致 → `已落地`；不一致 → `有差异` 并列出差异
3. **裁决者收口** —— `有差异` 经你裁决后改文档对齐，状态回 `已落地`；暂时改不了就保持 `有差异` 并在两边「待定问题与风险」各留一条

**模块文档的依赖契约表不写状态**，只写"我需要什么"（提供方、类、期望签名、语义）。原因是状态会因**别人的**落盘而变化，而模块文档无权替别人翻牌——状态收在一处，翻牌就永远不需要改另一个模块的文档。

提供方已设计却仍留 `待提供`，等于缺口无人认领——自审和 reviewer 都会报。

**端到端流程分两层，避免跨模块流程在多份文档里重复漂移**：

- 架构总纲第 10 节画**方向级骨架**——模块级调用链 + 每条流程服务的功能点 + 每跳承担的核心类 + 每跳数据形态 + 结果落地 + 跨模块的失败处理
- 模块文档第 5 节写本模块内部的函数级细节，每条流程标注**服务功能点**——触发入口 → 本模块内调用链 → 数据形态变化 → 结果投递给谁 → 异常路径；跨模块的那一跳只写"调用 &lt;模块&gt; 的 &lt;接口&gt;"，骨架不重复

**流程对齐规则**：架构总纲第 10 节登记的**每一条功能流程**（包括只在单个模块内完成的）都与各参与模块第 5 节**同名出现**；只有纯模块内部的**实现级流程**留在模块文档，不登记到架构总纲。

**图（diagram）**：架构总纲**第 6.3 节模块依赖关系**、**第 10 节每条全局功能流程**、模块文档**第 5 节每条端到端业务流程**，都**必须**配一张随文档落盘的 SVG 图——登记了却没有图的判定为缺陷。图类型按描述对象的性质选（跨模块调用顺序 → 时序图；泳道责任与审批分支 → 工作流图；状态流转与重试 → 生命周期图；数据来源处理去向与敏感边界 → 数据流图；整体结构 → 架构图），不按作者偏好挑；**同一流程名在架构总纲与模块文档共用同一张图文件**（两处图类型必须一致）。图由 `brainstorming` 在落盘阶段**自动**调用内部技能 `design-diagrams` 生成，**用户不写 IR、不需要知道 schema 存在**；文档以 `![<说明>](diagrams/<图名>.svg)` 引用，**正文不得内联 `<svg>` 标签**。**类关系三节（架构 8.2 / 8.3、模块 2.2）仍用文字或 mermaid**——本次不做类图（上游 `archify` 无类图能力），这是**预期结果，不是缺陷**。出图需要 **Node ≥ 18**：环境不满足时跳过出图、留占位说明，不阻塞文档落盘。

出现分歧时以谁为准（避免两边互相"必须一致"却判不出改哪边）：

| 分歧内容 | 权威 |
|---------|------|
| 依赖签名 | 调用方模块文档第 4 节（接口矩阵只是摘录，跟着改） |
| 有哪些模块 | 架构总纲第 6.2 节 |
| 跨模块接口是否已落地 | 架构总纲第 7 节 |
| 类的归属 | 各模块文档的类清单（架构总纲第 8.1 节只登记核心类，且必须是各已设计模块类清单并集的子集；属于未设计模块的核心类先临时登记，待该模块落盘时对齐） |

> 字段表、函数签名表、调用链表、接口矩阵**不算** spec 模式——它们是设计描述，是模板要求的，不是被禁止的验收条件。
>
> 一个 reviewer 子代理同时审三类文档：`01-架构设计.md` 对架构模板，模块文档对模块模板，`接口契约.md` 对接口契约模板。写盘集超过 5 份时先审架构总纲，再按模块分批。

## 目录结构

```
.
├── SKILL.md                          技能本体（英文，对齐上游）
├── architecture-doc-template.md      架构设计文档模板（中文骨架，12 节）
├── module-doc-template.md            功能模块设计文档模板（中文骨架，7 节）
├── interface-contract-template.md    接口契约设计文档模板（中文骨架，`## 总则` + `## 1.`–`## 10.`，共 11 个二级标题）
├── design-doc-reviewer-prompt.md     子代理审查提示词（英文）
├── design-diagrams/                  出图技能（内部，搬运自 archify 上游；含渲染器 / schema / 测试集，见其 UPSTREAM.md）
├── install.mjs                       一键安装两个技能的入口脚本（Node ≥ 18）
├── sync-upstream.sh                  与 superpowers 上游对比 SKILL.md 的辅助脚本（不覆盖 archify）
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
| `interface-contract-template.md` | 中文骨架 | 同上 |
| `design-diagrams/SKILL.md` | 中文 | 新写的内部技能说明书，不是上游文件 |
| `design-diagrams/` 其余 | 与上游一致（英文为主） | 上游 archify 逐字节搬运，不翻译，便于按 commit 比对 |
| 产出的设计文档 | 跟随对话语言 | 人读的文档 |

## 同步上游

本仓库有两个上游，分别对应两个技能：

| 技能 | 上游仓库 | 基准坐标 | 同步方式 |
|------|---------|---------|---------|
| `brainstorming`（`SKILL.md` 等） | [superpowers](https://github.com/obra/superpowers) | `v6.4.1`（commit `5bf4e78`） | `./sync-upstream.sh` 看 diff 后重放改动清单 |
| `design-diagrams` | [archify](https://github.com/tt-a1i/archify) | commit `5289f6867f048a7450ec5718f58459613a84cf41`（技能包版本 `2.17.0-dev.1`） | **无脚本**（`sync-upstream.sh` 不覆盖它），按 commit 手工比对 + 跑技能内测试判回归 |

`./sync-upstream.sh` **只覆盖 `superpowers`**，它比对的是 `brainstorming/SKILL.md`，与 `design-diagrams/` 无关。

### 上游一：superpowers（`brainstorming`）

本技能的 `SKILL.md` 是 [superpowers](https://github.com/obra/superpowers) `skills/brainstorming/SKILL.md` 的**改造副本**。

**上游基准**：`obra/superpowers` @ `v6.4.1`（commit `5bf4e78`）

**上游现状（2026-09-22 实测）**：本仓库**已同步到** `v6.4.1`（commit `5bf4e78`）。本仓库最初自上游 `v6.3.0`（commit `b36e082`）分叉；从该版到 `v6.4.1`，`skills/brainstorming/SKILL.md` 实测为 **250 → 285 行、diff 66 行**，新增一节 `## Establish Shared Understanding`——本次已把《需要重放的改动清单》按新基准逐条复核，并把新增节与上游改写处的**节级／段落级本地化**登记为第 36、37 条（见下）。
《需要重放的改动清单》是**活指令**：上游再前移时，须把清单逐条重新施加到新坐标、为新增节判定偏离，再跑 `./sync-upstream.sh --ref <新坐标>` 复验 diff；只改本文档里的版本号不算同步。

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
diff -u /tmp/sp/skills/brainstorming/SKILL.md ./SKILL.md
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
12. `## Incremental Persist Protocol` 节：落盘前强制读盘 → 判决影响面（模块文档只改本次涉及的条目，绝不整份重写；架构文档仅受影响时改、仅改受影响条目，其余逐字保留含措辞顺序格式，仅额外允许刷新「最近更新」行且同一次落盘用同一天）→ 冲突列差异待裁决 → 未设计模块的依赖记「待提供」并做签名级记录且在提供方落盘时逐条翻牌 → 未设计模块被设计时的登记动作（建文档、翻设计状态、去掉「（待创建）」、不重排序号，一次登记多个模块则逐个执行）→ 依赖引用了从未登记的模块时先登记再记依赖 → **模块删除与改名**的后续动作（删除连带清清单行与矩阵行、序号留空洞不重排、删除前报告它欠别人的「待提供」；改名同步更新清单「对应文档」列、矩阵「详见」列与其他文档的交叉引用），并声明三处唯一事实源
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
28. （D-2）新增整节 `## Diagrams in the Design Documents`，与 `design-diagrams/SKILL.md` 的入参契约逐项一致：内部技能声明；出图时机（落盘阶段、随文档同批进变更清单门、不单独落盘）；IR 由本技能自该节已有内容生成、事实来源限定该节、用户不写 IR；Skill 工具调用与入口命令；五类图选型；落盘路径与图名派生（含冲突报双方、不静默改名）；同名流程共用一份图文件；md 引用形态与正文不得内联 `<svg>`；校验硬门（不过不产出、不覆盖既有同名）；两轮降级口径（目标错误数 = 错误级诊断条数不含警告、基线轮计入两轮、第 2 轮未低于第 1 轮即停且退出码 3、两选项交回用户不代选）；Node < 18 留占位降级且不阻塞落盘
29. （D-3）`## Change List Gate` 清单项新增 `Diagrams` 一栏——「every diagram this persist will create or re-render, each named with the flow or section it belongs to, or `无`；**本栏还列出本次预期新建 / 重渲染、但未通过校验而以占位保留的图，标 `未通过校验` 并写明原因**；未变条目之图不列入也不重渲染」
30. 认清**第三类受管设计文档——接口契约**：技能由「架构总纲 / 功能模块」两类扩为「架构总纲 / 功能模块 / 接口契约」三类，写盘指令同步引用 `interface-contract-template.md`
31. 新增**机械的按需产出判定**：项目命中 MySQL / Redis / MQ / HTTP / gRPC / 动态库 API / TCP 七类对外接口中**任意一类**即必须产出接口契约文档；七类全不命中则不产出，并在变更清单中**逐族**写明不命中的判定依据；禁止以「本次未涉及接口」为由跳过判定
32. 固定接口契约文档的落盘路径为 `specs/design/接口契约.md`，全项目唯一一份且**文件名不带数字前缀**；禁止起别名、禁止并入架构总纲或模块文档
33. 自审清单新增**接口契约检查项**，其中明确**不得因该文档没有配图而报缺陷**（接口契约文档不配图是预期形态，报即为校准错误）
34. 设计呈现覆盖清单由**两类扩为三类**（加入接口契约文档）
35. 模板读取清单与审查子代理派发清单由**两类扩为三类**

**（叠加）v6.4.1 新基准的本地化**
以下两条覆盖 `v6.4.1` 新引入内容在 `SKILL.md` 上的**节级／段落级本地化**。既有第 6、19 条只覆盖了它们外溢的**术语**（`spec` → 设计文档、`<HARD-GATE>` 内的措辞替换），**未**覆盖整段重写本身——新节第三点的落点切换、门的分级结构与条数、`## Checklist` 第 `0.` 步、`## Process Flow` 共用节点、`## Anti-Pattern` 段的逐路径改写，故单列。

36. （叠加）本地化 v6.4.1 新增节 `## Establish Shared Understanding`：新节照上游的三点结构落盘（发现意图／回写理解／把意图带进设计），但**第三点**的落点由上游的 `the written spec` 改指**本仓库设计文档**（架构总纲／模块文档／接口契约，即项目根下 `specs/design/`），**同时保留上游的 `or the in-chat design/probe for bounded work and spikes` 分支**——bounded 与 spike 两支仍落在聊天内的设计／探针，不得把这两支也改指设计文档；全句不得出现 `spec`；`## Checklist` 的三条路径（Spike／Bounded／Architectural）各在「宣布路径」之后、原有第 1 步 `Explore project context` 之前插入一个**共同的第 `0.` 步**「建立共识理解」，步号写作 `0.`，**既有步号不重排**；`## Process Flow` 的流程图为三条路径新增一个共用前置节点（`Establish shared understanding`），使图与清单一致。
37. （叠加）本地化 v6.4.1 对 `<HARD-GATE>` 与 `## Anti-Pattern` 的改写：`<HARD-GATE>` 整段按上游结构重写为**按 Spike／Bounded／Architectural 分级**（不再是单一泛化条件），其中 Architectural 先决条件以**本仓库实际存在的门禁**表述——设计呈现与批准、Persist Gate、Change List Gate、用户审查门——只**并列名目、不给设计陈述与 Persist Gate 排先后**，也不重复各门内部规则，不得出现 `spec`／`plan`／`writing-plans`；`## Anti-Pattern` 段与 Red Flags 表中「这条太简单不需要设计」那一行按**所选路径**重写（bounded 得到聊天内的短设计、architectural 得到设计文档），与 `<HARD-GATE>` 的分级一致。

> **已核对但未改的处（对照说明，非偏离项）**：`## Process Flow` 未新出图节点——出图发生在既有的 "Write or merge docs" 环节内；`## Self-Review`、`## Subagent Review`、`## User Review Gate`、Red Flags 表、Checklist 均未扩图相关项——图相关的审查判据归 `design-doc-reviewer-prompt.md`。这几处经核对属**预期结果**，不是本次遗漏，不应登记为偏离。

### 上游二：archify（`design-diagrams`）

`design-diagrams/` 是 [archify](https://github.com/tt-a1i/archify) 出图技能包的**逐字节搬运副本**（本仓库只新增了 `SKILL.md`、`test/run-valid.mjs`、`UPSTREAM.md`，以及 Node 侧 SVG 直出与图名派生等自写模块），详见 `design-diagrams/UPSTREAM.md`。

**上游基准**：`tt-a1i/archify` @ commit `5289f6867f048a7450ec5718f58459613a84cf41`（技能包版本 `2.17.0-dev.1`；`skill-release.json` 的 `channel` 是 `development`，该仓库**无稳定 tag**，因此基准按 commit 固定，不按 tag 或 `latest`）。

**许可证归属**：archify 本体为 MIT（版权方与全文见 `design-diagrams/LICENSE`）；内联字体 **JetBrains Mono** 依 SIL Open Font License 1.1 授权，完整授权文本随包存放在 `design-diagrams/assets/JetBrainsMono-OFL.txt`；第三方商标与图标归属见 `design-diagrams/THIRD_PARTY_NOTICES.md`。

**怎么判回归**：技能内自带上游测试集，验证入口：

```bash
node design-diagrams/test/run-valid.mjs
```

它只跑**在裁剪后结构里成立的那个子集**（退出码 `0` = 全过）。哪些上游检查项被排除、为什么排除，逐条登记在 `design-diagrams/UPSTREAM.md`——同步上游时按基准 commit 逐字节比对，再跑这个入口确认没有真回归。

**注意：`./sync-upstream.sh` 只覆盖 `superpowers`，不覆盖 `archify`**——它比对的是 `brainstorming/SKILL.md`，与 `design-diagrams/` 无关；同步 archify 需按上面的基准 commit 手工比对。

## 后续变更

以下一项已登记为待启动的独立变更。变更目录在 `changes/` 下（停在 DP-0 未确认）；由于 `changes/` 被 `.gitignore` 忽略，另在此登记一行，以免换机或清理工作树后丢失。

| 变更 | 要解决的问题 | 细节所在 |
|------|-------------|---------|
| `backfill-run-valid-cases` | `design-diagrams` 组 B 的七个上游测试文件在 `SKILL.md` 落盘后**仍全部失败**（成因已从「`SKILL.md` 未创建」变为「已落盘但内容是内部技能入口形态、与上游 archify 原版断言不符」）。其中 `automatic-port-spread`（14/15）与 `sequence-column-fit`（5/6）的**运行时用例本来是通过的**，只因同一文件里还有一条读 `SKILL.md` 的文档断言而被整文件排除。要把 `run-valid.mjs` 的排除粒度从**文件级**改为**用例级**，才能把已通过的运行时用例纳入回归清单。 | `design-diagrams/UPSTREAM.md` 第 6 节「未决点」 |

该项是在 `add-interface-contract-template` 变更的归档验证中被实测确认的，当时按该变更的范围边界未处理。

## 来源与许可

本技能改编自 [superpowers](https://github.com/obra/superpowers) 的 `brainstorming` 技能
（MIT License, Copyright (c) 2025 Jesse Vincent）。

出图技能 `design-diagrams` 搬运自 [archify](https://github.com/tt-a1i/archify)
（MIT License, Copyright (c) 2026 tt-a1i (Archify) 与 Copyright (c) 2025 Cocoon AI）；
内联字体 JetBrains Mono 依 SIL Open Font License 1.1 授权，完整授权文本见
`design-diagrams/assets/JetBrainsMono-OFL.txt`；第三方商标与图标归属见
`design-diagrams/THIRD_PARTY_NOTICES.md`。

以 MIT License 发布，详见 [LICENSE](LICENSE)（`design-diagrams/LICENSE` 为其独立副本）。
