# tests —— 测试目录

本目录只放 `codebuddy-brainstorming` 自己的测试面：**绘图内核的冒烟测试**。

## 目录

```
tests/
├── fixtures/                     五类图各一份样例 IR（合法、可直接渲染）
│   ├── sample-architecture.json
│   ├── sample-workflow.json
│   ├── sample-sequence.json
│   ├── sample-dataflow.json
│   └── sample-lifecycle.json
├── render.smoke.test.mjs         冒烟测试：渲染五类图，校验三件套
└── README.md                     本文件
```

## 怎么跑

```bash
node tests/render.smoke.test.mjs
```

**不需要安装任何依赖**：只用 Node 内置模块与原生 `assert`。

退出码：`0` = 五个用例全部通过；`1` = 有用例失败。

## 冒烟测试断言什么

对 `fixtures/` 下五份样例逐个调用内核唯一入口

```bash
node scripts/diagram-engine/bin/render.mjs render <type> <ir.json> <outdir>
```

然后断言：

1. 三件套全部生成：`<basename>.json`、`<basename>.svg`、`<basename>.html`；
2. 三件都非空；
3. `.svg` 含 `<svg` 根元素；
4. `.html` 含查看器代码标记（`data-quality-profile` 产物标记与 `syncFromHash`
   内联查看器运行时）。

产物写在系统临时目录，用完即删，不污染仓库。

## 样例来自哪里

五份 fixture 取自上游 `archify` 技能包 `examples/` 的同名样例（架构/工作流/时序/数据流/
生命周期各一），是上游实测合法、可过 `--quality showcase` 的完整 IR。它们同时被
`renderers/<type>/README.md` 作为 worked example 引用。

## 上游回归集不在这里

绘图内核自带的**上游测试集**（约 128 个文件，含 `run-valid.mjs` 验证入口）留在
`scripts/diagram-engine/test/`，原因有两条：

1. **位置耦合**：该套件的测试用 `new URL('../', import.meta.url)` 把内核根解析为
   *自己所在目录的上一级*，必须与内核同处一层，搬出即系统性失效；
2. **它判的是上游行为，不是本技能的行为**：它用于同步上游版本时判回归，
   详见 `scripts/diagram-engine/UPSTREAM.md`。

跑它：

```bash
node scripts/diagram-engine/test/run-valid.mjs
```

其中的排除/纳入清单与逐文件结论记录在 `scripts/diagram-engine/UPSTREAM.md`。
