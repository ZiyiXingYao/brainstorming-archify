/**
 * design-diagrams —— 图名派生（任务 2.5）
 * ============================================================================
 *
 * 目的
 * ----
 * 设计文档里的图以同伴文件 `diagrams/<图名>.svg` 落盘，文档写
 * `![说明](diagrams/<图名>.svg)`（design.md 决策四）。`<图名>` 由来源名
 * （流程名或章节语义名）按固定算法派生，供 `brainstorming-archify` 在落盘时调用。
 *
 * 算法（design.md 决策四 / execution-contract 接口约束 3）
 * ------------------------------------------------------
 *   1. 图名固定为英文 slug——来源名为非英文时先译成英文；归一保留 ASCII 字母与数字，
 *      其余字符（空白、标点、路径分隔符、非 ASCII／中日韩字符等）替换为 `-`；
 *   2. 连续 `-` 折叠为单个 `-`；
 *   3. 去掉首尾 `-`；
 *   4. ASCII 部分小写化（只对 `[A-Z]` 逐字符降格，不依赖 `toLowerCase()` 的全量改写）；
 *   5. 派生结果为空时回落到该图的图类型名（如 `architecture`）；
 *   6. 派生结果冲突时追加 `-2`、`-3`（依次递增），并把冲突双方报告出来，不静默改名。
 *
 * 「字母」用 ASCII 字符类 `[A-Za-z]` 表达——图名不得含 CJK，故不用 `\p{L}`（它会放行中文）。
 *
 * 本文件为**新增文件**，不修改任何上游搬运文件，也不安装任何依赖。
 */

/** 允许保留的字符类：ASCII 字母与数字（图名固定为英文 slug）。 */
const KEEP = /[A-Za-z0-9]/;

/** 替换类：一段连续的非保留字符（含空白、标点与所有非 ASCII／CJK 字符）。 */
const SEPARATOR_RUN = /[^A-Za-z0-9]+/g;

/** 连续 `-`。 */
const REPEATED_DASH = /-+/g;

/** 首尾 `-`。 */
const EDGE_DASH = /^-+|-+$/g;

/** ASCII 大写字母。 */
const ASCII_UPPER = /[A-Z]/g;

/**
 * 是否含有至少一个可保留字符（ASCII 字母/数字）。
 * @param {string} raw
 * @returns {boolean}
 */
function hasNameCharacters(raw) {
  return KEEP.test(raw);
}

/**
 * 由来源名派生 slug（含「空结果回落图类型名」）。
 *
 * @param {unknown} sourceName 来源名（流程名 / 章节语义名）
 * @param {unknown} type 图类型名（回落值）
 * @returns {string}
 */
export function deriveDiagramSlug(sourceName, type) {
  return slugParts(sourceName, type).slug;
}

/**
 * 派生 slug 并告知是否发生了「空结果回落」。
 *
 * @param {unknown} sourceName
 * @param {unknown} type
 * @returns {{slug: string, fellBack: boolean}}
 */
export function slugParts(sourceName, type) {
  const raw = sourceName === null || sourceName === undefined ? '' : String(sourceName);
  const stripped = raw
    .replace(SEPARATOR_RUN, '-')
    .replace(REPEATED_DASH, '-')
    .replace(EDGE_DASH, '');
  const lowered = stripped.replace(ASCII_UPPER, (char) => char.toLowerCase());
  const fellBack = !hasNameCharacters(raw);
  const fallback = type === null || type === undefined || String(type) === '' ? 'diagram' : String(type);
  return { slug: fellBack ? fallback : lowered, fellBack };
}

/**
 * 派生可用作文件名的图名，并在冲突时追加 `-2`、`-3`… 且报告冲突。
 *
 * @param {unknown} sourceName 来源名
 * @param {unknown} type 图类型名
 * @param {Iterable<string>} [taken] 已被占用的图名
 * @returns {{
 *   source: string,
 *   type: unknown,
 *   slug: string,
 *   name: string,
 *   fellBack: boolean,
 *   conflict: null | {base: string, collidedWith: string, attempt: number, name: string},
 * }}
 */
export function deriveDiagramName(sourceName, type, taken = []) {
  const used = new Set(Array.from(taken, (value) => String(value)));
  const { slug, fellBack } = slugParts(sourceName, type);

  let name = slug;
  let attempt = 0;
  let collidedWith = null;
  while (used.has(name)) {
    if (collidedWith === null) collidedWith = name;
    attempt += 1;
    name = `${slug}-${attempt + 1}`;
  }

  return {
    source: sourceName === null || sourceName === undefined ? '' : String(sourceName),
    type,
    slug,
    name,
    fellBack,
    conflict: attempt === 0 ? null : { base: slug, collidedWith, attempt, name },
  };
}

/**
 * 批量派生图名：按顺序解决冲突，并把「冲突双方」成组报告出来。
 *
 * @param {Array<{source: unknown, type: unknown}>} entries
 * @returns {{
 *   entries: Array<ReturnType<typeof deriveDiagramName>>,
 *   conflicts: Array<{base: string, sides: Array<{source: string, type: unknown, name: string}>}>,
 * }}
 */
export function deriveDiagramNames(entries = []) {
  const used = new Set();
  const results = [];
  const groups = new Map();

  for (const entry of entries) {
    const source = entry && entry.source !== null && entry.source !== undefined ? String(entry.source) : '';
    const type = entry ? entry.type : undefined;
    const resolved = deriveDiagramName(source, type, used);
    used.add(resolved.name);
    results.push(resolved);

    if (!groups.has(resolved.slug)) groups.set(resolved.slug, []);
    groups.get(resolved.slug).push({ source, type, name: resolved.name });
  }

  const conflicts = [];
  for (const [base, sides] of groups) {
    if (sides.length > 1) conflicts.push({ base, sides });
  }

  return { entries: results, conflicts };
}
