import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { colorSchemes, isDark } from './lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file));
const config = JSON.parse(await read('logos.json'));
const manifest = JSON.parse(await read('manifest.json'));
const archive = unzipSync(await read('bundles/rachis-logos.zip'));
const listed = new Set(manifest.files.map(({ path: file }) => file));
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const file = `${directory}/${entry.name}`;
    // Optional output from the documented macOS iconutil command.
    if (file === 'raster/icons/rachis.icns') continue;
    files.push(...(entry.isDirectory() ? await walk(file) : [file]));
  }
  return files;
}
assert.deepEqual([...listed].sort(), [...await walk('vector'), ...await walk('raster'), 'README.md'].sort());

for (const entry of manifest.files) {
  const bytes = await read(entry.path);
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
  assert.deepEqual(Buffer.from(archive[`rachis-logos/${entry.path}`]), bytes, `ZIP: ${entry.path}`);
}
assert.deepEqual(Buffer.from(archive['rachis-logos/manifest.json']), await read('manifest.json'));
for (const source of [config.referencePng, ...config.assets.map(({ source }) => source)]) {
  assert.deepEqual(Buffer.from(archive[`rachis-logos/${source}`]), await read(source), `Source: ${source}`);
}

for (const asset of config.assets) {
  const source = (await read(asset.source)).toString();
  const bounds = source.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  for (const theme of colorSchemes) {
    const svg = (await read(`vector/${asset.type}/${asset.name}-${theme}.svg`)).toString();
    assert.ok(!svg.includes('prefers-color-scheme'), 'Fixed SVG cannot retain a media rule');
    for (const width of asset.widths) {
      for (const directory of ['transparent', isDark(theme) ? 'black' : 'white']) {
        for (const format of ['png', 'tiff']) {
          const file = `raster/${asset.type}/${theme}/${directory}/${asset.name}-${width}.${format}`;
          assert.ok(listed.has(file), `Missing export: ${file}`);
          const { width: actualWidth, height, hasAlpha } = await sharp(await read(file)).metadata();
          assert.equal(actualWidth, width, file);
          assert.equal(height, Math.max(1, Math.round(width * bounds[3] / bounds[2])), file);
          assert.equal(hasAlpha, directory === 'transparent', `Alpha: ${file}`);
        }
      }
    }
  }
  const adaptive = (await read(`vector/${asset.type}/${asset.name}-adaptive.svg`)).toString();
  assert.ok(adaptive.includes('@media (prefers-color-scheme: dark)'));
}

for (const theme of colorSchemes) {
  const ico = await read(`raster/icons/${theme}/favicon.ico`);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), config.icons.icoSizes.length);
  for (let i = 0; i < config.icons.icoSizes.length; i++) {
    const entry = 6 + i * 16;
    const start = ico.readUInt32LE(entry + 12);
    const end = start + ico.readUInt32LE(entry + 8);
    assert.ok(end <= ico.length);
    const { width, height } = await sharp(ico.subarray(start, end)).metadata();
    assert.equal(width, config.icons.icoSizes[i]);
    assert.equal(height, width);
  }
}
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const file = `raster/icons/rachis.iconset/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
    const metadata = await sharp(await read(file)).metadata();
    assert.equal(metadata.width, size * scale, file);
    assert.equal(metadata.height, size * scale, file);
  }
}
const webmanifest = JSON.parse(await read('raster/icons/site.webmanifest'));
for (const icon of webmanifest.icons) {
  const metadata = await sharp(await read(path.posix.join('raster/icons', icon.src))).metadata();
  assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
}
const readme = (await read('README.md')).toString().replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
const targets = [
  ...[...readme.matchAll(/(?:href|src)="([^"]+)"/g)].map(([, target]) => target),
  ...[...readme.matchAll(/\]\(([^\s)]+)\)/g)].map(([, target]) => target),
];
for (const target of new Set(targets)) {
  if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
  await read(target);
}
assert.ok(!archive['rachis-logos/preview.html'], 'The bundle should use the README gallery');
console.log(`Verified ${manifest.files.length} exports, raster dimensions/transparency, ICO frames, retina sizes, README links, and ZIP contents.`);
