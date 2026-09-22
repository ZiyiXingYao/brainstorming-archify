// 任务 2.2 —— 主题变量解析用例（本仓库新增，非上游文件）
//
// 覆盖：
//   - classic 深浅两套各 32 个变量；
//   - 少定义变量的预设（signal-flow 深 30 / 浅 27）能由 classic 补齐到完整；
//   - 四套预设 × 两主题共 8 个组合均非空、无缺项、无 undefined；
//   - 未知预设 / 未知主题明确报错，不静默回落；
//   - @media print 的变量覆盖不泄漏进主题块；
//   - 「先剥离注释再切规则」对主题块识别是承重的。
//
// 只依赖 Node 内置模块。

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRESETS,
  THEMES,
  themeBlockSelector,
  parseThemeBlocks,
  resolveThemeVars,
  resolveThemeVarsFromCss,
  resolveThemeVarsFromHtml,
} from '../svg/theme-vars.mjs';
import { findStyleBlocks } from '../svg/css-extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const TEMPLATE = path.join(SKILL_ROOT, 'assets', 'template.html');
const html = fs.readFileSync(TEMPLATE, 'utf8');
const { main } = findStyleBlocks(html);

test('预设与主题枚举与浏览器版目标一致', () => {
  assert.deepEqual(PRESETS, ['classic', 'signal-flow', 'blueprint', 'editorial']);
  assert.deepEqual(THEMES, ['dark', 'light']);
});

test('模板主题块选择器命名与探针一致', () => {
  assert.equal(themeBlockSelector('classic', 'dark'), ':root,[data-theme="dark"]');
  assert.equal(themeBlockSelector('classic', 'light'), '[data-theme="light"]');
  assert.equal(themeBlockSelector('signal-flow', 'dark'), '[data-preset="signal-flow"][data-theme="dark"]');
  assert.equal(themeBlockSelector('editorial', 'light'), '[data-preset="editorial"][data-theme="light"]');
});

test('模板里恰好有 4 套预设 × 2 主题 = 8 个主题块，且不含 #theme-icon 这类后代规则', () => {
  const blocks = parseThemeBlocks(main);
  assert.deepEqual(Object.keys(blocks).sort(), [...PRESETS].sort());
  for (const preset of PRESETS) {
    assert.deepEqual(Object.keys(blocks[preset]).sort(), ['dark', 'light']);
  }
  // #theme-icon 规则不是主题块：其 body 无 -- 变量；若被误当主题块，classic light 会多出无关键
  const classicLight = resolveThemeVars(blocks, 'classic', 'light');
  assert.equal(Object.keys(classicLight).length, 32);
});

test('classic 深浅两套各 32 个变量，且键集合一致', () => {
  const dark = resolveThemeVars(parseThemeBlocks(main), 'classic', 'dark');
  const light = resolveThemeVars(parseThemeBlocks(main), 'classic', 'light');
  assert.equal(Object.keys(dark).length, 32);
  assert.equal(Object.keys(light).length, 32);
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
  // 值必须是实际解析出的色值，而非浏览器默认（同时锁定 @media print 未泄漏）
  assert.equal(dark['--bg'], '#020617');
  assert.equal(light['--bg'], '#f8fafc');
  assert.equal(dark['--toolbar-text'], '#e2e8f0');
  assert.equal(light['--toolbar-menu-bg'], '#ffffff');
});

test('signal-flow 浅色（仅定义 27 个）由 classic 补齐到完整的 32 个', () => {
  const blocks = parseThemeBlocks(main);
  const presetLight = blocks['signal-flow'].light;
  const classicLight = blocks.classic.light;
  assert.equal(Object.keys(presetLight).length, 27);

  const merged = resolveThemeVars(blocks, 'signal-flow', 'light');
  assert.equal(Object.keys(merged).length, 32);
  // classic 的每个键都必须在，且无 undefined
  for (const key of Object.keys(classicLight)) {
    assert.ok(key in merged, `缺项：${key}`);
    assert.equal(typeof merged[key], 'string');
    assert.notEqual(merged[key], '');
    assert.notEqual(merged[key], undefined);
  }
  // 预设定义的值覆盖 classic
  assert.equal(merged['--arrow-emphasis'], '#0d9488');
  assert.equal(merged['--bg'], '#f4f9fc');
  // 预设未定义的键回落到 classic
  assert.ok(!('--toolbar-bg' in presetLight));
  assert.equal(merged['--toolbar-bg'], classicLight['--toolbar-bg']);
  assert.equal(merged['--toolbar-bg'], 'rgba(255, 255, 255, 0.92)');
});

test('signal-flow 深色（仅定义 30 个）由 classic 补齐，且预设值覆盖 classic', () => {
  const blocks = parseThemeBlocks(main);
  const merged = resolveThemeVars(blocks, 'signal-flow', 'dark');
  assert.equal(Object.keys(merged).length, 32);
  assert.equal(merged['--bg'], '#030711'); // 预设覆盖
  assert.equal(merged['--arrow-emphasis'], '#2dd4bf'); // 预设覆盖
  assert.equal(merged['--toolbar-text'], '#e2e8f0'); // classic 补齐
  assert.equal(merged['--toolbar-hover'], 'rgba(15, 23, 42, 0.95)'); // classic 补齐
});

test('8 个组合全部非空、无缺项、无 undefined（补齐后的完整集合）', () => {
  const blocks = parseThemeBlocks(main);
  const classicKeys = {
    dark: Object.keys(blocks.classic.dark),
    light: Object.keys(blocks.classic.light),
  };
  for (const preset of PRESETS) {
    for (const theme of THEMES) {
      const merged = resolveThemeVars(blocks, preset, theme);
      assert.ok(Object.keys(merged).length > 0, `${preset}/${theme} 为空`);
      for (const key of classicKeys[theme]) {
        assert.ok(key in merged, `${preset}/${theme} 缺项：${key}`);
      }
      for (const key of Object.keys(blocks[preset][theme])) {
        assert.ok(key in merged, `${preset}/${theme} 缺预设键：${key}`);
      }
      for (const [key, value] of Object.entries(merged)) {
        assert.match(key, /^--/, `${preset}/${theme} 出现非自定义属性键：${key}`);
        assert.equal(typeof value, 'string');
        assert.notEqual(value, '');
        assert.notEqual(value, 'undefined');
      }
    }
  }
});

test('未知预设 / 未知主题明确报错，不静默回落', () => {
  const blocks = parseThemeBlocks(main);
  assert.throws(() => resolveThemeVars(blocks, 'neon', 'dark'), /Unknown preset/);
  assert.throws(() => resolveThemeVars(blocks, 'classic', 'sepia'), /Unknown theme/);
  assert.throws(() => resolveThemeVarsFromCss(main, 'nope', 'dark'), /Unknown preset/);
  assert.throws(() => resolveThemeVarsFromHtml(html, 'signal-flow', 'high-contrast'), /Unknown theme/);
  // 报错信息应列出合法取值，便于定位
  assert.throws(() => resolveThemeVars(blocks, 'neon', 'dark'), /signal-flow/);
  assert.throws(() => resolveThemeVars(blocks, 'classic', 'sepia'), /light/);
});

test('先剥离注释是承重环节：带前导注释的默认深色块仍被识别为 classic/dark', () => {
  const synthetic = [
    '/* ==========================================================',
    '   THEME VARIABLES — switch by toggling [data-theme] on <html>',
    '   ========================================================== */',
    ':root,',
    '[data-theme="dark"] {',
    '  --bg: #000001;',
    '  --text: #eeeeee;',
    '}',
    '',
    '[data-theme="light"] {',
    '  --bg: #ffffff;',
    '  --text: #111111;',
    '}',
  ].join('\n');

  const blocks = parseThemeBlocks(synthetic);
  const dark = resolveThemeVars(blocks, 'classic', 'dark');
  assert.equal(dark['--bg'], '#000001');
  assert.equal(dark['--text'], '#eeeeee');
  // 若去掉 stripCssComments，classic/dark 块不会被识别，下面会抛「block not found」
  const light = resolveThemeVars(blocks, 'classic', 'light');
  assert.equal(light['--bg'], '#ffffff');
});

test('合并不修改入参：resolveThemeVars 返回新对象，且重复调用结果稳定', () => {
  const blocks = parseThemeBlocks(main);
  const before = JSON.stringify(blocks);
  const a = resolveThemeVars(blocks, 'blueprint', 'dark');
  const b = resolveThemeVars(blocks, 'blueprint', 'dark');
  assert.deepEqual(a, b);
  assert.notEqual(a, blocks['blueprint'].dark);
  assert.equal(JSON.stringify(blocks), before);
});

test('从模板 HTML 直接解析：classic/dark 与 classic/light 各 32 项', () => {
  const dark = resolveThemeVarsFromHtml(html, 'classic', 'dark');
  const light = resolveThemeVarsFromHtml(html, 'classic', 'light');
  assert.equal(Object.keys(dark).length, 32);
  assert.equal(Object.keys(light).length, 32);
  assert.notDeepEqual(dark, light);
});
