# Source artwork

The original files are preserved unchanged and organized by file type:

- `vector/rachis-logo.svg`: 256 × 64 wordmark, with lettering already converted to paths.
- `raster/rachis-logo.png`: original 256 × 64 raster reference; included unchanged in the bundle. Larger exports are rendered from the SVG.
- `vector/rachis-stamp.svg`: open teal symbol on a 64 × 64 canvas.
- `archive/favicon.svg`: unused original filled black symbol, retained only as an archive. No variants of this design are rendered or included in the bundle.

`vector/rachis-favicon.svg` was downloaded unchanged on 2026-10-21 from:

<https://rachis-org.caporaso-lab-account.workers.dev/_astro/favicon.Bo-uaUJP.svg>

The asset is linked by the [Rachis homepage](https://rachis-org.caporaso-lab-account.workers.dev/). It uses teal `#1a414c` strokes in light mode, white strokes in dark mode, and unfilled ellipses.

The homepage uses the same wordmark geometry as `vector/rachis-logo.svg`. Its theme behavior is supplied by surrounding CSS rather than the source SVG: black lettering and `#1c404b` symbol strokes in light mode; `#f7f8f8` lettering and `#0d99ff` symbol strokes in dark mode. These colors were verified against the deployed page's HTML and styles on 2026-10-21 and are recorded in `logos.json` as `lightmode` and `darkmode`. The generator makes this behavior self-contained in the exported SVGs. The stamp's dark variant uses the website favicon's white treatment. `bw_lightmode` and `bw_darkmode` override all painted areas with pure black or white while retaining unfilled areas.

Builds read only local files. Updating the downloaded asset is an intentional source change; hashed website asset URLs may change with later deployments.

The layout and export set are inspired by [qiime2/logos](https://github.com/qiime2/logos). No QIIME artwork or build code is copied into this repository.
