# Vice State Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Wahyukanzuro/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Wahyukanzuro/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn any photo into GTA 6-style **movie-poster cover art** — in your browser,
fully offline. Built for the [make.fun bounty](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Movie-poster formula**: a full-width banded title block, a named cast
  label on every panel, a press-quote strip with five stars, and a production
  line ("A VICE STATE PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA").
- **Any photo**: pick one of 12 sample photos per panel or upload your own
  (FileReader, local only — nothing ever leaves the browser). Drag to pan,
  zoom per panel.
- **Three layouts**: Collage (people-first hero), Grid (six equal panels),
  Tilted (snapshot stack on a sunset field).
- **Five grades**: Vice Sunset, Neon Nights, Golden Hour, Palm Noir,
  Bubblegum — plus halftone dots and film grain toggles.
- **Everything editable**: title, script subtitle, tagline, press quote and
  outlet, production lines, release word, and every cast label.
- **Export PNG** at 1080×1080, 1080×1350, or 1920×1080, plus a Surprise me
  button that reshuffles photos, grade, and tagline.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network, no dependencies — plain static files
(`app/index.html` + `app/style.css` + `app/src/*.js`, classic scripts).

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/app/, out/screenshots/ and out/dossier.json
```

## License

MIT — see [LICENSE](LICENSE). Fonts under the SIL Open Font License 1.1 —
see [app/fonts/OFL.txt](app/fonts/OFL.txt). No Rockstar Games logo,
artwork, or fonts are used anywhere.
