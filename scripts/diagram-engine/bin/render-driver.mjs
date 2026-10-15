#!/usr/bin/env node
/**
 * render-driver.mjs —— 绘图内核的内部驱动（由上游 archify v3.1.0 的 bin/archify.mjs 裁剪而来）
 * ============================================================================
 *
 * 只保留 render / validate / doctor 三个子命令；其余 13 个子命令
 * （compare、deliver、finalize、preview、migrate、inspect、check、visual-check、
 * browser-check、guide、brands、examples、demo）的 handler 与专用 helper 已整体移除。
 * 删除区间清单见提交信息、上游基准与偏离清单见 ../UPSTREAM.md 第 1 节。
 *
 * 已删除：--repo-root 代码溯源能力（本技能画图的事实来自讨论，没有仓库源码可读）。
 * 已删除：delivery / provenance / sidecar 能力与其专用 helper。
 *
 * 本文件不是对外入口。对外入口是同目录的 render.mjs。
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');

const TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle', 'erd', 'tree', 'class', 'timeline', 'waterfall', 'flowchart']);
async function specificationLocaleDiagnostics(type, specification) {
  let meta;
  try {
    meta = JSON.parse(String(specification)).meta;
  } catch {
    return [];
  }
  if (!meta?.locale) return [];
  const { localeDiagnostics } = await import('../renderers/shared/i18n.mjs');
  return localeDiagnostics(type, meta);
}

const COMMAND_USAGE = {
  render: '<type> <input.json> [output.html] [--quality standard|showcase]',
  validate: '<type> <input.json> [--json] [--layout-json] [--quality standard|showcase]',
  doctor: '',
};

function usage() {
  const commands = Object.entries(COMMAND_USAGE).flatMap(([command, forms]) =>
    (Array.isArray(forms) ? forms : [forms]).map(form => `  archify ${command}${form ? ` ${form}` : ''}`));
  return `Usage:
${commands.join('\n')}

Types:
  architecture, workflow, sequence, dataflow, lifecycle, erd, tree, class, timeline, waterfall, flowchart
`;
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function rejectCliArgument(message, details = {}) {
  const error = new Error(message);
  error.archifyArgument = {
    code: details.code || 'cli/invalid-arguments',
    subject: details.subject || {},
    evidence: details.evidence || {},
    supportedFixes: details.supportedFixes || ['correct the command arguments and retry'],
  };
  throw error;
}

function rendererPath(type) {
  if (!TYPES.has(type)) {
    rejectCliArgument(`Unknown diagram type "${type}". Expected one of: ${[...TYPES].join(', ')}`, {
      code: 'cli/unknown-diagram-type',
      subject: { type },
      evidence: { supportedTypes: [...TYPES] },
      supportedFixes: [`use one of: ${[...TYPES].join(', ')}`],
    });
  }
  return path.join(skillRoot, 'renderers', type, `render-${type}.mjs`);
}

// Default capture ceiling for piped child output. spawnSync's own default
// is 1 MiB, which is below what a dense diagram's checker receipt reaches.
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio || 'inherit',
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  // spawnSync can report a system failure after a child has exited zero. A
  // truncated renderer or checker result is never a successful invocation.
  if (result.error && result.status === 0) {
    result.archifyRawStatus = result.status;
    result.status = 1;
  }
  return result;
}

// The artifact checker prints its whole receipt on stdout; a dense,
// warning-heavy diagram can grow that receipt past spawnSync's 1 MiB
// default, which kills the child before it reports a verdict. Deliver,
// validate, migrate, compare, and check share this explicit limit so one
// environment knob moves them together.
function artifactCheckMaxBuffer() {
  const raw = process.env.ARCHIFY_CHECK_MAX_BUFFER;
  if (raw === undefined || raw === '') return DEFAULT_MAX_BUFFER;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && Math.floor(parsed) >= 1 ? Math.floor(parsed) : DEFAULT_MAX_BUFFER;
}

// A checker terminated while streaming its output never judged the
// artifact; its truncated stdout must not be reinterpreted as a verdict.
function checkerOutputLimitDiagnostics(check, limitBytes) {
  if (check.error?.code !== 'ENOBUFS') return null;
  const receivedBytes = Buffer.byteLength(check.stdout || '', 'utf8');
  return [diagnostic({
    code: 'artifact/check-output-limit',
    message: `The artifact checker exceeded the ${limitBytes} byte output buffer and was terminated before reporting a verdict (${receivedBytes} stdout bytes received); the artifact was not judged.`,
    subject: { check: 'render_output' },
    evidence: {
      systemCode: check.error.code,
      ...(check.signal ? { signal: check.signal } : {}),
      status: check.archifyRawStatus ?? check.status ?? null,
      limitBytes,
      receivedBytes,
    },
    supportedFixes: [
      'set ARCHIFY_CHECK_MAX_BUFFER to a much larger limit (for example 1073741824) and re-run',
    ],
  })];
}

function extractQualityArgs(args) {
  const rest = [];
  let quality;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--quality') {
      quality = args[index + 1];
      if (!quality || quality.startsWith('--')) rejectCliArgument('--quality requires standard or showcase.', {
        code: 'cli/missing-option-value',
        subject: { option: '--quality' },
        supportedFixes: ['provide --quality standard or --quality showcase'],
      });
      index += 1;
      continue;
    }
    if (arg.startsWith('--quality=')) {
      quality = arg.slice('--quality='.length);
      if (!quality) rejectCliArgument('--quality requires standard or showcase.', {
        code: 'cli/missing-option-value',
        subject: { option: '--quality' },
        supportedFixes: ['provide --quality standard or --quality showcase'],
      });
      continue;
    }
    rest.push(arg);
  }
  if (quality !== undefined && !['standard', 'showcase'].includes(quality)) {
    rejectCliArgument(`Unknown quality profile "${quality}". Expected standard or showcase.`, {
      code: 'cli/invalid-option-value',
      subject: { option: '--quality' },
      evidence: { value: quality, supportedValues: ['standard', 'showcase'] },
      supportedFixes: ['use --quality standard or --quality showcase'],
    });
  }
  return { rest, quality };
}

function rendererEnv(quality, diagnosticJson = false) {
  return {
    ...(quality ? { ARCHIFY_QUALITY_PROFILE: quality } : {}),
    ...(diagnosticJson ? { ARCHIFY_DIAGNOSTIC_FORMAT: 'json' } : {}),
  };
}

function diagnostic({ code, message, subject = {}, evidence = {}, supportedFixes = [], severity = 'error' }) {
  return {
    code,
    severity,
    message,
    subject,
    evidence,
    supportedFixes,
  };
}

function inputDiagnostic(error, inputPath) {
  const isSyntax = error instanceof SyntaxError;
  return diagnostic({
    code: isSyntax ? 'input/json-parse' : 'input/read',
    message: isSyntax
      ? `Input JSON could not be parsed: ${error.message}`
      : `Input could not be read: ${error.message}`,
    subject: { input: inputPath },
    evidence: {
      ...(error?.code ? { systemCode: error.code } : {}),
      reason: error.message,
    },
    supportedFixes: [isSyntax
      ? 'repair the JSON syntax and run validation again'
      : 'provide one readable JSON input file'],
  });
}

function rendererFailure(result) {
  if (result.error) {
    return {
      error: 'Renderer process could not start.',
      diagnostics: [diagnostic({
        code: 'internal/renderer-process',
        message: 'Renderer process could not start.',
        evidence: { reason: result.error.message },
      })],
    };
  }
  try {
    const payload = JSON.parse((result.stderr || '').trim());
    if (payload?.ok === false && Array.isArray(payload.diagnostics) && payload.diagnostics.length) {
      return {
        error: payload.error || payload.diagnostics[0].message,
        diagnostics: payload.diagnostics,
      };
    }
  } catch {
    // The diagnostic boundary is intentionally fail-closed. Never copy a raw
    // Node stack into a machine receipt when a renderer exits unexpectedly.
  }
  return {
    error: 'Renderer failed before emitting a structured diagnostic.',
    diagnostics: [diagnostic({
      code: 'internal/unclassified',
      message: 'Renderer failed before emitting a structured diagnostic.',
      evidence: { exitCode: result.status ?? 1 },
    })],
  };
}

const COMPOSITION_CHECKS = new Set([
  'label_route_clearance',
  'relationship_crossings',
  'relationship_corridors',
  'container_border_runs',
  'route_rhythm',
]);

const CHECK_FIXES = {
  single_svg: ['remove additional SVG roots so the artifact contains exactly one diagram SVG'],
  finite_svg: ['replace non-finite coordinates before rendering again'],
  orthogonal_arrows: ['use renderer-supported orthogonal routing controls'],
  legend_clearance: ['move the route or enlarge the viewBox so relationships do not enter the legend'],
};

const COMPOSITION_FIXES = {
  'composition/proper-crossing': ['if authored via/route/channelX/channelY controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and adjust route/via or channel coordinates so unrelated relationships use separate corridors'],
  'composition/ambiguous-corridor': ['if authored via/route/channelX/channelY controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and adjust route/via or channel coordinates so unrelated relationships do not visually merge'],
  'composition/container-border-run': ['if authored via/route/channelX/channelY controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and route across the frame perpendicularly through a clear opening'],
  'composition/label-route-clearance': ['if authored labelAt/labelDx/labelDy/labelSegment controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and adjust labelAt, labelDx, labelDy, labelSegment, message y, or the other relationship route'],
  'composition/label-canvas-containment': ['if authored labelAt/labelDx/labelDy/labelSegment controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and adjust labelAt, labelDx, labelDy, or labelSegment so the label rect stays inside the viewBox, or enlarge meta.viewBox'],
  'composition/micro-segment': ['if authored via/route/channelX/channelY controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and move the route/channel/via point so every visible segment is at least 8px'],
  'composition/short-interior-segment': ['if authored via/route/channelX/channelY controls exist and are not required by the user, remove them to let the renderer re-plan; otherwise preserve that intent and move the route/channel/via point so every interior turn has at least 16px'],
};

function checkerDiagnostics(checker) {
  const diagnostics = [];
  for (const issue of checker?.composition?.issues || []) {
    if (issue.severity !== 'error') continue;
    const { severity, code, relationship, nodeId, ...evidence } = issue;
    diagnostics.push(diagnostic({
      code,
      severity,
      message: `Final artifact failed ${code}.`,
      subject: relationship ? { relationship } : { check: 'composition', ...(nodeId ? { nodeId } : {}) },
      evidence,
      supportedFixes: compositionFixes(issue),
    }));
  }
  for (const check of checker?.checks || []) {
    if (check.ok || COMPOSITION_CHECKS.has(check.name)) continue;
    if (check.name === 'svg_path_data') {
      const pathDiagnostics = (checker.diagnostics || []).filter(item => (
        item?.severity === 'error'
        && ['artifact/svg-path-malformed', 'artifact/svg-path-unsupported'].includes(item.code)
      ));
      if (pathDiagnostics.length) {
        diagnostics.push(...pathDiagnostics.map(item => diagnostic(item)));
        continue;
      }
    }
    diagnostics.push(diagnostic({
      code: `artifact/${check.name.replaceAll('_', '-')}`,
      message: (check.details || []).find(Boolean) || `Final artifact failed ${check.name}.`,
      subject: { check: check.name },
      evidence: { details: check.details || [] },
      supportedFixes: CHECK_FIXES[check.name] || [],
    }));
  }
  return diagnostics.length ? diagnostics : [diagnostic({
    code: 'artifact/check-failed',
    message: 'Final artifact check failed without a classified diagnostic.',
    subject: { check: 'unknown' },
    evidence: {},
  })];
}

function compositionFixes(issue) {
  if (issue.code === 'composition/viewport-height') return [String(issue.detail || '').replace(/^\[[^\]]+\]\s*/, '')];
  if (issue.code !== 'composition/desktop-readability') return COMPOSITION_FIXES[issue.code] || [];
  const sourceFontPx = Number(issue.sourceFontPx);
  const actualBudgetPx = Number(issue.availableDiagramWidth);
  const hardFloorPx = Number(issue.minimumProjectedFontPx);
  const viewBoxWidth = Number(issue.viewBoxWidth);
  const preserveIntent = 'Preserve the semantic text and any supplied coordinates, routes, sides, channels, and labels.';
  const readerCap = issue.budgetBasis === 'recognized-declared-wide'
    ? ` The declared Reader reports a ${issue.budgetLimit} limit and ${actualBudgetPx}px actual diagram budget; do not assume an uncapped viewport.`
    : '';
  if (![sourceFontPx, actualBudgetPx, hardFloorPx, viewBoxWidth].every(Number.isFinite)
    || actualBudgetPx <= 0 || hardFloorPx <= 0 || viewBoxWidth <= 0) {
    return [`${preserveIntent} Repair the measured source font, desktop budget, or complete viewBox width; position-only label controls do not change projected text size.`];
  }
  if (sourceFontPx < hardFloorPx) {
    return [`${preserveIntent} The diagnosed ${sourceFontPx}px source text is below the ${hardFloorPx}px hard floor even at scale 1, so use a renderer-supported semantic text-size setting or renderer-level fix. Position-only label controls cannot repair its projection.${readerCap}`];
  }
  const maximumViewBoxWidth = Math.floor((sourceFontPx * actualBudgetPx) / hardFloorPx);
  return [`${preserveIntent} Compactly reflow automatic spacing and empty corridors so the complete viewBox width is at most ${maximumViewBoxWidth}px (current ${viewBoxWidth}px; ${sourceFontPx}px source text at ${actualBudgetPx}px desktop budget). If supplied geometry fixes that width, use a renderer-supported semantic text-size setting or renderer-level fix instead. Position-only label controls cannot repair its projection.${readerCap}`];
}

function formatDiagnostics(error, diagnostics = []) {
  if (!diagnostics.length) return error;
  return [
    error,
    ...diagnostics.map((entry) => {
      const fix = entry.supportedFixes?.length ? ` Fix: ${entry.supportedFixes.join('; ')}.` : '';
      return `[${entry.code}] ${entry.message}${fix}`;
    }),
  ].join('\n');
}

function exitFrom(result) {
  if (result.error) fail(result.error.message, 1);
  process.exit(result.status ?? 1);
}

function commandRender(args) {
  const qualityArgs = extractQualityArgs(args);
  // render takes no options of its own once --quality is stripped, so anything
  // left starting with -- is a typo. Without this a mistyped flag was taken as
  // the output path: `render architecture spec.json --json out.html` wrote a
  // file literally named `--json` and never wrote out.html, exiting 0. Every
  // sibling subcommand already guards this.
  const unknown = qualityArgs.rest.filter((arg) => arg.startsWith('--'));
  if (unknown.length) fail(`Unknown render option "${unknown[0]}".`);
  const [type, input, output] = qualityArgs.rest;
  if (!type || !input || qualityArgs.rest.length > 3) fail(usage());
  const result = runNode([rendererPath(type), input, ...(output ? [output] : [])], {
    env: rendererEnv(qualityArgs.quality),
  });
  if (result.status !== 0) exitFrom(result);
}

function reportArtifactFailure({ command, json, stage, type, input, output, error, diagnostics = [], status = 1, checker, receiptId, provenance, update }) {
  const receipt = {
    schemaVersion: 1,
    ok: false,
    command,
    ...(receiptId ? { receiptId } : {}),
    stage,
    type,
    input,
    ...(output === undefined ? {} : { output }),
    error,
    diagnostics,
    ...(provenance ? { provenance } : {}),
    ...(checker ? { checker } : {}),
    ...(update ? { update } : {}),
  };
  if (json) console.log(JSON.stringify(receipt, null, 2));
  else {
    console.error(formatDiagnostics(error, diagnostics));
    if (update?.noticeRequired) console.log(update.noticeText);
  }
  process.exitCode = status;
}

function reportArtifactArgumentFailure(command, error) {
  const details = error.archifyArgument || {};
  reportArtifactFailure({
    command,
    json: true,
    stage: 'arguments',
    error: error.message,
    diagnostics: [diagnostic({
      code: details.code || 'cli/invalid-arguments',
      message: error.message,
      subject: { command, ...(details.subject || {}) },
      evidence: details.evidence || {},
      supportedFixes: details.supportedFixes || ['correct the command arguments and retry'],
    })],
    status: 2,
  });
}

function engineeringProfileFromArtifact(artifact) {
  const match = artifact.toString('utf8').match(/<svg[^>]*\sdata-engineering-profile="([^"]+)"/);
  return match ? match[1] : null;
}

function artifactIdentity(artifact) {
  return { sha256: createHash('sha256').update(artifact).digest('hex'), bytes: artifact.byteLength };
}

async function commandDoctor(args) {
  const unknown = args.find((arg) => arg.startsWith('--'));
  if (unknown) fail(`Unknown doctor option "${unknown}".`);
  if (args.length) fail(usage());
  const checks = [];
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  checks.push({
    label: `Node.js v${process.versions.node} (requires >=18)`,
    ok: nodeMajor >= 18,
    missing: 0,
    failureLabel: 'unsupported',
  });

  const template = path.join(skillRoot, 'assets/template.html');
  checks.push({
    label: 'Interactive viewer template',
    ok: fs.existsSync(template),
    missing: fs.existsSync(template) ? 0 : 1,
  });

  const outputPathRuntime = path.join(skillRoot, 'renderers/shared/output-path.mjs');
  checks.push({
    label: 'Output path safety runtime',
    ok: fs.existsSync(outputPathRuntime),
    missing: fs.existsSync(outputPathRuntime) ? 0 : 1,
  });

  const atomicOutputRuntime = path.join(skillRoot, 'renderers/shared/atomic-output.mjs');
  checks.push({
    label: 'Atomic output safety runtime',
    ok: fs.existsSync(atomicOutputRuntime),
    missing: fs.existsSync(atomicOutputRuntime) ? 0 : 1,
  });

  const pathSemanticsRuntime = path.join(skillRoot, 'renderers/shared/path-semantics.mjs');
  checks.push({
    label: 'Physical path semantics runtime',
    ok: fs.existsSync(pathSemanticsRuntime),
    missing: fs.existsSync(pathSemanticsRuntime) ? 0 : 1,
  });

  const sidecarPathRuntime = path.join(skillRoot, 'renderers/shared/sidecar-path.mjs');
  checks.push({
    label: 'Sidecar path naming runtime',
    ok: fs.existsSync(sidecarPathRuntime),
    missing: fs.existsSync(sidecarPathRuntime) ? 0 : 1,
  });

  const renderOutputCheck = path.join(skillRoot, 'scripts/check-render-output.mjs');
  checks.push({
    label: 'Render output checker',
    ok: fs.existsSync(renderOutputCheck),
    missing: fs.existsSync(renderOutputCheck) ? 0 : 1,
  });

  const retainedMetadata = [
    path.join(skillRoot, 'UPSTREAM.md'),
    path.join(skillRoot, 'THIRD_PARTY_NOTICES.md'),
    path.join(skillRoot, 'LICENSE'),
    path.join(skillRoot, 'assets/JetBrainsMono-OFL.txt'),
  ];
  const metadataMissing = retainedMetadata.filter((file) => !fs.existsSync(file)).length;
  checks.push({
    label: 'Retained provenance and license files',
    ok: metadataMissing === 0,
    missing: metadataMissing,
  });

  const validators = path.join(skillRoot, 'renderers/shared/generated-validators.mjs');
  const validatorsExist = fs.existsSync(validators);
  let validatorsValid = false;
  if (validatorsExist) {
    try {
      const module = await import(`${pathToFileURL(validators).href}?doctor=${Date.now()}`);
      validatorsValid = [...TYPES].every((type) => typeof module[type] === 'function');
    } catch {
      validatorsValid = false;
    }
  }
  checks.push({
    label: 'Standalone schema validators',
    ok: validatorsValid,
    missing: validatorsExist ? 0 : 1,
    invalid: validatorsExist && !validatorsValid ? 1 : 0,
    failureLabel: validatorsExist ? 'invalid' : 'missing',
  });

  for (const type of TYPES) {
    const required = [
      path.join(skillRoot, 'renderers', type, `render-${type}.mjs`),
      path.join(skillRoot, 'schemas', `${type}.schema.json`),
    ];
    const missing = required.filter((file) => !fs.existsSync(file)).length;
    checks.push({
      label: `${type} renderer and schema`,
      ok: missing === 0,
      missing,
    });
  }

  console.log('diagram-engine doctor\n');
  for (const check of checks) {
    console.log(`[${check.ok ? 'ok' : (check.failureLabel || 'missing')}] ${check.label}`);
  }

  const nodeFailed = checks[0].ok ? 0 : 1;
  const missingFiles = checks.reduce((count, check) => count + check.missing, 0);
  const invalidRuntime = checks.reduce((count, check) => count + (check.invalid || 0), 0);
  if (nodeFailed === 0 && missingFiles === 0 && invalidRuntime === 0) {
    console.log('\ndiagram-engine is ready.');
    return;
  }

  const problems = [];
  if (nodeFailed) problems.push('Node.js 18 or newer is required');
  if (missingFiles) problems.push(`${missingFiles} required file${missingFiles === 1 ? '' : 's'} missing`);
  if (invalidRuntime) problems.push(`${invalidRuntime} runtime check${invalidRuntime === 1 ? '' : 's'} failed`);
  console.error(`\ndiagram-engine is not ready: ${problems.join('; ')}.`);
  process.exitCode = 1;
}

async function commandValidate(args, invocation = {}) {
  const invokingCommand = invocation.command || 'validate';
  const reportFailure = (options) => reportArtifactFailure({ ...options, command: invokingCommand });
  const qualityArgs = extractQualityArgs(args);
  args = qualityArgs.rest;
  const quality = qualityArgs.quality;
  const knownOptions = new Set(['--json', '--layout-json']);
  const unknown = args.filter((arg) => arg.startsWith('--') && !knownOptions.has(arg));
  if (unknown.length) rejectCliArgument(`Unknown ${invokingCommand} option "${unknown[0]}".`, {
    code: 'cli/unknown-option',
    subject: { option: unknown[0] },
    supportedFixes: ['remove the unknown option and retry'],
  });
  const json = args.includes('--json');
  const layoutJson = args.includes('--layout-json');
  const rest = args.filter((arg) => !knownOptions.has(arg));
  const [type, input] = rest;
  if (!type || !input || rest.length !== 2) rejectCliArgument(usage(), {
    code: 'cli/usage',
    supportedFixes: [`use: archify ${invokingCommand} <type> <input.json> [options]`],
  });
  const renderer = rendererPath(type);

  if (layoutJson && !['architecture', 'workflow'].includes(type)) {
    rejectCliArgument('--layout-json is currently supported for architecture and workflow diagrams only.', {
      code: 'cli/unsupported-option',
      subject: { option: '--layout-json', type },
      supportedFixes: ['remove --layout-json or use an architecture or workflow diagram'],
    });
  }

  const inputPath = path.resolve(input);
  let specification;
  try {
    specification = fs.readFileSync(inputPath);
    const document = JSON.parse(specification.toString('utf8'));
    const [{ validateAuthoredOutputPath }, { validateSchema }] = await Promise.all([
      import('../renderers/shared/output-path.mjs'),
      import('../renderers/shared/validator.mjs'),
    ]);
    if (document?.meta?.output === undefined) validateSchema(type, document);
    else validateAuthoredOutputPath(document.meta.output);
  } catch (error) {
    const diagnostics = error.archifyDiagnostics || [inputDiagnostic(error, inputPath)];
    reportFailure({
      json,
      stage: diagnostics.some((entry) => entry.code.startsWith('input/')) ? 'input' : 'render',
      type,
      input: inputPath,
      error: error.message,
      diagnostics,
      status: 1,
    });
    return;
  }

  if (layoutJson) {
    // Layout mode emits JSON without writing HTML; keep its unused target typed.
    const layoutOutput = path.join(os.tmpdir(), `archify-layout-${process.pid}-${type}.html`);
    const result = runNode([renderer, input, layoutOutput, '--layout-json'], {
      stdio: 'pipe',
      env: rendererEnv(quality, true),
    });
    if (result.status !== 0) {
      if (!result.error) {
        try {
          const receipt = JSON.parse(result.stdout);
          if (receipt?.contract && Array.isArray(receipt.diagnostics)) {
            process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
            process.exitCode = result.status ?? 1;
            return;
          }
        } catch {
          // Fall through to the renderer failure contract when no compiler
          // receipt was produced (for example, input JSON could not be read).
        }
      }
      const failure = rendererFailure(result);
      reportFailure({
        json,
        stage: failure.diagnostics.some((entry) => entry.code.startsWith('input/')) ? 'input' : 'render',
        type,
        input: path.resolve(input),
        error: failure.error,
        diagnostics: failure.diagnostics,
        status: result.status ?? 1,
      });
      return;
    }
    process.stdout.write(result.stdout);
    return;
  }

  const { createOwnedTempDirectory } = await import('../renderers/shared/owned-temp-directory.mjs');
  const temporary = createOwnedTempDirectory('archify-validate-');
  const tmp = temporary.path;
  const out = path.join(tmp, `${type}.html`);
  let exitCode = 0;
  let report = () => {};

  try {
    const snapshot = path.join(tmp, 'specification.snapshot.json');
    fs.writeFileSync(snapshot, specification, { flag: 'wx' });
    const render = runNode([renderer, snapshot, out], {
      stdio: 'pipe',
      env: rendererEnv(quality, true),
    });
    if (render.status !== 0) {
      const failure = rendererFailure(render);
      report = () => reportFailure({
        json,
        stage: failure.diagnostics.some((entry) => entry.code.startsWith('input/')) ? 'input' : 'render',
        type,
        input: path.resolve(input),
        error: failure.error,
        diagnostics: failure.diagnostics,
        status: render.status ?? 1,
      });
      exitCode = render.status ?? 1;
    } else {
      if (render.stderr) process.stderr.write(render.stderr);
      const localeWarnings = await specificationLocaleDiagnostics(type, specification);
      for (const warning of localeWarnings) process.stderr.write(`archify: ${warning.message}\n`);
      const checkMaxBuffer = artifactCheckMaxBuffer();
      const check = runNode([path.join(skillRoot, 'scripts/check-render-output.mjs'), out], {
        stdio: 'pipe',
        maxBuffer: checkMaxBuffer,
      });
      if (check.status !== 0) {
        exitCode = check.status ?? 1;
        const outputLimit = checkerOutputLimitDiagnostics(check, checkMaxBuffer);
        if (outputLimit) {
          report = () => reportFailure({
            json,
            stage: 'check',
            type,
            input: path.resolve(input),
            error: `The artifact checker exceeded its ${checkMaxBuffer} byte output buffer and was terminated before reporting a verdict.`,
            diagnostics: outputLimit,
            status: check.status ?? 1,
          });
        } else {
          let checker;
          try {
            checker = JSON.parse(check.stdout);
            checker.file = path.resolve(input);
          } catch {
            checker = { ok: false, diagnostic: 'Artifact checker failed without a parseable receipt.' };
          }
          report = () => reportFailure({
            json,
            stage: 'check',
            type,
            input: path.resolve(input),
            error: 'Final artifact check failed.',
            diagnostics: checkerDiagnostics(checker),
            checker,
            status: check.status ?? 1,
          });
        }
      } else {
        const result = JSON.parse(check.stdout);
        const engineeringProfile = engineeringProfileFromArtifact(fs.readFileSync(out));
        if (json) {
          const candidate = {
            path: path.resolve(input),
            ...artifactIdentity(specification),
          };
          const receipt = {
            schemaVersion: 1,
            ok: true,
            command: 'validate',
            type,
            input: candidate.path,
            candidate,
            candidateFrozen: true,
            checks: result.checks,
            composition: result.composition,
            ...(engineeringProfile ? { engineeringProfile } : {}),
            ...(localeWarnings.length ? { diagnostics: localeWarnings } : {}),
          };
          report = () => console.log(JSON.stringify(receipt, null, 2));
        } else {
          const engineering = engineeringProfile
            ? `; engineering ${engineeringProfile}: pass`
            : '';
          report = () => console.log(`ok ${type} ${path.resolve(input)} (${result.checks.length} artifact checks; composition ${result.composition.profile}: ${result.composition.summary.errors} errors, ${result.composition.summary.warnings} warnings${engineering})`);
        }
      }
    }
  } finally {
    try {
      await temporary.cleanup();
    } catch (error) {
      exitCode = 1;
      report = () => reportFailure({
        json,
        stage: 'cleanup',
        type,
        input: path.resolve(input),
        error: error.message,
        diagnostics: [{
          code: 'validate/temp-cleanup-incomplete',
          severity: 'error',
          message: error.message,
          subject: { directory: tmp },
          evidence: { reason: error.cause?.code || error.code },
          supportedFixes: ['resolve the reported filesystem error and inspect the retained temporary directory before retrying'],
        }],
        status: 1,
      });
    }
  }

  report();
  if (exitCode !== 0) process.exitCode = exitCode;
}

const [command, ...args] = process.argv.slice(2);
// Reuse the canonical help metadata rather than a separate help registry.
// Only the sole --help form bypasses command argument parsing and operations.
const soleCommandHelp = args.length === 1 && args[0] === '--help'
  && Object.hasOwn(COMMAND_USAGE, command);

try {
  switch (soleCommandHelp ? '--help' : command) {
    case undefined:
    case '-h':
    case '--help':
    case 'help':
      console.log(usage());
      break;
    case 'render':
      commandRender(args);
      break;
    case 'validate':
      await commandValidate(args);
      break;
    case 'doctor':
      await commandDoctor(args);
      break;
    default:
      fail(`Unknown command "${command}".\n\n${usage()}`);
  }
} catch (error) {
  if (!error.archifyArgument) throw error;
  if (command === 'validate' && args.includes('--json')) {
    reportArtifactArgumentFailure(command, error);
  } else {
    fail(error.message);
  }
}
