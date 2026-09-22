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
├── install.test.mjs              安装脚本：版本硬门 / 备份与备份冲突守卫 / 平铺与整目录规则 / 装后 doctor / 用法错误
├── doc-consistency.test.mjs      文档一致性：SKILL.md 关键约定、模板配图章节、旧技能名残留、状态取值单一权威、内核文档无已删命令
├── engine.test.mjs               把内核回归集接进本入口：唤起 scripts/diagram-engine/test/run-valid.mjs 并断言全过
└── README.md                     本文件
```

## 怎么跑

```bash
# 全部：一条命令覆盖「仓库测试 + 绘图内核回归集」
node --test tests/*.test.mjs
# → 40 个用例，0 失败（含 engine.test.mjs 唤起的内核 13 文件 / 241 用例）

# 只跑冒烟（独立脚本）
node tests/render.smoke.test.mjs
```

**目标是「跑根目录测试就等于跑全部测试」**，所以引擎回归集由 `engine.test.mjs` 在根入口里唤起——
但它**不搬家**，因为它位置耦合（见下）。

**不需要安装任何依赖**：只用 Node 内置模块与原生 `assert`。
产物与临时目录都写在系统临时目录，用完即删，不污染仓库，也不触碰 `~/.codebuddy`。

## 各文件断言什么

### `render.smoke.test.mjs`（独立脚本，退出码 0 = 全过）

对 `fixtures/` 下五份样例逐个调用内核唯一入口
`node scripts/diagram-engine/bin/render.mjs render <type> <ir.json> <outdir>`，断言：

1. 三件套齐备：`<basename>.json` / `.svg` / `.html`；
2. 三件都非空；
3. `.json` 与输入 IR **逐字节一致**（契约：源 IR 原样落盘）；
4. `.svg` 含 `<svg` 根元素；
5. `.html` 含查看器代码标记（`data-quality-profile` 与 `syncFromHash`）。

### `render.entry.test.mjs`（`node:test`）

入口的**契约与边界**，补冒烟测试没有覆盖的部分：`validate` / `doctor` 透传；参数个数错误退出码 2；
非法 IR 非零退出且目标目录不新增任何产物；**失败时既有同名文件不被覆盖、不残留 staging/backup 目录**；
成功路径不留残留；`<basename>.json` 与输入 IR 同路径时允许；**两轮降级**——同一目标连续两次未改善以退出码 3 停下。

### `install.test.mjs`（`node:test`）

安装脚本的四道行为约束逐条锁死：版本硬门（Node < 18 → 退出码 1 且**一个文件都不写**）；
`--dry-run` 不落盘；实装形态（`skill/` 平铺 + `templates/` 与 `scripts/` 整目录 + 内核入口存在 +
**`tests/`、内核回归集与 `sync-upstream.sh` 都不进安装**）；目标已存在时产出
`brainstorming.bak-<时间戳>` 且既有内容完整保留，**备份目标已被占用时拒绝静默覆盖**；
装后自检输出（断言里带检查项数，避免自检判定退化后用例仍绿）；已安装副本可独立跑 `doctor`；
用法错误退出码 2。

### `doc-consistency.test.mjs`（`node:test`）

机械看门人：`skill/SKILL.md` 必须含绘图规划 Gate、三件套、落点 `specs/design/diagrams/`、
命名 `<document number>-<diagram name>`、交互版链接行、主节点上限、showcase、修复顺序、间距公式、
品牌仅内置 ID，**自审恰为 15 项**，**修复顺序恰为 ①–⑥ 且 ⑤ 是标签超宽档**，
且不含 `design-diagrams` 与 `--repo-root`；
两份配图模板含三件套与两行引用，接口契约模板保持「不配图」口径；
`skill/` 与 `templates/` 无旧技能名残留；README 只允许历史条目提及旧技能名；审查提示词含三件套判据。

另有三组机械门，分别对应三类「改了一处、漏了另一处」：

① **状态取值单一权威**——四档取值与 `详见` 列的 `待调用方落盘` 标记只在架构模板第 7 节定义一次，
   其余三份文件必须出现指向第 7 节的引用。断言边界：它证明「权威块齐全 + 每份文件都有引用」，
   **不能**证明「每一处提及都带了引用」——那要靠人读。
② **内核非测试文档**（`scripts/diagram-engine/**`，跳过 `test/` 与 `node_modules/`）不得再把
   `archify brands` / `archify migrate` / `archify compare` / `archify validate` / `npm test`
   写成现行能力——`schemas/README.md` 曾四处这么写，而 `skill/`、`templates/` 有看门人、它没有。
③ **brand-marks 源码**不得残留联网抓取实现（`node:http` / `node:https` / `node:dns` / `node:net`
   或 `node:crypto` 导入、全局 `fetch()` / `XMLHttpRequest`、`checkedFetch`、`captureRemoteBrand`、
   `captureBrandReference`、私有地址守卫、抓取超时环境变量）。

## 样例来自哪里

五份 fixture 取自上游 `archify` 技能包 `examples/` 的同名样例（架构/工作流/时序/数据流/生命周期各一），
是上游实测合法、可过 `--quality showcase` 的完整 IR。它们同时被
`scripts/diagram-engine/renderers/<type>/README.md` 作为 worked example 引用。

## 上游回归集不在这里（但根入口会跑到它）

绘图内核自带的**上游回归集**（13 个文件，含 `run-valid.mjs` 验证入口）在
`scripts/diagram-engine/test/`。

**为什么不搬过来**：那 13 个用例都用「自己所在目录的上一级」当内核根
（`from '../renderers/…'`、`path.join(HERE, '..', …)`、`new URL('../…')` 三种写法之一），
搬出内核即系统性失效——此前把整包搬到 `tests/upstream/` 时**实测 85 个文件全红**。

**那么怎么保证不漏**：由本目录的 `engine.test.mjs` 在根入口里**唤起**它，并断言
①退出码 0、②文件级与用例级都「跑到的全部通过、0 失败 0 跳过」、③登记数不低于下限
（防止清单被清空后「空跑也算绿」）。所以跑 `node --test tests/*.test.mjs` 就等于跑全部。

单独跑它也可以：

```bash
node scripts/diagram-engine/test/run-valid.mjs
```

其中的登记清单与逐条结论记录在 `scripts/diagram-engine/UPSTREAM.md`。

> 一个实现细节：`engine.test.mjs` 唤起子进程时**剥掉了 `NODE_TEST_CONTEXT`**。
> 因为 `run-valid.mjs` 见到该变量（说明自己是被 `node --test` 发现的）会做防递归跳过，
> 否则根入口里那次唤起会变成「空跑」——正是该文件要防的静默失效。
