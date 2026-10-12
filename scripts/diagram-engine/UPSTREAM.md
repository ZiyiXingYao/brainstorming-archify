# diagram-engine 与上游 archify 的对应关系

本文件说明 `scripts/diagram-engine/` 这份**裁剪后的绘图内核**是从哪个上游、哪个坐标
搬来的，本次裁剪删掉了什么、改了哪些文件，哪些上游检查项被**有意排除**，以及同步上游时
怎么用 `test/run-valid.mjs` 判回归。

> 目录与文件名变更提示：内核目录原名 `design-diagrams/`，现为 `scripts/diagram-engine/`；
> 上游入口 `bin/archify.mjs` 现为 `bin/render-driver.mjs`（内部驱动），
> 本仓库新增的入口文件现为 `bin/render.mjs`（唯一对外入口）。
> 下文提到这些名字时均按此对应。

---

## 1. 基准（按 tag + commit 固定）

| 项 | 值 |
|---|---|
| 上游仓库 | `https://github.com/tt-a1i/archify` |
| 基准坐标 | `v3.0.1`（commit `2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c`；技能包版本 `3.0.1`，见 `skill-release.json`） |
| 发布通道 | `channel: "stable"` |
| 稳定 tag | `v3.0.1` |
| 更新清单地址 | `https://tt-a1i.github.io/archify/skill-updates/archify/stable.json`（上游自托管，供运行时查更新用，**不是**本仓库的基准坐标） |

**基准为什么钉在 `v3.0.1` 这个 tag 上**：上游已从 `development` 通道转到 `stable`，并发布了
稳定 tag `v3.0.1`。本仓库搬运时所用的技能包子树（`renderers/`、`schemas/`、`assets/`、
`scripts/`、`bin/archify.mjs` 等运行期文件）在该 tag 与其后 HEAD（`58ab0b98`）之间**逐字节一致**
（差异只在仓库根的 `SKILL.md`、`package.json`／`package-lock.json` 与 `test/`）；因此基准坐标
取稳定 tag `v3.0.1`，同步时按它比对。

**保留范围（本次裁剪后）**：内核只保留「把类型化 IR 画成设计文档的图」这一条链——

- 运行期必需：`bin/`（唯一入口 `render.mjs` + 内部驱动 `render-driver.mjs`）、
  `renderers/`、`schemas/`、`assets/`、`scripts/check-render-output.mjs`
- 本仓库新增的运行期构件：`svg/`（Node 侧 CSS 抽取与主题变量解析）、
  `lib/`（图名派生 `derive-name.mjs`、两轮降级状态 `degradation.mjs`）
- 维护期工具：`scripts/generate-validators.mjs`、`scripts/generate-brand-marks.mjs`
  （两者都需 devDependencies：`npm i ajv simple-icons` 才能跑；它们保证 `schemas/` 与运行期
  真正使用的 `renderers/shared/generated-validators.mjs` 不漂移、以及品牌目录可重建）、
  `brand-marks/catalog.json`
- 回归与溯源：`test/`（上游回归集，见第 3 节）、`UPSTREAM.md`、`LICENSE`、
  `THIRD_PARTY_NOTICES.md`、`package.json`、`package-lock.json`、`skill-release.json`

以上内容**除下列改动外**与基准 tag 逐字节一致：

| 改动 | 说明 |
|---|---|
| `bin/archify.mjs` → `bin/render-driver.mjs` | 子命令分派裁到只留 `render`／`validate`／`doctor`；删除投递、比对、终结、预览、浏览器校验、品牌列举、迁移等全部 handler 及其专用 helper，并摘掉 `--repo-root` 相关调用（**6936 → 562 行**） |
| `bin/render.mjs`（本仓库新增件，唯一对外入口） | `render <type> <ir.json> <outdir>` 一次产出 `.json`／`.svg`／`.html` 三件套；`validate`／`doctor` 透传给内部驱动；并叠一层「两轮降级」判定（见 `lib/degradation.mjs`） |
| 删除 `--repo-root` 溯源 | 删 `renderers/shared/repository-evidence.mjs`、`repository-location.mjs`；清掉 `renderers/shared/cli.mjs` 里的 `verifyRepositoryEvidence` 导入与调用，`loadDiagram` 返回值不再带 `sourceEvidence` |
| 品牌摘掉联网分支 | `renderers/shared/brand-marks.mjs` 改为**失败关闭**：URL 字符串与 `{url,sha256}` 直接报 `brand/unsupported-url` 诊断，**渲染路径不再发起任何网络请求**；内置 canonical ID 照常解析；同文件里不可达的抓取实现（DNS 解析、固定 socket HTTP、favicon 发现、图像识别）及其 `dns`／`http`／`https`／`net`／`crypto` 导入一并删除 |
| `renderers/*/README.md` | 指向 `examples/*.json` 的 worked example 引用改指 `tests/fixtures/sample-*.json`；删除指向已删 `references/` 的链接 |
| `schemas/README.md` | 删除对已删子命令（品牌列举、schema 迁移）与 `--repo-root` 的引用，改为裁剪后实况；上游的 `npm` 测试脚本改指 `npm run check:validators`／`check:brand-marks` |
| `package.json` / `package-lock.json` | 按裁剪后实况重写：去掉 `bin` 字段；`scripts` 只留四个生成器脚本；`devDependencies` 只留 `ajv`／`parse5`／`saxes`／`simple-icons` |
| `test/run-valid.mjs` | 白名单按 3.0.1 实测重写（见第 3 节） |

**本次裁剪删除**（上游技能包里有、本内核不要的）：`SKILL.md`（其绘图相关约定已并入
`skill/SKILL.md` 的绘图 Gate 章节）、`examples/`、`references/`、`migrations/`、`delta/`、
`recipes/`、`brand-marks/` 下除 `catalog.json` 外的内容、`bin/preview.mjs`、
`bin/visual-check.mjs`、`bin/open-artifact.mjs`、`bin/finalize.mjs`、`bin/delivery-update.mjs`、
`bin/recover-output.mjs`，以及 `scripts/` 中的 `check-update.mjs`、`render-examples.mjs`、
`delivery-update-child.mjs` 等只服务已删子命令的构建工具；`test/` 中只服务已删用例的
`helpers/` 与 `fixtures/` 也已删除（只保留被保留用例真正读取到的那一个 fixture 文件）。

**未搬入**（上游仓库根级别、本内核运行时不需要的内容）：仓库根 `scripts/`、`viewer/`、
`docs/`、`website/`、仓库根 `examples/`（**注意**：与技能包自带的 `archify/examples/` 是两个
不同目录，前者未搬、后者已搬且现已删除）、`benchmarks/`、`experiments/`、`generated/`、
`integrations/`、`community/`、`journal/`、`tools/`、`.github/`、`.gitattributes`、
`README*.md`、`CONTRIBUTING.md`、`archify.zip` 等。其中 `viewer/` 是交互查看器的**构建源码**，
其构建产物已内联进 `assets/template.html`（完全自包含），运行时不需要 `viewer/`。

---

## 2. 许可证归属

- **Archify 本体**：MIT。版权方为 `Copyright (c) 2026 tt-a1i (Archify)` 与
  `Copyright (c) 2025 Cocoon AI`，全文见本目录 `LICENSE`。
- **第三方商标与图标**：归属与许可记录见本目录 `THIRD_PARTY_NOTICES.md`。
- **内联字体 JetBrains Mono**：SIL Open Font License 1.1。完整授权文本随包存放在
  `assets/JetBrainsMono-OFL.txt`。
- 本仓库对以上内容只做搬运，不新增任何许可或权利主张。

---

## 3. 测试集现状与验证入口

`test/` 的来源是上游 `archify/test/` 的**整包搬运**，本仓库在此基础上按「裁剪后成立」重做了一次
**逐文件串行实测筛选**：对上游 165 个 `*.test.mjs` 每个单独跑
`node --test --test-reporter=tap <file>`，**退出码 0 且确有用例通过**者才进入
`run-valid.mjs` 的 `UPSTREAM_VALID` 清单；其余按成因删除（见第 4 节）。

**它必须留在内核目录内，不能搬到仓库根的 `tests/`**：该套件的测试把内核根解析为
*自己所在目录的上一级*。搬到 `tests/upstream/` 后内核根会解析成 `tests/`，系统性失效；
搬回 `scripts/diagram-engine/test/` 即恢复。仓库根的 `tests/` 因此只放本技能自己的测试面
（冒烟测试 + fixtures + README）。

### 裁剪后的实况

| 项 | 数量 |
|---|---|
| 上游 `*.test.mjs` 实测总数 | 165 |
| 实测退出码 0 且有用例通过 → 进入 `UPSTREAM_VALID` | 18 |
| 本地新增用例 → 进入 `LOCAL_TESTS` | 6 |
| 入口实际执行（`VALID_TESTS`） | 24 个文件 / **360 个用例** |
| 按成因删除的上游用例 | 146 |

本地 6 个用例：`svg-css-extract`（CSS 抽取器）、`svg-theme-vars`（主题变量解析）、
`derive-name`（图名派生）、`cli-surface`（驱动 CLI 面）、`doctor`（环境自检）、
`brand-marks`（品牌边界：内置 ID 可解析、URL 与摘要固定对象失败关闭且不联网）。
它们随上游模板/行为变化时按失败信息重签（`svg-css-extract.golden.json` 是其中的金样数据文件）。

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

**本技能自己的测试面在仓库根 `tests/`**（五类图 fixture + 冒烟测试 + 文档一致性 + 安装器），
与上游回归集分工：前者判「本内核能不能出图」，后者判「同步上游时既有行为有没有被破坏」。

---

## 4. 被排除的上游检查项（按成因分组）

下面每一组都给出：**哪些文件被排除**、**它们依赖了什么被剔除的东西**、**为什么在本仓库
不成立**。判定口径是「本仓库缺什么」，所以当你想知道「我这次改动该不该担心这些红灯」时，
先看红灯是否落在某一组的成因上——若是，它与你的改动无关。

### 组 A：依赖已删入口 / 子命令

被测对象是本次按设计砍掉的子命令（`bin/archify.mjs` 的多路分派、`preview.mjs`、
`visual-check.mjs`、`finalize.mjs`、`delivery-update.mjs`、`recover-output.mjs`）。
报错形态：`Cannot find module '…/bin/archify.mjs'`（或 `preview.mjs` / `recover-output.mjs` 等）。

**为什么不成立**：本内核只保留 `render`／`validate`／`doctor`，其余子命令的 handler 与
helper 已整体删除；改技能出图行为不可能让它们转绿。

### 组 B：依赖已删样例目录 `examples/`

顶层模块直接 `readFileSync('…/examples/*.json')` 或 spawn 渲染样例。
报错形态：`ENOENT …/examples/*.json`。

**为什么不成立**：`examples/` 已按裁剪要求删除；需要样例时改由仓库根 `tests/fixtures/` 承担。

### 组 C：依赖已删上游文档 `SKILL.md` / `references/`

对上游技能入口文档 `SKILL.md` 或 `references/*.md` 做内容断言或直接读取。
报错形态：`ENOENT …/SKILL.md` 或 `ENOENT …/references/*.md`。

**为什么不成立**：上游 `SKILL.md` 与 `references/` 已删除；绘图约定并入本仓库
`skill/SKILL.md`，内容约定与上游原版完全不同。

### 组 D：依赖未安装的 devDependencies

上游把这些列为 `package.json` 的 `devDependencies`；本仓库**不安装 `node_modules`**（硬约束），
因此凡 `import 'parse5'` / `require('ajv')` / `saxes` 的路径在加载期就
`ERR_MODULE_NOT_FOUND`。

**为什么不成立**：这些包只服务于**测试期**（HTML/XML 解析、schema 校验）。技能运行时不需要它们——
`doctor` 与五类图渲染在无 `node_modules` 时都能跑通。若以后放宽该硬约束，这些文件会变成候选回填项；
在当前硬约束下它们是**结构性必红**。

### 组 E：依赖未搬入的上游仓库根构建 / CI / 发布 / 站点 / 文档

检查的是**上游仓库自身**的工程脚手架（提交范围、打包清洗、发布身份、站点构建、README 展示、
基准测试），import / spawn 仓库根的 `scripts/`、`viewer/`、`docs/`、`benchmarks/`、
`.github/`、`.gitattributes`、`README*.md`——这些目录按第 1 节被有意排除。

**为什么不成立**：本仓库只是把技能包搬进来，既不拥有上游仓库根的这些工具，也没有对应物。

### 组 F：品牌联网抓取能力被移除

对品牌 URL 抓取、DNS 私网探测、内容编码、图像识别等**联网抓取**能力做断言。
报错形态：运行时断言失败（本内核的品牌解析已收窄为「只认内置 canonical ID、不联网」）。

**为什么不成立**：这条能力随 `--repo-root` 一并剪除。安全上这是有意为之（渲染路径零网络请求），
`brand-marks.test.mjs`（本地）正是守住这条边界的看门人。

---

## 5. 怎么用这套东西判回归

### 5.1 同步上游新版本

1. **取新基准**：优先取上游稳定 tag（`stable` 通道）；若仍无稳定 tag，则锁定一个新的 commit SHA
   （不要用 `latest` 或分支名）。
2. **逐字节替换已搬入目录**：按第 1 节的搬入范围，从新基准重新搬运并逐字节核验
   （`diff -r` / `cmp`）。**替换 `test/` 时要保住本仓库新增的 `scripts/diagram-engine/test/run-valid.mjs`
   与本地用例**（`svg-css-extract`、`svg-theme-vars`、`derive-name`、`cli-surface`、`doctor`、
   `brand-marks` 及 `svg-css-extract.golden.json`）；直接 `rm -rf test/` 再 `cp -R` 会把它们删掉。
3. **重放本次裁剪改动**：按第 1 节的改动表逐条把裁剪改动施加到新搬入的代码上
   （`render-driver.mjs` 裁子命令、删 `--repo-root`、品牌失败关闭、README 引用改指 fixtures、
   `schemas/README.md` 去已删能力、`package.json`／`lock` 重写）。
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
6. 更新第 1 节的基准坐标 / 版本，并在提交信息里写明新旧基准。

### 5.2 哪些红灯「上游本就会失败」，不能当回归

判据：**红灯文件落在第 4 节 A–F 任一组，且报错仍是同一类缺失**（缺已删入口 / `examples/` /
`SKILL.md` / `references/`、缺仓库根脚手架、缺 `node_modules`、或品牌抓取被移除）——这就是裁剪
造成的，**与你的改动无关，不当回归**。

反过来，下面几种红灯**必须查**：

- 红的是 `run-valid.mjs` 清单里的文件之一 → **真回归**，入口会直接报 exit 非 0。
- 第 4 节文件里出现了**新的错误类型**：例如组 A/B/C/E 的文件本来只是「缺件」类报错
  （`ENOENT …` / `Cannot find module …`），现在却报运行时断言失败 → 很可能是新回归，要查。
- 上游新增的测试文件（会出现在 `run-valid.mjs` 的 drift 提示里）：先归属——属于 A–F 组就更新
  第 4 节；不属于则必须逐文件实测，**全绿才加入清单**，有真实失败要查。
- 你这次改动恰好动了「部分通过」文件所覆盖的能力 → 入口**不会**跑这些文件，需要手工单跑确认。

### 5.3 已知限制

1. **覆盖缺口——整文件粒度带来的「连坐」**：入口按文件登记，凡文件里混有不成立的断言，整文件都
   不跑。上游文件一个字都不能改（硬约束），所以**不能**靠删断言把它们救回来；回填办法与建议见第 6 节。
2. **「全绿」不等于覆盖了浏览器行为**：本机没有任何浏览器，浏览器交互类用例（`*-browser.test.mjs`
   等）整体跳过。入口不登记它们（跳过计数会破坏「0 跳过」口径），浏览器交互的真回归靠本入口
   **测不出来**；目前只有静态证据（`tests/render.smoke.test.mjs` 断言产物 HTML 含内联查看器代码）。
3. **耗时**：逐文件串行跑约 24 个文件、数百毫秒到数秒不等；重测上游整包（165 文件）约数分钟。
   这是换取确定性的代价。

---

## 6. 未决点（需要人裁量，不由实现者拍板）

1. **是否回填「部分通过」文件的运行时用例**：上游文件不可改，只能整文件排除或改用
   `--test-name-pattern` 精确选取（后者对上游改名脆弱）。当前决定是**整文件排除 + 本文档登记缺口**。
   将来若把本仓库 `SKILL.md` 与上游文案对齐，或决定改写相应断言所检查的能力，再重新评估回填。
2. **是否允许安装 devDependencies 以回填组 D 的文件**：当前硬约束是「不得安装 `node_modules`」，
   所以组 D 结构性必红。若以后放宽，需重新评估（会引入 `node_modules` 与 `package-lock.json` 的同步负担）。
3. **是否在本仓库补 `.gitattributes`**：那只是为了满足上游仓库自身的气泡统计 / 行尾配置，
   对技能运行价值低，当前不做。
4. **浏览器交互行为没有自动化验证**：本机无浏览器，查看器的拖拽/缩放/搜索/Story/Route/Reach/Export/
   深链接等仍然**没有自动化测试**。要做行为验证需要引入无头浏览器，不在当前范围。
5. **`viewer/` 未搬入**：交互查看器的构建源码在上游仓库根，本内核只带其构建产物
   `assets/template.html`。将来要改查看器交互，必须回上游改源码后重新构建再搬入。
