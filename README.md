# Rachis logos

Source artwork and repeatable exports for the Rachis wordmark, stamp, and favicons. Inspired by [qiime2/logos](https://github.com/qiime2/logos), with standalone SVGs that adapt to light and dark color schemes. Subdomain branding is outside this starter set.

Open [preview.html](preview.html) to browse the artwork, or download [the complete ZIP bundle](bundles/rachis-logos.zip).

## Build

Install Node.js 22 or newer, then:

```sh
npm ci
npm run build
npm run check
```

`./rasterize.sh` is an alternative build entry point. The scripts work from any current directory. No ImageMagick, Inkscape, system fonts, or browser installation is required. Builds use the local SVGs and pinned npm dependencies; they do not fetch artwork from the website.

`npm test` runs renderer and icon-format tests. CI runs these tests, builds the full export set, and checks the resulting files.

## Files

| Path | Contents |
| --- | --- |
| `sources/vector/`, `sources/raster/` | Original artwork and website favicon, preserved unchanged |
| `sources/archive/` | Unused original favicon, excluded from exports and bundles |
| `logos.json` | Source paths, export widths, theme colors, and icon settings |
| `vector/<type>/` | Four fixed color schemes and an adaptive SVG for each artwork type |
| `raster/<type>/<scheme>/transparent/` | Transparent PNG/TIFF exports |
| `raster/<type>/<scheme>/white/` or `black/` | Exports flattened onto the scheme's matching background |
| `raster/icons/` | Adaptive SVG favicon, ICOs, PNGs, Apple iconset, touch icon, and web manifest |
| `manifest.json` | Export sizes and SHA-256 checksums |
| `bundles/rachis-logos.zip` | SVGs, rasters, icons, original artwork, documentation, and preview |

Artwork types are `wordmark`, `stamp`, and `favicon`. For example, a transparent monochrome wordmark for dark backgrounds is `raster/wordmark/bw_darkmode/transparent/rachis-logo-400.png`; its SVG is `vector/wordmark/rachis-logo-bw_darkmode.svg`. Favicons and app icon formats remain grouped in `raster/icons/`, as in the QIIME 2 repo.

The number in a raster filename is its **width in pixels**; height follows the source viewBox. The original PNG is retained as a reference rather than upscaled. Only the website favicon design is exported.

| Color scheme | Artwork | Intended background |
| --- | --- | --- |
| `bw_lightmode` | Pure black lettering and symbol | Light |
| `bw_darkmode` | Pure white lettering and symbol | Dark |
| `darkmode` | Website dark palette: off-white lettering and blue wordmark symbol; white stamp/favicon | Dark |
| `lightmode` | Website light palette: black lettering and teal symbol | Light |

The stamp and favicon have identical `darkmode` and `bw_darkmode` colors because the website's dark favicon is already white. The adaptive SVGs switch between `lightmode` and `darkmode`.

Generated directories, `preview.html`, and `manifest.json` are replaced on each successful build. Keep edits in the source files or scripts. Generated outputs are included in the repository's file set so they can be committed and downloaded directly. The ZIP has fixed entry timestamps for reproducible packaging with the same dependencies and platform.

The ZIP distributes artwork and usage documentation. Use a repository checkout to run the build scripts.

## Theme-aware SVGs

Use `vector/wordmark/rachis-logo-adaptive.svg` in an `<img>` or `raster/icons/favicon.svg` as a browser favicon. These files contain their own `prefers-color-scheme` media query; they need no page CSS or fonts.

```html
<img src="/logos/vector/wordmark/rachis-logo-adaptive.svg" width="256" height="64" alt="Rachis">
```

For an application with a manual theme switch, choose a fixed `-lightmode.svg`, `-darkmode.svg`, or `-bw_*.svg` file to match the app theme. Alternatively, set `data-theme="light"` or `data-theme="dark"` on the root of an **inline** adaptive SVG to override its automatic theme. A parent `.dark` class alone cannot control an external SVG image; an image can inherit the embedding element's CSS `color-scheme` in supporting browsers.

PNG, TIFF, and ICO exports always use a fixed theme. Their colors do not change after export. The dark wordmark matches the website's off-white lettering and blue symbol; the dark favicon is white, matching the website favicon.

## Web icons

Copy all of `raster/icons/` to your site's public icon directory, then adapt these paths:

```html
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/icons/site.webmanifest">
```

The root ICO is the `lightmode` fallback, with 16, 32, 48, 64, 128, and 256px PNG frames. Each of the four schemes also has its own ICO and PNGs in `raster/icons/<scheme>/`. Touch and app icons use the `lightmode` symbol on white with added padding. The web manifest's icon paths are relative to the manifest. These are ordinary icons, not maskable icons.

`raster/icons/rachis.iconset/` includes true 2× retina dimensions up to 1024px. To produce a macOS `.icns` file on a Mac:

```sh
iconutil -c icns raster/icons/rachis.iconset -o raster/icons/rachis.icns
```

## Changing the export set

Edit `logos.json` to adjust widths, colors, or the asset used for app icons. The current paint rules support the supplied path/ellipse artwork. If future artwork uses other SVG shapes or multiple independent paint colors, update `scripts/lib.mjs` accordingly. Original geometry and viewBoxes are preserved; only paint styles are overridden.

See [sources/README.md](sources/README.md) for asset origins and the website palette.
