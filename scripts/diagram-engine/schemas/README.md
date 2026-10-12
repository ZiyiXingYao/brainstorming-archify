# Archify JSON IR Schemas

Each typed renderer consumes a JSON intermediate representation (IR) validated
against one of the schemas in this folder before any layout work happens.

## Files

| Schema | Governs | Structural arrays |
|--------|---------|-------------------|
| `workflow.schema.json` | `diagram_type: "workflow"` | `lanes`, `phases`, `groups`, `mainPath`, `nodes`, `edges` |
| `sequence.schema.json` | `diagram_type: "sequence"` | `participants`, `segments`, `messages`, `activations` |
| `dataflow.schema.json` | `diagram_type: "dataflow"` | `stages`, `nodes`, `flows` |
| `lifecycle.schema.json` | `diagram_type: "lifecycle"` | `lanes`, `states`, `transitions` |
| `architecture.schema.json` | `diagram_type: "architecture"` | `components`, `boundaries`, `connections` |
| `common.schema.json` | shared `$defs` only (no top-level document) | — |

Every diagram schema requires `schema_version`, `diagram_type`, `meta` (with
`title` and a durable portable `output`), and its structural arrays — except `segments`, `activations`, and
`cards`, which are optional — and sets `additionalProperties: false` at every
level, so unknown fields are rejected rather than silently ignored.

Every `meta` object also accepts `animation: "trace"` for opt-in SVG/CSS motion
in generated HTML. Omit it, or set `"none"`, for the default static output.
It also accepts `locale`, any well-formed language tag (schema pattern
`^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`). The field selects the fixed Viewer UI,
renderer-owned default legend and accessibility copy, document-title suffix,
and `<html lang>` value; it does not translate authored strings. `en` and
`zh-CN` are built-in catalogs; any other tag needs a matching `translations`
object (see below) or the renderer falls back to English and discloses it.
Omitting `locale` preserves legacy behavior and resolves to English.
Malformed locale tags fail schema validation instead of being guessed or
silently rewritten.

`meta.translations` supplies the Viewer message catalog for a `locale` with no
built-in catalog, as data: an object mapping canonical message keys (see
`catalogKeys()` in `renderers/shared/i18n.mjs`) to translated strings whose
`{placeholder}` tokens match the English source. A key that is missing,
unrecognized, or has mismatched placeholders falls back to English rather than
failing the render; `validate`/`render`/`deliver` report the resulting
coverage to stderr. Spanish uses the reusable `examples/locales/es.json`
catalog; dev inputs that previously used only `locale: "es"` now need this
object in `meta.translations` to retain Spanish UI.
`visual_preset` accepts `classic` (the stable default), `signal-flow` (luminous
motion-forward presentation), `blueprint` (high-contrast engineering review),
or `editorial` (warm publication-style design review and documentation).
Presets change only viewer styling; they do not alter semantic IDs or geometry.
Sequence `meta` additionally accepts `column_fit`. The default `fixed` keeps
the historical 108px column gap and 86px participant boxes, so an authored
diagram renders at the same coordinates no matter how wide its viewBox is.
`spread` derives the gap and box width from the viewBox instead, which turns a
wide canvas into column distance and label room rather than empty space on the
right. Lane order, IDs, and message semantics are unchanged either way.

`meta.views` is retired. The schemas still accept the old guided-view shape so
existing files keep validating, but renderers ignore it; do not author it.

### Legend presentation contract

Every `meta` object accepts the same optional legend shape without changing
the schema version already selected for that renderer:

```json
"legend": {
  "mode": "auto",
  "entries": {
    "security": { "label": "restricted data", "visible": true }
  }
}
```

`mode` is `auto` (the default), `all`, or `hidden`. `auto` includes only kinds
present in typed IR; `all` includes the renderer's full stable catalog;
`hidden` removes the complete legend and takes precedence over entry overrides.
Architecture documents that omit an explicit `viewBox` size that automatic
viewBox from the same measured resolved legend footprint used for final SVG
layout. Across all renderers, legacy documents that omit `meta.legend` use a
compatibility-safe implicit `auto`: if the resolved legend cannot fit an
explicit authored viewBox without overlap, Archify omits the complete legend
instead of turning a previously valid schema-v1 document into a hard failure.
Once an author adds `meta.legend` (including explicit `mode: "auto"`), the
layout is intentional and unfit labels or bands fail with a path-prefixed
diagnostic. An entry may set a non-empty, bounded `label`, boolean `visible`,
or both.
`visible: false` removes a resolved entry and `visible: true` forces a supported
but unused kind into the visual legend. Unknown kinds and properties fail
strict validation.

Supported keys are renderer-owned:

| Renderer | `meta.legend.entries` keys |
|---|---|
| Architecture | `frontend`, `backend`, `database`, `cloud`, `security`, `messagebus`, `external` |
| Workflow | `frontend`, `backend`, `security`, `messagebus`, `database`, `cloud`, `external` |
| Sequence | `emphasis`, `return`, `security`, `dashed`, `default` |
| Dataflow | `emphasis`, `security`, `dashed`, `database`, `default` |
| Lifecycle | `start`, `active`, `waiting`, `decision`, `success`, `failure`, `neutral`, `external` |

Labels are presentation only: they do not rename the stable kind, change
nodes/relationships, or create Semantic Lens edge facts. Sequence message and
Dataflow flow-variant entries are visual keys. Component/state entries backed
by exact compiled node facts receive the interactive Semantic Legend bridge;
this includes Dataflow `database` when a real `nodes[].type: "database"` fact
exists.

Every relationship collection (`connections`, `edges`, `messages`, `flows`, and
`transitions`) accepts an optional author-controlled `id` using the shared ID
pattern. The renderer keeps its source-order runtime key separately, while the
authored ID enables a stable `#relation=<id>` viewer link that survives array
reordering. ID-less documents remain valid and their relationship pins stay
local to the current page.

Every semantic node collection (`components`, `nodes`, `participants`, and
`states`) also accepts one optional `brand`: a canonical built-in brand ID, as
listed in `renderers/shared/generated-brand-marks.mjs`, written as its id, its
title, or an alias (for example `github`). This build has **no brand-capture
capability and never makes a network request**: any HTTP(S) URL — even one whose
host belongs to a known brand — is rejected by the renderer with a
`brand/unsupported-url` diagnostic, and a bare domain (`github.com`) is not a
brand ID either and fails as `brand/unknown`. The schema therefore declares
`brand` as a bounded plain string and no longer blesses the upstream
digest-pinned `{ "url", "sha256" }` object form. Omitted `brand` preserves the
prior output.

## schema_version policy

Workflow supports schema versions 1 and 2. Version 1 remains the fixed-layout
compatibility contract; version 2 opts into the readable workflow compiler. This
build has no `migrate` subcommand — author schema version 2 directly.
Lifecycle also supports versions 1 and 2 with the same fields. Version 1 keeps
the fixed three-band layout; version 2 renders one row per lane on a shared
column grid (see the [lifecycle renderer](../renderers/lifecycle/README.md)).
Lifecycle has no migration command either: to adopt v2, set `schema_version: 2`,
re-place lower-lane `col` values on the shared grid (v1 column `N` sat under
main column `N + 2`), and drop coordinates authored for the v1 canvas
(`viewBox`, `via`, `channelX`, `channelY`, `labelAt`).
The other three diagram schemas keep `schema_version` pinned to `1`; they have
no schema-version migration command. For any of the five diagram types, repair
a legacy missing or nonportable `meta.output` in the source and run `validate`.

Workflow also accepts optional `semanticChecks`. `allowedRoots` and
`allowedTerminals` close the set of intentional graph sources and sinks;
`requiredEdges` requires exact authored relationships; and `requiredPaths`
requires directed reachability while allowing intermediate nodes. The compiler
evaluates these facts before layout and returns typed `workflow/*` diagnostics.
The field is additive and geometry-neutral: omitting it preserves existing
workflow behavior and including a satisfied contract does not change SVG or
layout-receipt bytes.

A file that validates today must keep validating and rendering within its
declared version throughout the 2.x release line. The explicitly reviewed
portable-output hardening is the one exception: older v1 documents that omit
`meta.output` must add a portable POSIX-relative `.html` path (for example,
`reports/diagram.html`); ordinary explicit CLI output arguments do not replace
this durable authored value. Additive viewer,
accessibility, and presentation improvements may enhance generated HTML, but
they must not reinterpret authored IR or turn a previously valid profile-less
v1 file into a new hard layout failure. Breaking IR changes require a new
version; additive, backwards-compatible fields do not.

## Shared definitions (common.schema.json)

The five diagram schemas reference `common.schema.json#/$defs/...`:

- `id` — element identifiers, pattern `^[a-zA-Z][a-zA-Z0-9_-]*$`
- `point` — an `[x, y]` pair of numbers (used by `via` and `labelAt`)
- `componentType` — `frontend`, `backend`, `database`, `cloud`, `security`,
  `messagebus`, `external`
- `locale` — a well-formed renderer locale tag (`en` and `zh-CN` are built in;
  any other tag needs a matching `translations` object)
- `translations` — canonical message key → translated string, for a `locale`
  with no built-in catalog
- `portableOutputPath` — the portable POSIX-relative `.html` path used by
  `meta.output`; see `renderers/shared/output-path.mjs` for the two output-path boundaries
- `brandMark` — one optional bounded brand ID string (an id, title or alias); URLs are rejected by the renderer
- `variant` — `default`, `emphasis`, `security`, `dashed` (sequence messages
  extend this list locally with `return`)
- `legendMode` and `legendEntry` — the shared strict mode and label/visibility
  override shapes used by each renderer-owned key map
- `guidedViews` — the retired `meta.views` shape, still accepted and ignored
- `cards` — the summary-card blocks rendered below the SVG

Lifecycle state `type` is mode-specific (`start`/`active`/`waiting`/...) and
stays in `lifecycle.schema.json`.

The JSON Schema definition is the portable contract's structurally expressible
preflight. The shipped generated validator wrapper and CLI additionally enforce
byte-based component limits and the complete runtime path contract; consumers
that need the same cross-platform acceptance boundary should use that wrapper.

## Runtime validation

At development time, `scripts/generate-validators.mjs` compiles all five
schemas with ajv's draft 2020-12 standalone generator using `strict: true` and
`allErrors: true`. The generated `renderers/shared/generated-validators.mjs`
is committed and shipped with the skill, so runtime validation has no npm or
network dependency. `renderers/shared/validator.mjs` applies the matching
standalone validator before the renderer's own layout checks.
The shared loader then checks cross-collection facts that JSON Schema cannot
express cleanly here: duplicate view IDs, duplicate focus IDs, focus IDs that do
not exist in the diagram's semantic collection, and duplicate authored
relationship IDs within the mode's relationship collection.

All five modes still declare an opt-in, revision-pinned repository evidence
shape. `meta.repository` names the repository URL and full commit SHA, with
optional `provider` (`github` or `gitee`) and `link_mode` (`web` or `local-only`);
a node may carry one to three `sources` with repo-relative POSIX paths, optional
line ranges, and optional labels. Sources are authored on the mode's own node
collection — Architecture `components`, Workflow and Data Flow `nodes`,
Sequence `participants`, Lifecycle `states`. **The shape is still schema-checked,
but this build no longer populates it**: the revision/blob/line verification and
the `--repo-root` argument were removed together with the rest of the
code-provenance capability, so the render path always emits `null`. The fields
are kept because the Viewer's Semantic Passport still consumes them when a
caller injects a verified payload; while it is absent the passport's evidence
area stays hidden, and ordinary documents and visual exports never carry
repository paths.

## Visual quality and engineering truth

`meta.quality_profile` and `meta.engineering_profile` answer different
questions. `quality_profile` is available in all five modes and controls how
strictly Archify judges composition. `engineering_profile` is an optional
Architecture-only semantic contract; omitting it preserves the ordinary v1
behavior.

The first engineering profile is `deployment-ownership`. Enable it only when
the user wants a fail-closed deployment review and the source facts are known.
It requires every non-external component to name an owner in `tag` and belong
to exactly one `region`; the document must contain both `region` and
`security-group` boundaries; every `database` must be inside a
`security-group`; each security group must contain members from one shared
region; and every connection whose region or security-group membership changes
must name the real crossing mechanism in `label`.

The profile validates only authored IR. It does not discover infrastructure,
infer owners, or prove that a diagram matches a live environment. If a fact is
unknown, leave the profile unset or obtain the fact instead of inventing it.

`npm run check:validators` and `npm run check:brand-marks` re-run the two
generators in check mode and fail when the committed artifacts drift from
`schemas/` and `brand-marks/catalog.json`. They need the `devDependencies`
installed; the shipped skill does not, because both generated files are
committed.

## Error format

Schema violations exit non-zero. Each ajv error is reported on its own line as
the instance path — annotated with the nearest enclosing element's `id` or
`label` — followed by the message and parameters:

```text
workflow schema validation failed:
  /nodes/3 (id/label: "router") must NOT have additional properties {"additionalProperty":"colour"}
```

Schemas catch shape errors (types, enums, ranges, unknown fields); geometry
problems such as overlaps and label collisions are the renderers' job.
