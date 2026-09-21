// 任务 2.1 —— CSS 抽取器用例（本仓库新增，非上游文件）
//
// 覆盖：
//   1. 模板内的两个 <style> 块可分别取到（字体块原文 / 主样式块）；
//   2. 主样式块顶层规则切分数与「SVG 相关」抽取集合对着金样锁定
//      （上游模板一旦增删规则即失败报警）；
//   3. 分词器感知注释 / 字符串 / at-rule 嵌套（@media print 内部规则必须被排除）；
//   4. 「先剥离注释再切规则」这一环是承重的——去掉它本文件会失败。
//
// 只依赖 Node 内置模块。

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SVG_SELECTOR_PATTERN,
  stripCssComments,
  splitTopLevelRules,
  normalizeSelector,
  isSvgRelevantSelector,
  extractSvgCss,
  findStyleBlocks,
  extractFontCss,
  extractSvgCssFromHtml,
} from '../svg/css-extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TEMPLATE = path.join(REPO_ROOT, 'design-diagrams', 'assets', 'template.html');
const GOLDEN = JSON.parse(fs.readFileSync(path.join(HERE, 'svg-css-extract.golden.json'), 'utf8'));

const html = fs.readFileSync(TEMPLATE, 'utf8');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

test('模板里能取到字体块与主样式块，字体块原文逐字节可用', () => {
  const { fonts, main } = findStyleBlocks(html);
  assert.equal(typeof fonts, 'string');
  assert.equal(typeof main, 'string');
  assert.ok(fonts.length > 90000, `字体块应含 base64 WOFF2，实际长度 ${fonts.length}`);
  assert.match(fonts, /@font-face/);
  assert.match(fonts, /font\/woff2;base64/);
  assert.ok(main.length > 100000, `主样式块长度异常：${main.length}`);
  // extractFontCss 与 findStyleBlocks 取到的字体块原文必须一致
  assert.equal(extractFontCss(html), fonts);
  // 字体块原文应与 HTML 中 <style id="archify-fonts"> 的内文逐字节一致
  const m = html.match(/<style id="archify-fonts">([\s\S]*?)<\/style>/);
  assert.equal(fonts, m[1]);
});

test('主样式块剥离注释后：顶层 791 个块 / 其中 35 个 at-rule / 756 条普通规则', () => {
  const { main } = findStyleBlocks(html);
  const rules = splitTopLevelRules(main);
  assert.equal(rules.length, GOLDEN.topLevelChunkCount);
  assert.equal(rules.filter((r) => r.isAtRule).length, GOLDEN.atRuleChunkCount);
  assert.equal(
    rules.filter((r) => !r.isAtRule).length,
    GOLDEN.plainTopLevelRuleCount,
  );
  // at-rule 是作为「一条顶层块」返回的，其内部规则不下钻
  assert.ok(rules.some((r) => r.selector === '@media print' && r.isAtRule));
});

test('金样：抽取出的 SVG 相关规则集合与金样完全一致（选择器 + 全文哈希）', () => {
  const { main } = findStyleBlocks(html);
  const { rules, selectors, css } = extractSvgCss(main);

  assert.equal(rules.length, GOLDEN.extractedRuleCount);
  assert.deepEqual(selectors, GOLDEN.selectors);

  const normalized = selectors.join('\n');
  assert.equal(sha256(normalized), GOLDEN.extractedSelectorSha256);
  assert.equal(sha256(css), GOLDEN.extractedTextSha256);
});

test('金样集合里含 2 条 #theme-icon 规则（正则过滤的副作用必须被如实保留）', () => {
  const { main } = findStyleBlocks(html);
  const { selectors } = extractSvgCss(main);
  const themeIcon = selectors.filter((s) => s.includes('#theme-icon'));
  assert.equal(themeIcon.length, 2);
  assert.deepEqual(themeIcon, ['[data-theme="light"] #theme-icon', '[data-theme="dark"] #theme-icon']);
});

test('at-rule 内部规则被排除：@media print 的变量覆盖不得进入抽取结果', () => {
  const { main } = findStyleBlocks(html);
  const { selectors, css } = extractSvgCss(main);
  assert.ok(!selectors.some((s) => s.trim().startsWith('@')), '抽取结果不应含 at-rule 选择器');
  assert.equal(css.includes('@media print'), false, '不应含 @media print 规则');
  // @media print 把 --bg 强制成 #ffffff；抽取结果里不得出现该 print 覆盖值
  assert.equal(css.includes('--bg: #ffffff'), false, '抽取结果不应包含 print 专用的 --bg: #ffffff');
});

test('选择器正则与浏览器版一致，且顶层 at-rule 不匹配', () => {
  assert.equal(SVG_SELECTOR_PATTERN.source, '(^|,)\\s*(svg|:root|\\[data-theme|\\[data-preset|\\.c-|\\.t-|\\.a-|\\.m-)');
  assert.equal(isSvgRelevantSelector('svg'), true);
  assert.equal(isSvgRelevantSelector(':root, [data-theme="dark"]'), true);
  assert.equal(isSvgRelevantSelector('.c-grid'), true);
  assert.equal(isSvgRelevantSelector('.t-primary'), true);
  assert.equal(isSvgRelevantSelector('.a-default'), true);
  assert.equal(isSvgRelevantSelector('.m-default'), true);
  assert.equal(isSvgRelevantSelector('html[data-preset="signal-flow"] body'), false);
  assert.equal(isSvgRelevantSelector('@media print'), false);
});

test('先剥离注释是承重环节：带前导注释的 :root,[data-theme=dark] 必须仍被识别为纯选择器', () => {
  const synthetic = [
    '/* ==========================================================',
    '   THEME VARIABLES — switch by toggling [data-theme] on <html>',
    '   ========================================================== */',
    ':root,',
    '[data-theme="dark"] {',
    '  --bg: #020617;',
    '}',
  ].join('\n');

  const rules = splitTopLevelRules(synthetic);
  assert.equal(rules.length, 1);
  // 选择器必须是剥离注释后的纯文本；若去掉 stripCssComments 这一步，这里会带上前导注释而失败
  assert.equal(normalizeSelector(rules[0].selector), ':root, [data-theme="dark"]');
  assert.equal(rules[0].text.includes('/*'), false, '规则原文不应残留注释');
  assert.equal(stripCssComments(synthetic).includes('/*'), false);

  // 合成输入不应是空的：抽取器必须认出这条默认深色块
  const extracted = extractSvgCss(synthetic);
  assert.equal(extracted.rules.length, 1);
  assert.equal(extracted.selectors[0], ':root, [data-theme="dark"]');
  assert.match(extracted.css, /--bg: #020617;/);
});

test('分词器感知字符串与注释里的花括号（朴素计数会错切）', () => {
  const synthetic = [
    '/* 注释里的花括号 { } 不应计数 */',
    '.c-string { content: "}"; --brace: "{"; }',
    '.t-after { color: red; }',
  ].join('\n');

  const rules = splitTopLevelRules(synthetic);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].selector, '.c-string');
  assert.equal(rules[0].body.trim(), 'content: "}"; --brace: "{";');
  assert.equal(rules[1].selector, '.t-after');
});

test('at-rule 嵌套不下钻：@media 里的 :root 变量块不进入顶层抽取结果', () => {
  const synthetic = [
    '@media print {',
    '  :root, [data-theme="dark"] { --bg: #ffffff; }',
    '}',
    'svg { color: red; }',
  ].join('\n');

  const rules = splitTopLevelRules(synthetic);
  assert.equal(rules.length, 2, '顶层是 @media 一条 + svg 一条；@media 不下钻');
  assert.equal(rules[0].selector, '@media print');
  assert.equal(rules[0].isAtRule, true);
  assert.equal(rules[1].selector, 'svg');

  const extracted = extractSvgCss(synthetic);
  assert.equal(extracted.ruleCount, 1);
  assert.equal(extracted.selectors[0], 'svg');
  assert.equal(extracted.css.includes('#ffffff'), false);
});

test('extractSvgCssFromHtml 与 extractSvgCss(主样式块) 结果一致', () => {
  const a = extractSvgCssFromHtml(html);
  const { main } = findStyleBlocks(html);
  const b = extractSvgCss(main);
  assert.deepEqual(a.selectors, b.selectors);
  assert.equal(a.css, b.css);
});
