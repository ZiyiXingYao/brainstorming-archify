/**
 * design-diagrams —— 主题变量解析（任务 2.2）
 * ============================================================================
 *
 * 目的
 * ----
 * 复刻浏览器版 `getComputedStyle` 在「指定预设 × 指定主题」下的**最终变量值**：
 * 某个 `data-preset` + `data-theme` 的元素上，每个自定义属性的计算值。
 *
 * 合并规则
 * --------
 * CSS 级联语义：预设块的选择器（如 `[data-preset="signal-flow"][data-theme="dark"]`，
 * 特异性 0,2,0）高于默认配色块（`:root` / `[data-theme="dark"]` / `[data-theme="light"]`，
 * 特异性 0,1,0）。因此某组合的最终值 =「classic 该主题块」打底，再被「该预设该主题块」
 * 覆盖。预设块可能少定义变量（signal-flow 深 30 / 浅 27，少于 classic 的 32），
 * 少的那几个必须由 classic 补齐，否则导出 SVG 会出现未定义变量。
 *
 * 关键前置
 * --------
 * 主题块的识别依赖「已剥离注释」的顶层规则（见 `./css-extract.mjs`）。模板里默认
 * 深色块的正则选择器是 `:root,\n    [data-theme="dark"]`，其前面紧跟一条说明性注释；
 * 若不先剥离注释，该块会被漏掉，classic 深色将解析为空。
 *
 * 参数校验：未知预设 / 未知主题 / 缺块，一律抛错，**不静默回落**。
 */

import { splitTopLevelRules, normalizeSelector } from './css-extract.mjs';
import { findStyleBlocks } from './css-extract.mjs';

/** 受支持的预设。`classic` 表示「不带 data-preset」的默认配色。 */
export const PRESETS = Object.freeze(['classic', 'signal-flow', 'blueprint', 'editorial']);

/** 受支持的主题。 */
export const THEMES = Object.freeze(['dark', 'light']);

/**
 * 某个「预设 × 主题」块在模板里的**归一化**选择器。
 * @param {string} preset
 * @param {string} theme
 * @returns {string}
 */
export function themeBlockSelector(preset, theme) {
  if (preset === 'classic') {
    return theme === 'dark' ? ':root,[data-theme="dark"]' : '[data-theme="light"]';
  }
  return `[data-preset="${preset}"][data-theme="${theme}"]`;
}

function assertKnown(preset, theme) {
  if (!PRESETS.includes(preset)) {
    throw new Error(`Unknown preset "${preset}". Expected one of: ${PRESETS.join(', ')}.`);
  }
  if (!THEMES.includes(theme)) {
    throw new Error(`Unknown theme "${theme}". Expected one of: ${THEMES.join(', ')}.`);
  }
}

/**
 * 从规则 body 中解析自定义属性声明（`--name: value`）。
 * 感知引号与括号：`;` 只在括号深度为 0 且不在字符串内时才分隔声明。
 * 只保留 `--` 变量（主题块里的 `-webkit-mask-image` 之类会被忽略）。
 *
 * @param {string} body
 * @returns {Record<string, string>}
 */
export function parseDeclarations(body) {
  const out = {};
  const take = (chunk) => {
    const idx = chunk.indexOf(':');
    if (idx < 0) return;
    const name = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (name.startsWith('--') && value.length > 0) out[name] = value;
  };

  const n = body.length;
  let i = 0;
  let quote = null;
  let depth = 0;
  let start = 0;
  while (i < n) {
    const c = body[i];
    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      i += 1;
      continue;
    }
    if (c === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      if (depth > 0) depth -= 1;
      i += 1;
      continue;
    }
    if (c === ';' && depth === 0) {
      take(body.slice(start, i));
      start = i + 1;
      i += 1;
      continue;
    }
    i += 1;
  }
  take(body.slice(start));
  return out;
}

/**
 * 解析模板主样式块里的全部主题块。
 * 只把**选择器整条等于**规范主题选择器的顶层规则视为主题块；`[data-theme="light"] #theme-icon`
 * 这类后代规则、以及 `@media print` 内的变量覆盖都不会被误认。
 *
 * @param {string} styleText 主样式块原文
 * @returns {Record<string, {dark: Record<string,string>, light: Record<string,string>}>}
 */
export function parseThemeBlocks(styleText) {
  const index = new Map();
  for (const rule of splitTopLevelRules(styleText)) {
    if (rule.isAtRule) continue;
    index.set(normalizeSelector(rule.selector), rule.body);
  }

  const blocks = {};
  for (const preset of PRESETS) {
    blocks[preset] = {};
    for (const theme of THEMES) {
      const sel = normalizeSelector(themeBlockSelector(preset, theme));
      const body = index.get(sel);
      blocks[preset][theme] = body === undefined ? {} : parseDeclarations(body);
    }
  }
  return blocks;
}

/**
 * 计算「预设 × 主题」下的完整变量集合。
 *
 * @param {ReturnType<typeof parseThemeBlocks>} blocks
 * @param {string} preset `classic` | `signal-flow` | `blueprint` | `editorial`
 * @param {string} theme  `dark` | `light`
 * @returns {Record<string, string>} 变量名 → 值（新对象，不修改入参）
 */
export function resolveThemeVars(blocks, preset, theme) {
  assertKnown(preset, theme);
  if (!blocks || typeof blocks !== 'object' || !blocks[preset] || !blocks[preset][theme]) {
    throw new Error(`Theme block for preset "${preset}" / theme "${theme}" was not parsed from the template.`);
  }
  const base = blocks.classic && blocks.classic[theme];
  if (!base || Object.keys(base).length === 0) {
    throw new Error(`Base classic/${theme} theme block is missing or empty; cannot complete the variable set.`);
  }
  const overlay = preset === 'classic' ? {} : blocks[preset][theme];
  const merged = { ...base, ...overlay };
  if (Object.keys(merged).length === 0) {
    throw new Error(`Resolved ${preset}/${theme} variable set is empty.`);
  }
  return merged;
}

/**
 * 便捷入口：直接给主样式块原文。
 * @param {string} styleText
 * @param {string} preset
 * @param {string} theme
 * @returns {Record<string, string>}
 */
export function resolveThemeVarsFromCss(styleText, preset, theme) {
  assertKnown(preset, theme);
  return resolveThemeVars(parseThemeBlocks(styleText), preset, theme);
}

/**
 * 便捷入口：直接给模板 HTML。
 * @param {string} html
 * @param {string} preset
 * @param {string} theme
 * @returns {Record<string, string>}
 */
export function resolveThemeVarsFromHtml(html, preset, theme) {
  assertKnown(preset, theme);
  return resolveThemeVarsFromCss(findStyleBlocks(html).main, preset, theme);
}
