/**
 * Brand marks — bundled catalogue resolution only.
 *
 * This build has **no capture capability and never makes a network request**.
 * A `brand` value must resolve to a bundled canonical ID (its id, title, or an
 * alias). An HTTP(S) URL — including one whose host belongs to a known brand —
 * and a pinned `{ url, sha256 }` object are both rejected with a
 * `brand/unsupported-url` diagnostic.
 *
 * The upstream fetch machinery (DNS resolution, pinned-socket HTTP, favicon
 * discovery, image sniffing) was removed together with the `--repo-root`
 * code-provenance capability, so nothing here can reach the network.
 */

import { BRAND_MARKS } from './generated-brand-marks.mjs';
import { throwDiagnosticError } from './diagnostics.mjs';
import { minimumNodeTextWidth } from './text-fit.mjs';
import { esc } from './utils.mjs';

const COLLECTIONS = Object.freeze({
  architecture: 'components',
  workflow: 'nodes',
  sequence: 'participants',
  dataflow: 'nodes',
  lifecycle: 'states',
});
const MARK_BY_LOOKUP = new Map();
const RESOLVED_BY_NODE = new WeakMap();
const RESOLVED_MARK = Symbol('archify.brandMark');
/** 品牌徽标在节点顶栏占据的横向宽度：徽标 16px + 内缩 3px + 与标签间的间距。 */
const BRAND_RAIL_WIDTH = 48;

function lookupForms(value) {
  const raw = String(value ?? '').trim().toLocaleLowerCase('en-US');
  if (!raw) return [];
  const dashed = raw.replace(/[\s_]+/g, '-');
  const compact = raw.replace(/[\s_.-]+/g, '');
  return [...new Set([raw, dashed, compact])];
}

for (const mark of BRAND_MARKS) {
  for (const value of [mark.id, mark.title, ...mark.aliases]) {
    for (const form of lookupForms(value)) {
      if (!MARK_BY_LOOKUP.has(form)) MARK_BY_LOOKUP.set(form, mark);
    }
  }
}

function isHttpUrl(value) {
  try {
    return ['https:', 'http:'].includes(new URL(String(value)).protocol);
  } catch {
    return false;
  }
}

export function findBrandMark(value) {
  for (const form of lookupForms(value)) {
    const mark = MARK_BY_LOOKUP.get(form);
    if (mark) return mark;
  }
  return null;
}

function suggestions(value) {
  const needle = lookupForms(value)[0];
  // 纯空白值会退化出空 needle，此时任何包含判断都恒真，候选列表只能是字母序垃圾。
  if (!needle) return [];
  return BRAND_MARKS.map((mark) => ({
    id: mark.id,
    // 反向包含（输入里含某个 ID 片段）只在片段够长时才算命中：否则单字符 ID
    // （目录里存在 `x`）会在任何含该字母的输入上冒充「相近 ID」。
    score: lookupForms(mark.id).some((form) => form.includes(needle)
      || (needle.length >= 3 && needle.includes(form))) ? 0 : 1,
  })).sort((left, right) => left.score - right.score || left.id.localeCompare(right.id))
    .slice(0, 5)
    .map((entry) => entry.id);
}

export async function prepareDiagramBrandMarks(diagramType, diagram) {
  const collection = COLLECTIONS[diagramType];
  const nodes = collection && Array.isArray(diagram[collection]) ? diagram[collection] : [];
  const unknown = [];
  for (const [index, node] of nodes.entries()) {
    if (!node.brand) continue;
    const subject = `/${collection}/${index}/brand`;
    if (typeof node.brand === 'object') {
      unknown.push({
        code: 'brand/unsupported-url',
        message: `${subject} is a pinned URL object; this build supports built-in brand IDs only`,
      });
      continue;
    }
    const preset = findBrandMark(node.brand);
    if (preset) {
      const resolved = { ...preset, kind: 'preset', status: 'preset', sourceUrl: preset.provenance.source };
      node[RESOLVED_MARK] = resolved;
      RESOLVED_BY_NODE.set(node, resolved);
      continue;
    }
    if (isHttpUrl(node.brand)) {
      unknown.push({
        code: 'brand/unsupported-url',
        message: `${subject} ${JSON.stringify(node.brand)} is a URL; this build supports built-in brand IDs only`,
      });
      continue;
    }
    unknown.push({
      code: 'brand/unknown',
      message: `${subject} ${JSON.stringify(node.brand)} is not a built-in brand; closest IDs: ${suggestions(node.brand).join(', ')}`,
    });
  }
  if (unknown.length) {
    // code 与修法来自收集时的显式分类，不再对人工可读消息做 includes 嗅探——
    // 后者会被作者写的品牌值（例如 "myURL"）误触发，也会随文案调整静默漂移。
    throwDiagnosticError(
      `Brand mark validation failed:\n- ${unknown.map((entry) => entry.message).join('\n- ')}`,
      unknown.map((entry) => ({
        code: entry.code,
        severity: 'error',
        message: entry.message,
        subject: { diagramType, collection },
        evidence: {},
        supportedFixes: entry.code === 'brand/unsupported-url'
          ? ['author a built-in brand ID instead; this build never captures a site URL']
          : ['choose a built-in brand ID from renderers/shared/generated-brand-marks.mjs'],
      })),
    );
  }
}

export function brandMarkFor(node) {
  return node?.[RESOLVED_MARK] || RESOLVED_BY_NODE.get(node) || null;
}

export function brandMetadataFor(node) {
  const mark = brandMarkFor(node);
  return mark ? {
    brand: mark.title,
    brandId: mark.id,
    brandStatus: mark.status,
    brandSource: mark.sourceUrl,
  } : {};
}

export function brandLabelFitWidth(node, width) {
  return brandMarkFor(node) ? Math.max(1, width - BRAND_RAIL_WIDTH) : width;
}

export function brandTopRailProblem(node, width, minimumFontSize, subject = 'Node') {
  if (!brandMarkFor(node)) return null;
  const available = width - BRAND_RAIL_WIDTH;
  const required = minimumNodeTextWidth(node.label, minimumFontSize);
  if (available >= required) return null;
  return `${subject} "${node.id}" brand top rail leaves ${Math.max(0, available)}px for its label, but `
    + `"${node.label}" needs ~${Math.ceil(required)}px at the ${minimumFontSize}px legible minimum — widen the node or shorten the label.`;
}

function markAttrs(mark) {
  return [
    `data-brand-mark="${esc(mark.id)}"`,
    `data-brand-title="${esc(mark.title)}"`,
    `data-brand-status="${esc(mark.status)}"`,
    mark.sourceUrl ? `data-brand-source="${esc(mark.sourceUrl)}"` : '',
    mark.sha256 ? `data-brand-sha256="${esc(mark.sha256)}"` : '',
  ].filter(Boolean).join(' ');
}

/**
 * 渲染品牌徽标。
 *
 * `kind` 由 `prepareDiagramBrandMarks` 写入，本构建下**恒为 `preset`**：`remote` 与
 * 末尾兜底两个分支当前没有生产者，保留为扩展点（例如将来由调用方注入一份已验证的
 * 图形），所以这里也不会发起任何网络请求——`remote` 用的是内联 `data:` URL。
 */
export function renderBrandMark(node, { x, y, size = 16 } = {}) {
  const mark = brandMarkFor(node);
  if (!mark) return '';
  const inset = 3;
  let content;
  if (mark.kind === 'preset') {
    const scale = (size - inset * 2) / mark.viewBox;
    content = `<path d="${esc(mark.path)}" transform="translate(${inset} ${inset}) scale(${scale})" fill="#${esc(mark.hex)}"/>`;
  } else if (mark.kind === 'remote') {
    content = `<image href="${esc(mark.dataUrl)}" x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const scale = size / 20;
    content = `<g transform="scale(${scale})" class="brand-mark-fallback"><circle cx="10" cy="10" r="5.2"/><path d="M4.8 10h10.4M10 4.8c1.6 1.6 2.4 3.3 2.4 5.2s-.8 3.6-2.4 5.2M10 4.8C8.4 6.4 7.6 8.1 7.6 10s.8 3.6 2.4 5.2"/></g>`;
  }
  return `<g aria-hidden="true" ${markAttrs(mark)} class="brand-mark" transform="translate(${x} ${y})">
            <rect width="${size}" height="${size}" rx="4" class="brand-mark-badge"/>
            ${content}
            <rect width="${size}" height="${size}" rx="4" class="brand-mark-frame"/>
          </g>`;
}
