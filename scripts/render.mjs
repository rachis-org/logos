import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import sharp from 'sharp';
import { appIcon, encodeIco, renderPng, themedSvg, colorSchemes, adaptiveModes, isDark } from './lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run build [-- --help]\nRender vector/, raster/, preview.html, manifest.json, and bundles/rachis-logos.zip.');
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

function gallery() {
  const rows = config.assets.map((asset) => `
    <section><h2>${asset.description}</h2><div class="pair">
      ${colorSchemes.map((theme) => `<article class="${isDark(theme) ? 'dark' : 'light'}"><span>${theme}</span>
        <img class="${asset.type === 'wordmark' ? 'wordmark' : 'symbol'}" src="vector/${asset.type}/${asset.name}-${theme}.svg" alt="${asset.description}">
        <p><a href="vector/${asset.type}/${asset.name}-${theme}.svg">SVG</a> · <a href="raster/${asset.type}/${theme}/transparent/${asset.name}-${asset.widths.find((width) => width >= 256)}.png">PNG</a></p>
      </article>`).join('')}
    </div><p><a href="vector/${asset.type}/${asset.name}-adaptive.svg">Adaptive SVG</a></p></section>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rachis logo exports</title><style>
* { box-sizing: border-box; } body { margin: 0 auto; padding: 48px 24px; max-width: 1100px; font: 16px/1.5 system-ui; color: #183640; background: #edf2f4; }
h1 { font-size: 36px; margin-bottom: 8px; } h2 { font-size: 20px; margin-top: 36px; } a { color: inherit; } .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
article { border: 1px solid #849ca34d; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 225px; }
article.light { background: white; color: #1a414c; color-scheme: light; } article.dark { background: #030620; color: #f7f8f8; color-scheme: dark; }
article span { align-self: flex-start; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; opacity: .65; }
img { display: block; max-width: 100%; margin: 24px 0; } .wordmark { width: 320px; height: 80px; } .symbol { width: 96px; height: 96px; }
article p { margin: 0; font-size: 14px; } @media(max-width:600px) { .pair { grid-template-columns: 1fr; } }
</style><h1>Rachis logos</h1><p>Generated from the original artwork and website palette. <a href="bundles/rachis-logos.zip">Download the complete bundle</a>.</p>
${rows}<section><h2>Adaptive SVGs in a browser</h2><p>The same file is embedded twice; each panel sets its own CSS <code>color-scheme</code>.</p><div class="pair">
${Object.keys(adaptiveModes).map((mode) => `<article class="${mode}"><span>${mode} color scheme</span><img class="wordmark" src="vector/wordmark/rachis-logo-adaptive.svg" alt="Adaptive Rachis wordmark"><img class="symbol" src="vector/favicon/rachis-favicon-adaptive.svg" alt="Adaptive favicon"></article>`).join('')}
</div></section><section><h2>Web icons</h2><p><a href="raster/icons/favicon.svg">Adaptive favicon</a> · <a href="raster/icons/favicon.ico">ICO fallback</a> · <a href="raster/icons/apple-touch-icon.png">Apple touch icon</a> · <a href="raster/icons/site.webmanifest">Web manifest</a></p></section></html>\n`;
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
  await save('preview.html', gallery());

  const files = [];
  for (const filename of [...entries].sort()) {
    const bytes = await readFile(path.join(stage, filename));
    files.push({ path: filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await save('manifest.json', JSON.stringify({ schemaVersion: 1, files }, null, 2) + '\n');

  const archive = {};
  // Stable ordering and timestamps make repeated builds byte-for-byte identical.
  const inputs = [...new Set(['README.md', 'logos.json', 'sources/README.md', config.referencePng, ...config.assets.map(({ source }) => source)])];
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
  console.log(`Built ${entries.length} files. Open preview.html to browse the results.`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
