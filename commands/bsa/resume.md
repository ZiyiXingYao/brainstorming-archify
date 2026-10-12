---

description: 恢复一个被中断或跨会话重启的 brainstorming-archify 设计讨论
argument-hint: "[project-root]"
allowed-tools: Bash(node:*)
---

Before executing a CLI line below, replace its leading `BSA` with `node "__BSA_ROOT__/scripts/task-state/resume-state.mjs"`. Never run `BSA` literally or call a `bsa` from `PATH`.

先跑 `node "__BSA_ROOT__/scripts/task-state/resume-state.mjs" --json`；需要指定项目根时，把项目根作为单一字面参数跟在 `--root` 后（为空时命令自己从当前目录向上找 `.brainstorming-archify/state.yaml`）。

只使用返回的 `ok`、`state`、`files`、`blockers` 与 `next_action`：

- `blockers` 非空 → **停下**，把每条 blocker 和它给出的修复命令原样展示给用户；不猜、不继续、不绕过。
- 否则按 `next_action` 行动：加载它 `load` 列出的技能文件，按 `reason` 与 `command` 继续这场设计讨论（`explore` 继续提问收敛；`draft` 等人工校验后逐文件 `confirmed`；`confirm` 生成 `specs/design/task.md` 后收口；`closed` 没有进行中的讨论，要动就用 `reopen`）。
- **不得直接修改 `.brainstorming-archify/state.yaml`**——它的唯一写入口是 `node "__BSA_ROOT__/scripts/task-state/change-state.mjs"`。
