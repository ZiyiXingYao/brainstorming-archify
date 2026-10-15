# diagram-engine 与上游 archify 的对应关系

本文件说明 `scripts/diagram-engine/` 这份**裁剪后的绘图内核**是从哪个上游、哪个坐标
搬来的，本次裁剪删掉了什么、改了哪些文件，哪些上游检查项被**有意排除**，以及同步上游时
怎么用 `test/run-valid.mjs` 判回归。

> 目录与文件名变更提示：内核目录原名 `design-diagrams/`，现为 `scripts/diagram-engine/`；
> 上游入口 `bin/archify.mjs` 现为 `bin/render-driver.mjs`（内部驱动），
> 本仓库新增的入口文件现为 `bin/render.mjs`（唯一对外入口）。
> 下文提到这些名字时均按此对应。

---

## 1. 基准与搬运范围

### 1.1 基准坐标

| 项 | 值 |
|---|---|
| 上游仓库 | `https://github.com/tt-a1i/archify` |
| 基准坐标 | `v3.1.0`（commit `1c2b42d660e4a7571813fb43839c79e3e9ca7720`；技能包版本 `3.1.0`，见 `skill-release.json`） |
| 发布通道 | `channel: "stable"`（上游 v3.0.0 起转稳定） |
| 稳定 tag | `v3.1.0` |
| 上一基准 | `v3.0.1`（commit `2ab3cae`） |
| 更新清单地址 | `https://tt-a1i.github.io/archify/skill-updates/archify/stable.json`（上游自托管，供运行时查更新用，**不是**本仓库的基准坐标） |

`v3.0.1 → v3.1.0` 是一次大版本：**图类型从五类扩到十类**（新增 `erd`、`class`、`tree`、
`timeline`、`waterfall`），新增 `locales/` 内置语言目录（en / zh-CN / zh-TW / es / ko，
语言从渲染器元组搬成数据），并带来 dataflow 编译器与联合标签路由、lifecycle 网格路由、
workflow 放置修复、architecture 标签与路由等大范围改动。

### 1.2 保留范围（本次裁剪后）

内核只保留「把类型化 IR 画成设计文档的图」这一条链——

- 运行期必需：`bin/`（唯一入口 `render.mjs` + 内部驱动 `render-driver.mjs`）、
  `renderers/`（**十一类**：上游十类 + 本仓库自建的 `flowchart`）、`schemas/`、
  `assets/`、`locales/`（v3.1.0 新增，查看器语言目录）、`scripts/check-render-output.mjs`
- 本仓库新增的运行期构件：`svg/`（Node 侧 CSS 抽取与主题变量解析）、
  `lib/`（图名派生 `derive-name.mjs`、两轮降级状态 `degradation.mjs`）
- 维护期工具：`scripts/generate-validators.mjs`、`scripts/generate-brand-marks.mjs`
  （两者都需 devDependencies：`npm i ajv simple-icons` 才能跑）、`brand-marks/catalog.json`
- 回归与溯源：`test/`（上游仓库根 `test/` 的整包搬运 + 本地用例，见第 3 节）、
  `UPSTREAM.md`、`LICENSE`、`THIRD_PARTY_NOTICES.md`、`package.json`、
  `package-lock.json`、`skill-release.json`

### 1.3 逐项改动（除下列改动外，与基准 tag 逐字节一致）

| 改动 | 说明 |
|---|---|
| `bin/archify.mjs` → `bin/render-driver.mjs` | 子命令分派裁到只留 `render`／`validate`／`doctor`；删除 compare、deliver、finalize、preview、migrate、inspect、check、visual-check、browser-check、guide、brands、examples、demo 的 handler 与专用 helper，并摘掉 `--repo-root` 调用（**7139 → 约 900 行**）。删除区间按行号记录于提交信息：`13-1876`、`1889-2190`、`2341-2390`、`2410-2608`、`2765-4232`、`4275-4327`、`4346-4356`、`4362-5872`、`6054-6823`。删除后另做四处收口：`TYPES` 与 `usage()`／`COMMAND_USAGE` 收到十一类与三个子命令、`rendererEnv` 去掉 `repoRoot` 参数、`commandRender`／`commandValidate` 去掉 `extractRepoRootArgs`、`commandValidate` 的 `--json` 收据去掉指向已删 `finalize` 的 `nextAction`、`commandDoctor` 去掉对已删 `examples/`／`references/`／`recipes/`／`delta/` 的检查并补回被一并删掉的 `artifactIdentity` |
| `bin/render.mjs`（本仓库新增件，唯一对外入口） | `render <type> <ir.json> <outdir>` 一次产出 `.json`／`.svg`／`.html` 三件套；`validate`／`doctor` 透传给内部驱动；并叠一层「两轮降级」判定（见 `lib/degradation.mjs`）。`TYPES` 同步扩到十一类 |
| 删除 `--repo-root` 溯源 | 删 `renderers/shared/repository-evidence.mjs`、`repository-location.mjs`；清掉 `renderers/shared/cli.mjs` 里的 `verifyRepositoryEvidence` 导入与调用，`loadDiagram` 返回值不再带 `sourceEvidence` |
| 品牌摘掉联网分支 | `renderers/shared/brand-marks.mjs` 改为**失败关闭**（706 → 195 行）：URL 字符串与 `{url,sha256}` 直接报 `brand/unsupported-url` 诊断，**渲染路径不再发起任何网络请求**；内置 canonical ID 照常解析；同文件里不可达的抓取实现（DNS 解析、固定 socket HTTP、favicon 发现、图像识别）及其 `dns`／`http`／`https`／`net`／`crypto` 导入一并删除。`COLLECTIONS` 扩到十一类 |
| **自建 `flowchart` 类型**（本仓库新增，上游没有） | 新增 `schemas/flowchart.schema.json` 与 `renderers/flowchart/render-flowchart.mjs`：自上而下的程序设计流程图——`start`／`end` 端子、`process` 处理、`decision` 判断（≥2 条带条件标签的分支）、`io` 输入输出、`loop` 循环头、`exception` 失败或回滚。回边走左走廊、跨层前向边走右走廊，横段只落在行内或行间空隙，因此不穿节点、不产生真交叉。接线点：`renderers/shared/cli.mjs` 的 `START_TYPES`／`SEMANTIC_COLLECTIONS`（`nodes`）／`RELATIONSHIP_COLLECTIONS`（`edges`）、`renderers/shared/brand-marks.mjs` 的 `COLLECTIONS`（`nodes`）、`scripts/generate-validators.mjs` 的类型表、`locales/{en,zh-CN}.json` 的 `diagram.description.flowchart` |
| `renderers/*/README.md` | 指向 `examples/*.json` 的 worked example 引用改指仓库根 `tests/fixtures/sample-*.json`（本内核未搬 `examples/`）；`timeline`／`tree`／`waterfall` 三份改为「上游样例未随本裁剪构建提供」；删除指向已删 `references/` 的链接 |
| `schemas/README.md` | 删除对已删子命令（`brands` 列举与抓取、`migrate`）与 `--repo-root` 的引用，改为裁剪后实况；上游的 npm 测试脚本改指 `npm run check:validators` |
| `package.json` / `package-lock.json` | 按裁剪后实况重写：去掉 `bin` 字段与指向仓库根 `../scripts/*` 的脚本；`scripts` 只留四个生成器脚本；`devDependencies` 只留 `ajv`／`simple-icons`（v3.1.0 起上游已不再需要 `parse5`／`saxes`） |
| **测试集改布局 + 定位适配**（v3.1.0 新增的偏离） | 上游把测试集从技能包内 `archify/test/` 移到**仓库根 `test/`**，且导入路径从 `../renderers/…` 变成 `../archify/renderers/…`。本内核仍要求测试留在内核目录内，因此对搬入的测试文件做三类**定位改写**（断言逻辑一字未改）：① import 说明符前缀 `'../archify/` → `'../`（含 helpers 里的 `'../../archify/`，共 138 个文件 / 218 处）；② 包根解析 `path.resolve(…, '..', 'archify')` → `path.resolve(…, '..')`（含 `'..', 'archify',` 形式）；③ 入口名 `'archify.mjs'`／`'bin/archify.mjs'`／`'../bin/archify.mjs'` → `render-driver.mjs`（三类合计 202 个文件 / 271 处）。改写后逐文件重测，全绿者入 `UPSTREAM_VALID`（见第 3 节） |
| `test/run-valid.mjs` | 白名单按 3.1.0 实测重写（见第 3 节）；文件头注释同步到新路径与新基准 |

### 1.4 本次裁剪删除（上游技能包里有、本内核不要的）

`SKILL.md`（其绘图相关约定已并入 `skill/SKILL.md` 的绘图 Gate 章节）、`examples/`、
`references/`、`migrations/`、`delta/`、`recipes/`、`brand-marks/` 下除 `catalog.json`
外的内容、`bin/` 下除 `archify.mjs` 外的全部入口（`preview.mjs`、`visual-check.mjs`、
`open-artifact.mjs`、`finalize.mjs`、`delivery-update.mjs`、`recover-output.mjs`），
以及 `scripts/` 中只服务已删子命令的构建工具（`check-update.mjs`、`render-examples.mjs`、
`delivery-update-child.mjs`、`update-contract.mjs`）。

**未搬入**（上游仓库根级别、本内核运行时不需要的内容）：仓库根 `scripts/`、`viewer/`、
`docs/`、`website/`、仓库根 `examples/`（**注意**：与技能包自带的 `archify/examples/` 是两个
不同目录）、`benchmarks/`、`experiments/`、`generated/`、`integrations/`、`community/`、
`journal/`、`tools/`、`.github/`、`.gitattributes`、`README*.md`、`CONTRIBUTING.md`、
`archify.zip`、`package.json`（仓库根）等。其中 `viewer/` 是交互查看器的**构建源码**，
其构建产物已内联进 `assets/template.html`（完全自包含），运行时不需要 `viewer/`。

### 1.5 跨仓库的既有差异（v3.1.0 起）

上游 v3.1.0 的 `lifecycle` schema **只接受 `schema_version: 3`**（v3.0.1 还接受 1 与 2）。
本内核照搬该约束，因此仓库根 `tests/fixtures/sample-lifecycle.json` 已换成上游 v3 样例。
**这条与 `skill/SKILL.md` 里「新图用 `schema_version: 2`」的旧表述冲突**，属于变更 B
（图类型与章节绑定）的待办，本变更只负责让内核与文档口径一致。

---

## 2. 许可证归属

- **Archify 本体**：MIT。版权方为 `Copyright (c) 2026 tt-a1i (Archify)` 与
  `Copyright (c) 2025 Cocoon AI`，全文见本目录 `LICENSE`。
- **第三方商标与图标**：归属与许可记录见本目录 `THIRD_PARTY_NOTICES.md`。
- **内联字体 JetBrains Mono**：SIL Open Font License 1.1。完整授权文本随包存放在
  `assets/JetBrainsMono-OFL.txt`。
- 本仓库对以上内容只做搬运，不新增任何许可或权利主张。自建的 `flowchart`
  渲染器与 schema 同样是 MIT（本仓库），不改变上游版权归属。

---

## 3. 测试集现状与验证入口

`test/` 的来源是上游**仓库根** `test/` 的整包搬运（v3.1.0 起上游把测试集从技能包内
移到仓库根），本仓库在此基础上做了两件事：① 第 1.3 节的**定位改写**（包根、import
前缀、入口名）；② 按「裁剪后成立」逐文件串行实测筛选——对上游 212 个 `*.test.mjs`
每个单独跑 `node --test --test-reporter=tap <file>`，**退出码 0 且 pass>0** 者才进入
`run-valid.mjs` 的 `UPSTREAM_VALID` 清单；其余按成因登记在第 4 节，**文件留在盘上**
（不再删除），入口只在末尾以 drift 提示列出。

**它必须留在内核目录内，不能搬到仓库根的 `tests/`**：该套件按本内核的相对布局解析路径，
搬到 `tests/upstream/` 后系统性失效；仓库根的 `tests/` 因此只放本技能自己的测试面
（冒烟测试 + fixtures + README）。

### 裁剪后的实况

| 项 | 数量 |
|---|---|
| 上游 `*.test.mjs` 实测总数 | 212 |
| 实测退出码 0 且 pass>0 → 进入 `UPSTREAM_VALID` | 48 |
| 本地新增用例 → 进入 `LOCAL_TESTS` | 6 |
| 入口实际执行（`VALID_TESTS`） | 54 个文件 |
| 按成因未登记的上游用例 | 164 |

本地 6 个用例：`svg-css-extract`（CSS 抽取器，含金样 `svg-css-extract.golden.json`）、
`svg-theme-vars`（主题变量解析）、`derive-name`（图名派生）、`cli-surface`（驱动 CLI 面）、
`doctor`（环境自检）、`brand-marks`（品牌边界：内置 ID 可解析、URL 与摘要固定对象失败
关闭且不联网）。它们随上游模板/行为变化时按失败信息重签——**内核内的 `svg/` 只有抽取器，
没有重签脚本**，金样按测试失败信息重算。

### 验证入口

```
node scripts/diagram-engine/test/run-valid.mjs
```

- 一条命令跑完；退出码 `0` = 清单内全部通过，非 0 = 有文件失败。
- 只跑显式清单里的文件，**不使用通配**——通配会把上游以后新增的、或本内核环境下必红的
  文件悄悄拉进来，让「全绿」这个信号失真。
- 不读取也不安装 `node_modules`（只用 Node 内置模块）。
- 输出给出「跑了几个文件 / 通过多少 / 失败多少」与用例级统计，失败时点名文件并给出首条错误，
  末尾以 drift 提示列出未登记的 `*.test.mjs`。
- **以后新增能力的用例怎么加**：在本目录新建 `xxx.test.mjs`，把文件名加进 `run-valid.mjs`
  的 `LOCAL_TESTS` 数组即可。两个数组的边界与 drift 机制见该文件头部注释。
- **改动裁剪范围后必须重跑重测**：`UPSTREAM_VALID` 是「实测全绿」的清单，不是愿望清单。

**本技能自己的测试面在仓库根 `tests/`**（十一类图 fixture + 冒烟测试 + 文档一致性 +
安装器），与上游回归集分工：前者判「本内核能不能出图」，后者判「同步上游时既有行为有没有
被破坏」。

---

## 4. 被排除的上游检查项（按成因分组）

下面每一组都给出：**哪些文件被排除**、**它们依赖了什么被剔除的东西**、**为什么在本仓库
不成立**。判定口径是「本仓库缺什么」，所以当你想知道「我这次改动该不该担心这些红灯」时，
先看红灯是否落在某一组的成因上——若是，它与你的改动无关。

### 组 A：依赖已删入口 / 子命令

被测对象是本次按设计砍掉的子命令（`bin/render-driver.mjs` 的多路分派、`preview.mjs`、
`visual-check.mjs`、`finalize.mjs`、`delivery-update.mjs`、`recover-output.mjs`、
`migrate`、`guide`、`brands`、`examples`、`demo`）。
报错形态：`Cannot find module '…/bin/archify.mjs'` 或子命令被拒。

**为什么不成立**：本内核只保留 `render`／`validate`／`doctor`，其余子命令的 handler 与
helper 已整体删除；改技能出图行为不可能让它们转绿。

### 组 B：依赖已删样例目录 `examples/`

顶层模块直接 `readFileSync('…/examples/*.json')` 或 spawn 渲染样例。
报错形态：`ENOENT …/examples/*.json`。

**为什么不成立**：`examples/` 已按裁剪要求删除；需要样例时改由仓库根 `tests/fixtures/` 承担。

### 组 C：依赖已删上游文档 `SKILL.md` / `references/` / `recipes/` / `delta/`

对上游技能入口文档 `SKILL.md`、`references/*.md`、`recipes/scenarios.mjs` 或
`delta/architecture-delta.mjs`（compare 专用）做内容断言或直接读取。
报错形态：`ENOENT …/SKILL.md` 或 `ENOENT …/references/*.md`。

**为什么不成立**：这些内容已删除；绘图约定并入本仓库 `skill/SKILL.md`，内容约定与上游
原版完全不同。

### 组 D：依赖未安装的 devDependencies

上游把这些列为 `package.json` 的 `devDependencies`；本仓库**不安装 `node_modules`**（硬约束），
因此凡 `import 'parse5'` / `require('ajv')` / `saxes` / `skills` / `yaml` 的路径在加载期就
`ERR_MODULE_NOT_FOUND`。

**为什么不成立**：这些包只服务于**测试期**（HTML/XML 解析、schema 校验）。技能运行时不需要
它们——`doctor` 与十一类图渲染在无 `node_modules` 时都能跑通。若以后放宽该硬约束，这些文件
会变成候选回填项；在当前硬约束下它们是**结构性必红**。

### 组 E：依赖未搬入的上游仓库根构建 / CI / 发布 / 站点 / 文档

检查的是**上游仓库自身**的工程脚手架（提交范围、打包清洗、发布身份、站点构建、README 展示、
基准测试），import / spawn 仓库根的 `scripts/`、`viewer/`、`docs/`、`benchmarks/`、
`.github/`、`.gitattributes`、`README*.md`——这些目录按第 1.4 节被有意排除。

**为什么不成立**：本仓库只是把技能包搬进来，既不拥有上游仓库根的这些工具，也没有对应物。

### 组 F：品牌联网抓取能力被移除

对品牌 URL 抓取、DNS 私网探测、内容编码、favicon 发现、图像识别等**联网抓取**能力做断言。
报错形态：运行时断言失败（本内核的品牌解析已收窄为「只认内置 canonical ID、不联网」）。

**为什么不成立**：这条能力随 `--repo-root` 一并剪除。安全上这是有意为之（渲染路径零网络
请求），`brand-marks.test.mjs`（本地）正是守住这条边界的看门人。

### 组 G：本机没有浏览器

查看器交互、真实浏览器可读性、WebM 录制类用例（`*-browser.test.mjs`、`adaptive-reader-layout`、
`chrome-pipe-transport` 等）需要无头浏览器，本机没有。

**为什么不成立**：本机无浏览器，这类用例无法在本内核的回归入口里判定；静态证据由
`tests/render.smoke.test.mjs`（断言产物 HTML 含内联查看器代码）承担。

---

## 5. 怎么用这套东西判回归

### 5.1 同步上游新版本

1. **取新基准**：优先取上游稳定 tag（`stable` 通道）；若仍无稳定 tag，则锁定一个新的 commit SHA
   （不要用 `latest` 或分支名）。
2. **逐字节替换已搬入目录**：按第 1.2 节的搬入范围，从新基准重新搬运并逐字节核验
   （`diff -r` / `cmp`）。**替换 `test/` 时要保住本仓库新增的 `scripts/diagram-engine/test/run-valid.mjs`
   与本地用例**（`svg-css-extract`、`svg-theme-vars`、`derive-name`、`cli-surface`、`doctor`、
   `brand-marks` 及 `svg-css-extract.golden.json`）；直接 `rm -rf test/` 再 `cp -R` 会把它们删掉。
3. **重放本次裁剪改动**：按第 1.3 节的改动表逐条把裁剪改动施加到新搬入的代码上——
   入口裁子命令与删除区间、删 `--repo-root`、品牌失败关闭、自建 `flowchart` 的接线点
   （`cli.mjs` 三张表、`brand-marks.mjs` 的 `COLLECTIONS`、`generate-validators.mjs` 类型表、
   `locales/*.json` 描述键）、README 引用改指 fixtures、`schemas/README.md` 去已删能力、
   `package.json`／`lock` 重写、测试集的**三类定位改写**。
4. **先跑入口**：`node scripts/diagram-engine/test/run-valid.mjs`——**应当全绿、退出码 0**。
   如果红了，先按 5.2 归类：清单内文件变红 = 真回归；清单外的新漂移 = 先归属再决定。
5. **重新做一次逐文件测量并更新清单**（必须**串行逐文件**，在技能源码树根执行）：
   ```bash
   for f in scripts/diagram-engine/test/*.test.mjs; do
     out=$(node --test --test-reporter=tap "$f" 2>&1); status=$?
     p=$(printf '%s\n' "$out" | sed -n 's/^# pass \([0-9]\+\)$/\1/p')
     fl=$(printf '%s\n' "$out" | sed -n 's/^# fail \([0-9]\+\)$/\1/p')
     printf '%s|%s|pass=%s|fail=%s\n' "$status" "$f" "${p:-0}" "${fl:-0}"
   done | sort -k2
   ```
   退出码 0 且 `pass>0` 的行 → 新的 `UPSTREAM_VALID` 清单（替换 `run-valid.mjs` 里的数组，保持顺序）；
   其余行 → 逐条复核它属于第 4 节哪一组，**同步更新第 4 节与本节基准表**。
6. **重建校验器**：`cd scripts/diagram-engine && npm ci && node scripts/generate-validators.mjs && rm -rf node_modules`
   （自建类型与 schema 变更后必须重跑，否则 `doctor` 的 validators 一项会红）。
7. 更新第 1 节的基准坐标 / 版本，并在提交信息里写明新旧基准。

### 5.2 哪些红灯「上游本就会失败」，不能当回归

判据：**红灯文件落在第 4 节 A–G 任一组，且报错仍是同一类缺失**（缺已删入口 / `examples/` /
`SKILL.md` / `references/`、缺仓库根脚手架、缺 `node_modules`、无浏览器、或品牌抓取被移除）
——这就是裁剪造成的，**与你的改动无关，不当回归**。

反过来，下面几种红灯**必须查**：

- 红的是 `run-valid.mjs` 清单里的文件之一 → **真回归**，入口会直接报 exit 非 0。
- 第 4 节文件里出现了**新的错误类型**：例如组 A/B/C/E 的文件本来只是「缺件」类报错
  （`ENOENT …` / `Cannot find module …`），现在却报运行时断言失败 → 很可能是新回归，要查。
- 上游新增的测试文件（会出现在 `run-valid.mjs` 的 drift 提示里）：先归属——属于 A–G 组就更新
  第 4 节；不属于则必须逐文件实测，**全绿才加入清单**，有真实失败要查。
- 你这次改动恰好动了「部分通过」文件所覆盖的能力 → 入口**不会**跑这些文件，需要手工单跑确认。

### 5.3 已知限制

1. **覆盖缺口——整文件粒度带来的「连坐」**：入口按文件登记，凡文件里混有不成立的断言，整文件都
   不跑。上游文件一个字都不能改（硬约束，第 1.3 节的定位改写是唯一例外，且只改路径与入口名），
   所以**不能**靠删断言把它们救回来；回填办法见第 6 节。
2. **「全绿」不等于覆盖了浏览器行为**：本机没有任何浏览器，浏览器交互类用例整体跳过。
   入口不登记它们（跳过计数会破坏「0 跳过」口径），真回归靠本入口**测不出来**。
3. **耗时**：逐文件串行跑 54 个文件约 1–3 秒到数十秒不等（实测整轮约 3 分钟）；
   重测上游整包（212 文件）约 3–4 分钟。这是换取确定性的代价。

---

## 6. 未决点（需要人裁量，不由实现者拍板）

1. **是否回填「部分通过」文件的运行时用例**：上游文件不可改，只能整文件排除或改用
   `--test-name-pattern` 精确选取（后者对上游改名脆弱）。当前决定是**整文件排除 + 本文档登记缺口**。
2. **是否允许安装 devDependencies 以回填组 D 的文件**：当前硬约束是「不得安装 `node_modules`」，
   所以组 D 结构性必红。若以后放宽，需重新评估。
3. **是否在本仓库补 `.gitattributes`**：那只是为了满足上游仓库自身的气泡统计 / 行尾配置，
   对技能运行价值低，当前不做。
4. **浏览器交互行为没有自动化验证**：本机无浏览器，查看器的拖拽/缩放/搜索/导出/深链接等仍然
   **没有自动化测试**。要做行为验证需要引入无头浏览器，不在当前范围。
5. **`viewer/` 未搬入**：交互查看器的构建源码在上游仓库根，本内核只带其构建产物
   `assets/template.html`。将来要改查看器交互，必须回上游改源码后重新构建再搬入。
6. **自建 `flowchart` 的长期维护**：它没有上游对应物，每次同步上游都要按第 5.1 节第 3 步
   重新接线。若将来上游补上同义类型，需评估改用上游实现。

