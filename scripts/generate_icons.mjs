// Regenerate native and browser icons from the same vector used by the README mark.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'public/brand/billzen-icon.svg';
const cli = path.join(root, 'node_modules/@tauri-apps/cli/tauri.js');
function generate(args) {
  const result = spawnSync(process.execPath, [cli, 'icon', source, ...args], {
    cwd: root, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Icon generation failed (${result.status})`);
}
generate(['--ios-color', '#c9ff79']);
generate(['--output', 'public/brand', '--png', '192', '--png', '512']);
for (const [from, to] of [
  ['src-tauri/icons/icon.ico', 'public/favicon.ico'],
  ['src-tauri/icons/ios/AppIcon-60x60@3x.png', 'public/apple-touch-icon.png'],
]) fs.copyFileSync(path.join(root, from), path.join(root, to));

const mark = fs.readFileSync(path.join(root, source), 'utf8')
  .replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  .replace(/\s*<title[^>]*>.*?<\/title>\s*/, '').trim();
const heroPath = path.join(root, 'docs/brand/billzen-hero.svg');
let hero = fs.readFileSync(heroPath, 'utf8');
const marker = /<!-- billzen-mark:start -->[\s\S]*?<!-- billzen-mark:end -->/;
if (!marker.test(hero)) throw new Error('README hero is missing its icon source markers');
hero = hero.replace(marker, `<!-- billzen-mark:start --><g transform="translate(50 42)">${mark}</g><!-- billzen-mark:end -->`);
fs.writeFileSync(heroPath, hero);
console.log('Native, browser and README branding generated from', source);
