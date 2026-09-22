# diagram-engine

## Purpose

定义绘图内核必须具备的行为：把类型化 JSON IR 在 Node 侧确定性渲染为自包含 SVG 与完整交互式
HTML 页，并作为内部能力被 `brainstorming-archify` **直接调用**（它不是独立技能，也不维护第二份技能文档），
使设计文档中的图由程序布局而非文本 DSL 近似。

## Requirements

### Requirement: 五类图的渲染能力内置

绘图内核 SHALL 在自身目录（`scripts/diagram-engine/`）内携带架构图、工作流图、时序图、数据流图和
生命周期图五类图的渲染器、schema 与交互页模板，使渲染过程不依赖内核目录之外的任何服务或网络；
内核 MUST NOT 被声明为独立技能，也 MUST NOT 携带第二份技能文档。

#### Scenario: 离线渲染五类图

- **WHEN** 在无网络环境下依次渲染五类图各一份合法 IR
- **THEN** 五类图均产出 SVG，且过程中不发起网络请求、不读取内核目录以外的路径

#### Scenario: 请求不存在的图类型

- **WHEN** 请求的图类型不属于上述五类
- **THEN** 渲染以非零退出码失败，并指出支持的类型清单，不产出任何文件

#### Scenario: 内核目录内不存在第二份技能文档

- **WHEN** 列出 `scripts/diagram-engine/` 的全部文件
- **THEN** 其中没有 `SKILL.md`，也没有任何以技能文档形态描述内核的文件

### Requirement: 类型化 JSON IR 是图的唯一输入

每张图 SHALL 由一份符合对应 schema 的类型化 JSON IR 唯一决定；作者 SHALL NOT 在 IR 中规划坐标，
节点与连线的位置 MUST 由渲染器计算。IR MUST 作为三件套之一随图落盘，使该图是否过期可被判定。

#### Scenario: IR 不符合 schema

- **WHEN** 提交的 IR 缺少必填字段或字段类型不符合对应 schema
- **THEN** 渲染以非零退出码失败，并逐条指出不符合的字段，不产出任何文件

#### Scenario: IR 中携带手工坐标

- **WHEN** IR 在允许的布局控制字段之外携带坐标
- **THEN** 该字段被 schema 拒绝，渲染失败

#### Scenario: IR 随图一同落盘

- **WHEN** 一张图被落盘
- **THEN** 生成它的 IR 与图同目录同前缀、扩展名不同，一并落盘

### Requirement: Node 侧 SVG 直出

内核 SHALL 提供一个 Node 侧可运行的入口，把渲染结果输出为**自包含**的 SVG 文件，
其中 MUST 内联渲染所需的全部样式规则、深浅两套主题变量与字体，使该文件脱离生成环境后仍能正确显示。

#### Scenario: 脱离环境打开 SVG

- **WHEN** 把产出的 SVG 复制到另一台无本内核、无网络的机器上直接用浏览器打开
- **THEN** 图形、颜色、字体与生成时一致，不依赖任何外部样式表或字体文件

#### Scenario: 跟随系统深浅色

- **WHEN** 打开该 SVG 的宿主环境在深色与浅色之间切换
- **THEN** 图随宿主主题切换配色，且切换不改变图形结构、节点位置与连线走向

#### Scenario: 图渲染失败不留半成品

- **WHEN** 导出过程中渲染或校验失败
- **THEN** 目标路径上不留下截断或半渲染的任何一件产物，且既有同名文件不被覆盖

### Requirement: 图的文件形态与嵌入引用

产出 SHALL 为每张图写三个同目录同前缀的文件：`.json`（源 IR）、`.svg`（静态图）、`.html`（交互页）；
落点 SHALL 为设计文档所在目录下的 `diagrams/` 子目录（即 `<项目根>/specs/design/diagrams/`）；
文件名 SHALL 为 `<文档序号>-<图名>.<图类型>.<扩展名>`，其中文档序号取**归属文档**的编号；
`<图名>` SHALL 为英文 slug（ASCII 字母、数字与 `-`），即使设计文档本身以中文撰写也不得含中日韩字符。
设计文档 SHALL 以固定两行引用它——图片行引用 SVG，紧随一行以链接指向交互页；
MUST NOT 把 SVG 内容内联进文档正文。

#### Scenario: 文档引用图

- **WHEN** 阅读一份含图的设计文档
- **THEN** 该文档以图片语法引用 `diagrams/` 下的 SVG，并在紧随的一行以链接指向同名 `.html`，
  正文中不出现 `<svg>` 标签

#### Scenario: 三件套成对

- **WHEN** 检查 `<项目根>/specs/design/diagrams/` 下的任一图
- **THEN** 该图的 `.json`、`.svg`、`.html` 三件同时存在、同前缀、同目录，不存在被拆散存放的一件

#### Scenario: 图落在规定位置之外

- **WHEN** 某张图被写到项目根 `diagrams/` 或其他非 `specs/design/diagrams/` 的位置
- **THEN** 判定为缺陷

#### Scenario: 命名缺文档序号或缺图类型

- **WHEN** 图文件名缺少 `<文档序号>-` 前缀或缺少 `.<图类型>` 段
- **THEN** 判定为缺陷

#### Scenario: 同名流程出现在两份文档

- **WHEN** 同一个流程名同时出现在架构文档与模块文档中
- **THEN** 两者引用同一个图文件——执行期**先**写入的那次按**归属文档**的序号命名
  （跨模块流程归架构文档），后写入者改为引用既有文件，不各自生成一份

#### Scenario: 图文件名冲突

- **WHEN** 两张图按命名规则会得到同一个文件名
- **THEN** 命名规则使两者得到不同文件名——在序号与图名之后追加 `-2`、`-3`…，
  并把冲突双方报告出来，不静默改名

#### Scenario: 图名的字符归一

- **WHEN** 由图名或章节语义名派生 `<图名>` 段
- **THEN** `<图名>` 一律为英文——来源名为非英文时先译成英文再归一；归一保留 ASCII
  字母与数字，其余字符（含非 ASCII／中日韩字符）替换为 `-`、连续 `-` 合并为一个、
  去掉首尾 `-`、ASCII 部分转小写；结果为空时回退为图类型名

#### Scenario: 中文文档的图名仍为英文

- **WHEN** 设计文档以中文撰写，其流程名或章节语义名也是中文
- **THEN** 该图的 `<图名>` 段仍为英文 slug，图文件名不出现中日韩字符

### Requirement: 几何校验硬门

内核 SHALL 在产出 SVG 之前对 IR 执行几何校验，覆盖节点重叠、连线穿过无关节点、关系标签遮挡；
校验未通过时 MUST NOT 产出 SVG。

#### Scenario: 校验发现穿节点

- **WHEN** 校验判定某条连线穿过无关节点
- **THEN** 不产出 SVG，并给出该连线的稳定标识、测量证据与可选修法

#### Scenario: 同一张图连续两轮无改善

- **WHEN** 对同一张图自动修正时，基线轮计入两轮；第 2 轮的目标错误数未低于第 1 轮（目标错误数指校验诊断中错误级条目的条数，不含警告）
- **THEN** 停止自动修正，向调用方报告未解决项，并把「保留占位继续落盘」与「继续修正」交由用户选择

#### Scenario: 校验子命令单独可用

- **WHEN** 只对一份 IR 执行校验而不渲染
- **THEN** 校验子命令独立运行，退出码反映校验结论，且不写出任何文件

### Requirement: 上游同步与回归测试保留

绘图内核 SHALL 保留其上游 `archify` 的测试集，且该测试集 SHALL **留在内核目录内**
（`scripts/diagram-engine/test/`，入口 `run-valid.mjs`），并在内核目录内记录所搬运的上游版本
标识与许可证归属，使后续同步上游版本时可判定是否引入回归。
该测试集 MUST NOT 被搬到内核目录之外：其用例以「自己所在目录的上一级」解析内核根
（相对导入、`path.join(HERE, '..', …)`、`new URL('../…')` 三种写法之一），搬出即系统性失效。
规划期曾拟定迁往 `tests/upstream/`，执行期实测搬迁后 85 个文件全红而否决，**仓库中不存在该目录**。

#### Scenario: 同步上游新版本

- **WHEN** 把内核内的渲染器更新到 `archify` 的更新版本
- **THEN** 可直接运行 `scripts/diagram-engine/test/run-valid.mjs`，确认既有行为未被破坏

#### Scenario: 版本可追溯

- **WHEN** 查阅内核目录
- **THEN** 能找到所搬运的上游仓库、版本标识与许可证归属信息

#### Scenario: 上游文档随内核保留

- **WHEN** 查阅 `scripts/diagram-engine/`
- **THEN** 能找到 `UPSTREAM.md`、`THIRD_PARTY_NOTICES.md` 与 `LICENSE`，
  且 `THIRD_PARTY_NOTICES.md` 所声明的内联字体授权文本在声明的路径上存在

### Requirement: 渲染入口的唯一子命令集

内核 SHALL 只暴露一个入口 `bin/render.mjs`，其子命令集 SHALL 恰为 `render`、`validate`、`doctor`；
`render` SHALL 接收图类型、IR 路径与输出目录，一次性写出三件套；MUST NOT 提供
`compare`、`brands`、`migrate`、`visual-check`、`guide`、`demo`、`preview` 等其余子命令。

#### Scenario: 列出可用子命令

- **WHEN** 以内核入口的用法输出或帮助子命令为准核对
- **THEN** 只出现 `render`、`validate`、`doctor` 三个子命令

#### Scenario: 调用已砍掉的子命令

- **WHEN** 以 `compare`、`brands`、`migrate`、`visual-check`、`guide`、`demo` 或 `preview` 调用入口
- **THEN** 以非零退出码失败并指出该子命令不存在，不静默降级为其他行为

#### Scenario: render 一次写出三件套

- **WHEN** 对一份合法 IR 执行 `render` 并给定输出目录
- **THEN** 该目录下出现同前缀的 `.json`、`.svg`、`.html` 三个文件

### Requirement: 渲染不读取被绘对象之外的源码

内核 SHALL NOT 提供从被绘对象的仓库源码取事实的能力：MUST NOT 接受仓库根参数、
MUST NOT 为收集仓库证据而读取本内核目录之外的文件；图的事实来源唯一是传入的 IR。

#### Scenario: 检索代码溯源能力

- **WHEN** 在内核的 `bin/` 与 `renderers/` 下检索 `repo-root`、`repository-evidence`、`repository-location`
- **THEN** 零命中，不存在残留的参数、环境变量或渲染器分支

#### Scenario: 传入不存在的路径作为证据来源

- **WHEN** 以任意仓库根参数调用入口
- **THEN** 该参数被拒绝为未知参数，渲染不受影响地只依赖 IR

### Requirement: 交互式 HTML 页随图落盘

`render` SHALL 把渲染时使用的交互式页面写成 `.html` 产物，与 `.svg`、`.json` 同目录同前缀；
该页面 MUST 保留其全部交互能力：拖拽画布、滚轮缩放、点击节点高亮上下游、`/` 搜索框、
深色/浅色主题切换、Story 章节播放、Route 路径探查、Reach 上下游探查、
Export 菜单（PNG / JPEG / WebP / SVG / WebM / Copy Share Card）、URL hash 深链接、演示模式。

#### Scenario: 打开交互页

- **WHEN** 在浏览器中打开任一图的 `.html` 产物
- **THEN** 可拖拽画布、滚轮缩放、点击节点高亮其上下游、用 `/` 呼出搜索框、切换深浅主题

#### Scenario: 交互页承载渲染配置

- **WHEN** IR 中带 `meta.views`（Story 章节）与 `meta.animation` 轨迹动画
- **THEN** 交互页可播放 Story 章节并呈现轨迹动画；WebM 导出可用；`showcase` 严格校验
  与 `meta.visual_preset`（`signal-flow` / `blueprint` / `editorial` / `classic`）均照旧生效

#### Scenario: 交互页不得被裁剪

- **WHEN** 核对 `.html` 产物的交互能力清单
- **THEN** 清单上每一项都存在，不存在为「精简」而被移除的交互功能

### Requirement: 内核元数据与许可证文件保留

内核目录 SHALL 保留 `UPSTREAM.md`、`THIRD_PARTY_NOTICES.md`、`LICENSE`、`package.json`、
`skill-release.json` 与 `assets/JetBrainsMono-OFL.txt`；`package.json` 的 `scripts` 段
MUST NOT 保留指向本仓库中不存在的文件的命令。

#### Scenario: 检查内核元数据

- **WHEN** 列出内核目录顶层
- **THEN** 上述六个文件齐备

#### Scenario: package.json 指向不存在的文件

- **WHEN** 逐条核对 `package.json` 的 `scripts` 命令所引用的路径
- **THEN** 每一条都能在本仓库中找到对应文件；找不到的已被删除或改正，不存在指向缺失父级脚本目录的死链
