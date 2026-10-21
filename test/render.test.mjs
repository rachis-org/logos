import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { appIcon, encodeIco, renderPng, themedSvg } from '../scripts/lib.mjs';

const config = JSON.parse(await readFile(new URL('../logos.json', import.meta.url)));
const favicon = config.assets.find(({ name }) => name === config.icons.asset);
const source = await readFile(new URL(`../${favicon.source}`, import.meta.url), 'utf8');

test('fixed favicon themes preserve hollow artwork and transparent canvas', async () => {
  for (const [theme, color] of [['bw_lightmode', [0, 0, 0]], ['bw_darkmode', [255, 255, 255]], ['darkmode', [255, 255, 255]], ['lightmode', [26, 65, 76]]]) {
    const png = await renderPng(themedSvg(source, favicon, theme), 256);
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 256);
    assert.equal(info.height, 256);
    assert.equal(data[3], 0, 'corner must remain transparent');
    const opaque = [];
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 255) opaque.push(i);
    assert.ok(opaque.length > 100, 'symbol must be visible');
    for (const i of opaque) assert.deepEqual([...data.subarray(i, i + 3)], color);
    assert.ok(opaque.length < info.width * info.height / 3, 'open favicon must not become solid');
  }
});

test('ICO frame directory points to independent, correctly sized PNG images', async () => {
  const svg = themedSvg(source, favicon, 'lightmode');
  const frames = await Promise.all([16, 32, 256].map(async (size) => ({ size, png: await renderPng(svg, size) })));
  const ico = encodeIco(frames);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), frames.length);
  for (let i = 0; i < frames.length; i++) {
    const entry = 6 + i * 16;
    const offset = ico.readUInt32LE(entry + 12);
    const length = ico.readUInt32LE(entry + 8);
    const { width, height } = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.equal(width, frames[i].size);
    assert.equal(height, width);
    assert.equal(ico[entry] || 256, width);
  }
});

test('app icons have opaque background and the configured safe inset', async () => {
  const png = await appIcon(themedSvg(source, favicon, 'lightmode'), 192, '#ffffff', 0.125);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 192);
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
    const offset = (y * 192 + x) * 4;
    assert.equal(data[offset + 3], 255);
    if (x < 24 || y < 24 || x >= 168 || y >= 168) {
      assert.deepEqual([...data.subarray(offset, offset + 3)], [255, 255, 255]);
    }
  }
});

// Monochrome wordmarks must recolor both lettering and symbol strokes.
test('black and white schemes contain no residual accent color', async () => {
  for (const asset of config.assets) {
    const input = await readFile(new URL(`../${asset.source}`, import.meta.url), 'utf8');
    for (const [scheme, channel] of [['bw_lightmode', 0], ['bw_darkmode', 255]]) {
      const png = await renderPng(themedSvg(input, asset, scheme), 256);
      const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let visible = 0;
      for (let offset = 0; offset < data.length; offset += 4) {
        if (!data[offset + 3]) continue;
        visible++;
        assert.deepEqual([...data.subarray(offset, offset + 3)], [channel, channel, channel], `${asset.name}: ${scheme}`);
      }
      assert.ok(visible > 100, `${asset.name}: ${scheme} must be visible`);
    }
  }
});
