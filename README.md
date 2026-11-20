# Vice State Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Wahyukanzuro/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Wahyukanzuro/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn any photo into GTA 6-style cover art. A web app for the
[make.fun bounty](https://make.fun/bounty/gta6-cover-art-01) — pick a photo,
choose a layout and a Vice grade, and export a print-ready PNG cover.

## What it does

- **Three layouts** — Collage (hero + five panels), Grid (six even panels),
  Tilted (snapshot stack with white borders).
- **Five grades** — Vice Sunset, Neon Nights, Golden Hour, Palm Noir,
  Bubblegum. Each one is a canvas filter pass plus a tinted overlay, so the
  cover reads as printed poster art, not a phone snapshot.
- **Real poster type** — a 3D stacked title (sunset gradient, hard offset
  shadows, thick outline), Pacifico script subtitle, VOL. 06 badge,
  Collector's Edition ribbon, gold EST. 2026 seal, WANTED stars, tagline
  strip with palm silhouettes and a barcode.
- **Print finish** — halftone dots and film grain toggles.
- **Any photo** — use the twelve built-in samples or upload your own.
  Uploads are read with FileReader on the page only; nothing is sent
  anywhere. Drag a panel to pan its photo, zoom per panel.
- **Exports** — 1080×1080, 1080×1350, 1920×1080 PNG, pixel-exact.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8931 — everything is static and works fully
offline. No build step, no network, no dependencies.

## Files

- `main.ts` — entrypoint: copies `app/` and `screenshots/` into the
  output directory and writes `dossier.json`.
- `app/index.html`, `app/style.css` — the editor.
- `app/src/cover.js` — the cover rendering engine (Canvas 2D).
- `app/src/main.js` — editor logic (panels, uploads, exports).
- `app/fonts/` — Anton, Pacifico and PT Sans (SIL OFL 1.1, see `OFL.txt`).
- `app/samples/` — twelve sample photos.

## License

MIT. Fonts are under the SIL Open Font License 1.1. This is an unofficial
fan-made tool, not affiliated with Rockstar Games or Take-Two Interactive.
