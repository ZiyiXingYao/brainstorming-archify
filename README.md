# CodeBuddy Brainstorming Skill

一个可独立安装到 [CodeBuddy](https://cnb.cool/codebuddy/codebuddy-code) 的头脑风暴技能：**只管对话式设计探讨，最终（经你同意）按固定模板产出一份人类可读的设计文档。**

它不写代码、不接下游技能、不产出 spec 模式文档——讨论结束后生成的文档，交给 `spec-superflow` 之类的流程继续消费。

## 特性

- **三路径分类**：Spike（探路）/ Bounded（有界）/ Architectural（架构级），按复杂度缩放流程
- **落盘门**：讨论收敛后先问你要不要存成文件；只是随口问问就到此结束，不留垃圾文件
- **固定模板**：`design-doc-template.md` 锁定章节结构，保证每次产出格式一致，不会随意发挥
- **三道审查**：AI 自审 → 子代理独立审查 → 用户确认
- **零依赖**：纯 Markdown，不需要 Node 或任何运行时

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

# 3. 拷贝技能文件（跳过 .git / README / LICENSE）
cp /tmp/codebuddy-brainstorming/SKILL.md \
   /tmp/codebuddy-brainstorming/design-doc-template.md \
   /tmp/codebuddy-brainstorming/design-doc-reviewer-prompt.md \
   ~/.codebuddy/skills/brainstorming/

# 4. 清理
rm -rf /tmp/codebuddy-brainstorming
```

### 方式三：从本机源码目录安装（开发者）

```bash
mkdir -p ~/.codebuddy/skills/brainstorming
cp /code/codebuddy-brainstorming/SKILL.md \
   /code/codebuddy-brainstorming/design-doc-template.md \
   /code/codebuddy-brainstorming/design-doc-reviewer-prompt.md \
   ~/.codebuddy/skills/brainstorming/
```

## 验证安装

```bash
ls ~/.codebuddy/skills/brainstorming/
# 期望输出：SKILL.md  design-doc-template.md  design-doc-reviewer-prompt.md

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
4. **询问是否落盘**——不要就直接结束
5. 按 `design-doc-template.md` 生成文档到 `docs/specs/design/YYYY-MM-DD-<主题>.md`
6. AI 自审 → 子代理审查 → 你确认

## 目录结构

```
.
├── SKILL.md                          技能本体（含路径分类、落盘门、生成与审查流程）
├── design-doc-template.md            固定设计文档模板（7 节叙述式结构）
├── design-doc-reviewer-prompt.md     子代理审查提示词
├── README.md
└── LICENSE
```

## 来源与许可

本技能改编自 [superpowers](https://github.com/obra/superpowers) 的 `brainstorming` 技能
（MIT License, Copyright (c) 2025 Jesse Vincent），针对「独立头脑风暴 → 人类可读设计文档」
这一使用场景做了改造：

- 断开与 superpowers 下游技能的衔接（不再调用 writing-plans，不进入实现）
- 移除 spec 模式文档与子代理 spec 审查模板
- 移除浏览器可视化伴侣（visual companion）及其服务端脚本
- 新增固定设计文档模板 `design-doc-template.md`
- 新增「落盘门」：产出文件前必须先征得用户同意

以 MIT License 发布，详见 [LICENSE](LICENSE)。
