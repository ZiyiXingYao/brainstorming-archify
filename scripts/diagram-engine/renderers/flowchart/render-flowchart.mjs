import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderDefinitions, textUnits } from '../shared/utils.mjs';
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
import { routePointsValue } from '../shared/geometry.mjs';

// ---------------------------------------------------------------------------
// flowchart — 程序设计流程图（本仓库自建类型，上游 archify 没有）
//
// 词汇：start / end（起止端子）、process（处理）、decision（判断，带条件标签的
// 多分支）、io（输入输出）、loop（循环头）、exception（失败或回滚）。
// 布局：自上而下的分层。前向边从源底部出、目标顶部入；回边与跨层边走右侧通道。
// 事实口径：图只画作者声明的节点与边，不推断任何结构；结构不合规即报诊断，
// 不静默修补。
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram, template, outPath } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'flowchart',
  defaultExample: 'program-flow.flowchart.json',
  argv: process.argv,
});

const nodes = diagram.nodes;
const edges = diagram.edges;
const locale = diagram.meta?.locale;
const problems = [];

const layout = {
  margin: 40,
  top: 76,
  gapX: diagram.layout?.gapX ?? 44,
  gapY: diagram.layout?.gapY ?? 62,
  nodeW: diagram.layout?.nodeW ?? 168,
  nodeH: diagram.layout?.nodeH ?? 46,
  decisionH: 78,
  labelFont: 13,
  sublabelFont: 11,
  edgeFont: 11.5,
  // 估算宽度用的字宽系数（与内核其它渲染器的文本度量口径一致）
  advance: 0.6,
};

const NODE_MIN_W = 120;
const NODE_MAX_W = 300;

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

// ---- 节点尺寸与行内顺序 ------------------------------------------------------

const labelWidth = (text, font) => textUnits(text) * font * layout.advance;

function nodeSize(node) {
  const width = Math.min(NODE_MAX_W,
    Math.max(NODE_MIN_W, Math.round(labelWidth(node.label, layout.labelFont) + 40)));
  if (node.kind === 'decision') {
    // 菱形内接矩形要装得下标签：宽度按约 1.7 倍标签宽取值
    const diamond = Math.min(NODE_MAX_W + 90,
      Math.max(170, Math.round(labelWidth(node.label, layout.labelFont) * 1.7 + 56)));
    return { width: diamond, height: layout.decisionH };
  }
  const height = node.sublabel ? layout.nodeH + 16 : layout.nodeH;
  return { width, height };
}

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
    placed.set(node.id, { node, x, y, width: size.width, height: size.height, rank: level });
    cursorX += size.width + layout.gapX;
  }
  cursorY += rowHeight + layout.gapY;
}

const canvasHeight = Math.round(cursorY - layout.gapY + layout.margin + 24);

// ---- 边路由 -----------------------------------------------------------------

const EDGE_STROKE = { main: 1.5, branch: 1.5, loop: 1.4, exception: 1.4 };

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

// ---- 渲染 ------------------------------------------------------------------

const MARKER_BY_VARIANT = {
  default: 'arrowhead',
  emphasis: 'arrowhead-emphasis',
  security: 'arrowhead-security',
  dashed: 'arrowhead-dashed',
};

function pathData(points) {
  return `M ${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')}`;
}
const round = (value) => Math.round(value * 10) / 10;

function nodeShape(box) {
  const { node } = box;
  const common = `x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"`;
  switch (node.kind) {
    case 'start':
    case 'end':
      return `<rect ${common} rx="${box.height / 2}" class="c-mask fc-terminal"/>`;
    case 'decision': {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      return `<polygon points="${round(cx)},${box.y} ${box.x + box.width},${round(cy)} ${round(cx)},${box.y + box.height} ${box.x},${round(cy)}" class="c-mask fc-decision"/>`;
    }
    case 'io': {
      const skew = 14;
      return `<polygon points="${box.x + skew},${box.y} ${box.x + box.width},${box.y} ${box.x + box.width - skew},${box.y + box.height} ${box.x},${box.y + box.height}" class="c-mask fc-io"/>`;
    }
    case 'exception':
      return `<rect ${common} rx="6" class="c-mask fc-exception"/>`;
    case 'loop':
      return `<rect ${common} rx="6" class="c-mask fc-loop"/>`;
    default:
      return `<rect ${common} rx="6" class="c-mask fc-process"/>`;
  }
}

function renderNode(box) {
  const { node } = box;
  // 判断与 io 的视觉形状不是矩形，故在其下方垫一块同尺寸的隐形盒，
  // 让产物的节点几何仍可被构图检查读到（不遮住任何东西）。
  const measure = node.kind === 'decision' || node.kind === 'io'
    ? `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="fc-measure"/>`
    : '';
  const labelY = node.sublabel ? box.y + box.height / 2 - 4 : box.y + box.height / 2 + 4.5;
  const label = `            <text x="${round(box.x + box.width / 2)}" y="${round(labelY)}" class="t-primary fc-label" font-size="${layout.labelFont}" text-anchor="middle">${esc(node.label)}</text>`;
  const sublabel = node.sublabel
    ? `\n            <text x="${round(box.x + box.width / 2)}" y="${round(labelY + 15)}" class="t-secondary fc-sublabel" font-size="${layout.sublabelFont}" text-anchor="middle">${esc(node.sublabel)}</text>`
    : '';
  const brand = brandMarkFor(node)
    ? `\n            ${renderBrandMark(node, { x: box.x + 6, y: box.y + 6 })}`
    : '';
  return `          <g ${focusNodeAttrs(node.id, node.label, { kind: node.kind, sublabel: node.sublabel, tag: node.tag }, locale)}>
            ${focusNodeTitle(node.label, { kind: node.kind, sublabel: node.sublabel, tag: node.tag })}
${measure ? `${measure}\n` : ''}            ${nodeShape(box)}${brand}
${label}${sublabel}
          </g>`;
}

function labelAnchor(points, edge) {
  const [a, b] = points;
  if (edge.role === 'branch' || edge.label) {
    // 分支标签放在第一段中点，沿段方向偏移，避免压线
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const vertical = Math.abs(a[0] - b[0]) < 0.5;
    return vertical ? [mid[0] + 8, mid[1]] : [mid[0], mid[1] - 7];
  }
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return [mid[0] + 8, mid[1] - 5];
}

function renderEdge({ edge, points, back }) {
  const variant = edge.variant || 'default';
  const role = edge.role || (back ? 'loop' : 'main');
  const marker = MARKER_BY_VARIANT[variant] || 'arrowhead';
  const dash = variant === 'dashed' ? ' stroke-dasharray="5 4"' : '';
  const cls = `a-${variant} fc-edge fc-edge-${role}`;
  const pathTag = `          <path ${focusEdgeAttrs(edge.from, edge.to, edge.label, undefined, edge.id)} data-composition-points="${routePointsValue(points)}" data-edge-role="${role}" d="${pathData(points)}" class="${cls}"${animateAttr(diagram.meta, 'edge', 0)} stroke-width="${EDGE_STROKE[role] || 1.5}"${dash} marker-end="url(#${marker})"/>`;
  if (!edge.label) return pathTag;
  const [lx, ly] = labelAnchor(points, edge);
  const width = Math.ceil(labelWidth(edge.label, layout.edgeFont) + 12);
  const mask = `          <rect x="${round(lx - width / 2)}" y="${round(ly - 10)}" width="${width}" height="15" rx="3" class="fc-edge-label-plate"/>`;
  const text = `          <text x="${round(lx)}" y="${round(ly + 1.5)}" class="t-secondary fc-edge-label" font-size="${layout.edgeFont}" text-anchor="middle">${esc(edge.label)}</text>`;
  return `${pathTag}\n${mask}\n${text}`;
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
          svg[data-flowchart-ui] .fc-edge-main { stroke: var(--arrow); }
          svg[data-flowchart-ui] .fc-edge-branch { stroke: var(--arrow-emphasis); }
          svg[data-flowchart-ui] .fc-edge-loop { stroke: var(--text-muted); }
          svg[data-flowchart-ui] .fc-edge-exception { stroke: var(--failure-stroke, var(--arrow)); }
          svg[data-flowchart-ui] .fc-terminal { stroke: var(--arrow-emphasis); }
          svg[data-flowchart-ui] .fc-process { stroke: var(--lane-stroke); }
          svg[data-flowchart-ui] .fc-decision { stroke: var(--arrow-emphasis); }
          svg[data-flowchart-ui] .fc-io { stroke: var(--database-stroke, var(--lane-stroke)); }
          svg[data-flowchart-ui] .fc-loop { stroke: var(--text-muted); stroke-dasharray: 6 4; }
          svg[data-flowchart-ui] .fc-exception { stroke: var(--failure-stroke, var(--arrow)); stroke-dasharray: 6 4; }
          svg[data-flowchart-ui] .fc-label { font-weight: 600; }
          svg[data-flowchart-ui] .fc-measure { fill: none; stroke: none; }
          svg[data-flowchart-ui] .fc-edge-label-plate { fill: var(--mask); stroke: none; }
        </style>

        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Control flow -->
${routed.map(renderEdge).join('\n')}

        <!-- Steps -->
${[...placed.values()].map(renderNode).join('\n')}
      </svg>`;
}

writeDiagram({
  outPath,
  template,
  diagramType: 'flowchart',
  meta: diagram.meta,
  svg: renderSvg(),
  cards: diagram.cards,
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
