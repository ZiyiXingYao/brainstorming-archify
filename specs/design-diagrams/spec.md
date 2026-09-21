# design-diagrams

## Purpose

定义 `design-diagrams` 技能必须具备的行为：把类型化 JSON IR 在 Node 侧确定性渲染为自包含 SVG，
并作为内部能力被 `brainstorming` 调用，使设计文档中的图由程序布局而非文本 DSL 近似。

## Requirements

### Requirement: 五类图的渲染能力内置

`design-diagrams` 技能 SHALL 在自身目录内携带架构图、工作流图、时序图、数据流图和生命周期图五类图的
渲染器、schema 与示例，使渲染过程不依赖技能目录之外的任何服务或网络。

#### Scenario: 离线渲染五类图

- **WHEN** 在无网络环境下依次渲染五类图各一份合法 IR
- **THEN** 五类图均产出 SVG，且过程中不发起网络请求、不读取技能目录以外的路径

#### Scenario: 请求不存在的图类型

- **WHEN** 请求的图类型不属于上述五类
- **THEN** 渲染以非零退出码失败，并指出支持的类型清单，不产出任何文件

### Requirement: 类型化 JSON IR 是图的唯一输入

每张图 SHALL 由一份符合对应 schema 的类型化 JSON IR 唯一决定；作者 SHALL NOT 在 IR 中规划坐标，
节点与连线的位置 MUST 由渲染器计算。

#### Scenario: IR 不符合 schema

- **WHEN** 提交的 IR 缺少必填字段或字段类型不符合对应 schema
- **THEN** 渲染以非零退出码失败，并逐条指出不符合的字段，不产出任何文件

#### Scenario: IR 中携带手工坐标

- **WHEN** IR 在允许的布局控制字段之外携带坐标
- **THEN** 该字段被 schema 拒绝，渲染失败

#### Scenario: IR 随图一同落盘

- **WHEN** 一张图被落盘
- **THEN** 生成它的 IR 与图同目录同名、扩展名不同，一并落盘，供后续判断该图是否已过期

### Requirement: Node 侧 SVG 直出

技能 SHALL 提供一个 Node 侧可运行的导出入口，把渲染结果输出为**自包含**的 SVG 文件，
其中 MUST 内联渲染所需的全部样式规则、深浅两套主题变量与字体，使该文件脱离生成环境后仍能正确显示。

#### Scenario: 脱离环境打开 SVG

- **WHEN** 把产出的 SVG 复制到另一台无本技能、无网络的机器上直接用浏览器打开
- **THEN** 图形、颜色、字体与生成时一致，不依赖任何外部样式表或字体文件

#### Scenario: 跟随系统深浅色

- **WHEN** 打开该 SVG 的宿主环境在深色与浅色之间切换
- **THEN** 图随宿主主题切换配色，且切换不改变图形结构、节点位置与连线走向

#### Scenario: 图渲染失败不留半成品

- **WHEN** 导出过程中渲染或校验失败
- **THEN** 目标路径上不留下截断或半渲染的 SVG，且既有同名文件不被覆盖

### Requirement: 图的文件形态与嵌入引用

产出 SHALL 为每张图写一个独立 SVG 文件，路径为设计文档所在目录下的 `diagrams/` 子目录；
设计文档 SHALL 以 Markdown 图片语法引用它，且 MUST NOT 把 SVG 内容内联进文档正文。

#### Scenario: 文档引用图

- **WHEN** 阅读一份含图的设计文档
- **THEN** 该文档通过图片引用指向 `diagrams/` 下的 SVG，正文中不出现 `<svg>` 标签

#### Scenario: 图文件名冲突

- **WHEN** 两张图按命名规则会得到同一个文件名
- **THEN** 命名规则使两者得到不同文件名，并把冲突双方报告出来，不静默改名

#### Scenario: 同名流程出现在两份文档

- **WHEN** 同一个流程名同时出现在架构文档与模块文档中
- **THEN** 两者引用同一个图文件，不各自生成一份

### Requirement: 几何校验硬门

技能 SHALL 在产出 SVG 之前对 IR 执行几何校验，覆盖节点重叠、连线穿过无关节点、关系标签遮挡；
校验未通过时 MUST NOT 产出 SVG。

#### Scenario: 校验发现穿节点

- **WHEN** 校验判定某条连线穿过无关节点
- **THEN** 不产出 SVG，并给出该连线的稳定标识、测量证据与可选修法

#### Scenario: 同一张图连续两轮无改善

- **WHEN** 对同一张图自动修正时，基线轮计入两轮；第 2 轮的目标错误数未低于第 1 轮（目标错误数指校验诊断中错误级条目的条数，不含警告）
- **THEN** 停止自动修正，向调用方报告未解决项，并把「保留占位继续落盘」与「继续修正」交由用户选择

### Requirement: 内部技能边界与调用契约

`design-diagrams` SHALL 声明自身为内部技能：MUST 能被 `brainstorming` 调用，
MUST NOT 因用户直接提出的画图请求而被自动选中。

#### Scenario: 用户直接要求画图

- **WHEN** 用户直接要求画一张图，而对话不在 `brainstorming` 的设计流程中
- **THEN** 该技能不接管该请求，并说明它由 `brainstorming` 在设计文档产出时调用

#### Scenario: brainstorming 调用

- **WHEN** `brainstorming` 在设计文档落盘阶段需要出图
- **THEN** 该技能接受调用，按传入的图类型与 IR 产出 SVG，并把校验结果返回给 `brainstorming`

### Requirement: 一键安装

仓库根 SHALL 提供一个 Node 脚本，一条命令把 `brainstorming` 与 `design-diagrams` 两个技能安装到
CodeBuddy 的技能目录，并在安装前检查运行环境、安装后做一次真实渲染自检。

#### Scenario: 环境不满足

- **WHEN** 当前 Node 主版本低于出图所需的最低版本（18）
- **THEN** 脚本以非零退出码结束，明确说明所需版本与当前版本，且不写入任何文件

#### Scenario: 安装后自检

- **WHEN** 安装在环境满足的条件下完成
- **THEN** 脚本产出一张样例 SVG 并核对它非空、含根元素且含内联样式，核对通过后报告安装结果与两个技能的路径

#### Scenario: 预演模式

- **WHEN** 以预演模式运行脚本
- **THEN** 脚本列出将写入的文件与目标路径，但不修改文件系统

### Requirement: 上游同步与回归测试保留

`design-diagrams` SHALL 保留其上游 `archify` 的测试集，并记录所搬运的上游版本标识，
使后续同步上游版本时可判定是否引入回归。

#### Scenario: 同步上游新版本

- **WHEN** 把技能内的渲染器更新到 `archify` 的更新版本
- **THEN** 可直接运行技能内自带的测试集，确认既有行为未被破坏

#### Scenario: 版本可追溯

- **WHEN** 查阅技能目录
- **THEN** 能找到所搬运的上游仓库、版本标识与许可证归属信息
