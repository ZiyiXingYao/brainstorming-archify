# Design Document Reviewer Prompt Template

Use this template when dispatching a design document reviewer subagent.

**Purpose:** Verify the design documents are complete, consistent,
implementation-ready, and follow the fixed templates
`architecture-doc-template.md` and `module-doc-template.md`.

**Dispatch after:** The design documents are written to `specs/design/`.

**One subagent reviews both document types.** When the write set exceeds
five documents, split the dispatch: architecture first, then module
documents in batches, carrying the architecture findings forward.

```
Subagent (general-purpose):
  description: "Review design documents"
  prompt: |
    You are a design document reviewer. Verify these brainstormed design documents are complete and usable.

    **Documents to review:** [DESIGN_DOC_PATHS]
    **Architecture template:** [ARCHITECTURE_TEMPLATE_PATH]   ← absolute path to architecture-doc-template.md
    **Module template:** [MODULE_TEMPLATE_PATH]               ← absolute path to module-doc-template.md
    **Approved change list:** [CHANGE_LIST_SUMMARY]           ← what the human approved: new files, modified files and which sections, what was declared untouched, new dependencies, pending conflicts. State whether it was announced as an architecture overhaul
    **Findings from the architecture review (if this is a later batch):** [PRIOR_BATCH_FINDINGS]

    ## Which Template Applies to Which Document

    - `01-架构设计.md` → the architecture template
    - every other document in `specs/design/` → the module template

    Check each document against its own template only. A module document is
    not expected to carry a background section, and the architecture document
    is not expected to carry per-class field and function tables. Reporting
    one for lacking what the other's template requires is a false positive.

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
    only to `01-架构设计.md`; the rest apply to both.

    | Category | What to Look For |
    |----------|------------------|
    | Template compliance | Each document checked against its own template: every section present, in order, no extra sections; N/A sections state a reason |
    | Readability | Narrative for responsibilities, boundaries, class relationships, and business flows; tables where the template calls for tables. No spec-mode content (acceptance criteria, task lists, Given/When/Then, or a requirement ID used as an entry's name or substance). A descriptively named functional point carrying a stable reference label such as `FP-1` is a cross-reference aid, not spec-mode content — but a bare ID standing in for the name is incomplete, and an ID followed by acceptance criteria is a violation. At a **reference site** — a flow's 服务功能点 field, a module's section 1.2 or section 5 annotation, or any cross-document back-reference — the label alone is sufficient once that functional point's descriptive name has been defined in the same document or in architecture section 5 |
    | Structural completeness **(module)** | Every class in the class list has a detailed-design entry with a field table and a function table — or an explicit `不适用` with a reason where one genuinely does not apply (a pure data class has no functions; a stateless class has no fields). An unmarked missing table is an issue; a reasoned `不适用` is not. Function tables name each function's caller and the other modules' functions it depends on |
    | Dependency coverage **(module + architecture matrix)** | Every module document declares its outward dependency contract **at signature level** (function name, parameters, return type, boundary semantics) — a bare name with no signature is incomplete; rows that only need a class rather than a function use `—` for the signature and explain the requirement in the semantics column; every dependency-contract row appears in the architecture interface matrix and vice versa (bidirectional traceability); the matrix's summary matches the calling module's row word-for-word. Statuses are one of 已落地 / 待提供 / 有差异 and appear **only in the matrix** — a status column in a module document is an issue, because flipping a row must never require editing another module's document. A `待提供` row whose provider module has already been designed is an issue — the provider was required to flip it to 已落地 or 有差异, so an unflipped row means the gap has no owner |
    | Flow completeness | Two layers, checked separately. **(architecture)** every functional flow is registered — including one whose module-level chain completes inside a single module — and each states its 服务功能点, its trigger, a module-level chain naming the core class that carries each hop, the data shape per hop, where the result lands, and how the whole flow unwinds when a hop fails. **(module)** each flow states the module's entry point, the intra-module function-level chain, data-shape changes, who receives the result, the failure path, and its 服务功能点 — without restating the cross-module skeleton. A flow registered in both places must share its name and its 服务功能点 and may not restate the other layer; a purely module-internal implementation flow belongs only in the module document |
    | Class attribution **(architecture)** | The architecture's core-class list is a **subset** of the union of the **already-designed** modules' class lists; every core-class entry satisfies the core-class criterion (it appears on the module-level chain of a section 10 flow, or it is the interface carrier of a section 7 matrix row — the interface carrier being the class named in that row's dependency-summary column); a core class owned by an **already-designed** module whose class list does not contain it is an issue, and the same class owned by two modules is an issue; a core class owned by a module that is still 未设计 is registered provisionally and is **not** an issue, but must be reconciled into that module's class list when the module is designed. The architecture file tree covers module folders and core files and can locate every core class's `定义文件`; a tree that stops at module folders is **not** a defect, and a non-core source file's absence is **not** a defect. A module marked 已设计 has a document that exists, one marked 未设计 has no document yet and carries the `（待创建）` marker, and no module document exists whose module is absent from the list |
    | Functional-point coverage | The functional-point list in architecture section 5 is complete — every capability the system provides appears and nothing invented; each functional point is served by at least one section 10 flow, and each section 10 flow names at least one functional point (bidirectional coverage); a functional point listed in a module document's section 1.2 exists in architecture section 5 and vice versa, and each module's section 1.2 agrees with that module's section 5 服务功能点 annotations; a functional point claimed by no module is an issue. A 功能点 is a descriptive requirement entry — who needs it in what situation and what it achieves — and must **not** be a requirement ID plus acceptance criteria; Given/When/Then must not appear |
    | Cross-document consistency | Dependency-contract rows and interface-matrix rows agree in both directions; every **functional** flow — including one whose module-level chain stays inside a single module — appears in the architecture's global flow section with the matching name and 服务功能点, and no module document claims a global flow that the architecture does not have; a purely module-internal **implementation** flow must not be registered there; module names are unique across the list and match file names and the matrix's "详见" references, with no reference pointing at a renamed or deleted module; cross-references use the project-root-relative path form (`specs/design/02-通信模块.md`) rather than bare file names or `../` hops |
    | Incremental merge integrity | Every document and section the approved change list declared untouched is word-for-word unchanged (the 最近更新 line is the one permitted exception); no content from other modules or earlier discussions was silently dropped — in particular, a module document redrafted wholesale rather than merged, and any document the change list did not name as modified. When the change list announced an architecture overhaul, check that the existing documents were still walked entry by entry and that whatever still holds was kept, rather than regenerated |
    | Completeness | No TBD/TODO/placeholders/empty sections; background, comparison, recommendation, and decisions are all substantive |
    | Consistency **(architecture)** | No contradictions between sections; the recommended approach matches the comparison's conclusion |
    | Decision traceability | Key decisions state their rationale and rejected alternatives |
    | Ambiguity | Sentences that could be read two ways, enough to produce the wrong design |
    | Scope | **(architecture)** one project's architecture, expressed as a module split, flow set, and file tree — not a grab-bag of unrelated systems; **(module)** one module, not several |

    ## Calibration

    **Only flag issues that would cause real problems during later specification or implementation.**

    These are issues: a missing section, a contradiction, a class with no field or
    function table and no `不适用` reason, a dependency contract that stops at a
    name with no signature, a dependency that is not traceable in both directions,
    a `待提供` row whose provider module has already been designed, a status column
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

    These are **not** issues: field tables, function signature tables, call chains,
    data-shape tables, or interface matrices. Those are required design description
    and must not be reported as "spec mode". Nor is a table marked `不适用` with a
    stated reason — that is the template working as designed. An architecture file
    tree that stops at module folders and core files, and an architecture core-class
    list that is a strict subset of the **already-designed** modules' class lists, are both the templates
    working as designed. Neither are wording style, uneven section depth, "could be
    more detailed", or a document not carrying the other template's sections.

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
