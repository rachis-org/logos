import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import sharp from 'sharp';
import { appIcon, encodeIco, renderPng, themedSvg, colorSchemes, isDark } from './lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run build [-- --help]\nRender vector/, raster/, the README gallery, manifest.json, and bundles/rachis-logos.zip.');
  process.exit(0);
}
if (args.length) throw new Error(`Unknown arguments: ${args.join(' ')}`);

const config = JSON.parse(await readFile(path.join(root, 'logos.json'), 'utf8'));
const iconAsset = config.assets.find(({ name }) => name === config.icons.asset);
if (!iconAsset) throw new Error('icons.asset must name a configured asset');
const stage = await mkdtemp(path.join(root, '.logo-build-'));
const entries = [];
async function save(relative, data) {
  const target = path.join(stage, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  entries.push(relative);
}

function readmeGallery() {
  const header = `## Logo gallery

Each preview links to its SVG. The PNG previews include a white or black background so every scheme stays visible in both GitHub themes.

| Color scheme | ${config.assets.map(({ description }) => description).join(' | ')} |
| --- | ${config.assets.map(() => '---').join(' | ')} |`;
  const rows = colorSchemes.map((scheme) => {
    const images = config.assets.map((asset) => {
      const background = isDark(scheme) ? 'black' : 'white';
      const width = asset.widths.find((value) => value >= (asset.type === 'wordmark' ? 400 : 128));
      const svg = `vector/${asset.type}/${asset.name}-${scheme}.svg`;
      const png = `raster/${asset.type}/${scheme}/${background}/${asset.name}-${width}.png`;
      return `<a href="${svg}"><img src="${png}" width="${asset.type === 'wordmark' ? 240 : 64}" alt="${asset.description}, ${scheme}"></a>`;
    });
    return `| \`${scheme}\` | ${images.join(' | ')} |`;
  });
  const adaptive = config.assets.map((asset) => `[${asset.type}](vector/${asset.type}/${asset.name}-adaptive.svg)`).join(' · ');
  return `${header}\n${rows.join('\n')}\n\nAdaptive SVGs: ${adaptive}.\n\nWeb icons: [adaptive favicon](raster/icons/favicon.svg) · [ICO fallback](raster/icons/favicon.ico) · [Apple touch icon](raster/icons/apple-touch-icon.png) · [web manifest](raster/icons/site.webmanifest).`;
}

function updateReadme(readme) {
  const start = '<!-- BEGIN GENERATED LOGO GALLERY -->';
  const end = '<!-- END GENERATED LOGO GALLERY -->';
  const first = readme.indexOf(start);
  const last = readme.indexOf(end, first + start.length);
  if (first < 0 || last < 0) throw new Error('README.md is missing the logo gallery markers');
  return readme.slice(0, first + start.length) + `\n\n${readmeGallery()}\n\n` + readme.slice(last);
}

try {
  const iconSvgs = {};
  for (const asset of config.assets) {
    console.log(`Rendering ${asset.name}…`);
    const source = await readFile(path.join(root, asset.source), 'utf8');
    await save(`vector/${asset.type}/${asset.name}-adaptive.svg`, themedSvg(source, asset, 'adaptive'));
    for (const theme of colorSchemes) {
      const svg = themedSvg(source, asset, theme);
      await save(`vector/${asset.type}/${asset.name}-${theme}.svg`, svg);
      if (asset === iconAsset) iconSvgs[theme] = svg;
      for (const width of asset.widths) {
        for (const [directory, background] of [
          ['transparent', undefined],
          [isDark(theme) ? 'black' : 'white', isDark(theme) ? '#000000' : '#ffffff'],
        ]) {
          const png = await renderPng(svg, width, background);
          const base = `raster/${asset.type}/${theme}/${directory}/${asset.name}-${width}`;
          await save(`${base}.png`, png);
          await save(`${base}.tiff`, await sharp(png).tiff({ compression: 'lzw' }).toBuffer());
        }
      }
    }
  }

  console.log('Rendering favicons and app icons…');
  await save('raster/icons/favicon.svg', await readFile(path.join(stage, `vector/${iconAsset.type}/${iconAsset.name}-adaptive.svg`)));
  for (const theme of colorSchemes) {
    const sizes = [...new Set([...config.icons.pngSizes, ...config.icons.icoSizes])].sort((a, b) => a - b);
    const frames = [];
    for (const size of sizes) {
      const png = await renderPng(iconSvgs[theme], size);
      await save(`raster/icons/${theme}/favicon-${size}.png`, png);
      if (config.icons.icoSizes.includes(size)) frames.push({ size, png });
    }
    const ico = encodeIco(frames);
    await save(`raster/icons/${theme}/favicon.ico`, ico);
    if (theme === 'lightmode') await save('raster/icons/favicon.ico', ico);
  }
  for (const [filename, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    await save(`raster/icons/${filename}`, await appIcon(iconSvgs.lightmode, size, config.icons.appBackground, config.icons.appPadding));
  }
  // Retina entries must actually have twice the pixel dimensions.
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      await save(`raster/icons/rachis.iconset/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`,
        await renderPng(iconSvgs.lightmode, size * scale));
    }
  }
  await save('raster/icons/site.webmanifest', JSON.stringify({
    name: 'Rachis', short_name: 'Rachis', display: 'standalone',
    background_color: config.icons.appBackground, theme_color: iconAsset.lightmode.stroke,
    icons: [192, 512].map((size) => ({ src: `icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
  }, null, 2) + '\n');
  await save('README.md', updateReadme(await readFile(path.join(root, 'README.md'), 'utf8')));

  const files = [];
  for (const filename of [...entries].sort()) {
    const bytes = await readFile(path.join(stage, filename));
    files.push({ path: filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await save('manifest.json', JSON.stringify({ schemaVersion: 1, files }, null, 2) + '\n');

  const archive = {};
  // Stable ordering and timestamps make repeated builds byte-for-byte identical.
  const inputs = [...new Set(['logos.json', 'sources/README.md', config.referencePng, ...config.assets.map(({ source }) => source)])];
  for (const filename of [...entries, ...inputs].sort()) {
    archive[`rachis-logos/${filename}`] = [await readFile(path.join(entries.includes(filename) ? stage : root, filename)),
      { mtime: new Date(2020, 0, 1) }];
  }
  await save('bundles/rachis-logos.zip', zipSync(archive, { level: 6 }));

  // Publish only after rendering and packaging succeed. These paths are generated.
  for (const filename of await readdir(stage)) {
    await rm(path.join(root, filename), { recursive: true, force: true });
    await rename(path.join(stage, filename), path.join(root, filename));
  }
  console.log(`Built ${entries.length} files. Browse the logo gallery in README.md.`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
