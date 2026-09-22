# tests —— 仓库自测面

本目录放 `codebuddy-brainstorming` 自己的测试。**它不进安装**（见 `scripts/install.mjs`）。

## 目录

```
tests/
├── fixtures/                     五类图各一份样例 IR（合法、可直接渲染）
│   ├── sample-architecture.json
│   ├── sample-workflow.json
│   ├── sample-sequence.json
│   ├── sample-dataflow.json
│   └── sample-lifecycle.json
├── render.smoke.test.mjs         冒烟：渲染五类图，校验三件套（独立脚本，原生 assert）
├── render.entry.test.mjs         入口契约：透传子命令 / 参数校验 / 失败不留半成品 / 原子提交 / 两轮降级
├── install.test.mjs              安装脚本：版本硬门 / 备份 / 平铺与整目录规则 / 装后 doctor / 用法错误
├── doc-consistency.test.mjs      文档一致性：SKILL.md 关键约定、模板配图章节、旧技能名残留
└── README.md                     本文件
```

## 怎么跑

```bash
# 全部（冒烟 5 个用例 + 契约测试 31 个用例 = 32 项，均零失败）
node --test tests/*.test.mjs

# 只跑冒烟（独立脚本）
node tests/render.smoke.test.mjs
```

**不需要安装任何依赖**：只用 Node 内置模块与原生 `assert`。
产物与临时目录都写在系统临时目录，用完即删，不污染仓库，也不触碰 `~/.codebuddy`。

## 各文件断言什么

### `render.smoke.test.mjs`（独立脚本，退出码 0 = 全过）

对 `fixtures/` 下五份样例逐个调用内核唯一入口
`node scripts/diagram-engine/bin/render.mjs render <type> <ir.json> <outdir>`，断言：

1. 三件套齐备：`<basename>.json` / `.svg` / `.html`；
2. 三件都非空；
3. `.svg` 含 `<svg` 根元素；
4. `.html` 含查看器代码标记（`data-quality-profile` 与 `syncFromHash`）。

### `render.entry.test.mjs`（`node:test`）

入口的**契约与边界**，补冒烟测试没有覆盖的部分：`validate` / `doctor` 透传；参数个数错误退出码 2；
非法 IR 非零退出且目标目录不新增任何产物；**失败时既有同名文件不被覆盖、不残留 staging/backup 目录**；
成功路径不留残留；`<basename>.json` 与输入 IR 同路径时允许；**两轮降级**——同一目标连续两次未改善以退出码 3 停下。

### `install.test.mjs`（`node:test`）

安装脚本的四道行为约束逐条锁死：版本硬门（Node < 18 → 退出码 1 且**一个文件都不写**）；
`--dry-run` 不落盘；实装形态（`skill/` 平铺 + `templates/` 与 `scripts/` 整目录 + 内核入口存在 +
**`tests/` 与内核回归集不进安装**）；目标已存在时产出 `brainstorming.bak-<时间戳>` 且既有内容完整保留；
装后自检输出；已安装副本可独立跑 `doctor`；用法错误退出码 2。

### `doc-consistency.test.mjs`（`node:test`）

机械看门人：`skill/SKILL.md` 必须含绘图规划 Gate、三件套、落点 `specs/design/diagrams/`、
命名 `<document number>-<diagram name>`、交互版链接行、主节点上限、showcase、修复顺序、间距公式、
品牌仅内置 ID，**自审恰为 15 项**，且不含 `design-diagrams` 与 `--repo-root`；
两份配图模板含三件套与两行引用，接口契约模板保持「不配图」口径；
`skill/` 与 `templates/` 无旧技能名残留；README 只允许历史条目提及旧技能名；审查提示词含三件套判据。

## 样例来自哪里

五份 fixture 取自上游 `archify` 技能包 `examples/` 的同名样例（架构/工作流/时序/数据流/生命周期各一），
是上游实测合法、可过 `--quality showcase` 的完整 IR。它们同时被
`scripts/diagram-engine/renderers/<type>/README.md` 作为 worked example 引用。

## 上游回归集不在这里

绘图内核自带的**上游回归集**（13 个文件，含 `run-valid.mjs` 验证入口）在
`scripts/diagram-engine/test/`，因为它位置耦合（测试用 `new URL('../')` 把内核根解析为
自己所在目录的上一级，搬出即系统性失效），而且它判的是**上游行为**而非本技能的行为。

```bash
node scripts/diagram-engine/test/run-valid.mjs
```

其中的登记清单与逐条结论记录在 `scripts/diagram-engine/UPSTREAM.md`。
