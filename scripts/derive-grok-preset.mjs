import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..', 'presets', 'grok-optimized');
const read = name => readFileSync(resolve(root, name), 'utf8').replace(/\r\n?/g, '\n');
const official = read('upstream-standard.patch.yml');
const persona = read('persona-prefix.md').trimEnd();
const oldPrefix = '              prefix: You are a coding agent powered by the {{model}} model.';
if (official.split(oldPrefix).length !== 2 || !official.includes('id: preset-standard')) throw new Error('Pinned official standard preset layout changed');
const patch = official
  .replace('id: preset-standard', 'id: preset-grok-optimized')
  .replace('        id: standard\n        order: 1', '        id: grok-optimized\n        name: DSH · Grok 优化模式\n        description: 基于官方标准工具，强化任务纪律和结果验证。\n        order: 2')
  .replace(oldPrefix, '              prefix: |\n' + persona.split('\n').map(line => line ? '                ' + line : '').join('\n'));
if (process.argv.includes('--check')) {
  if (read('cordis.patch.yml') !== patch) throw new Error('Derived preset differs from maintained source');
} else writeFileSync(resolve(root, 'cordis.patch.yml'), patch);
console.log('Derived Grok preset from official 0.2.0 standard without extra tools.');
