import sharp from 'sharp';

export const colorSchemes = ['bw_lightmode', 'bw_darkmode', 'darkmode', 'lightmode'];
export const adaptiveModes = { light: 'lightmode', dark: 'darkmode' };
export const isDark = (scheme) => scheme.endsWith('darkmode');

function paintRules(selector, paint) {
  return `${selector} path { fill: ${paint.fill} !important; }
${selector} ellipse { fill: ${paint.fill} !important; stroke: ${paint.stroke} !important; }`;
}

/** Keep the source geometry and scope paint overrides for safe inline embedding. */
export function themedSvg(source, asset, theme) {
  if (!['adaptive', ...colorSchemes].includes(theme)) throw new Error(`Unknown theme: ${theme}`);
  const id = `logo-${asset.name}-${theme}`;
  let svg = source.replace(/<svg\b([^>]*)>/, (_, attrs) =>
    `<svg${attrs.replace(/\s+id="[^"]*"/, '')} id="${id}">`);
  if (svg === source) throw new Error(`Missing SVG root: ${asset.source}`);
  // The website favicon has its own media rule; replace it with scoped rules below.
  svg = svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  let css = paintRules(`#${id}`, asset[theme === 'adaptive' ? adaptiveModes.light : theme]);
  if (theme === 'adaptive') {
    css += `\n@media (prefers-color-scheme: dark) {\n${paintRules(`#${id}`, asset[adaptiveModes.dark])}\n}`;
    for (const [mode, scheme] of Object.entries(adaptiveModes)) {
      css += `\n${paintRules(`#${id}[data-theme="${mode}"]`, asset[scheme])}`;
    }
  }
  return svg.replace('</svg>', `<style>\n${css}\n</style>\n</svg>`);
}

export async function renderPng(svg, width, background) {
  // Render directly at each requested size, never enlarge a smaller PNG.
  let pipeline = sharp(Buffer.from(svg), { density: 300 }).resize({ width });
  if (background) pipeline = pipeline.flatten({ background });
  return pipeline.png().toBuffer();
}

export async function appIcon(svg, size, background, padding) {
  const inset = Math.round(size * padding);
  const symbol = await renderPng(svg, size - 2 * inset);
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: symbol, gravity: 'centre' }]).png().toBuffer();
}

/** ICO directory followed by lossless PNG frames, supported by modern browsers. */
export function encodeIco(frames) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  for (const [index, { size, png }] of frames.entries()) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error('ICO size must be 1–256');
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...frames.map(({ png }) => png)]);
}
