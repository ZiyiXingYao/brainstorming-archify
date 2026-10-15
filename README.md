# brainstorming-archify

> **当前版本**：`1.0.0`（tag `v1.0.0`） · [Releases](https://github.com/ZiyiXingYao/brainstorming-archify/releases) · [MIT](LICENSE) · 三个版本号的区分见[版本](#版本)
> **技能本体**：[`skill/SKILL.md`](skill/SKILL.md)（英文，AI 读的行为约束） · **维护手册**：[MAINTAINING.md](MAINTAINING.md) · **规格基线**：[`specs/`](specs/) · **测试面**：[`tests/README.md`](tests/README.md)

一个可独立安装到 [CodeBuddy](https://cnb.cool/codebuddy/codebuddy-code) 的**对话式设计技能**：用一问一答把设计谈透，最后（经你同意）按固定模板落成一套**人类可读的实现级设计文档**，并生成实现任务清单。它**不写代码、不接下游流程**。

## 这个库干了啥

- **把讨论收敛成设计文档集**：一份全局架构总纲（**15 节**，含 4+1 视图里的运行视图与部署视图）+ 命中持久化接口或存在领域模型时产出一份**实体与数据设计** + 每个功能模块一份 + 命中七类接口任一类时按需产出一份接口契约；**图类型由章节决定**——模块依赖与运行视图出架构图、全局功能流程与模块流程出时序图、业务编排出工作流图、模块功能描述出程序流程图、实体与数据设计出类图/ER 图/数据流图/状态机图，各出 `.json` 源 IR / `.svg` 静态图 / `.html` 交互版三件套。
- **用门约束 AI**：**落盘门**（要不要写）→ **变更清单门**（写什么，你批）→ **用户审查门**（写得对不对），外加绘图规划 Gate 与子代理独立审查。设计期的取舍与理由都落进文档的「关键决策记录」节，不留在对话里。
- **多模块项目的契约不靠口头对齐**：未设计模块的依赖按**签名级**（函数名 / 入参 / 返回类型 / 边界语义）记进架构接口矩阵，提供方设计时逐条翻牌；函数名须与提供方函数表逐字相等。
- **讨论进度落库、可中断续接**：`.brainstorming-archify/state.yaml` 记状态机与文件状态，当前轮次的 change-list 文件记讨论记录 / 决策 / 台账 / 落盘授权；隔天或换会话用 `/bsa:resume` 恢复现场，explore 阶段的决策不会因中断而丢。
- **全部确认后产出实现任务清单**：`specs/design/task.md`——框架 → 模块 → 具体功能三层，每任务一行（勾选框 + 概要 + 依赖 + 四段式 AI 提示词 `[实现的功能]`—`[任务实现的要求]`—`[实现的约束]`—`[验收标准]`），带依赖校验。
- **明确不做**：不写实现代码、不调用下游技能或流程、不产出 spec 模式的验收产物（字段表 / 签名表 / 接口矩阵是设计描述，模板要求，不算 spec 模式）。技能**只描述行为**，权威口径在 `SKILL.md`、三份模板与 `specs/`。

## 怎么用

**安装**（唯一带版本硬门、备份与自检的路径）：

```bash
node scripts/install.mjs   # → ~/.codebuddy/skills/brainstorming-archify/ + ~/.codebuddy/commands/bsa/resume.md
node scripts/install.mjs --dry-run   # 只列将写入的文件与目标路径，不落盘
```

- 启动先查 Node 主版本，**< 18 时非零退出且一个文件都不写**；目标已存在先整体备份为 `brainstorming-archify.bak-<时间戳>`；装完对已安装副本跑 `diagram-engine doctor` 自检。
- 可选：`--target <技能目录>`（默认 `~/.codebuddy/skills/brainstorming-archify`）、`--commands-dir <命令目录>`（默认 `~/.codebuddy/commands`；只覆盖 `bsa/resume.md` 自己那份，其他命令原样保留、重复安装幂等）、`--help`。

**用**：提出想法 / 新功能 / 行为变更（或需求模糊、要选型）时技能会自动触发，也可显式调用；安装后需**新开一个 CodeBuddy 会话**才会加载。讨论被打断或跨会话时，打 **`/bsa:resume`** 从状态库恢复现场（它报告当前状态、每个文件什么状态、当前轮次记录文件与下一步）。

**产出物**（落在**你的项目**里，不在本仓库）：

```
<你的项目>/
├── specs/design/
│   ├── 01-架构设计.md     架构总纲，全项目唯一（固定 01）
│   ├── 00-接口契约.md     按需产出，全项目唯一（`00-` 固定字面前缀）
│   ├── 02-<模块名>.md …   每个功能模块一份（序号追加不重排）
│   ├── task.md            实现任务清单（全部文档确认后生成）
│   └── diagrams/          图三件套：同前缀 .json / .svg / .html，不拆散
└── .brainstorming-archify/   过程产物（不随设计文档交接、不入提交）
    ├── state.yaml            进度锚点：explore → draft → confirm → closed
    └── change-lists/         轮次记录：当前那一份由 state.yaml 指向
```

**验证安装**：

```bash
node ~/.codebuddy/skills/brainstorming-archify/scripts/diagram-engine/bin/render.mjs doctor
# 期望：检查项全部 [ok]，退出码 0；需 Node ≥ 18
```

**更新**：重跑 `node scripts/install.mjs`（先备份后覆盖；`git clone` 方式则 `git pull` 后再跑一次）。
**卸载**：`rm -rf ~/.codebuddy/skills/brainstorming-archify ~/.codebuddy/commands/bsa`（按需清理 `brainstorming-archify.bak-*`）。卸载不影响已落盘的设计文档——它们在你的项目目录里。

**四套模板的章节形状**（固定结构，产出即实现级设计）：架构总纲 **15 节**（背景/目标/方案对比/整体功能/功能点/模块划分/跨模块接口矩阵/核心类/代码文件树/全局功能流程/**业务编排流程**/运行视图/部署视图/关键决策/待定问题）；功能模块 **8 节**（含**本模块实体状态机**）；**实体与数据设计 8 节**（数据模式总览/领域类图/实体关系图/数据流图/核心实体状态机/数据生命周期与保留/关键决策/待定问题，**条件必出**）；接口契约 `## 总则`（不编号）+ `## 1.`–`## 10.`，七类接口节各含「清单表 / 逐项契约 / 该类规则」三段，该文档**不配图**。编号固定前缀为 `00-` 契约 / `01-` 架构 / `02-` 实体与数据设计，模块为 `03+`。

## 版本

仓库里有**三个互不相同的版本号**，用途不同，不要混着看：

| 版本号 | 值 | 指的是什么 | 什么时候变 |
|---|---|---|---|
| **本仓库 / 本技能的发布版本** | **`1.0.0`**（tag `v1.0.0`） | 这个仓库与它导出的技能的版本，由 git tag 与 [GitHub Release](https://github.com/ZiyiXingYao/brainstorming-archify/releases) 承载；本 README 顶部与本节是它的文字出处（历史：`v0.1.0`，2026-09-22） | 每次发版 |
| 技能文本上游基准 | `v7.0.0`（commit `bb92a77`） | `skill/SKILL.md` 所同步的 superpowers 坐标 | 同步 superpowers 时 |
| 绘图内核上游基准 | `v3.1.0`（commit `1c2b42d`；技能包版本 `3.1.0`） | 内核搬运自 archify 的坐标 | 搬运新内核时 |

**`scripts/diagram-engine/skill-release.json` 里的 `3.1.0` 不是本仓库版本**——那是上游 archify 技能包的发布清单（含它自己的 `skillId`、更新通道与仓库地址），随内核逐字节搬入以保留可追溯性，改它会让内核与上游对不上号。发版步骤见 [MAINTAINING.md §4](MAINTAINING.md#4-发布一个版本)。

## 依赖的上游库

**运行依赖只有一个：`Node ≥ 18`，而且只有出图需要。** 本仓库**零 npm 依赖**（没有 node_modules）；设计文档本身是纯 Markdown，读写、审阅、交接都不需要任何运行时——所以在完全没有 Node 的机器上技能依然可用，只是没有图（版本不满足时跳过出图、在文档里留占位说明，不阻塞文档落盘）。

| 上游 | 被用作 | 以什么形态并入 | 基准 | 许可 |
|---|---|---|---|---|
| [superpowers](https://github.com/obra/superpowers) 的 `brainstorming` 技能 | **对话式设计流程骨架**——路径分类、提问与收敛、设计呈现、自审与用户审查 | **改造副本**：`skill/SKILL.md` 保留英文原文，便于与上游逐句 diff；本地偏离逐条登记在 MAINTAINING 的重放清单 | `v7.0.0` | MIT, © 2025 Jesse Vincent |
| [archify](https://github.com/tt-a1i/archify) 出图技能包 | **绘图内核**——架构图 / 工作流图 / 时序图 / 数据流图 / 生命周期图 / ER 图 / 类图 / 树形图 / 时间线图 / 瀑布图十类图的渲染、校验与自检（另有本仓库自建的**程序流程图** `flowchart`） | **裁剪副本**：保留十类上游图类型的渲染能力，删掉无关子命令、`--repo-root` 溯源能力、`examples/`、`references/` 等目录，并**自建 `flowchart` 类型**；作为**技能内部构件**装在 `scripts/diagram-engine/`，不是第二个技能，用户不单独调用、不写 IR | `v3.1.0` | MIT, © 2026 tt-a1i (Archify) 与 © 2025 Cocoon AI；内联字体 JetBrains Mono 依 SIL OFL 1.1 |

同步办法与逐项偏离清单见 [MAINTAINING.md](MAINTAINING.md)；内核的裁剪明细与被删清单另见 [`scripts/diagram-engine/UPSTREAM.md`](scripts/diagram-engine/UPSTREAM.md)。

## 语言与许可

- **语言**：`skill/` 下两个文件（技能本体与子代理提示词）用**英文**，保持与上游逐句可比；三份模板、README、MAINTAINING、tests/README 用**中文**；产出的设计文档跟随对话语言；**图文件名恒为英文 slug**。内核内含文档与上游一致（英文为主），逐字节搬运不翻译。
- **许可**：[MIT](LICENSE)（`scripts/diagram-engine/LICENSE` 为其独立副本）。本技能改编自 superpowers 的 `brainstorming`（MIT, © 2025 Jesse Vincent）；出图内核搬运自 archify（MIT, © 2026 tt-a1i (Archify) 与 © 2025 Cocoon AI）并做过裁剪；内联字体 JetBrains Mono 依 SIL OFL 1.1，完整文本见 `scripts/diagram-engine/assets/JetBrainsMono-OFL.txt`；第三方商标与图标归属见 `scripts/diagram-engine/THIRD_PARTY_NOTICES.md`。
- **自测**：`node --test tests/*.test.mjs`（覆盖仓库测试与内核回归集，零依赖）。
