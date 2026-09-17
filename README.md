# CodeBuddy Brainstorming Skill

一个可独立安装到 [CodeBuddy](https://cnb.cool/codebuddy/codebuddy-code) 的头脑风暴技能：**只管对话式设计探讨，最终（经你同意）按固定模板产出一份人类可读的设计文档。**

它不写代码、不接下游技能、不产出 spec 模式文档——讨论结束后生成的文档，交给 `spec-superflow` 之类的流程继续消费。

## 特性

- **三路径分类**：Spike（探路）/ Bounded（有界）/ Architectural（架构级），按复杂度缩放流程
- **落盘门（Persist Gate）**：讨论收敛后先问你要不要存成文件；只是随口问问就到此结束，不留垃圾文件
- **两套模板**：架构总纲（`architecture-doc-template.md`）+ 功能模块（`module-doc-template.md`），章节结构锁定，产出即实现级设计
- **增量落盘**：每次讨论先读盘再判决——只填模块内部细节时架构文档零改动；动了模块划分 / 类归属 / 文件树时才改受影响条目，其余逐字保留
- **变更清单门**：写盘前先给变更清单（新建 / 修改哪些文件、各改哪几节、哪些逐字不动、新增了哪些依赖），批准后才落盘
- **签名级跨模块契约**：未设计模块的依赖按签名级记录（函数名 / 入参 / 返回类型 / 边界语义为硬约束，调参类型等软约束由提供方定），记为「待提供」落到架构接口矩阵，对方模块设计时必须回应
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
5. **变更清单门**：给出将新建 / 修改哪些文件、各改哪几节、哪些逐字不动、新增了哪些未落地依赖——批准后才落盘
6. 按模板生成文档到 `specs/design/`
7. AI 自审 → 子代理审查 → 你确认

产出文档的语言跟随对话语言（中文对话产中文文档）。模板保持固定结构，不随语言改变。

### 产出物结构

```
specs/design/
├── 01-架构设计.md      架构总纲，全项目唯一一份（固定 01）
├── 02-<功能模块>.md    每个功能模块一份，文件名 = 模块名
└── 03-<功能模块>.md
```

序号**追加不重排**：新增模块排在当前最大序号之后，即使逻辑上应靠前也不插入重排——否则会重命名既有文件、打断文档间引用。

**架构总纲**（`architecture-doc-template.md`，10 节）：背景与问题 / 目标与非目标 / 方案对比与选型 / 整体功能说明 / 功能模块划分 / 跨模块接口矩阵 / 类归属与类关系 / 代码文件树组织 / 关键决策记录 / 待定问题与风险。

**功能模块文档**（`module-doc-template.md`，7 节）：模块职责与边界 / 本模块类清单与关系 / 类详细设计（逐类的字段表 + 函数表）/ 对外依赖契约（签名级）/ 端到端业务流程 / 关键决策记录 / 待定问题与风险。

对外依赖契约按调用方定义的硬约束（函数名、入参个数与含义、返回类型、边界语义）与提供方自定的软约束（参数具体类型、错误类型体系、内部结构）分列；提供方调整硬约束时状态置「有差异」，列差异待裁决。

端到端业务流程逐条写清五件事：触发入口 → 函数级调用链 → 每跳的数据形态 → 处理结果投递给谁 → 异常路径。

> 字段表、函数签名表、调用链表、接口矩阵**不算** spec 模式——它们是设计描述，是模板要求的，不是被禁止的验收条件。

## 目录结构

```
.
├── SKILL.md                          技能本体（英文，对齐上游）
├── architecture-doc-template.md      架构设计文档模板（中文骨架，10 节）
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
6. 「写 spec 到 `docs/superpowers/specs/`」→「写人类可读设计文档到 `specs/design/`，严格遵循 `architecture-doc-template.md` 与 `module-doc-template.md`」
7. Checklist 中 Architectural 路径末项 `invoke writing-plans` → `Move to the Persist Gate`

**新增**
8. `## Scope` 节：声明边界（不实现、不接下游技能、不产 spec 模式产物）
9. `## The Persist Gate` 节：落盘前单独一条消息征求同意
10. `## Incremental Persist Protocol` 节：落盘前强制读盘 → 判决本次是否影响架构 → 只改受影响条目、其余逐字保留（禁止顺手润色）→ 冲突列差异待裁决 → 未设计模块的依赖记「待提供」
11. `## Change List Gate` 节：写盘前先出变更清单（新建 / 修改 / 逐字不动 / 新增依赖 / 冲突）待批准
12. `## Writing the Design Document` / `## Document Format Requirements` 节（两份模板、混合式形态、spec 模式边界澄清）
13. `## Self-Review` 节：逐节核对模板合规的 9 项清单（替换 spec 自审），含增量合并完整性、跨文档一致性、覆盖完整性
14. `## Subagent Review` 节 + `design-doc-reviewer-prompt.md`，含重跑规则：修订涉及结论 / 决策 / 流程 → 重跑子代理审查；纯措辞或笔误修订 → 只需自审
15. `## User Review Gate` 与 `## Terminal State` 节
16. Red Flags 表新增 8 行（随口问问也落盘 / 自创文档格式 / 模块讨论顺手改架构文档 / 不读盘就写 / 字段表当 spec 模式 / 设计批准当写盘批准 / 聊完就实现 / 落盘门），改写 1 行
17. `## Process Flow` 中新增 Persist Gate 与 Change List Gate 分支，终态改为 `Done` / `Stop here (no file)`

## 来源与许可

本技能改编自 [superpowers](https://github.com/obra/superpowers) 的 `brainstorming` 技能
（MIT License, Copyright (c) 2025 Jesse Vincent）。

以 MIT License 发布，详见 [LICENSE](LICENSE)。
