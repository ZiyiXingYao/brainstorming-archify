# skill-packaging

## Purpose

定义本仓库的交付形态约定：仓库按 `skill/`、`templates/`、`scripts/`、`tests/` 四个目录组织，
由 `scripts/install.mjs` 一条命令把 `brainstorming-archify` 单一技能安装到 CodeBuddy 的技能目录，
并由仓库自带的冒烟测试在本地验证出图链路可用。

## Requirements

### Requirement: 仓库目录划分

仓库 SHALL 按职责分为四个顶层目录：`skill/`（CodeBuddy 加载入口与其子代理提示词）、
`templates/`（全部 Markdown 模板）、`scripts/`（可执行脚本与绘图内核）、`tests/`（冒烟测试、
测试样例与上游回归集）。除此之外，仓库根 SHALL 只有两类非技能目录——`specs/`（已发布规格基线）与
`changes/`（spec-superflow 变更工作区，被 `.gitignore` 忽略）——以及仓库级文件
`README.md`、`MAINTAINING.md`、`LICENSE`、`.gitignore`。
技能文件 MUST NOT 散落在仓库根。

#### Scenario: 核对顶层目录

- **WHEN** 列出仓库根目录
- **THEN** 除 `specs/`、`changes/` 与仓库级文件外只有 `skill/`、`templates/`、`scripts/`、`tests/`
  四个目录，不存在平铺在根目录的 `SKILL.md`、模板或安装脚本

#### Scenario: 技能入口在约定位置

- **WHEN** 查找 CodeBuddy 的技能入口
- **THEN** `skill/SKILL.md` 与 `skill/design-doc-reviewer-prompt.md` 均存在

#### Scenario: 模板齐备

- **WHEN** 列出 `templates/`
- **THEN** 含架构总纲模板、功能模块模板、接口契约模板、实体与数据设计模板与自验用例模板**五份**，不因重排而少任何一份

#### Scenario: 绘图内核在约定位置

- **WHEN** 查找绘图入口
- **THEN** `scripts/diagram-engine/bin/render.mjs` 存在

### Requirement: 一键安装单一技能

仓库 SHALL 提供一键安装脚本，把本技能安装到目标技能目录，并保持幂等：重复安装结果一致、
只覆盖自己那份文件、不影响目录下其它技能。

安装清单 SHALL 覆盖技能运行所需的全部构件，其中**设计文档模板 SHALL 为五份**：
架构设计文档模板、功能模块设计文档模板、接口契约模板、**实体与数据设计文档模板**与**自验用例模板**。
安装后 SHALL 对已安装副本执行一次绘图内核自检，通过才报告成功。

#### Scenario: 五份模板全部落盘

- **WHEN** 安装完成后检查已安装副本的模板目录
- **THEN** 五份模板俱在，其中包含实体与数据设计文档模板与自验用例模板

#### Scenario: 重复安装幂等

- **WHEN** 对同一目标目录连续安装两次
- **THEN** 第二次结果与第一次一致，五份模板内容不变

#### Scenario: 不影响目录下其它技能

- **WHEN** 目标技能目录下已存在其它技能
- **THEN** 安装后这些技能原样保留

#### Scenario: 装后自检失败

- **WHEN** 已安装副本的绘图内核自检不通过
- **THEN** 安装脚本以非零退出码结束并报告失败原因

### Requirement: 绘图内核的环境自检

绘图内核 SHALL 提供 `doctor` 子命令，检查运行环境与内核自身完整性，并以退出码表达结论：
环境或内核不满足要求时以非零退出码结束并逐条说明不满足项。

#### Scenario: 环境满足

- **WHEN** 在 Node 主版本不低于 18 且内核文件齐备的环境下运行 `doctor`
- **THEN** 退出码为 0，并报告所检查的各项均通过

#### Scenario: Node 版本不足

- **WHEN** Node 主版本低于 18
- **THEN** `doctor` 以非零退出码结束，并报出所需版本与当前版本

#### Scenario: 内核文件缺失

- **WHEN** 内核的运行期必需文件（渲染器、schema 或交互页模板）缺失
- **THEN** `doctor` 以非零退出码结束，并指出缺失的具体路径

### Requirement: 渲染冒烟测试

仓库 SHALL 在 `tests/` 下提供一个冒烟测试，仅使用 Node 原生 `assert`、不引入任何第三方依赖；
该测试 SHALL 读取测试样例目录下五类图各一份样例 IR，逐份调用绘图入口渲染，
并断言每份都产出三件套且各件非空、`.svg` 含根元素、`.html` 含查看器代码。

#### Scenario: 五类样例全部渲染

- **WHEN** 运行该冒烟测试
- **THEN** 五类图的样例各被渲染一次，五个用例全部通过，任一用例失败即以非零退出码结束

#### Scenario: 三件套齐备

- **WHEN** 冒烟测试核对任一份样例的产物目录
- **THEN** 同前缀的 `.json`、`.svg`、`.html` 三个文件都存在且内容非空

#### Scenario: 静态图与交互页的结构断言

- **WHEN** 冒烟测试检查 `.svg` 与 `.html` 产物
- **THEN** `.svg` 含 `<svg` 根元素；`.html` 含查看器代码

#### Scenario: 零第三方依赖

- **WHEN** 检查该冒烟测试的依赖
- **THEN** 它只使用 Node 内置模块与原生 `assert`，运行前不需要安装任何依赖

### Requirement: 上游回归集的位置与定位

仓库 SHALL 把绘图内核自带的上游测试集**留在内核目录内**（`scripts/diagram-engine/test/`，
入口 `run-valid.mjs`），保持其内部相对结构与验证入口可用，使后续同步上游版本时仍能全套判回归；
该回归集 MUST NOT 计入安装清单，也 MUST NOT 计入冒烟测试的必跑清单。
该回归集 MUST NOT 被搬到内核目录之外：其用例以「自己所在目录的上一级」解析内核根，搬出即系统性
失效（执行期实测搬迁后 85 个文件全红），故仓库中不存在 `tests/upstream/` 目录。
仓库根 SHALL 提供聚合入口（`tests/engine.test.mjs`），使 `node --test tests/*.test.mjs`
一条命令即覆盖仓库测试与内核回归集。

#### Scenario: 定位回归集

- **WHEN** 查阅 `scripts/diagram-engine/test/`
- **THEN** 能找到上游测试集与其原有的验证入口，内部相对结构未被拆散

#### Scenario: 回归集不阻塞冒烟测试

- **WHEN** 运行冒烟测试
- **THEN** 它不依赖也不运行内核回归集；但根目录的聚合入口会唤起该回归集，故跑根目录测试即等于跑全部
