# design-diagrams 与上游 archify 的对应关系

本文件说明 `design-diagrams/` 这份技能包是从哪个上游、哪个 commit 搬来的，哪些上游
检查项在搬入后被**有意排除**，以及同步上游时怎么用 `test/run-valid.mjs` 判回归。

---

## 1. 基准（按 commit 固定）

| 项 | 值 |
|---|---|
| 上游仓库 | `https://github.com/tt-a1i/archify` |
| 基准坐标 | commit `5289f6867f048a7450ec5718f58459613a84cf41`（技能包版本 `2.17.0-dev.1`，见 `skill-release.json`） |
| 发布通道 | `channel: "development"` |
| 稳定 tag | **无** |
| 更新清单地址 | `https://tt-a1i.github.io/archify/skill-updates/archify/stable.json`（上游自托管，供运行时查更新用，**不是**本仓库的基准坐标） |

**为什么用 commit 而不是 tag**：上游处于 `development` 通道、版本号是
`2.17.0-dev.1`，仓库里没有可供锚定的稳定 tag；`skill-release.json` 里的
`updateManifestUrl` 指向 stable 通道的更新清单，用途是让运行时知道去哪查新版本，
不代表本仓库搬的是那一版。因此本仓库的基准只能钉死在 commit `5289f686…` 上；同步时
按这个 commit 逐字节比对，不要按 tag 或 `latest`。

**搬入范围**（对应上游 `archify/` 技能包目录）：`bin/`、`renderers/`、`schemas/`、
`scripts/`（**技能包自带的**那一份，与仓库根的 `scripts/` 是两个不同目录）、`delta/`、
`migrations/`、`brand-marks/`、`assets/`、`examples/`、`recipes/`、`references/`、
`test/`，以及 `package.json`、`package-lock.json`、`skill-release.json`、`LICENSE`、
`THIRD_PARTY_NOTICES.md`。以上内容与基准 commit 逐字节一致（`test/` 的唯一例外是
本仓库新增的 `run-valid.mjs`，见第 3 节）。

**未搬入**（上游仓库根级别、本技能包运行时不需要的内容）：仓库根 `scripts/`、
`viewer/`、`docs/`、`website/`、仓库根 `examples/`（**注意**：与技能包自带的
`archify/examples/` 是两个不同目录，前者未搬、后者已搬）、`benchmarks/`、
`experiments/`、`generated/`、`integrations/`、`.github/`、`.gitattributes`、
`README.md` / `README_EN.md` / `README_ZH.md`、`CONTRIBUTING.md`、`archify.zip` 等。

---

## 2. 许可证归属

- **Archify 本体**：MIT。版权方为 `Copyright (c) 2026 tt-a1i (Archify)` 与
  `Copyright (c) 2025 Cocoon AI`，全文见 `design-diagrams/LICENSE`。
- **第三方商标与图标**：归属与许可记录见 `design-diagrams/THIRD_PARTY_NOTICES.md`。
  要点：内置矢量标记多数生成自 Simple Icons 16.28.0（集合是 CC0 1.0，但**集合的 CC0
  不等于每个底层图标都是 CC0**，文件里逐条记录了 Angular / Airflow / Kafka / .NET /
  JavaScript / Jenkins / Rust / Vue.js 的登记许可与处理方式）；OpenAI 标记取自 OpenAI
  品牌指南而非 Simple Icons；品牌名与商标仍属各自所有者，该通知**不授予** Archify 并未
  持有的权利。
- **内联字体 JetBrains Mono**：SIL Open Font License 1.1。**完整授权文本**随包存放在
  `design-diagrams/assets/JetBrainsMono-OFL.txt`——`THIRD_PARTY_NOTICES.md` 的
  "JetBrains Mono" 一节声明的正是这个路径。
- 本仓库对以上内容只做搬运，不新增任何许可或权利主张。

---

## 3. 测试集现状与验证入口

`design-diagrams/test/` 是上游 `archify/test/` 的**整包逐字节搬运**（137 个文件：
115 个 `*.test.mjs` + `helpers/`、`fixtures/`，以及 `golden.mjs`、
`webm-artifact.smoke.mjs`、`site-language-integration.mjs` 三个非 `*.test.mjs` 文件）。
上游文件**一个字节都没有改**。

在裁剪结构下逐个文件实测（对每个文件单独跑 `node --test test/<file>`，取退出码）：

- 115 个 `*.test.mjs` 里，**78 个全绿（退出码 0）**，**37 个有失败（退出码 1）**。
- 78 个全绿文件由 `test/run-valid.mjs` 的 `UPSTREAM_VALID` 显式清单登记；37 个的失败
  成因在第 4 节逐条列出。

`test/run-valid.mjs` 是本仓库新增的验证入口（**不是上游文件**）：

```
node design-diagrams/test/run-valid.mjs
```

- 一条命令跑完；退出码 `0` = 清单内全部通过，非 0 = 有文件失败。
- 只跑显式清单里的文件，**不使用通配**——通配会把上游以后新增的、或本仓库环境下必红的
  文件悄悄拉进来，让「全绿」这个信号失真。
- 不读取也不安装 `node_modules`（只用 Node 内置模块）。
- 输出给出「跑了几个文件 / 通过多少 / 失败多少」与用例级统计，失败时点名文件并给出
  首条错误。
- **以后新增能力的用例怎么加**：在本目录新建 `xxx.test.mjs`，把文件名加进
  `run-valid.mjs` 的 `LOCAL_TESTS` 数组即可；本地用例与上游清单在同一个入口里一起跑、
  一起计入总判定。两个数组的边界，以及「未登记文件会在运行末尾以 drift 提示列出」的
  机制，见该文件头部注释。

> 注意：`run-valid.mjs` 逐文件**串行**运行，而不是 `node --test` 一次跑整个目录；
> 并对 `update-notifier.test.mjs`（负载敏感、含**多条**时序用例）做特殊处置——最多尝试
> 3 次，且只有当失败**全部落在**点名的那几条时序敏感用例上时才不计入判定；任何其它
> 用例失败照报。两者都是为了让入口的退出码确定——原因与实测数据见第 5.3.2 节。

---

## 4. 被排除的上游检查项（37 个文件，按实锤成因分组）

下面每一组都给出：**哪些测试文件**、**它们依赖了什么被剔除的东西**、**为什么在本仓库
不成立**。判定口径是「本仓库缺什么」，所以当你想知道「我这次改动该不该担心这些红灯」
时，先看红灯是否落在本节的某个文件上、且报错是否仍是同一类——若是，它与你的改动无关。

### 组 A：依赖未搬入的上游仓库根构建 / CI / 发布 / 基准工具（12 个）

这些测试检查的不是 `design-diagrams` 技能的行为，而是**上游仓库自身的工程脚手架**：
提交范围判定、打包清洗、发布身份、站点构建、基准测试。它们 import / spawn 仓库根的
`scripts/`、`viewer/`、`benchmarks/`，这些目录按第 1 节被有意排除。

| 测试文件 | 依赖的未搬入物 | 实测报错（实锤） |
|---|---|---|
| `ci-scope.test.mjs` | 仓库根 `scripts/ci-scope.mjs` | `Cannot find module '…/scripts/ci-scope.mjs'` |
| `clean-skill-staging.test.mjs` | 仓库根 `scripts/stage-clean-skill.mjs` | `Cannot find module '…/scripts/stage-clean-skill.mjs'` |
| `release-package-gates.test.mjs` | 仓库根 `scripts/stage-clean-skill.mjs` | `Cannot find module '…/scripts/stage-clean-skill.mjs'` |
| `stable-update-manifest.test.mjs` | 仓库根 `scripts/check-stable-update-manifest.mjs` | `Cannot find module '…/scripts/check-stable-update-manifest.mjs'` |
| `release-identity.test.mjs` | 仓库根 `scripts/check-release-identity.mjs` | `Cannot find module '…/scripts/check-release-identity.mjs'` |
| `brand-marks.test.mjs` | 仓库根 `scripts/third-party-notices-contract.mjs` | `Cannot find module '…/scripts/third-party-notices-contract.mjs'` |
| `site-language-continuity.test.mjs` | 仓库根 `scripts/site-copy.mjs` | `Cannot find module '…/scripts/site-copy.mjs'` |
| `gallery.test.mjs` | 仓库根 `scripts/build-gallery.mjs`（另需未搬入的 `docs/`） | `Cannot find module '…/scripts/build-gallery.mjs'` |
| `guide-page.test.mjs` | 仓库根 `scripts/build-guide.mjs`（另需未搬入的 `docs/guide.html`） | `Cannot find module '…/scripts/build-guide.mjs'` |
| `start-page.test.mjs` | 仓库根 `scripts/build-start.mjs`（另需未搬入的 `docs/start.html`） | `Cannot find module '…/scripts/build-start.mjs'` |
| `generate-viewer.test.mjs` | 仓库根 `scripts/generate-viewer.mjs` + `viewer/`（241 个失败全部源自此） | `ENOENT … lstat '…/viewer'` |
| `ordinary-model-floor.test.mjs` | 未搬入的 `benchmarks/ordinary-model-floor/benchmark.mjs` | `Cannot find module '…/benchmarks/ordinary-model-floor/benchmark.mjs'` |

**为什么不成立**：这些是上游仓库的 CI 与发布门禁（「提交只碰文档就走快速通道」「打包含
清洗」「发布身份一致」「站点可复现构建」「基准不退化」）。本仓库只是把技能包搬进来，
既不拥有上游仓库根的这些工具，也没有对应的 `docs/`、`viewer/`、`benchmarks/`。**改
`design-diagrams/` 里的技能行为不可能让它们转绿，它们变红也不代表技能坏了。**

### 组 B：断言上游 `design-diagrams/SKILL.md` 的内容，而本仓库该文件是另一形态（7 个）

每个文件都在模块顶层 `readFileSync('…/design-diagrams/SKILL.md')`，随后对其**内容**做断言
（描述文案、字面路径引用、分节结构等）。`design-diagrams/SKILL.md` 已在上一变更的波次三
落盘——上一版把成因写成「该文件尚未创建、本变更不创建它」，该前提**已过期**——但该文件是
本仓库为「内部出图技能」重写的入口文档，不是上游 archify 的 SKILL.md，因此这些内容断言
仍不成立。2026-09-22 **单文件逐个实测**（`cd design-diagrams && node --test test/<文件>`，
串行、每次只跑一个文件）结论如下，**7 个文件仍全部失败**，失败成因已由「文件不存在
（`ENOENT`）」变为「内容不符（文档断言失败）」：

| 测试文件 | 实测结论（2026-09-22，单文件跑 `node --test test/<文件>`） |
|---|---|
| `skill-metadata.test.mjs` | **仍失败**：6 个用例 0 通过 / 6 失败。首条 `AssertionError: description must retain the data-flow trigger`（断言 SKILL.md 描述文案）；其余为对 SKILL.md 文案与字面路径引用的 `match` 断言失败 |
| `adaptive-reader-layout.test.mjs` | **仍失败**：6 个用例 5 通过 / 1 失败。用例 5 `reader remeasures real content and reduces width before allowing desktop page overflow` 对 SKILL.md 文案 `match` 断言失败 |
| `authoring-safety-contract.test.mjs` | **仍失败**：4 个用例 1 通过 / 3 失败。用例 1 / 3 / 4 对 SKILL.md 文案 `match` 断言失败（报错字段即 `error: 'SKILL.md'`） |
| `delivery-contract.test.mjs` | **仍失败**：5 个用例 4 通过 / 1 失败。用例 2 `skill keeps deterministic delivery, automated browser evidence, and perceptual review distinct` 对 SKILL.md 文案 `match` 断言失败 |
| `preview-contract.test.mjs` | **仍失败**：1 个用例 0 通过 / 1 失败。当前阻断点在模块顶层读 `…/README_EN.md` 处 `ENOENT`（SKILL.md 之后的下一个依赖；该文件同时读 SKILL.md、`references/delivery-contract.md` 与仓库根三份 README） |
| `automatic-port-spread.test.mjs` | **仍失败**：15 个用例 14 通过 / 1 失败。用例 15（文档断言）对 SKILL.md 文案 `match` 失败，期望文案含 `Automatic Port Spread is a default renderer behavior` |
| `sequence-column-fit.test.mjs` | **仍失败**：6 个用例 5 通过 / 1 失败。用例 6（文档断言）对 SKILL.md 文案 `match` 失败，期望文案含 `do not shorten semantic labels before trying spread` |

**为什么不成立**：这些断言写的是**上游 archify 的技能入口文档**（英文 authoring-router
的文案与分节）。本仓库的 `design-diagrams/SKILL.md` 是给「内部出图技能」重写的入口
（中文、由 `brainstorming` 调用），二者内容约定完全不同。改技能出图行为不会让它们转绿；
它们变红也不代表出图能力坏了。

> ⚠️ **有真实覆盖被这条排除吃掉**：`automatic-port-spread`（14 个）与
> `sequence-column-fit`（5 个）的运行时用例**已经通过**，却因为同一文件里还有一个断言
> 上游 SKILL.md 文案的文档用例而整文件被排除。上一版预期「SKILL.md 落盘后这两个文件
> 应当整体转绿」**已被上述实测证伪**：SKILL.md 已落盘，这两个文件**仍失败**（各 1 个
> 文档断言），因此**本次不回填**验证入口清单（见第 6 节）。

### 组 C：依赖未搬入的官网 / docs 站与仓库根 `examples/`（4 个）

| 测试文件 | 依赖的未搬入物 | 实测报错（实锤） |
|---|---|---|
| `landing.test.mjs` | 官网 `docs/index.html` | `ENOENT … open '…/docs/index.html'` |
| `proof-aperture.test.mjs` | 官网 `docs/index.html` | `ENOENT … open '…/docs/index.html'` |
| `real-repository-proof.test.mjs` | 官网案例 `docs/cases/mco-runtime.architecture.json` | `ENOENT … open '…/docs/cases/mco-runtime.architecture.json'` |
| `architecture-delta.test.mjs` | 仓库根 `examples/checkout-platform-delta.html`（**仓库根**那份 `examples/`，不是技能包自带的 `archify/examples/`） | 28 个运行时用例通过；1 个失败：`ENOENT … open '…/examples/checkout-platform-delta.html'` |

**为什么不成立**：这些检查的是上游对外网站与「已入库的渲染成品可复现」。`docs/` 与
`website/` 未搬入。`architecture-delta` 尤其容易误判：技能包自带 `examples/` 里有
`checkout-platform.base/head.architecture.json`（搬了），但那个测试读的是**仓库根**
`examples/` 下上游已渲染好的比对 HTML（没搬）。

> ⚠️ `architecture-delta` 的 28 个运行时用例（架构比对逻辑）已通过但被整文件排除。

### 组 D：依赖未搬入的上游 README / 社区文档 / `.github`（6 个）

| 测试文件 | 依赖的未搬入物 | 实测报错（实锤） |
|---|---|---|
| `readme-showcase.test.mjs` | 仓库根三份 README 与徽章、`docs/assets/*.png`、`.github/workflows/star-history.yml`、仓库根 `scripts/build-readme-showcase.mjs` | 7 个失败：`ENOENT … scripts/build-readme-showcase.mjs`、`ENOENT … docs/assets/archify-demo-story.png`、`ENOENT … .github/workflows/star-history.yml` |
| `cursor-onboarding.test.mjs` | 上游 `README_EN.md` | `ENOENT … open '…/README_EN.md'` |
| `community-proof-intake.test.mjs` | `.github/ISSUE_TEMPLATE/showcase.yml`、`bug-report.yml`、`CONTRIBUTING.md` | 3 个失败：`ENOENT … .github/ISSUE_TEMPLATE/showcase.yml` 等 |
| `reach-share-card.test.mjs` | 上游 README 内容 | 5 个运行时用例通过；1 个失败：`AssertionError: README.md`，期望 `/Reach Share Card/`（本仓库根 README 是 brainstorming 技能的，与上游无关） |
| `route-share-card.test.mjs` | 上游 README 内容 | 7 个运行时用例通过；1 个失败：`AssertionError: README.md`，期望 `/Export → Route Share Card/` |
| `share-card-export.test.mjs` | 上游 README 内容 | 7 个运行时用例通过；1 个失败：`AssertionError: README.md`，期望 `/Share Card/i` |

**为什么不成立**：这些断言的是**上游仓库根的产品文档**（三语 README、徽章、分享卡片的
宣传图、issue 模板、贡献指南）。本仓库根的 `README.md` 是 brainstorming 技能自己的
README，二者的内容约定完全不同。**改技能代码不会让它们转绿。**

> ⚠️ 三个 share-card 文件各有 5～7 个**运行时用例已通过**（渲染 / 导出 / 重跑遍历等）
> 却被整文件排除，是本套餐里第二处值得回填的覆盖缺口。

### 组 E：依赖未搬入的仓库根 `.gitattributes`（2 个）

| 测试文件 | 依赖的未搬入物 | 实测报错（实锤） |
|---|---|---|
| `checkout-line-endings.test.mjs` | 仓库根 `.gitattributes`（`core.autocrlf` 三种取值下的行尾保真规则） | 3 个失败全是 `ENOENT … open '…/.gitattributes'` |
| `repository-language-metadata.test.mjs` | 仓库根 `.gitattributes` 里的 `linguist-generated` 标注 | `AssertionError: archify/assets/template.html must be excluded from GitHub language statistics`，`actual: 'unspecified'`（`git check-attr` 查不到任何标注） |

**为什么不成立**：这两个文件检查的是**上游仓库**的 Git 配置——文本/二进制文件的行尾
策略，以及哪些生成物要从 GitHub 语言统计里排除。本仓库没有 `.gitattributes`（也没有
`archify/`、`viewer/`、`docs/` 这些被标注的路径）。它们与技能运行行为无关。

### 组 F：依赖未安装的 devDependencies（6 个）

上游把这些列为 `package.json` 的 `devDependencies`；本仓库**不安装
`node_modules`**（硬约束），因此凡 `import 'parse5'` / `require('ajv')` 的路径在加载期
就 `ERR_MODULE_NOT_FOUND`。

| 测试文件 | 依赖的未安装包（引入点） | 实测报错（实锤） |
|---|---|---|
| `cli.test.mjs` | `parse5`（经 `test/helpers/xml.mjs`） | `Cannot find package 'parse5' imported from …/test/helpers/xml.mjs` |
| `generated-artifact-xml.test.mjs` | `parse5`（经 `test/helpers/xml.mjs`） | 同上 |
| `architecture-delta-markers.test.mjs` | `parse5` | `Cannot find package 'parse5' imported from …/test/architecture-delta-markers.test.mjs` |
| `offline-font-browser.test.mjs` | `parse5`（经 `test/helpers/offline-fonts.mjs`） | `Cannot find package 'parse5' imported from …/test/helpers/offline-fonts.mjs` |
| `offline-self-containment.test.mjs` | `parse5`（经 `test/helpers/offline-fonts.mjs`） | 同上 |
| `generate-validators.test.mjs` | `ajv`（CI 期 `scripts/generate-validators.mjs` 用它做 schema 校验） | 1 个用例通过；1 个失败：`Cannot find package 'ajv' imported from …/.validator-check-…/scripts/generate-validators.mjs` |

**为什么不成立**：这些包只服务于**测试期**（HTML/XML 解析、schema 校验、字体自包含
检查），技能运行时不需要它们——`bin/archify.mjs doctor` 与五类图渲染在无
`node_modules` 时都能跑通（`scripts/generate-validators.mjs --check` 依赖的是已生成的
`renderers/shared/generated-validators.mjs`，不需要 `ajv`）。若以后决定允许安装
devDependencies，这 6 个文件会变成候选回填项；在当前硬约束下它们是**结构性必红**。

> ⚠️ `generate-validators` 的第 1 个用例（生成校验器的 schema 版本行为）已通过，被同一
> 文件里的 CRLF 用例排除。

---

## 5. 怎么用这套东西判回归

### 5.1 同步上游新版本

1. **取新基准**：上游走 `development` 通道、无稳定 tag，所以锁定一个新的 commit SHA 作为
   新基准（不要用 `latest` 或某个分支名）。
2. **逐字节替换已搬入目录**：按第 1 节的搬入范围，从新 commit 重新搬运并逐字节核验（
   `diff -r` / `cmp`）。**替换 `test/` 时要保住本仓库新增的 `design-diagrams/test/run-valid.mjs`**
   （它不属于上游，直接 `rm -rf test/` 再 `cp -R` 会把它删掉）；`UPSTREAM.md` 在技能根，
   不受影响。
3. **先跑入口**：`node design-diagrams/test/run-valid.mjs`——**应当全绿、退出码 0**。
   如果红了，先按 5.2 归类：清单内文件变红 = 真回归；清单外的新漂移 = 先归属再决定。
4. **重新做一次逐文件测量并更新清单**（必须**串行逐文件**，理由见 5.3.2）：

   ```bash
   cd /code/codebuddy-brainstorming-add-design-diagrams
   for f in design-diagrams/test/*.test.mjs; do
     out=$(node --test --test-reporter=tap "$f" 2>&1); status=$?
     p=$(printf '%s\n' "$out" | sed -n 's/^# pass \([0-9]\+\)$/\1/p')
     fl=$(printf '%s\n' "$out" | sed -n 's/^# fail \([0-9]\+\)$/\1/p')
     printf '%s|%s|pass=%s|fail=%s\n' "$status" "$f" "${p:-0}" "${fl:-0}"
   done | sort -k2
   ```

   退出码 0 的行 → 新的 `UPSTREAM_VALID` 清单（替换 `run-valid.mjs` 里的数组，保持顺序）；
   退出码 1 的行 → 逐条复核它属于第 4 节哪一组，**同步更新第 4 节的表格与本节基准表**。
5. 更新第 1 节的基准 commit / 版本，并在提交信息里写明新旧基准。

### 5.2 哪些红灯「上游本就会失败」，不能当回归

判据：**红灯文件落在第 4 节 A–F 任一组，且报错仍是同一类缺失**（缺仓库根
`scripts/`、`viewer/`、`docs/`、仓库根 `examples/`、`.gitattributes`、`node_modules`
或上游 README）——这就是裁剪造成的，**与你的改动无关，不当回归**。组 B 另算：它们不是
缺 `design-diagrams/SKILL.md`（该文件已落盘），而是断言其**内容**为上游原版而不成立，
报错形态是文档断言失败（见第 4 节组 B）。

反过来，下面几种红灯**必须查**：

- 红的是 `run-valid.mjs` 清单里的 78 个文件之一 → **真回归**，入口会直接报 exit 非 0。
- 第 4 节文件里出现了**新的错误类型**：例如组 A/C/D/E/F 的文件本来只是「缺件」类报错
  （`ENOENT …` / `Cannot find module …`），现在却报运行时断言失败 → 很可能是新回归，要查。
  （组 B 是例外：它们对 SKILL.md 内容做断言，本就是文档断言失败，不是缺件。）
- 上游新增的测试文件（会出现在 `run-valid.mjs` 的 drift 提示里）：先归属——属于 A–F 组
  就更新第 4 节；不属于则必须逐文件实测，**全绿才加入清单**，有真实失败要查。
- 你这次改动恰好动了组 B/C/D/F 里「部分通过」文件所覆盖的能力（端口自动扩展、列宽
  自适应、分享卡渲染 / 导出、架构比对、生成校验器）→ 入口**不会**跑这些文件，需要手工
  单跑该文件确认那部分已通过的用例仍然通过（见 5.3.1）。

### 5.3 已知限制

1. **覆盖缺口——整文件粒度带来的「连坐」**：入口按文件排除，凡文件里混有不成立的断言，
   整文件都不跑。第 4 节 37 个文件里**本来已经通过的运行时用例共 70 个**因此不在验证
   范围内：`architecture-delta` 28、`automatic-port-spread` 14、`route-share-card` 7、
   `share-card-export` 7、`reach-share-card` 5、`sequence-column-fit` 5、`start-page` 3、
   `generate-validators` 1。上游文件一个字都不能改（硬约束），所以**不能**靠删断言把它们
   救回来；回填办法与建议见第 6 节。**注意**：组 B 的 `automatic-port-spread`（14 个）与
   `sequence-column-fit`（5 个）当初被记为「等 `SKILL.md` 落盘即可整体转绿」的缺口，
   `SKILL.md` 现已落盘但这两个文件**仍各有 1 个文档断言失败**（成因见第 4 节组 B），
   缺口并未因落盘而关闭。
2. **`update-notifier.test.mjs` 时序敏感，且不止一条用例**：该文件里至少三条并发 /
   时序用例在负载下会假红——
   `an empty precheck snapshot cannot start a second concurrent network request`
   （`test/update-notifier.test.mjs:1951`）、`an overlapping check reads the last-good
   candidate while another process refreshes it`、`a last-good notice remains
   acknowledgeable after the refresh commits a new candidate`；典型报错
   `AssertionError … actual 'silent' expected 'update_available'`。实测抖动率：
   空闲环境**单独跑 20 次红 1 次**，加 4 个 CPU burner 后**单独跑 10 次红 5 次**；
   把整目录交给一次 `node --test`（内部并行）更易复现。此前本节写的「单独跑 10/10
   通过」被这次更大量的实测**证伪**，故更正——它不是只在并发时才红。
   退出码因此非确定，而 README 把 `run-valid.mjs` 的退出码当作安装完整性判据，
   假红会被误读成「装坏了」，所以在**入口侧**做了两件事（该文件是上游搬运件、
   一个字节都不能改，只能这样消解）：
   - `run-valid.mjs` **逐文件串行**运行，而不是一次 `node --test` 跑整个目录；
   - 对**这一个文件**最多尝试 3 次（任一次通过即判通过）；若三次全失败、但失败用例
     **全部落在**上面点名的那几条上，则判为已知假红、**不计入判定**，输出打 `⚠` 并
     列出被忽略的用例；只要出现**任何一条**其它用例的失败，即判真失败。
   （先试过「只重跑、不点名」：在 4 个 CPU burner 下三次尝试可能全红，退出码仍非确定，
   所以补上「点名后的用例才不计入」这一层——点名的失败是已知假红，非点名的失败照报，
   退出码对真回归是确定的。）
   **代价（会被掩盖什么）**：点到名的那几条时序敏感用例的**确定性**失败也会被当成假红
   放过——这是换取退出码确定的代价；其它用例（含确定性回归）的失败一律照报，不掩盖。
   副作用：如果你在别处用 `node --test design-diagrams/test/` 或高并发跑测试，看到这个
   文件红了，先怀疑并发、不要当回归。（也正因如此，重测清单时**不要**用一次
   `node --test` 跑整目录。）
3. **「全绿」不等于覆盖了浏览器行为**：本机没有任何浏览器，13 个文件是纯浏览器用例、
   整体跳过（`pass=0`，如 `*-browser.test.mjs`、`desktop-reader-browser`），另有若干文件
   部分跳过（`i18n`、`repository-evidence`、`semantic-radar`、`viewer-chrome-layout`、
   `desktop-reader-browser`）。入口输出里每个文件都带 `skipped=` 便于识别，全程共 40 个
   跳过用例。浏览器交互的真回归靠本入口**测不出来**。
4. **耗时**：串行 78 个 Node 子进程约 2.5 分钟（实测两次：2m40s / 2m26s）。这是换取
   确定性（见 5.3.2）的代价。

---

## 6. 未决点（需要人裁量，不由实现者拍板）

1. **是否回填「部分通过」文件的运行时用例**（5.3.1 的 70 个用例）：上游文件不可改，只能
   整文件排除或改用 `--test-name-pattern` 精确选取（后者对上游改名脆弱）。当前决定是
   **整文件排除 + 本文档登记缺口**。
   - **后续项（本次不回填 `design-diagrams/test/run-valid.mjs` 通过清单）**：上一版预期
     组 B 的 `automatic-port-spread`、`sequence-column-fit` 在 `SKILL.md` 落盘后能整体
     转绿。`SKILL.md` 已于上一变更波次三落盘，但 2026-09-22 单文件实测显示这两个文件
     **仍各失败 1 个文档断言**（其余 14 / 5 个运行时用例通过），**无一文件整体转绿**。
     故本次**不回填** `UPSTREAM_VALID`——不是遗漏，而是预期所依赖的前提（SKILL.md 落盘
     即转绿）已被实测证伪。将来若把本仓库 `SKILL.md` 与上游文案对齐，或决定改写这两个
     断言所检查的能力，再重新评估回填。
2. **是否允许安装 devDependencies 以回填组 F 的 6 个文件**：当前硬约束是「不得安装
   `node_modules`」，所以组 F 结构性必红。若以后放宽，需重新评估（会引入 `node_modules`
   与 `package-lock.json` 的同步负担）。
3. **是否在本仓库补 `.gitattributes` 以回填组 E**：那只是为了满足上游仓库自身的气泡
   统计 / 行尾配置，对技能运行价值低，当前不做。

