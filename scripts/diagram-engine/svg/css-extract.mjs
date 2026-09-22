/**
 * design-diagrams —— Node 侧 CSS 抽取器（任务 2.1）
 * ============================================================================
 *
 * 目的
 * ----
 * archify 的 `viewer/export.js` 只在浏览器里把「画图真正需要的 CSS」从模板抽出
 * 来内联进导出的 SVG（靠 `stylesheet.cssRules` 遍历 + 选择器正则过滤 +
 * `getComputedStyle` 解析变量）。本机没有浏览器，本模块在 Node 侧用**静态解析**
 * 复刻这一步。
 *
 * 两个必须避开的坑（都有对应用例锁住）
 * --------------------------------
 * 1. **必须先剥离注释再切规则。** 主题变量块前有一条说明性注释（分隔线形式的）
 *    注释，若直接对「原始规则文本」做「选择器是否以 `:root` 开头」之类的判断，
 *    `:root, [data-theme="dark"]` 这个默认深色块会被整体漏掉。见
 *    `test/svg-css-extract.test.mjs` 的「先剥离注释是承重环节」用例。
 * 2. **朴素花括号计数不可靠。** 注释与字符串（引号里的 `{` / `}`）会让朴素计数
 *    错切规则。分词器必须感知注释、字符串与 at-rule 嵌套；顶层规则才取，at-rule
 *    （如 `@media print`，它也定义变量）内部的规则**不取**。
 *
 * 设计约束
 * --------
 * - 不依赖任何第三方 CSS 解析库，只用 Node 内置能力。
 * - 抽取结果**逐字保留**规则原文（仅剥离注释、裁掉首尾空白），不做任何格式化。
 * - 输出可直接被任务 2.3 的导出入口拼接内联。
 */

/**
 * 与浏览器版 `viewer/export.js:270` 完全一致的选择器过滤正则。
 * 命中 `svg` / `:root` / `[data-theme` / `[data-preset` / `.c-` / `.t-` / `.a-` / `.m-`
 * 起头的任一选择器（逗号分隔的每一段都参与匹配）。
 * 注意：`[data-theme="light"] #theme-icon` 这类后代规则也会被命中——这与浏览器版
 * 行为一致，故「保留 182 条」里含这 2 条 `#theme-icon` 规则。
 */
export const SVG_SELECTOR_PATTERN =
  /(^|,)\s*(svg|:root|\[data-theme|\[data-preset|\.c-|\.t-|\.a-|\.m-)/;

/**
 * 剥离 CSS 注释（斜杠星号 … 星号斜杠）。注释在 CSS 里等价于空白，这里按**空串**替换，
 * 以便与金样哈希稳定一致。感知引号：字符串里的 `/*` 不算注释起始。
 * 未闭合的注释视为到末尾为止。
 *
 * @param {string} css
 * @returns {string}
 */
export function stripCssComments(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  let quote = null;
  while (i < n) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += css[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * 归一化选择器：按逗号切分、逐段 trim、以 `', '` 重新拼接。
 * 用于把 `:root,\n    [data-theme="dark"]` 归一成 `:root, [data-theme="dark"]`，
 * 便于稳定比较与做主题块归类。
 *
 * @param {string} selector
 * @returns {string}
 */
export function normalizeSelector(selector) {
  return selector
    .split(',')
    .map((part) => part.trim())
    .join(', ');
}

/**
 * 是否属于「画图需要的」SVG 相关规则。
 * @param {string} selector
 * @returns {boolean}
 */
export function isSvgRelevantSelector(selector) {
  return SVG_SELECTOR_PATTERN.test(selector);
}

/**
 * 切出**顶层**规则。流程：先剥离注释，再逐字符扫描；扫描时感知
 * 注释（已被剥离）、字符串（引号内的 `{`/`}`/`;` 不参与结构）与花括号嵌套。
 * 只在花括号深度回到 0 时产出一条规则；at-rule（`@media`/`@keyframes`/`@page`…）
 * 作为**一条**顶层规则返回（`isAtRule: true`），其内部规则不单独产出。
 *
 * @param {string} styleText 主样式块原文（或任意 CSS 文本）
 * @returns {Array<{selector: string, isAtRule: boolean, body: string, text: string}>}
 */
export function splitTopLevelRules(styleText) {
  const css = stripCssComments(styleText);
  const rules = [];
  const n = css.length;
  let i = 0;
  let quote = null;
  let depth = 0;
  let chunkStart = 0;
  let preludeEnd = -1;

  while (i < n) {
    const c = css[i];
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
    if (c === '{') {
      if (depth === 0) preludeEnd = i;
      depth += 1;
      i += 1;
      continue;
    }
    if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        const selector = css.slice(chunkStart, preludeEnd).trim();
        if (selector.length > 0) {
          rules.push({
            selector,
            isAtRule: selector.startsWith('@'),
            body: css.slice(preludeEnd + 1, i),
            text: css.slice(chunkStart, i + 1).trim(),
          });
        }
        preludeEnd = -1;
        chunkStart = i + 1;
      } else if (depth < 0) {
        // 结构失衡时的兜底：丢弃多余右花括号，避免后续整体错位
        depth = 0;
        chunkStart = i + 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return rules;
}

/**
 * 抽取内联进独立 SVG 的规则集合。
 *
 * @param {string} styleText 主样式块原文
 * @returns {{rules: Array<object>, selectors: string[], css: string, ruleCount: number}}
 */
export function extractSvgCss(styleText) {
  const rules = splitTopLevelRules(styleText).filter(
    (rule) => !rule.isAtRule && isSvgRelevantSelector(rule.selector),
  );
  const selectors = rules.map((rule) => normalizeSelector(rule.selector));
  const css = rules.map((rule) => rule.text).join('\n');
  return { rules, selectors, css, ruleCount: rules.length };
}

/**
 * 从模板 HTML 中定位两个 `<style>` 块。
 * - `fonts`：`<style id="archify-fonts">` 的内文原文（base64 WOFF2，逐字节保留）；
 * - `main`：无 `id` 的主样式块内文（多个时取最长者）。
 *
 * 找不到时**抛错**而不是返回空——避免调用方静默产出缺样式的图。
 *
 * @param {string} html
 * @returns {{fonts: string, main: string}}
 */
export function findStyleBlocks(html) {
  const re = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) blocks.push({ attrs: m[1], content: m[2] });

  const fontBlock = blocks.find((b) => /id\s*=\s*["']?archify-fonts\b/.test(b.attrs));
  if (!fontBlock) {
    throw new Error('未找到 <style id="archify-fonts"> 字体块：模板结构可能已变更。');
  }
  const mains = blocks
    .filter((b) => !/\bid\s*=/.test(b.attrs))
    .sort((a, b) => b.content.length - a.content.length);
  if (mains.length === 0) {
    throw new Error('未找到无 id 的主样式块：模板结构可能已变更。');
  }
  return { fonts: fontBlock.content, main: mains[0].content };
}

/**
 * 取字体 CSS 原文（`<style id="archify-fonts">` 的内文）。
 * @param {string} html
 * @returns {string}
 */
export function extractFontCss(html) {
  return findStyleBlocks(html).fonts;
}

/**
 * 从模板 HTML 一步抽取 SVG 相关规则。
 * @param {string} html
 * @returns {{rules: Array<object>, selectors: string[], css: string, ruleCount: number}}
 */
export function extractSvgCssFromHtml(html) {
  return extractSvgCss(findStyleBlocks(html).main);
}
