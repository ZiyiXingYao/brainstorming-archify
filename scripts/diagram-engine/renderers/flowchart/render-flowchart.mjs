import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderDefinitions, renderSemanticSigil, textUnits, SEMANTIC_SIGIL_INSET, SEMANTIC_SIGIL_FOOTPRINT } from '../shared/utils.mjs';
import {
  animateAttr,
  focusEdgeAttrs,
  focusNodeAttrs,
  focusNodeTitle,
  loadDiagramWithBrandMarks,
  svgAccessibleText,
  svgRootAttrs,
  writeDiagram,
} from '../shared/cli.mjs';
import { brandMarkFor, renderBrandMark } from '../shared/brand-marks.mjs';
import { throwDiagnosticError } from '../shared/diagnostics.mjs';
import { arrowClassMap, edgeLabelAccent, routePointsValue } from '../shared/geometry.mjs';
import { fittedNodeFontSize, minimumNodeTextWidth, nodeLabelLayout } from '../shared/text-fit.mjs';
import {
  legendFootprint,
  relationshipLegendObstacles,
  resolveLegend,
  renderLegend as renderResolvedLegend,
} from '../shared/legend.mjs';
import { translateMessage as i18nText } from '../shared/i18n.mjs';

// ---------------------------------------------------------------------------
// flowchart — 程序设计流程图（本仓库自建类型，上游 archify 没有）
//
// 词汇：start / end（起止端子）、process（处理）、decision（判断，带条件标签的
// 多分支）、io（输入输出）、loop（循环头）、exception（失败或回滚）。
// 布局：自上而下的分层。前向边从源底部出、目标顶部入；回边与跨层边走右侧通道。
// 事实口径：图只画作者声明的节点与边，不推断任何结构；结构不合规即报诊断，
// 不静默修补。
//
// 风格口径：本类型的**布局**（分层 / 重心排序 / 回边走廊）是自有的，但**成色与
// 文本度量全部复用内核共享件**，与 lifecycle / architecture 同构：
//   - 节点配色走内核 tone 调色板（kind → c-<tone>，见 KIND_STYLE）；
//   - 节点文字走 text-fit（fittedNodeFontSize / minimumNodeTextWidth / nodeLabelLayout）；
//   - 边样式走 arrowClassMap（a-<variant> 类 + arrowhead 标记）与 edgeLabelAccent；
//   - 语义角标走 renderSemanticSigil；图例走 resolveLegend / renderLegend。
// 不自定义 shape 颜色、不自定义 marker——避免与内核其它类型画风不一致。
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'flowchart',
  defaultExample: 'program-flow.flowchart.json',
  argv: process.argv,
});

const nodes = diagram.nodes;
const edges = diagram.edges;
const locale = diagram.meta?.locale;
const problems = [];

// ---- 内核 tone 映射 --------------------------------------------------------
// kind → tone 取自内核调色板（c-frontend / c-backend / c-database / c-cloud /
// c-security / c-messagebus / c-external 由模板与主题变量提供 fill + stroke）。
// 语义与 lifecycle 同源：端子=frontend、处理步=backend、判断=database、
// 循环=cloud、异常=security、进出=messagebus。
const KIND_STYLE = {
  start: { fill: 'c-frontend', sigil: { kind: 'start', icon: 'start' } },
  end: { fill: 'c-frontend', sigil: { kind: 'start', icon: 'stop' } },
  process: { fill: 'c-backend', sigil: { kind: 'success', icon: 'active' } },
  decision: { fill: 'c-database', sigil: { kind: 'decision', icon: 'decision' } },
  loop: { fill: 'c-cloud', sigil: { kind: 'cloud', icon: 'waiting' } },
  exception: { fill: 'c-security', sigil: { kind: 'security', icon: 'failure' } },
  io: { fill: 'c-messagebus', sigil: { kind: 'messagebus', icon: 'database' } },
};
const KIND_STYLE_DEFAULT = KIND_STYLE.process;
const styleFor = (node) => KIND_STYLE[node.kind] || KIND_STYLE_DEFAULT;

// 边的 role 语义 → 内核 variant（default / emphasis / security / dashed），
// 供 arrowClassMap 与 edgeLabelAccent 复用；作者显式声明的 variant 优先。
const ROLE_VARIANT = { main: 'default', branch: 'emphasis', loop: 'dashed', exception: 'security' };

const layout = {
  margin: 40,
  top: 76,
  gapX: diagram.layout?.gapX ?? 44,
  gapY: diagram.layout?.gapY ?? 62,
  nodeW: diagram.layout?.nodeW ?? 168,
  nodeH: diagram.layout?.nodeH ?? 46,
  decisionH: 78,
  labelFont: 13,
  labelMinFont: 8,
  sublabelFont: 11,
  sublabelMinFont: 7,
  edgeFont: 11.5,
  // 估算宽度用的字宽系数（与内核 text-fit 的 nodeTextFit.widthFactor 一致）
  advance: 0.6,
  padY: 10,
  lineHeight: 18,
  sublabelLineHeight: 15,
};

// 文本内边距与左侧角标栏（与内核 text-fit 的 horizontalPadding / nodeLabelLayout
// 左栏口径一致）：折行按 TEXT_PAD 计算，框宽额外预留 RAIL_LEFT 让文字躲开角标。
const TEXT_PAD = 8;
const RAIL_LEFT = SEMANTIC_SIGIL_FOOTPRINT + 2;
// 框宽额外预留：左栏放角标 + 右侧留一点，让 nodeLabelLayout 走「保持行、右移让开
// 角标」而不是把整行压到角标下方（门槛是 width - 4 - RAIL_LEFT >= 行宽）。
const RAIL_RESERVE = RAIL_LEFT + 5;
const MIN_TEXT_INNER = 48;
const NODE_MIN_W = 120;
const NODE_MAX_W = 384;
// `layout.nodeW` 是作者可用的框宽下限（缺省时退回 NODE_MIN_W）；`layout.nodeH` 是框高下限。
const NODE_FLOOR_W = diagram.layout?.nodeW ?? NODE_MIN_W;
const IO_SKEW = 14;
// 菱形判断框：可用单行文字宽 / 半宽斜率 / 内接边距 / 容纳目标。
const DECISION_TEXT_W = 340;
const DECISION_SLOPE = 1.47;
const DECISION_PAD = 28;
const DECISION_FILL = 0.82;

// ---- 结构校验 --------------------------------------------------------------

const byId = new Map();
for (const node of nodes) {
  if (byId.has(node.id)) {
    problems.push(problem('flowchart/duplicate-id', `Node id "${node.id}" is declared more than once.`, { id: node.id }));
  }
  byId.set(node.id, node);
}
for (const edge of edges) {
  for (const end of ['from', 'to']) {
    if (!byId.has(edge[end])) {
      problems.push(problem('flowchart/unknown-endpoint',
        `Edge ${edge.from} -> ${edge.to} names ${end} "${edge[end]}", which is not a declared node.`,
        { from: edge.from, to: edge.to }));
    }
  }
}

const starts = nodes.filter((node) => node.kind === 'start');
if (starts.length !== 1) {
  problems.push(problem('flowchart/start-count',
    `A program flowchart needs exactly one start terminal; found ${starts.length}.`,
    { starts: starts.map((node) => node.id) }));
}
const ends = nodes.filter((node) => node.kind === 'end');
if (!ends.length) {
  problems.push(problem('flowchart/end-missing', 'A program flowchart needs at least one end terminal.', {}));
}

for (const decision of nodes.filter((node) => node.kind === 'decision')) {
  const outgoing = edges.filter((edge) => edge.from === decision.id);
  if (outgoing.length < 2) {
    problems.push(problem('flowchart/decision-branches',
      `Decision "${decision.id}" has ${outgoing.length} outgoing edge(s); a decision needs at least two labelled branches.`,
      { id: decision.id }));
  }
  for (const edge of outgoing) {
    if (!edge.label) {
      problems.push(problem('flowchart/branch-label',
        `Branch ${decision.id} -> ${edge.to} carries no condition label; every decision branch must state its condition.`,
        { from: decision.id, to: edge.to }));
    }
  }
}

if (problems.length) {
  throwDiagnosticError(
    `Flowchart structure is invalid:\n- ${problems.map((entry) => entry.message).join('\n- ')}`,
    problems,
  );
}

// ---- 分层 ------------------------------------------------------------------

const adjacency = new Map(nodes.map((node) => [node.id, []]));
for (const edge of edges) {
  if (adjacency.has(edge.from) && byId.has(edge.to)) adjacency.get(edge.from).push(edge.to);
}

const startId = starts[0]?.id ?? nodes[0]?.id;
const hops = new Map([[startId, 0]]);
const queue = [startId];
while (queue.length) {
  const current = queue.shift();
  for (const next of adjacency.get(current) || []) {
    if (hops.has(next)) continue;
    hops.set(next, hops.get(current) + 1);
    queue.push(next);
  }
}

const unreachable = nodes.filter((node) => !hops.has(node.id));
if (unreachable.length) {
  throwDiagnosticError(
    `These nodes cannot be reached from the start terminal: ${unreachable.map((node) => node.id).join(', ')}.`,
    [problem('flowchart/unreachable',
      `These nodes cannot be reached from the start terminal: ${unreachable.map((node) => node.id).join(', ')}.`,
      { ids: unreachable.map((node) => node.id) })],
  );
}

// 回边 = 指向 DFS 栈上祖先的边（标准定义）。用跳数比较会把「跳数相同的合法
// 前向边」误判成回边，从而给汇合点少排一层，必须用祖先关系判定。
const visitState = new Map();
const backKeys = new Set();
const edgeKey = (edge) => `${edge.from}\u0000${edge.to}`;
const visit = (id) => {
  visitState.set(id, 1);
  for (const edge of edges) {
    if (edge.from !== id) continue;
    const state = visitState.get(edge.to) ?? 0;
    if (state === 1) backKeys.add(edgeKey(edge));
    else if (state === 0) visit(edge.to);
  }
  visitState.set(id, 2);
};
visit(startId);

const forward = edges.filter((edge) => !backKeys.has(edgeKey(edge)));
const backward = edges.filter((edge) => backKeys.has(edgeKey(edge)));

// 前向无环图上做最长路径分层
const indegree = new Map(nodes.map((node) => [node.id, 0]));
for (const edge of forward) indegree.set(edge.to, indegree.get(edge.to) + 1);
const rank = new Map([[startId, 0]]);
const ready = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
const order = [];
while (ready.length) {
  const current = ready.shift();
  order.push(current);
  for (const edge of forward) {
    if (edge.from !== current) continue;
    rank.set(edge.to, Math.max(rank.get(edge.to) ?? 0, (rank.get(current) ?? 0) + 1));
    indegree.set(edge.to, indegree.get(edge.to) - 1);
    if (indegree.get(edge.to) === 0) ready.push(edge.to);
  }
}
for (const node of nodes) if (!rank.has(node.id)) rank.set(node.id, 0);

/** 跨层前向边（层距 > 1）：与回边一样走外侧走廊。 */
const longEdges = forward.filter((edge) => (rank.get(edge.to) ?? 0) > (rank.get(edge.from) ?? 0) + 1);

// ---- 文本度量与折行（复用内核 text-fit 口径）--------------------------------

const round = (value) => Math.round(value * 10) / 10;
const labelWidthPx = (text, font) => textUnits(text) * font * layout.advance;
const maxLineWidthPx = (lines, font) => lines.reduce((max, line) => Math.max(max, labelWidthPx(line, font)), 0);

/** 把一个超宽词按字素切到可容纳宽度。 */
function breakLongSegment(segment, maxWidth, font) {
  const pieces = [];
  let buffer = '';
  for (const char of Array.from(segment)) {
    if (buffer !== '' && labelWidthPx(buffer + char, font) > maxWidth) {
      pieces.push(buffer);
      buffer = char;
    } else {
      buffer += char;
    }
  }
  if (buffer !== '') pieces.push(buffer);
  return pieces;
}

/**
 * 贪心折行：优先在空白处断开；CJK 无空白则按字素断开。返回值至少一行。
 * 与内核一致地在**首选字号**下折行，缩字号只作兜底。
 */
function wrapLabel(text, maxWidth, font) {
  const segments = String(text ?? '').split(/(\s+)/).filter((segment) => segment !== '');
  const lines = [];
  let line = '';
  const flush = () => { if (line !== '') { lines.push(line); line = ''; } };
  for (const segment of segments) {
    if (/^\s+$/.test(segment)) {
      if (line !== '' && labelWidthPx(`${line} `, font) <= maxWidth) line += ' ';
      continue;
    }
    const candidate = line + segment;
    if (labelWidthPx(candidate, font) <= maxWidth) { line = candidate; continue; }
    flush();
    if (labelWidthPx(segment, font) <= maxWidth) { line = segment; continue; }
    const pieces = breakLongSegment(segment, maxWidth, font);
    for (let index = 0; index < pieces.length - 1; index += 1) lines.push(pieces[index]);
    line = pieces[pieces.length - 1] ?? '';
  }
  flush();
  return lines.length ? lines : [String(text ?? '')];
}

// 折行上限：超过它的标签在流程图里已不可读，宁可拒绝也不硬塞。缩字号最多到可读下限。
const MAX_LABEL_LINES = 4;

/**
 * 折行 + 缩字号：从首选字号往下试，取第一个能把标签压进 MAX_LABEL_LINES 行的字号
 * （越小一行装得越多、行数越少）；到可读下限仍压不进则返回最低字号的结果并标记超限。
 */
function fitLines(label, innerW) {
  for (let font = layout.labelFont; font >= layout.labelMinFont; font -= 0.5) {
    const lines = wrapLabel(label, innerW, font);
    if (lines.length <= MAX_LABEL_LINES) return { lines, font, overfull: false };
  }
  return { lines: wrapLabel(label, innerW, layout.labelMinFont), font: layout.labelMinFont, overfull: true };
}

// ---- 节点尺寸（放宽 → 折行 → 缩字号）---------------------------------------

const measured = new Map();

function measureNode(node) {
  if (measured.has(node.id)) return measured.get(node.id);
  const isDecision = node.kind === 'decision';
  const isIo = node.kind === 'io';
  const skewPad = isIo ? IO_SKEW * 2 : 0;
  const maxW = isDecision ? DECISION_TEXT_W : NODE_MAX_W;

  // 放宽：框宽先按单行装下整条标签取值，并额外预留左侧角标栏（RAIL_LEFT），
  // 让 nodeLabelLayout 走「保持居中、右移让开角标」而不是把文字压到角标下方。
  const singleW = Math.ceil(labelWidthPx(node.label, layout.labelFont) + RAIL_RESERVE + skewPad);
  const boxW = Math.max(NODE_FLOOR_W, Math.min(maxW, singleW));
  // 折行：超过框宽的标签按内核 horizontalPadding 口径折行（此时才可能多行）。
  const innerW = Math.max(MIN_TEXT_INNER, boxW - TEXT_PAD - skewPad);
  // 缩字号：行数超过上限时整块缩字号（行数随之下降），到可读下限仍超限则标记超限。
  const { lines, font: lineFont, overfull } = fitLines(node.label, innerW);

  const textW = maxLineWidthPx(lines, lineFont);
  const textBlockH = lines.length * layout.lineHeight;
  const sub = node.sublabel
    ? { font: fittedNodeFontSize(node.sublabel, boxW - skewPad, layout.sublabelFont, layout.sublabelMinFont) }
    : null;

  let width;
  let height;
  if (isDecision) {
    const halfW = textW / 2;
    const halfH = textBlockH / 2;
    const A = Math.max(85, DECISION_SLOPE * halfW + DECISION_PAD);
    const B = Math.max(layout.decisionH / 2, halfH / Math.max(0.1, DECISION_FILL - halfW / A));
    width = Math.round(2 * A);
    height = Math.round(2 * B);
  } else {
    width = boxW;
    height = Math.max(layout.nodeH, Math.round(layout.padY * 2 + textBlockH + (sub ? layout.sublabelLineHeight : 0)));
  }

  const size = {
    width,
    height,
    lines,
    lineFont,
    textW,
    sub,
    skewPad,
    overfull,
  };
  measured.set(node.id, size);
  return size;
}

const nodeSize = (node) => measureNode(node);

// 兜底校核：折行与缩字号都做完后，仍压不进 MAX_LABEL_LINES 行（`overfull`），
// 或某行在可读下限下仍超可用宽，一律报诊断而不是让文字溢出框外。
const textProblems = [];
for (const node of nodes) {
  const size = nodeSize(node);
  const budget = node.kind === 'decision'
    ? size.width - 2 * DECISION_PAD
    : size.width - size.skewPad - TEXT_PAD;
  if (size.overfull) {
    textProblems.push(problem('flowchart/label-overflow',
      `Node "${node.id}" label "${node.label}" needs more than ${MAX_LABEL_LINES} lines at the ${layout.labelMinFont}px legible minimum — shorten the label.`,
      { id: node.id, lines: size.lines.length }));
    continue;
  }
  for (const line of size.lines) {
    const required = minimumNodeTextWidth(line, layout.labelMinFont);
    if (required > budget) {
      textProblems.push(problem('flowchart/label-overflow',
        `Node "${node.id}" line "${line}" needs ~${Math.ceil(required)}px at the ${layout.labelMinFont}px legible minimum, but its box provides ${Math.round(budget)}px — shorten the label.`,
        { id: node.id, line }));
    }
  }
}
if (textProblems.length) {
  throwDiagnosticError(
    `Flowchart labels cannot fit their boxes:\n- ${textProblems.map((entry) => entry.message).join('\n- ')}`,
    textProblems,
  );
}

// ---- 行内顺序 ---------------------------------------------------------------

const rows = [];
for (const node of nodes) {
  const level = rank.get(node.id);
  while (rows.length <= level) rows.push([]);
  rows[level].push(node);
}

// 一趟重心排序：按前驱的平均列位置排序，压低交叉
const columnOf = new Map();
rows[0].forEach((node, index) => columnOf.set(node.id, index));
for (let level = 1; level < rows.length; level += 1) {
  const row = rows[level];
  const barycenter = new Map();
  for (const node of row) {
    const parents = forward.filter((edge) => edge.to === node.id).map((edge) => columnOf.get(edge.from));
    barycenter.set(node.id, parents.length
      ? parents.reduce((sum, value) => sum + value, 0) / parents.length
      : Number.MAX_SAFE_INTEGER);
  }
  row.sort((left, right) => barycenter.get(left.id) - barycenter.get(right.id)
    || nodes.indexOf(left) - nodes.indexOf(right));
  row.forEach((node, index) => columnOf.set(node.id, index));
}

// 回边源排在本行最左、跨层前向边源排在最右：它们的横段从节点外侧出，
// 本侧没有同行邻居才不会穿过同行节点。
const backSources = new Set(backward.map((edge) => edge.from));
const longSources = new Set(longEdges.map((edge) => edge.from));
for (const row of rows) {
  const left = row.filter((node) => backSources.has(node.id) && !longSources.has(node.id));
  const right = row.filter((node) => longSources.has(node.id) && !backSources.has(node.id));
  const middle = row.filter((node) => !left.includes(node) && !right.includes(node));
  if (!left.length && !right.length) continue;
  row.length = 0;
  row.push(...left, ...middle, ...right);
}

// ---- 坐标 ------------------------------------------------------------------

const placed = new Map();
const rowHeights = rows.map((row) => Math.max(...row.map((node) => nodeSize(node).height)));
const rowWidths = rows.map((row) => row.reduce((sum, node) => sum + nodeSize(node).width, 0)
  + layout.gapX * Math.max(0, row.length - 1));

const contentWidth = Math.max(...rowWidths);
const canvasWidth = Math.max(420, contentWidth + layout.margin * 2 + 160);
const centerX = canvasWidth / 2;
/** 画布两侧走廊的起点：最宽一行的左右缘之外，留出走廊与箭头的空间。 */
const rightGutter = Math.round(centerX + contentWidth / 2 + 28);
const leftGutter = Math.round(centerX - contentWidth / 2 - 28);

let cursorY = layout.top;
for (let level = 0; level < rows.length; level += 1) {
  const row = rows[level];
  const rowHeight = rowHeights[level];
  let cursorX = centerX - rowWidths[level] / 2;
  for (const node of row) {
    const size = nodeSize(node);
    const x = Math.round(cursorX);
    const y = Math.round(cursorY + (rowHeight - size.height) / 2);
    placed.set(node.id, { node, x, y, width: size.width, height: size.height, rank: level, size });
    cursorX += size.width + layout.gapX;
  }
  cursorY += rowHeight + layout.gapY;
}
const contentBottom = Math.round(cursorY - layout.gapY + layout.margin);

// ---- 边路由 -----------------------------------------------------------------

function portBottom(box) { return [box.x + box.width / 2, box.y + box.height]; }
function portTop(box) { return [box.x + box.width / 2, box.y]; }

let backLane = 0;
let longLane = 0;
const routed = edges.map((edge) => {
  const from = placed.get(edge.from);
  const to = placed.get(edge.to);
  if (!from || !to) return null;
  const isBack = backKeys.has(edgeKey(edge));
  const isLong = longEdges.includes(edge);
  let points;
  if (isBack || isLong) {
    // 回边走**左**走廊、跨层前向边走**右**走廊，两侧各自成列；
    // 两者的横段都从节点外侧进出（源已按本侧无邻居钉位），
    // 竖段只在走廊上，因此不与任何相邻层的边交叉。
    const channelX = isBack
      ? leftGutter - (backLane++) * 18
      : rightGutter + (longLane++) * 18;
    const fromY = from.y + from.height / 2;
    const toY = to.y + to.height / 2;
    const fromSide = isBack ? from.x : from.x + from.width;
    const toSide = isBack ? to.x : to.x + to.width;
    points = [
      [fromSide, fromY],
      [channelX, fromY],
      [channelX, toY],
      [toSide, toY],
    ];
  } else {
    const start = portBottom(from);
    const end = portTop(to);
    // 相邻层且列心接近时画一条真正的直线：列心允许有亚像素差，
    // 取两者中点作为唯一直线，避免出现 0.5px 的「微段」。
    if (Math.abs(start[0] - end[0]) < 10) {
      const x = Math.round((start[0] + end[0]) / 2);
      points = [[x, start[1]], [x, end[1]]];
    } else {
      const midY = start[1] + (end[1] - start[1]) / 2;
      points = [start, [start[0], midY], [end[0], midY], end];
    }
  }
  return { edge, points, back: isBack };
}).filter(Boolean);

const routeByEdge = new Map(routed.map((entry) => [entry.edge, entry.points]));

// 自检：边不得穿过无关节点的包围盒
if (process.env.FLOWCHART_DEBUG) {
  console.error(JSON.stringify({
    rows: rows.map((row) => row.map((node) => node.id)),
    boxes: [...placed.values()].map((box) => ({ id: box.node.id, x: box.x, y: box.y, w: box.width, h: box.height, rank: box.rank })),
    routes: routed.map((entry) => ({ edge: `${entry.edge.from}->${entry.edge.to}`, back: entry.back, points: entry.points })),
  }, null, 2));
}
for (const { edge, points } of routed) {
  const from = placed.get(edge.from);
  const to = placed.get(edge.to);
  for (const box of placed.values()) {
    if (box === from || box === to) continue;
    for (let index = 0; index < points.length - 1; index += 1) {
      if (segmentHitsBox(points[index], points[index + 1], box)) {
        throwDiagnosticError(
          `Edge ${edge.from} -> ${edge.to} passes through unrelated node "${box.node.id}".`,
          [problem('flowchart/edge-through-node',
            `Edge ${edge.from} -> ${edge.to} passes through unrelated node "${box.node.id}".`,
            { from: edge.from, to: edge.to, through: box.node.id })],
        );
      }
    }
  }
}

function segmentHitsBox([x1, y1], [x2, y2], box) {
  const pad = 2;
  const left = box.x + pad;
  const right = box.x + box.width - pad;
  const top = box.y + pad;
  const bottom = box.y + box.height - pad;
  if (right <= left || bottom <= top) return false;
  if (Math.abs(y1 - y2) < 0.5) {
    if (y1 <= top || y1 >= bottom) return false;
    return Math.max(Math.min(x1, x2), left) < Math.min(Math.max(x1, x2), right);
  }
  if (Math.abs(x1 - x2) < 0.5) {
    if (x1 <= left || x1 >= right) return false;
    return Math.max(Math.min(y1, y2), top) < Math.min(Math.max(y1, y2), bottom);
  }
  return false;
}

// ---- 图例（复用内核 legend 模块）-------------------------------------------

const LEGEND_CATALOG = ['start', 'end', 'process', 'decision', 'loop', 'exception', 'io'].map((kind) => ({
  kind,
  label: i18nText(locale, `legend.flowchart.${kind}`),
}));
const presentKinds = new Set(nodes.map((node) => node.kind));
const legendEntries = resolveLegend(diagram.meta?.legend, LEGEND_CATALOG, presentKinds);
const legend = legendFootprint(legendEntries, { width: canvasWidth - 80 });
const canvasHeight = Math.round(contentBottom + (legendEntries.length ? 78 + legend.extraHeight : 24));
const legendBaselineY = canvasHeight - 16;

// ---- 渲染 ------------------------------------------------------------------

function pathData(points) {
  return `M ${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')}`;
}

function shapeMarkup(box, className, extra = '') {
  const { node, x, y, width, height } = box;
  const common = `x="${x}" y="${y}" width="${width}" height="${height}"`;
  switch (node.kind) {
    case 'start':
    case 'end':
      return `<rect ${common} rx="${round(height / 2)}" class="${className}"${extra}/>`;
    case 'decision': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      return `<polygon points="${round(cx)},${y} ${x + width},${round(cy)} ${round(cx)},${y + height} ${x},${round(cy)}" class="${className}"${extra}/>`;
    }
    case 'io':
      return `<polygon points="${x + IO_SKEW},${y} ${x + width},${y} ${x + width - IO_SKEW},${y + height} ${x},${y + height}" class="${className}"${extra}/>`;
    default:
      return `<rect ${common} rx="6" class="${className}"${extra}/>`;
  }
}

function renderNode(box, index) {
  const { node, size } = box;
  const style = styleFor(node);
  const hasBrand = Boolean(brandMarkFor(node));
  const hasSource = Boolean(sourceEvidence?.nodes?.[node.id]?.length);
  const firstBaseline = (box.height - (size.lines.length - 1) * layout.lineHeight) / 2 + size.lineFont * 0.36;
  const rows = size.lines.map((text, lineIndex) => ({
    text,
    font: size.lineFont,
    y: firstBaseline + lineIndex * layout.lineHeight,
  }));
  if (size.sub) {
    rows.push({ text: node.sublabel, font: size.sub.font, y: firstBaseline + size.lines.length * layout.lineHeight });
  }
  const labelLayout = nodeLabelLayout({
    width: box.width,
    height: box.height,
    rows,
    side: 'left',
    brand: hasBrand,
    source: hasSource,
  });
  const textX = round(box.x + labelLayout.x);
  const labels = size.lines.map((text, lineIndex) => {
    const anchor = lineIndex === 0 ? ' data-node-label=""' : '';
    return `            <text${anchor} x="${textX}" y="${round(box.y + labelLayout.ys[lineIndex])}" class="t-primary fc-label" font-size="${size.lineFont}" text-anchor="middle">${esc(text)}</text>`;
  });
  if (size.sub) {
    labels.push(`            <text data-detail="context" x="${textX}" y="${round(box.y + labelLayout.ys[size.lines.length])}" class="t-muted fc-sublabel" font-size="${size.sub.font}" text-anchor="middle">${esc(node.sublabel)}</text>`);
  }
  const brand = hasBrand
    ? `\n            ${renderBrandMark(node, { x: box.x + box.width - 22, y: box.y + 6 })}`
    : '';
  const sigil = renderSemanticSigil(style.sigil.kind, {
    icon: style.sigil.icon,
    x: box.x + SEMANTIC_SIGIL_INSET,
    y: round(box.y + labelLayout.sigilY),
    size: labelLayout.sigilSize,
  });
  const passport = { kind: node.kind, sublabel: node.sublabel, tag: node.tag };
  return `          <g ${focusNodeAttrs(node.id, node.label, passport, locale)}>
            ${focusNodeTitle(node.label, passport)}
            ${shapeMarkup(box, 'c-mask')}
            ${shapeMarkup(box, `${style.fill} fc-shape fc-${node.kind}`, animateAttr(diagram.meta, 'node', index))}${brand}
            ${sigil}
${labels.join('\n')}
          </g>`;
}

function edgeVariant(edge, back) {
  const role = edge.role || (back ? 'loop' : 'main');
  return edge.variant || ROLE_VARIANT[role] || (back ? 'dashed' : 'default');
}

function labelAnchor(points) {
  const [a, b] = points;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const vertical = Math.abs(a[0] - b[0]) < 0.5;
  return vertical ? [mid[0] + 8, mid[1]] : [mid[0], mid[1] - 7];
}

function renderEdge({ edge, points, back }, index) {
  const role = edge.role || (back ? 'loop' : 'main');
  const variant = edgeVariant(edge, back);
  const [cls, marker] = arrowClassMap[variant] || arrowClassMap.default;
  const strokeWidth = edge.width || (variant === 'emphasis' ? 1.8 : 1.5);
  const pathTag = `          <path ${focusEdgeAttrs(edge.from, edge.to, edge.label, index, edge.id)} data-composition-points="${routePointsValue(points)}" data-edge-role="${role}" d="${pathData(points)}" class="${cls} fc-edge"${animateAttr(diagram.meta, 'edge', index)} stroke-width="${strokeWidth}" marker-end="url(#${marker})"/>`;
  if (!edge.label) return pathTag;
  const [lx, ly] = labelAnchor(points);
  const width = Math.ceil(labelWidthPx(edge.label, layout.edgeFont) + 12);
  const mask = `          <rect x="${round(lx - width / 2)}" y="${round(ly - 10)}" width="${width}" height="15" rx="3" class="fc-edge-label-plate"/>`;
  const text = `          <text x="${round(lx)}" y="${round(ly + 1.5)}" class="${edgeLabelAccent(variant)} fc-edge-label" font-size="${layout.edgeFont}" text-anchor="middle">${esc(edge.label)}</text>`;
  return `${pathTag}\n${mask}\n${text}`;
}

function renderLegendBlock() {
  if (!legendEntries.length) return '';
  return renderResolvedLegend({
    entries: legendEntries,
    locale,
    layout: {
      x: layout.margin,
      baselineY: legendBaselineY,
      width: canvasWidth - 80,
      minTitleY: contentBottom + 8,
      obstacles: relationshipLegendObstacles(edges, {
        pointsFor: (edge) => routeByEdge.get(edge) || [],
        labelRectFor: () => null,
      }),
      unfit: diagram.meta?.legend === undefined ? 'hide' : 'error',
      diagramType: 'flowchart',
    },
    renderSwatch: (entry) => `<rect x="${entry.x}" y="${entry.baseline - 8}" width="14" height="9" rx="2" class="${styleFor({ kind: entry.kind }).fill}" stroke-width="1"/>`,
  });
}

function renderSvg() {
  // 流程图天然纵向：作者未给 viewBox 时声明按固有高度适配，
  // 让阅读器按高度收窄，而不是要求把内容横向铺开。
  const readerFit = diagram.meta?.viewBox
    ? ''
    : ' data-reader-fit="intrinsic-height" data-reader-min-text="7.5"';
  return `      <svg viewBox="0 0 ${canvasWidth} ${canvasHeight}" ${svgRootAttrs(diagram.meta)} data-flowchart-ui=""${readerFit}>
${svgAccessibleText(diagram.meta, 'flowchart')}
${renderDefinitions()}
        <style>
          svg[data-flowchart-ui] .fc-edge { stroke-linejoin: round; stroke-linecap: round; }
          svg[data-flowchart-ui] .fc-shape { stroke-width: 1.25px; }
          svg[data-flowchart-ui] .fc-loop,
          svg[data-flowchart-ui] .fc-exception { stroke-dasharray: 6 4; }
          svg[data-flowchart-ui] .fc-label { font-weight: 600; }
          svg[data-flowchart-ui] .fc-edge-label-plate { fill: var(--mask); stroke: none; }
        </style>

        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Control flow -->
${routed.map(renderEdge).join('\n')}

        <!-- Steps -->
${[...placed.values()].map(renderNode).join('\n')}

        <!-- Legend -->
${renderLegendBlock()}
      </svg>`;
}

writeDiagram({
  outPath,
  template,
  diagramType: 'flowchart',
  meta: diagram.meta,
  svg: renderSvg(),
  cards: diagram.cards,
  sourceEvidence,
});

function problem(code, message, subject) {
  return {
    code,
    severity: 'error',
    message,
    subject,
    evidence: {},
    supportedFixes: ['correct the flowchart structure in the IR and re-run'],
  };
}
