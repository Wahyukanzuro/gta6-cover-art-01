// Vice State Cover Studio — cover renderer (v4, movie-poster rebuild).
// Draws a GTA-style movie poster on a canvas: press-quote strip, photo panels
// with cast labels, a full-width banded title block, tagline ribbon and a
// production strip. All layout is derived from the canvas size, so the same
// code renders the stage preview and the 1080x1080 / 1080x1350 / 1920x1080
// exports. No network: photos are local samples or user uploads (data URLs).
(function (global) {
  'use strict';

  var SAMPLES = [
    'woman-convertible.jpg', 'man-portrait.jpg', 'fisherman-pier.jpg',
    'friends-neon.jpg', 'gas-station.jpg', 'marina.jpg',
    'boulevard.jpg', 'coastal-road.jpg', 'convertible.jpg',
    'lifeguard.jpg', 'night-street.jpg', 'pier.jpg'
  ];

  var DEFAULT_ROLES = [
    'THE DRIVER', 'THE FIXER', 'THE ANGLER',
    'THE CREW', 'THE LOOKOUT', 'THE BOULEVARD'
  ];

  var DEFAULT_PANELS = [
    { src: 'woman-convertible.jpg', role: 'THE DRIVER', zoom: 1.15, ox: 0.5, oy: 0.42 },
    { src: 'man-portrait.jpg', role: 'THE FIXER', zoom: 1.25, ox: 0.5, oy: 0.32 },
    { src: 'fisherman-pier.jpg', role: 'THE ANGLER', zoom: 1.1, ox: 0.5, oy: 0.45 },
    { src: 'friends-neon.jpg', role: 'THE CREW', zoom: 1.1, ox: 0.5, oy: 0.45 },
    { src: 'gas-station.jpg', role: 'THE LOOKOUT', zoom: 1.05, ox: 0.5, oy: 0.5 },
    { src: 'marina.jpg', role: 'THE BOULEVARD', zoom: 1.1, ox: 0.5, oy: 0.5 }
  ];

  // Five grades: a canvas-filter pass plus a tinted overlay, applied per photo.
  var GRADES = {
    'vice-sunset': { filter: 'saturate(1.25) contrast(1.12) sepia(0.18) brightness(1.03)', tint: 'rgba(255,120,40,0.10)' },
    'neon-nights': { filter: 'saturate(1.7) contrast(1.24) brightness(0.98)', tint: 'rgba(255,0,120,0.14)' },
    'golden-hour': { filter: 'saturate(1.4) contrast(1.08) sepia(0.32)', tint: 'rgba(255,170,40,0.12)' },
    'palm-noir': { filter: 'saturate(0.65) contrast(1.32) brightness(0.88)', tint: 'rgba(20,40,120,0.16)' },
    'bubblegum': { filter: 'saturate(1.5) contrast(1.05) hue-rotate(-12deg)', tint: 'rgba(255,90,180,0.12)' }
  };

  function defaultState() {
    return {
      layout: 'collage',
      grade: 'vice-sunset',
      title: 'VICE STATE',
      subtitle: 'Neon Tide',
      tagline: 'CHASE THE SUN · STEAL THE NIGHT',
      quote: 'SUNSET HAS NEVER LOOKED THIS DANGEROUS',
      outlet: 'VICE CITY WEEKLY',
      production: 'A VICE STATE PICTURE · STARRING YOU',
      production2: 'SHOT ON YOUR OWN CAMERA · GRADED BY HAND',
      comingSoon: 'COMING SOON',
      vol: 'VOL. 06',
      edition: "COLLECTOR'S EDITION",
      halftone: true,
      grain: true,
      panels: DEFAULT_PANELS.map(function (p) { return { src: p.src, role: p.role, zoom: p.zoom, ox: p.ox, oy: p.oy }; })
    };
  }

  // Deterministic pseudo-random from an integer seed (no Math.random in output).
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Shrink the font until the text fits maxWidth; returns the fitted size.
  function fitFont(ctx, text, maxWidth, startSize, family, weight) {
    var size = startSize;
    while (size > 12) {
      ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + family;
    return size;
  }

  // Draw one photo into a rect with cover-fit, pan (ox/oy 0..1) and zoom.
  function drawPhoto(ctx, img, x, y, w, h, panel, grade) {
    if (!img || !img.naturalWidth) {
      ctx.fillStyle = '#241040';
      ctx.fillRect(x, y, w, h);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    var scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (panel.zoom || 1);
    var dw = img.naturalWidth * scale;
    var dh = img.naturalHeight * scale;
    var dx = x + (w - dw) * clamp(panel.ox == null ? 0.5 : panel.ox, 0, 1);
    var dy = y + (h - dh) * clamp(panel.oy == null ? 0.5 : panel.oy, 0, 1);
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    ctx.fillStyle = grade.tint;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Small cast label chip pinned to a panel's bottom-left corner.
  function drawRoleChip(ctx, x, y, w, role, unit) {
    if (!role) return;
    var pad = unit * 0.55;
    var fs = Math.max(6, unit * 1.05);
    ctx.font = '400 ' + fs + 'px Anton, sans-serif';
    var tw = ctx.measureText(role).width;
    var bw = tw + pad * 2;
    var bh = fs * 1.9;
    ctx.fillStyle = 'rgba(8,2,20,0.82)';
    ctx.fillRect(x, y - bh, bw, bh);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x, y - bh, unit * 0.22, bh);
    ctx.fillStyle = '#fff6d8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(role, x + pad + unit * 0.22, y - bh / 2 + 1);
  }

  // Deterministic halftone dots over a rect (seeded by panel index).
  function drawHalftone(ctx, x, y, w, h, seed) {
    var rnd = seeded(seed * 7919 + 13);
    var step = Math.max(6, w / 130);
    ctx.fillStyle = 'rgba(10,2,24,0.10)';
    for (var yy = y + step / 2; yy < y + h; yy += step) {
      for (var xx = x + step / 2; xx < x + w; xx += step) {
        if (rnd() < 0.55) {
          ctx.beginPath();
          ctx.arc(xx, yy, step * 0.16, 0, 6.2832);
          ctx.fill();
        }
      }
    }
  }

  // Photo-area rects for each layout. Returns 6 rects {x,y,w,h} in canvas px.
  function layoutRects(layout, area) {
    var g = Math.max(4, area.w * 0.006);
    var rects = [];
    if (layout === 'grid') {
      var cw = (area.w - g * 2) / 3;
      var ch = (area.h - g) / 2;
      for (var r = 0; r < 2; r++) {
        for (var c = 0; c < 3; c++) {
          rects.push({ x: area.x + c * (cw + g), y: area.y + r * (ch + g), w: cw, h: ch });
        }
      }
      return rects;
    }
    if (layout === 'tilted') {
      // Snapshot stack: white-bordered cards, slight rotations, on a field.
      var tw = (area.w - g * 2) / 3;
      var th = (area.h - g) / 2;
      var rots = [-3.5, 2.5, -2, 3, -2.5, 2];
      for (var i = 0; i < 6; i++) {
        var col = i % 3, row = (i / 3) | 0;
        rects.push({
          x: area.x + col * (tw + g), y: area.y + row * (th + g),
          w: tw, h: th, rot: rots[i], border: Math.max(5, area.w * 0.008)
        });
      }
      return rects;
    }
    // Collage: hero left (tall), two stacked panels right, three across bottom.
    var splitY = area.y + area.h * 0.62;
    var heroW = area.w * 0.58;
    rects.push({ x: area.x, y: area.y, w: heroW - g / 2, h: splitY - area.y - g / 2 });
    var rx = area.x + heroW + g / 2;
    var rw = area.w - heroW - g / 2;
    var midY = area.y + (splitY - area.y) / 2;
    rects.push({ x: rx, y: area.y, w: rw, h: midY - area.y - g / 2 });
    rects.push({ x: rx, y: midY + g / 2, w: rw, h: splitY - midY - g / 2 });
    var bw = (area.w - g * 2) / 3;
    for (var b = 0; b < 3; b++) {
      rects.push({ x: area.x + b * (bw + g), y: splitY + g / 2, w: bw, h: area.y + area.h - splitY - g / 2 });
    }
    return rects;
  }

  // Banded gradient title: cream -> yellow -> orange -> pink, hard stops.
  function titleGradient(ctx, y, h) {
    var grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0.00, '#fff8dc');
    grad.addColorStop(0.24, '#fff8dc');
    grad.addColorStop(0.25, '#ffd94d');
    grad.addColorStop(0.49, '#ffd94d');
    grad.addColorStop(0.50, '#ff9e2c');
    grad.addColorStop(0.74, '#ff9e2c');
    grad.addColorStop(0.75, '#ff5da2');
    grad.addColorStop(1.00, '#ff5da2');
    return grad;
  }

  // The full-width title block: banded title + script subtitle overlapping.
  function drawTitleBlock(ctx, W, y, h, state) {
    var cx = W / 2;
    var titleSize = fitFont(ctx, state.title, W * 0.94, h * 0.62, 'Anton, sans-serif', '400');
    // Grow toward full width: a poster title spans ~90% of the poster.
    ctx.font = '400 ' + titleSize + 'px Anton, sans-serif';
    var tw = ctx.measureText(state.title).width;
    var target = W * 0.88;
    if (tw < target) {
      var grown = Math.min(h * 0.78, titleSize * (target / tw));
      if (grown > titleSize) {
        titleSize = grown;
        ctx.font = '400 ' + titleSize + 'px Anton, sans-serif';
        // Re-measure at the grown size: the stretch below must use the fresh
        // width, or grow + stretch double-count and the title overflows.
        tw = ctx.measureText(state.title).width;
      }
    }
    var titleY = y + h * 0.44;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // Anton is condensed: on wide posters the title is height-capped long
    // before it spans the width, so stretch it horizontally (up to 1.9x)
    // toward ~86% of the poster width, like a wide poster grotesque.
    var sx = 1;
    if (tw < target) sx = Math.min(1.9, target / tw);
    ctx.save();
    ctx.translate(cx, titleY);
    ctx.scale(sx, 1);
    // Hard offset shadow, then thick outline, then banded fill.
    ctx.font = '400 ' + titleSize + 'px Anton, sans-serif';
    ctx.fillStyle = '#160426';
    ctx.fillText(state.title, titleSize * 0.055, titleSize * 0.075);
    ctx.strokeStyle = '#160426';
    ctx.lineWidth = Math.max(6, titleSize * 0.085);
    ctx.strokeText(state.title, 0, 0);
    // Gradient in local coords: the context is translated to the title centre.
    ctx.fillStyle = titleGradient(ctx, -titleSize * 0.5, titleSize);
    ctx.fillText(state.title, 0, 0);
    ctx.restore();
    // Script subtitle overlapping the title's lower right, right-aligned so
    // it can never run off the poster's edge.
    var subSize = Math.max(14, h * 0.30);
    ctx.font = subSize + 'px Pacifico, cursive';
    var subX = W * 0.97;
    var subY = y + h * 0.86;
    ctx.save();
    ctx.translate(subX, subY);
    ctx.rotate(-0.05);
    ctx.textAlign = 'right';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, subSize * 0.12);
    ctx.strokeText(state.subtitle, 0, 0);
    ctx.fillStyle = '#ff5da2';
    ctx.fillText(state.subtitle, 0, 0);
    ctx.restore();
    return 0;
  }

  // Top strip: five gold stars + fresh press quote + outlet.
  function drawQuoteStrip(ctx, W, y, h, state) {
    var unit = h * 0.52;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var stars = '★★★★★';
    ctx.font = unit + 'px "PT Sans", sans-serif';
    var starsW = ctx.measureText(stars).width;
    var text = '  "' + state.quote + '" — ' + state.outlet;
    ctx.font = '700 ' + (h * 0.42) + 'px "PT Sans", sans-serif';
    var textW = ctx.measureText(text).width;
    var total = starsW + textW;
    // Centred slightly left of middle so the corner ribbon never covers the
    // outlet name at the quote's tail.
    var startX = (W - total) / 2 - W * 0.03;
    ctx.fillStyle = '#ffd34d';
    ctx.font = unit + 'px "PT Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stars, startX, y + h / 2 + 1);
    ctx.fillStyle = '#fff6d8';
    ctx.font = '700 ' + (h * 0.42) + 'px "PT Sans", sans-serif';
    ctx.fillText(text, startX + starsW, y + h / 2 + 1);
  }

  // Deterministic barcode: seeded bar widths, no text.
  function drawBarcode(ctx, x, y, w, h, seed) {
    var rnd = seeded(seed);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#111111';
    var bx = x;
    while (bx < x + w - 2) {
      var bw = 1 + Math.floor(rnd() * 4);
      if (rnd() < 0.62) ctx.fillRect(bx, y, bw, h);
      bx += bw + 1 + Math.floor(rnd() * 3);
    }
  }

  // Gold EST. seal: ringed circle with two lines of text.
  function drawSeal(ctx, cx, cy, r, state) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fillStyle = '#e8a91c';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.strokeStyle = '#8a5c00';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, 6.2832);
    ctx.stroke();
    ctx.fillStyle = '#4a2c00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (r * 0.34) + 'px "PT Sans", sans-serif';
    ctx.fillText('EST.', cx, cy - r * 0.16);
    ctx.fillText('2026', cx, cy + r * 0.22);
    ctx.restore();
  }

  // Simple palm silhouettes for the production strip corners.
  function drawPalm(ctx, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(6, -26, 2, -44);
    ctx.stroke();
    for (var i = 0; i < 5; i++) {
      var a = -0.5 - i * 0.45;
      ctx.beginPath();
      ctx.moveTo(2, -44);
      ctx.quadraticCurveTo(2 + Math.cos(a) * 26, -44 + Math.sin(a) * 16, 2 + Math.cos(a) * 40, -44 + Math.sin(a) * 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Deterministic film grain over the whole cover.
  function drawGrain(ctx, W, H, seed) {
    var rnd = seeded(seed);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    var n = Math.floor(W * H / 9000);
    for (var i = 0; i < n; i++) {
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (var j = 0; j < n; j++) {
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
  }

  // Main entry: draw the whole poster. images maps sample name (or data URL key)
  // to a loaded HTMLImageElement. state comes from defaultState() / the editor.
  function drawCover(ctx, W, H, state, images) {
    var grade = GRADES[state.grade] || GRADES['vice-sunset'];
    var unit = W / 1080;
    // Backdrop: deep violet gradient.
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c0a38');
    bg.addColorStop(1, '#12041f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var quoteH = H * 0.048;
    var photoTop = quoteH;
    var photoBottom = H * 0.635;
    // Portrait posters need breathing room: the grown title's outline starts
    // almost at the photo area's edge and slices the bottom-row cast chips,
    // so drop the title block by a small gap and shrink it by the same amount
    // (tagline + production rows stay anchored; landscape is untouched).
    var titleGap = W < H ? H * 0.014 : 0;
    var titleTop = photoBottom + titleGap;
    var titleH = H * 0.225 - titleGap;
    var tagTop = titleTop + titleH;
    var tagH = H * 0.045;
    var prodTop = tagTop + tagH;

    drawQuoteStrip(ctx, W, quoteH * 0.12, quoteH * 0.8, state);

    // Photo area.
    var area = { x: W * 0.012, y: photoTop, w: W * 0.976, h: photoBottom - photoTop };
    if (state.layout === 'tilted') {
      var field = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
      field.addColorStop(0, '#ff9e2c');
      field.addColorStop(0.55, '#ff5da2');
      field.addColorStop(1, '#7a2bd8');
      ctx.fillStyle = field;
      ctx.fillRect(area.x, area.y, area.w, area.h);
    }
    var rects = layoutRects(state.layout, area);
    for (var i = 0; i < 6; i++) {
      var r = rects[i];
      var panel = state.panels[i];
      var img = images[panel.src] || null;
      ctx.save();
      if (r.rot) {
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.rotate(r.rot * Math.PI / 180);
        ctx.translate(-r.w / 2, -r.h / 2);
        ctx.fillStyle = '#fff8ec';
        ctx.fillRect(-r.border, -r.border, r.w + r.border * 2, r.h + r.border * 2);
        drawPhoto(ctx, img, 0, 0, r.w, r.h, panel, grade);
        if (state.halftone) drawHalftone(ctx, 0, 0, r.w, r.h, i + 1);
        drawRoleChip(ctx, 0, r.h, r.w, panel.role, unit * 16);
        ctx.restore();
      } else {
        drawPhoto(ctx, img, r.x, r.y, r.w, r.h, panel, grade);
        if (state.halftone) drawHalftone(ctx, r.x, r.y, r.w, r.h, i + 1);
        drawRoleChip(ctx, r.x, r.y + r.h, r.w, panel.role, unit * 16);
        // Thin dark gutter frame.
        ctx.strokeStyle = 'rgba(10,2,24,0.9)';
        ctx.lineWidth = Math.max(2, unit * 2);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.restore();
      }
    }

    // VOL. 06 chip on the hero photo, edition ribbon across the top-right
    // corner: a diagonal band whose centre sits just inside the corner, so
    // the text stays fully visible and both ends exit through the edges.
    var hero = rects[0];
    ctx.font = '700 ' + Math.max(6, unit * 17) + 'px "PT Sans", sans-serif';
    var volW = ctx.measureText(state.vol).width + unit * 22;
    ctx.fillStyle = 'rgba(8,2,20,0.85)';
    ctx.fillRect(hero.x, hero.y, volW, unit * 30);
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.vol, hero.x + unit * 11, hero.y + unit * 15);
    var ribH = unit * 30;
    var ribLen = W * 0.38;
    ctx.save();
    ctx.translate(W * 0.93, area.y + H * 0.035);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#d81e3f';
    ctx.fillRect(-ribLen / 2, -ribH / 2, ribLen, ribH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 ' + Math.max(6, unit * 15) + 'px "PT Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.edition, 0, 1);
    ctx.restore();

    // Title block (full-width, bottom-center of the poster).
    drawTitleBlock(ctx, W, titleTop, titleH, state);

    // Tagline ribbon: black pill, letterspaced cream caps. Sizes stay
    // proportional (small floor) so the small stage preview keeps the same
    // spacing as the exports instead of colliding.
    var tagFs = Math.max(6, H * 0.016);
    ctx.font = '700 ' + tagFs + 'px "PT Sans", sans-serif';
    var tagW = ctx.measureText(state.tagline).width + tagFs * 3.2;
    var tagX = (W - tagW) / 2;
    var tagY = tagTop + tagH + tagH * 0.14;
    ctx.fillStyle = '#0a0218';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH * 0.72, tagH * 0.36);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.tagline, W / 2, tagY + tagH * 0.36);

    // Production strip: COMING SOON + WANTED, production lines, seal, barcode.
    var py = prodTop + (H - prodTop) * 0.5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5da2';
    ctx.font = '700 ' + Math.max(6, H * 0.017) + 'px "PT Sans", sans-serif';
    ctx.fillText(state.comingSoon, W * 0.03, py - H * 0.012);
    ctx.fillStyle = '#ffd34d';
    ctx.font = '700 ' + Math.max(6, H * 0.013) + 'px "PT Sans", sans-serif';
    ctx.fillText('WANTED ★★★★★', W * 0.03, py + H * 0.014);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8dcc8';
    ctx.font = '400 ' + Math.max(6, H * 0.0135) + 'px "PT Sans", sans-serif';
    ctx.fillText(state.production, W * 0.5, py - H * 0.011);
    ctx.fillStyle = '#b9a8c8';
    ctx.fillText(state.production2, W * 0.5, py + H * 0.013);
    drawPalm(ctx, W * 0.015, H - H * 0.012, unit * 0.9, '#3d1a63');
    drawPalm(ctx, W * 0.985, H - H * 0.012, unit * 0.9, '#3d1a63');
    var sealR = Math.max(16, (H - prodTop) * 0.34);
    drawSeal(ctx, W * 0.845, py, sealR, state);
    drawBarcode(ctx, W * 0.90, py - sealR * 0.7, W * 0.065, sealR * 1.4, 42);

    if (state.grain) drawGrain(ctx, W, H, 7);
  }

  global.CoverArt = {
    SAMPLES: SAMPLES,
    GRADES: GRADES,
    DEFAULT_ROLES: DEFAULT_ROLES,
    defaultState: defaultState,
    drawCover: drawCover,
    layoutRects: layoutRects
  };
})(typeof window !== 'undefined' ? window : globalThis);
