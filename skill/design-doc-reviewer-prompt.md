# Design Document Reviewer Prompt Template

Use this template when dispatching a design document reviewer subagent.

**Purpose:** Verify the design documents are complete, consistent,
implementation-ready, and follow the fixed templates
`architecture-doc-template.md`, `module-doc-template.md`,
`interface-contract-template.md`, and `data-model-doc-template.md` — and, once
every document of the round is
confirmed, that the generated `specs/design/task.md` splits the design into
a dependency-clean implementation task list.

**Dispatch after:** The design documents are written to `specs/design/`.

**One subagent reviews all four document types** — plus `specs/design/task.md`
when the round has reached `confirm`. When the write set
exceeds five documents, split the dispatch: architecture first, then the
module documents in batches, carrying the architecture findings forward.
The interface contract may ride with any module batch or be dispatched on
its own — it depends on no other document's findings and no other document
depends on its. `task.md` rides with the last batch, because it is only
generated once every document is confirmed.

```
Subagent (general-purpose):
  description: "Review design documents"
  prompt: |
    You are a design document reviewer. Verify these brainstormed design documents are complete and usable.

    **Documents to review:** [DESIGN_DOC_PATHS]
    **Architecture template:** [ARCHITECTURE_TEMPLATE_PATH]   ← absolute path to architecture-doc-template.md
    **Module template:** [MODULE_TEMPLATE_PATH]               ← absolute path to module-doc-template.md
    **Interface-contract template:** [INTERFACE_CONTRACT_TEMPLATE_PATH]   ← absolute path to interface-contract-template.md
    **Data-model template:** [DATA_MODEL_TEMPLATE_PATH]                   ← absolute path to data-model-doc-template.md
    **Approved change list:** [CHANGE_LIST_SUMMARY]           ← what the human approved: new files (including every diagram file this write will create or re-render, each with the flow it belongs to), modified files and which sections, what was declared untouched, new dependencies, pending conflicts. State whether it was announced as an architecture overhaul
    **Findings from the architecture review (if this is a later batch):** [PRIOR_BATCH_FINDINGS]

    ## Which Template Applies to Which Document

    Route every document to exactly one template by its file name and its
    content — never check a document against a template other than its own,
    and never skip the routing step. The number prefix on the file name is
    what makes the routing mechanical:

    - `01-架构设计.md` (the architecture overview, or 架构总纲) → the
      architecture template (架构模板)
    - `02-实体与数据设计.md` (the data-model document, 实体与数据设计) → the
      data-model template (实体与数据设计模板). This number is reserved: it is a
      fixed literal prefix like `00-` and `01-`, so a document named `02-` is
      **always** the data-model document, never a module
    - `NN-<模块名>.md` whose number is **03 or above** (the module documents —
      `03-`, `04-`, … `10-`) → the module template (模块模板)
    - `specs/design/00-接口契约.md` (the interface contract, 接口契约模板) → the interface-contract template
    - `specs/design/task.md` (the implementation task list, 任务清单) → no template; it is checked against the `Task split` row below

    Documents that are **not** managed design documents route to no template
    and are not reviewed here — for example the skill's own files (`SKILL.md`,
    `README.md`, `design-doc-reviewer-prompt.md`) and the four templates
    themselves. Their carrying `<...>` placeholders is expected, so it is not a
    `Completeness` finding, and none of the rows below apply to them.
    `specs/design/` is the only directory this routing covers.

    **`.brainstorming-archify/change-lists/` is not a managed design document.** It holds
    the approved change lists — process artifacts under
    `<project root>/.brainstorming-archify/change-lists/`. The **current round's**
    file is the one `state.yaml`'s `change_list.path` points at (it is a living
    round record: round header, discussion record, key decisions, file-modification
    ledger, and one authorisation block per persist). Route the directory to no
    template and do not review it against any template's criteria: its `<...>`
    hints and placeholders are expected and are **not** a `Completeness` finding,
    and none of the rows below apply to it. When a criterion below needs the
    approved change list's content — `change-list coverage`, the diagram rows, the
    untouched-content row — read the content from the current round's change-list
    file (and, for an earlier persist of the same round, its earlier authorisation
    block), rather than treating the list as unreadable because it is not in
    `specs/design/`.

    A routing error is itself a defect to report: naming a document on the wrong template makes every finding drawn from it suspect. The interface contract's path and file name are fixed at `specs/design/00-接口契约.md`, so a document named `接口契约.md` with no prefix, `0-接口契约.md` with the wrong prefix, `contract.md`, or the like is a routing failure — report it, and do not fall back to checking it against another template.

    Check each document against its own template only. A module document is
    not expected to carry a background section, and the architecture document
    is not expected to carry per-class field and function tables. Reporting
    one for lacking what the other's template requires is a false positive.
    An interface contract is likewise not expected to carry the architecture's
    module split or the module documents' class, field, and function tables,
    nor any SVG diagram — reporting it for lacking those is a false positive
    too.

    ## Authority Order

    When two documents disagree, these decide which one is wrong — do not
    report the disagreement as a tie:

    - Dependency signatures → the calling module's section 4 wins; the
      interface matrix is a copy and must be corrected to match it
    - Which modules exist → architecture section 6.2
    - Which cross-module interfaces are settled → architecture section 7
    - Class ownership → the module documents' section 2.1 is the authority
      for each module's complete class list; the architecture's section 8.1
      registers only core classes and must be a subset of the union of the
      **already-designed** modules' class lists. A core class owned by a
      module that is still 未设计 is registered provisionally and is not a
      conflict; it must be reconciled into that module's class list once the
      module is designed. A conflict here resolves by direction, not by
      deletion: when the class satisfies the core-class criterion, its
      owning module's section 2.1 is the authority and must be completed
      with it — the architecture's section 8.1 entry stays; when the class
      does not satisfy the criterion, the architecture's section 8.1 entry
      is the one that is wrong. If two module class lists disagree with
      each other, neither is authoritative until the human resolves it
    - A functional flow's module chain and boundary crossings →
      architecture section 10; the same flow's intra-module function-level
      detail → the module document's section 5. Neither may contradict the
      other, a name mismatch is wrong on both sides, and a flow registered
      in the architecture must carry the same 服务功能点 in both places

    ## What to Check

    Rows marked **(module)** apply only to module documents; **(architecture)**
    only to `01-架构设计.md`; **(data model)** only to
    `specs/design/02-实体与数据设计.md`; **(interface contract)** only to
    `specs/design/00-接口契约.md`; the unmarked rows apply to the architecture and
    module documents. The data-model document is additionally checked against the
    unmarked rows that are **generic rather than topic-specific** — Template
    compliance, Readability, Incremental merge integrity, Completeness, Decision
    traceability, Ambiguity, and **Diagram consistency** — and not against the
    rows that address a module's class tables, dependency matrices, functional
    points or a flow's cross-module skeleton, which exist only in the architecture
    and module documents. The interface contract is checked against its own
    template and against its own **(interface contract)** rows below; beyond
    those, the unmarked rows that are **generic rather than topic-specific**
    also apply to it — Template compliance, Readability, Incremental merge
    integrity, Completeness, Decision traceability, and Ambiguity all apply. The
    unmarked rows that address classes, flows, dependency matrices, functional
    points, cross-document flow consistency, or diagrams are
    architecture-and-module concerns and are **not** applied to it.

    | Category | What to Look For |
    |----------|------------------|
    | Template compliance | Each document checked against its own template: every section present, in order, no extra sections; N/A sections state a reason |
    | Readability | Narrative for responsibilities, boundaries, class relationships, and business flows; tables where the template calls for tables. No spec-mode content (acceptance criteria, task lists, Given/When/Then, or a requirement ID used as an entry's name or substance). A descriptively named functional point carrying a stable reference label such as `FP-1` is a cross-reference aid, not spec-mode content — but a bare ID standing in for the name is incomplete, and an ID followed by acceptance criteria is a violation. At a **reference site** — a flow's 服务功能点 field, a module's section 1.2 or section 5 annotation, or any cross-document back-reference — the label alone is sufficient once that functional point's descriptive name has been defined in the same document or in architecture section 5 |
    | Structural completeness **(module)** | Every class in the class list has a detailed-design entry with a field table and a function table — or an explicit `不适用` with a reason where one genuinely does not apply (a pure data class has no functions; a stateless class has no fields). An unmarked missing table is an issue; a reasoned `不适用` is not. Function tables name each function's caller and the other modules' functions it depends on |
    | Dependency coverage **(module + architecture matrix)** | Every module document declares its outward dependency contract **at signature level** (function name, parameters, return type, boundary semantics) — a bare name with no signature is incomplete; rows that only need a class rather than a function use `—` for the signature and explain the requirement in the semantics column; every dependency-contract row appears in the architecture interface matrix and vice versa (bidirectional traceability); the matrix's summary matches the calling module's §4 **rows as a set** — a caller may carry several §4 rows against the same provider, so compare the two row **sets**, not one row against one row. Statuses come from the architecture template's section 7 four-value table — never restate that table — and appear **only in the matrix** — a status column in a module document is an issue, because flipping a row must never require editing another module's document. A `待提供` row whose provider module has already been designed is an issue — the provider was required to flip it to 已落地, 有差异 or 待调用方 (the last when the caller has not been designed yet), so an unflipped row means the gap has no owner. A `待调用方` row is **not** an issue: its owner is the not-yet-designed caller module. A `详见` cell that points at a module document which does not exist yet **is** an issue — the cell must read `待调用方落盘` instead. The matrix row's **function name** must equal the provider module document's section 3 function-table name **verbatim** — including case and camel/snake style; the function name is a hard constraint, so a style mismatch makes the row `有差异`, never `已落地`. When one persist designs both sides of a row, that row must flip in the same persist and must not stay `待提供` |
    | Flow completeness | Two layers, checked separately. **(architecture)** every functional flow is registered — including one whose module-level chain completes inside a single module — and each states its 服务功能点, its trigger, a module-level chain naming the core class that carries each hop, the data shape per hop, where the result lands, and how the whole flow unwinds when a hop fails. **(module)** each flow states the module's entry point, the intra-module function-level chain, data-shape changes, who receives the result, the failure path, and its 服务功能点 — without restating the cross-module skeleton. A flow registered in both places must share its name and its 服务功能点 and may not restate the other layer; a purely module-internal implementation flow belongs only in the module document |
    | Class attribution **(architecture)** | The architecture's core-class list is a **subset** of the union of the **already-designed** modules' class lists; every core-class entry satisfies the core-class criterion (it appears on the module-level chain of a section 10 flow, it is the carrier of a section 10 flow's trigger entry, or it is the interface carrier of a section 7 matrix row — the interface carrier being the class named in that row's dependency-summary column); a core class owned by an **already-designed** module whose class list does not contain it is an issue, and the same class owned by two modules is an issue; a core class owned by a module that is still 未设计 is registered provisionally and is **not** an issue, but must be reconciled into that module's class list when the module is designed. The architecture file tree covers module folders and core files and can locate every core class's `定义文件`; a tree that stops at module folders **and core files** is **not** a defect — file-level completeness is not required — but a tree that cannot locate a core class's `定义文件` **is** one, and a non-core source file's absence is **not** a defect. A module marked 已设计 has a document that exists, one marked 未设计 has no document yet and carries the `（待创建）` marker, and no module document exists whose module is absent from the list |
    | Functional-point coverage | The functional-point list in architecture section 5 is complete — every capability the system provides appears and nothing invented; each functional point is served by at least one section 10 flow, and each section 10 flow names at least one functional point (bidirectional coverage); a functional point listed in a module document's section 1.2 exists in architecture section 5 and vice versa, and each module's section 1.2 agrees with that module's section 5 服务功能点 annotations; a functional point claimed by no module is an issue. A 功能点 is a descriptive requirement entry — who needs it in what situation and what it achieves — and must **not** be a requirement ID plus acceptance criteria; Given/When/Then must not appear |
    | Cross-document consistency | Dependency-contract rows and interface-matrix rows agree in both directions; every **functional** flow — including one whose module-level chain stays inside a single module — appears in the architecture's global flow section with the matching name and 服务功能点, and no module document claims a global flow that the architecture does not have; a purely module-internal **implementation** flow must not be registered there; module names are unique across the list and match file names and the matrix's "详见" references, with no reference pointing at a renamed or deleted module; cross-references use the project-root-relative path form (`specs/design/02-通信模块.md`) rather than bare file names or `../` hops |
    | Incremental merge integrity | Every document and section the approved change list declared untouched is word-for-word unchanged — untouched documents are now **fully** untouched, because the modification record no longer lives in their headers (it lives in the current round file's file-modification ledger, which is a process artifact, not a design document; do not demand a 最近更新/参与/来源 header line, and do not treat its absence as a defect). No content from other modules or earlier discussions was silently dropped — in particular, a module document redrafted wholesale rather than merged, and any document the change list did not name as modified. When the change list announced an architecture overhaul, check that the existing documents were still walked entry by entry and that whatever still holds was kept, rather than regenerated |
    | Completeness | No TBD/TODO/prose-placeholder/empty sections; background, comparison, recommendation, and decisions are all substantive. The placeholder scan targets prose placeholders the author must fill and must **not** flag a literal spec inside inline backticks (e.g. the interface contract's naming format string), the fixed `不适用：<原因>` notation, or the trailing 「使用说明」 block |
    | Consistency **(architecture)** | No contradictions between sections; the recommended approach matches the comparison's conclusion |
    | Decision traceability | Key decisions state their rationale and rejected alternatives |
    | Ambiguity | Sentences that could be read two ways, enough to produce the wrong design |
    | Scope | **(architecture)** one project's architecture, expressed as a module split, flow set, and file tree — not a grab-bag of unrelated systems; **(module)** one module, not several |
    | Runtime and deployment views **(architecture)** | The architecture document's section 12 (运行视图) describes which processes run, each process's threads, and how processes and threads relate — or carries an explicit `不适用：<reason>` — **and carries its `architecture` diagram** (processes as components, hosts/containers as boundaries, who talks to whom as connections); a runtime view with no diagram and no `不适用` reason is a defect. Section 13 (部署视图) describes the deployment directory structure, how to deploy, and which files make up the deployment — or carries an explicit `不适用：<reason>`. A missing section, an out-of-order section, or a section present but empty with no `不适用` reason is an issue. The deployment view does **not** require a diagram — never report a defect for its having none. |
    | Task split **(task.md)** | `specs/design/task.md` exists exactly when every design document of the round is confirmed — when it is part of the write set it must be present, and when documents are still unconfirmed its absence is **not** a finding. Tasks come in three tiers in this order — framework (engineering skeleton, directory layout, shared infrastructure, process/thread wiring), then one task per module in the architecture's module list in dependency order, then one task per functional flow or flow-less functional point inside its module. Every task row starts with a checkbox (`- [ ]`) in the first column, then a short 概要, a 依赖 column naming predecessor IDs (or `无`), a **参考文档** line naming every design document the task implements against as **file name plus section number** (`01-架构设计.md` §6.2、§8.1；`00-接口契约.md` 2.2；`03-<模块>.md` §3.1), and a detailed AI implementation prompt whose four parts are present and in order — `[实现的功能]`, `[任务实现的要求]`, `[实现的约束]`, `[验收标准]`. Task IDs are `T-01`, `T-02`, … in execution order. The prompt references concrete design sections (`§6.2`, `§7`, `§8.1`, the contract's `x.2` items) rather than restating or re-deciding them; a prompt that asks the implementer to re-derive a settled decision is incomplete. The 参考文档 line is the task's reading list and must be checkable: a row with no 参考文档 line, a document name with no section (`01-架构设计.md`), a section with no document (`§6.2`), a document that does not exist under `specs/design/`, a section number the named document does not carry, or padding the line with every section of a document just to be safe — each is a defect, and the finding names the missing or wrong pair. A short gloss after a section (`§6.2（模块清单）`) is allowed and is not a defect. Every section the prompt leans on must appear in the line; the line may list background the prompt never cites, so extra entries are not defects on their own. A module the architecture lists as 未设计 must have its task cite the architecture and contract sections instead of a nonexistent module document, with the missing document named as a blocking precondition under `[实现的约束]`; citing the absent document is a defect. A task that draws on no numbered section carries `参考文档：无` and says under `[实现的约束]` what it does rest on — that row satisfies the line requirement, while a row that simply omits the line does not. The trailing 依赖校验 section states, per rule — forward or self dependency, two tasks touching the same file without an explicit order, a feature task whose module task is not listed before it, a dependency naming a nonexistent ID — either 无冲突 or the concrete violations; a verification section claiming 无冲突 that the list contradicts is a defect, and so is a missing verification section. **Progress rule:** when the write set includes `task.md` and a previous `task.md` existed, the new file must respect what was already done — read the previous file's checkboxes (`- [x]` = done). If that previous file still had **any** unchecked row (`- [ ]`), the correct artifact is that same file **edited in place and appended**: every existing task's ID, wording and checkbox state preserved, no renumbering, no deletion of unfinished work, appended IDs continuing past the highest existing one. A whole-file regeneration that drops unchecked tasks or clears their checkbox states is a defect. Only a previous file whose rows are **all** checked off may be regenerated whole — and that regeneration holds **only this round's change**, not a re-listing of the whole design; regenerating the full design in that case is a defect too. |
    | Diagram consistency | Every diagram is a **triple** of same-prefix files — `.json`, `.svg`, `.html` — all under `<project root>/specs/design/diagrams/`, never split across directories and never outside that folder; a missing member of the triple, or a diagram placed elsewhere, is a defect. The file name carries both its document-number prefix and its type segment (`<document number>-<diagram name>.<diagram type>.<ext>`); a missing prefix or a missing type segment is a defect. The document uses the fixed **two-line** reference — the image line pointing at the `.svg`, plus the immediately following `> [打开交互式版本](…)` line pointing at the same-prefix `.html` — and a missing interactive-version line is a defect; every referenced file exists and the relative path resolves against that document (no absolute path, no `../` jump), and a reference to a missing or unresolvable file is a defect. The components, participants, or states shown in a diagram do not contradict the prose of the section the diagram accompanies; a contradiction is a defect and both contradicting places — the diagram element and the sentence — must be named. **Every diagram's type must equal the one its own section binds** — `architecture` for architecture §6.3 and §12 (runtime view), `sequence` for architecture §10 and a module's §5, `workflow` for architecture §11, `flowchart` for a module's §3.N function description, `lifecycle` for a module's §6, and `class` / `erd` / `dataflow` / `lifecycle` for the data-model document's sections 2–5; a diagram whose type contradicts its section is a defect, and the finding must name the type that section binds. A flow under the same name in the architecture and a module document is **not** one shared diagram any more: the architecture draws the cross-module call order (numbered `01-`) and the module draws its own implementation steps (numbered with the module's own document number), so two different files are correct and must not be reported as duplication — but a module diagram that merely restates the architecture one is a defect. A **single-module** functional flow is the exception to that ownership: its diagram belongs to the **module** document and the architecture's section 10 references it instead of drawing its own, so a module-only flow whose architecture section carries its own copy, or a module document that references the architecture's file as its own diagram, is a defect. The document body contains no inline `<svg>` tag: diagrams are referenced as images, so an inline `<svg>` in the body is a defect. Every diagram stays within the 12-primary-node limit; more than 12 primary nodes in one diagram is a defect — the content must be split into several diagrams. **A diagram marked `未通过校验` in the approved change list is exempt from the triple and two-line requirements**: it must be absent from `diagrams/` (including its `.json` source IR — an orphan IR with no placeholder note is a defect), and its section must carry the fixed placeholder line (`> ⚠️ 占位：…未通过校验…`) instead. A missing triple with no placeholder line remains a defect |
    | Diagram change-list coverage | The approved change list enumerates every diagram this write will create or re-render, named by its triple base (`<document number>-<diagram name>.<diagram type>`) with the flow it belongs to, and **accounts one-to-one for the confirmed Diagram Planning Gate plan**; a diagram file written outside the change list is a defect, and so is a diagram in the list that the confirmed plan never contained (or a confirmed plan entry that never reached the list). A diagram that fails geometric validation does not enter the finished product and is instead marked in the change list with its status and reason |
    | Interface-contract structure **(interface contract)** | Level-2 headings number **11** — `## 总则` (unnumbered) plus `## 1.` through `## 10.`; sections 1–7 each carry all three parts, in order — `x.1` 清单表 (the list table) → `x.2` 逐项契约 (the per-item contract) → `x.3` 该类规则 (the family's rules). A section 1–7 missing any of the three parts and carrying no `不适用：<reason>` declaration for that part is a defect. **A family the system does not use at all may instead carry a single section-level `不适用：<reason>` in place of all three parts** — that is the shape both the interface-contract template and the published spec mandate for a wholly-absent family, and it is **not** a defect (do not demand `x.1`/`x.2`/`x.3` from a family the project does not use). |
    | Interface-contract traceable columns **(interface contract)** | Every `x.1` 清单表 carries the traceable column set its family prescribes — the per-family list below **governs**, so a family that needs only one side is complete with that one side alone (dynamic-library API 「调用方」; TCP 「对端」) and is not missing an owner column. Never flatten the set to a single 「写入方」-style label that does not fit the family: MySQL 「数据维护方 + 本服务侧的读写权限」; Redis 「写入方 + 读取方」; MQ 「方向（完整链路两端）+ 分片键」; HTTP / gRPC 「提供方 + 调用方」; dynamic-library API 「调用方」; TCP 「对端」. Redis additionally carries a mandatory 「数据类型」 column (the value's Redis type — STRING / HASH / SET / ZSET / LIST / STREAM) placed after 「用途」. A missing column, or a blank cell in any row, is a defect. |
    | Interface-contract field tables and examples **(interface contract)** | Every `x.2` field table gives at least three things — a name, a type-or-length, and a meaning — and MUST carry, after the field table, the example its family prescribes: MySQL a full `CREATE TABLE` statement, Redis a structure example chosen by its 「数据类型」 (a JSON example for a JSON value, field/value for HASH, members for SET / ZSET / LIST — key structure only, covering every field is not required), MQ and gRPC a proto message, HTTP the request and the response, the dynamic-library API a header signature, TCP a frame. A missing example is a defect. The table stays authoritative; when the table and the example disagree, the table wins and the example must be corrected to match it, so a disagreement is a defect that names both the table entry and the example. |
    | Interface-contract 总则 **(interface contract)** | The 总则 section carries all four parts: the authority-source declaration (this file is the sole authority over the code-side artifacts and wins when they disagree), the scope-and-shape statement, the code-side artifact mapping table, and the naming standard (Redis key — entity-level `<系统>:<域>:<实体>:<用途>:{实体标识}` or global/aggregate `<系统>:<域>:<实体>:<用途>` with no `{实体标识}`; MQ topic `<系统>.<域>.<实体>.<用途>.{实体标识}` with the last segment as the shard key; HTTP `/<系统>/<域>/<实体>/<用途>`). A missing part is a defect; so is a scope statement that says only what is covered without what is not covered, or whose non-coverage list is missing 「进程内跨模块接口不写在本文件」 (in-process cross-module interfaces are not written in this document). |
    | Interface-contract catch-all **(interface contract)** | Outward interfaces outside the seven families (files, CLI subcommands, third-party callbacks, …) go in section 8 — never forced into sections 1–7 and never omitted. Forcing a non-family interface into sections 1–7, or omitting a known outward interface, is a defect; an empty section 8 whose heading stays with `不适用：<reason>` is **not** a defect. |
    | Data-model document **(data model)** | `specs/design/02-实体与数据设计.md` must exist exactly when its mechanical trigger fires — the system uses a MySQL, Redis or MQ interface, or has an explicit domain model — and must be **absent entirely** otherwise; a missing document when the trigger fires is a defect, and reporting its absence as a defect when the trigger does not fire is a calibration error (this document has no `不适用` form). When present it carries all eight sections in order: data-model overview, domain class diagram, entity-relationship diagram, data-flow diagram, core entity state machine, data lifecycle and retention, key decisions, open questions. **Its four diagrams are deliberately a key subset, not the full inventory**: the class diagram covers the architecture's §8.1 core classes, the ER diagram the core domain entities, the data-flow diagram the cross-module / cross-boundary / sensitive links, and the state machine the entities whose state is visible across modules — reporting that a diagram does not cover every class in the module class lists or every table in the interface contract is a calibration error, because those two lists are the authorities for completeness. The document must not restate the interface contract's field-level contracts. Its class diagram is what architecture §8.2 / §8.3 must reference |
    | Diagram scope **(interface contract)** | The interface contract is not a diagram-bearing document — it carries no SVG diagrams, needs no `diagrams/` directory, and needs no diagram triple. Its having no diagram is **not** a defect, and reporting one for its lack of a diagram is a calibration error. The diagram rows above do not apply to it. |

    ## Calibration

    **Only flag issues that would cause real problems during later specification or implementation.**

    These are issues: a missing section, a contradiction, a class with no field or
    function table and no `不适用` reason, a dependency contract that stops at a
    name with no signature, a dependency that is not traceable in both directions,
    a `待提供` row whose provider module has already been designed, a matrix row
    whose function name diverges from the provider module document's section 3
    function table (a hard-constraint mismatch — that row is `有差异`, not `已落地`),
    a row left `待提供` although both sides were designed in the same persist,
    a status column
    in a module document instead of the matrix, a matrix signature that disagrees
    with the calling module document it points to, a core class whose `定义文件`
    cannot be located in the architecture file tree, a core class owned by an
    already-designed module whose class list does not contain it (a core class
    owned by a module that is still 未设计 is registered provisionally and is not
    an issue), the same class owned by two modules, a class in architecture
    section 8.1 that does not satisfy the core-class criterion, a flow missing
    its failure handling, a module marked 已设计 whose document does not exist, an
    orphan module document whose module is missing from the module list, a reference
    pointing at a renamed or deleted module, a functional flow the architecture
    registers nowhere although the module document writes it up in full, or a module
    document that restates a flow's cross-module skeleton instead of confining itself
    to the intra-module function-level detail, untouched content that
    was altered or lost, a module document regenerated instead of merged, a decision
    with no rationale, an ambiguity that could mislead, a leftover placeholder.
    So is a document routed to the wrong template. For an interface contract
    routed to the interface-contract template, these are also issues: its
    level-2 headings do not number 11 (`## 总则` unnumbered plus `## 1.`–`## 10.`);
    a section 1–7 is missing its `x.1` 清单表, `x.2` 逐项契约, or `x.3` 该类规则
    part with no `不适用：<reason>` declaration; an `x.1` 清单表 lacks the family's
    traceable column set or has a blank cell; the Redis `2.1` 清单表 lacks the
    mandatory 「数据类型」 column or has a blank data-type cell; an `x.2` field table
    lacks a name, a type-or-length, or a meaning, omits the family's mandatory
    example (MySQL `CREATE TABLE`, the Redis structure example, a proto message, the
    HTTP request/response, a header signature, a frame), or contradicts its example; the
    总则 omits the authority-source declaration, the scope-and-shape statement (or
    its 「进程内跨模块接口不写在本文件」 line), the code-side artifact mapping
    table, or the naming standard (Redis key — entity-level
    `<系统>:<域>:<实体>:<用途>:{实体标识}`, global/aggregate `<系统>:<域>:<实体>:<用途>`;
    MQ topic `<系统>.<域>.<实体>.<用途>.{实体标识}`, HTTP `/<系统>/<域>/<实体>/<用途>`);
    a non-family interface is forced into sections 1–7, or a known outward
    interface is omitted.

    These are **not** issues: field tables, function signature tables, call chains,
    data-shape tables, or interface matrices. Those are required design description
    and must not be reported as "spec mode". Nor is a table marked `不适用` with a
    stated reason — that is the template working as designed. An architecture file
    tree that stops at module folders and core files, and an architecture core-class
    list that is a strict subset of the **already-designed** modules' class lists, are both the templates
    working as designed. Neither are wording style, uneven section depth, "could be
    more detailed", or a document not carrying the other template's sections.     The
    architecture document's class structure relationships (8.2) and class call relationships
    (8.3) are **no longer** allowed to stand as prose, tables or mermaid in place of a
    diagram: the kernel now has a `class` type, so those two sections must reference the
    domain class diagram in `02-实体与数据设计.md`. A module document's class relationships
    (2.2) may still be prose, tables or mermaid for its own internal classes — that is
    unchanged. Nor is the interface contract's carrying no SVG
    diagrams and needing no `diagrams/` directory — it is not a diagram-bearing document, so
    do not report it for having none. Nor is an empty section 8 in the interface contract
    that keeps its heading with `不适用：<reason>`. Nor are, when scanning for placeholders,
    a literal spec inside inline backticks (e.g. the naming format string), the fixed
    `不适用：<原因>` notation, or the trailing 「使用说明」 block — the placeholder scan targets
    prose placeholders the author must fill, so reporting any of these as an unfilled
    placeholder is a calibration error.

    Approve unless there are serious gaps.

    ## Output Format

    ## Design Document Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Document / Section X]: [specific issue] - [why it matters later]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Issues (if any), Recommendations
