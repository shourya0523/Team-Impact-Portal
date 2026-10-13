# Brand assets

| File            | Use                                                                      |
| --------------- | ------------------------------------------------------------------------ |
| `logo.svg`      | Team IMPACT logo, vector. Light backgrounds, or dark ones at large sizes |
| `logo-dark.svg` | Same logo with a thicker white keyline, for dark or busy backgrounds     |

Both use exactly `#1E3F7B` (navy) and `#EA2642` (red) plus white, and share one 1473 x 1693 canvas.

## How they were made

The only source available was a 1393 x 1613 PNG of the official logo (supplied 7 Oct 2026 as an SVG
that embeds that PNG; no vector master). `build-logo.py` snaps every pixel to navy, red or white,
traces each colour with [vtracer](https://github.com/visioncortex/vtracer) and stacks the layers.
The dark version adds a ~40 px (at source scale) white keyline around the silhouette, the same
treatment as Team IMPACT's own favicon. Rendered back at source size, the trace differs from the
source on about 1.5% of pixels (antialiased edges).

**These are traces, not Team IMPACT's master artwork.** Replace them with the official vector files
when Team IMPACT provides them; keep the file names so nothing else changes.

To rebuild: put the source PNG at `<dir>/src.png`, then
`pip install vtracer pillow numpy && python build-logo.py <dir>`.
