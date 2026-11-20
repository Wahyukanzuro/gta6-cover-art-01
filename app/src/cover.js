// Vice State Cover Studio — cover rendering engine.
// Pure Canvas 2D, zero network, deterministic output (seeded grain and
// barcode) so every export of the same state is byte-identical.

var SAMPLES = [
  { src: 'samples/woman-convertible.jpg', label: 'Boulevard queen' },
  { src: 'samples/man-portrait.jpg', label: 'Neon portrait' },
  { src: 'samples/friends-neon.jpg', label: 'Neon nights out' },
  { src: 'samples/fisherman-pier.jpg', label: 'Pier life' },
  { src: 'samples/gas-station.jpg', label: 'Gas station' },
  { src: 'samples/marina.jpg', label: 'Marina' },
  { src: 'samples/coastal-road.jpg', label: 'Coastal road' },
  { src: 'samples/night-street.jpg', label: 'Night street' },
  { src: 'samples/lifeguard.jpg', label: 'Lifeguard' },
  { src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { src: 'samples/convertible.jpg', label: 'Convertible' },
  { src: 'samples/pier.jpg', label: 'Pier' },
];

// Five grades. Each one is deliberately heavier than a plain photo filter:
// a canvas filter pass plus a tinted overlay pass, so the cover reads as
// printed poster art instead of a phone snapshot.
var GRADES = {
  sunset: {
    name: 'Vice Sunset',
    filter: 'saturate(1.45) contrast(1.16) sepia(0.22) hue-rotate(-10deg) brightness(1.04)',
    overlay: 'rgba(255, 110, 30, 0.20)',
    mode: 'soft-light',
    wash: 'rgba(255, 170, 60, 0.10)',
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.7) contrast(1.24) brightness(0.94) hue-rotate(18deg)',
    overlay: 'rgba(190, 30, 220, 0.22)',
    mode: 'overlay',
    wash: 'rgba(40, 10, 90, 0.14)',
  },
  golden: {
    name: 'Golden Hour',
    filter: 'saturate(1.35) contrast(1.1) sepia(0.38) brightness(1.07)',
    overlay: 'rgba(255, 200, 90, 0.18)',
    mode: 'soft-light',
    wash: 'rgba(255, 230, 150, 0.08)',
  },
  noir: {
    name: 'Palm Noir',
    filter: 'saturate(0.32) contrast(1.38) brightness(0.9)',
    overlay: 'rgba(30, 60, 140, 0.20)',
    mode: 'overlay',
    wash: 'rgba(10, 10, 40, 0.16)',
  },
  bubble: {
    name: 'Bubblegum',
    filter: 'saturate(1.55) contrast(1.06) hue-rotate(-28deg) brightness(1.09)',
    overlay: 'rgba(255, 60, 170, 0.16)',
    mode: 'soft-light',
    wash: 'rgba(255, 120, 200, 0.10)',
  },
};

var LAYOUTS = {
  collage: { name: 'Collage', blurb: 'Hero + five panels' },
  grid: { name: 'Grid', blurb: 'Six even panels' },
  tilted: { name: 'Tilted', blurb: 'Snapshot stack' },
};

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var imageCache = {};
function loadImage(src) {
  if (imageCache[src]) return imageCache[src];
  var p = new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('cannot load ' + src)); };
    img.src = src;
  });
  imageCache[src] = p;
  return p;
}

var noiseCanvas = null;
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  var c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  var g = c.getContext('2d');
  var data = g.createImageData(256, 256);
  var rnd = mulberry32(20261121);
  for (var i = 0; i < data.data.length; i += 4) {
    var v = Math.floor(rnd() * 255);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  noiseCanvas = c;
  return c;
}

// Draw an image cover-fitting a rect, with zoom and pan offsets.
// ox/oy are fractions of the spare overflow (0 = start, 0.5 = centre).
function drawCoverFit(ctx, img, rect, zoom, ox, oy) {
  var z = zoom || 1;
  var scale = Math.max(rect.w / img.width, rect.h / img.height) * z;
  var dw = img.width * scale;
  var dh = img.height * scale;
  var spareX = dw - rect.w;
  var spareY = dh - rect.h;
  var dx = rect.x - spareX * (ox == null ? 0.5 : ox);
  var dy = rect.y - spareY * (oy == null ? 0.5 : oy);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function vignette(ctx, rect, strength) {
  var g = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,2,24,' + strength + ')');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// Panel rects for one layout at one output size. Fractions of W/H, so the
// same composition holds at 1080x1080, 1080x1350 and 1920x1080.
function layoutRects(layout, W, H) {
  var g = Math.round(Math.min(W, H) * 0.009);
  var stripH = Math.round(H * 0.095);
  var bodyH = H - stripH;
  var rects = [];
  if (layout === 'grid') {
    var cw = (W - g * 2) / 3;
    var ch = (bodyH - g) / 2;
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 3; c++) {
        rects.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch, rot: 0 });
      }
    }
    return { rects: rects, stripH: stripH, bodyH: bodyH };
  }
  if (layout === 'tilted') {
    // Five snapshots on a sunset field, each tilted and white-bordered.
    var pw = W * 0.42, ph = bodyH * 0.44;
    rects = [
      { x: W * 0.03, y: bodyH * 0.04, w: pw, h: ph, rot: -4 },
      { x: W * 0.52, y: bodyH * 0.02, w: pw, h: ph, rot: 3 },
      { x: W * 0.10, y: bodyH * 0.50, w: W * 0.34, h: bodyH * 0.42, rot: 2 },
      { x: W * 0.47, y: bodyH * 0.47, w: W * 0.34, h: bodyH * 0.42, rot: -3 },
      { x: W * 0.30, y: bodyH * 0.30, w: W * 0.36, h: bodyH * 0.38, rot: 5 },
    ];
    return { rects: rects, stripH: stripH, bodyH: bodyH };
  }
  // Collage: big hero left, two stacked right, three across the bottom.
  var heroW = W < H ? W * 0.60 : W * 0.58;
  var heroH = bodyH * 0.70;
  var rightW = W - heroW - g;
  var rightH = (heroH - g) / 2;
  var botY = heroH + g;
  var botH = bodyH - heroH - g;
  var botW = (W - g * 2) / 3;
  rects = [
    { x: 0, y: 0, w: heroW, h: heroH, rot: 0 },
    { x: heroW + g, y: 0, w: rightW, h: rightH, rot: 0 },
    { x: heroW + g, y: rightH + g, w: rightW, h: rightH, rot: 0 },
    { x: 0, y: botY, w: botW, h: botH, rot: 0 },
    { x: botW + g, y: botY, w: botW, h: botH, rot: 0 },
    { x: (botW + g) * 2, y: botY, w: botW, h: botH, rot: 0 },
  ];
  return { rects: rects, stripH: stripH, bodyH: bodyH };
}

function drawPanel(ctx, img, rect, grade, panel) {
  ctx.save();
  var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  if (rect.rot) {
    ctx.translate(cx, cy);
    ctx.rotate((rect.rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  if (rect.rot) {
    // White snapshot border + drop shadow for the tilted layout.
    var bw = Math.round(Math.min(rect.w, rect.h) * 0.045) + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(rect.x + 8, rect.y + 10, rect.w + bw * 2, rect.h + bw * 2);
    ctx.fillStyle = '#f8f2e4';
    ctx.fillRect(rect.x - bw, rect.y - bw, rect.w + bw * 2, rect.h + bw * 2);
  }
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = grade.filter;
  drawCoverFit(ctx, img, rect, panel.zoom, panel.ox, panel.oy);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = grade.mode;
  ctx.fillStyle = grade.overlay;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  vignette(ctx, rect, 0.28);
  ctx.restore();
  ctx.save();
  if (rect.rot) {
    ctx.translate(cx, cy);
    ctx.rotate((rect.rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  ctx.restore();
}

function drawHalftone(ctx, W, H, alpha) {
  var step = Math.max(14, Math.round(W / 72));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#2a0a4a';
  for (var y = step / 2; y < H; y += step) {
    for (var x = step / 2; x < W; x += step) {
      var r = 1 + ((x + y) % (step * 2)) / (step * 2) * 1.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// The title is the cover. Three passes make it read as printed poster
// type: hard offset shadows in deep purple, a multi-stop sunset gradient
// fill, and a thick dark outline — slightly tilted, overlapping the photos
// instead of sitting in an empty band of its own.
function drawTitle(ctx, state, W, H) {
  var words = (state.title || 'VICE STATE').toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) words = ['VICE', 'STATE'];
  // 0.12W keeps the letters clear of the hero's eyes: the hero photo's
  // face sits centre-frame, and a wider title would cover it.
  var size = Math.round(W * 0.12);
  var lineH = size * 0.94;
  var totalH = lineH * words.length;
  var top = Math.round(H * 0.045);
  var left = Math.round(W * 0.035);
  ctx.save();
  ctx.translate(left + W * 0.42, top + totalH / 2);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.translate(-(left + W * 0.42), -(top + totalH / 2));
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  var grad = ctx.createLinearGradient(left, top, left + W * 0.5, top + totalH);
  grad.addColorStop(0, '#fff7d6');
  grad.addColorStop(0.35, '#ffd23f');
  grad.addColorStop(0.65, '#ff7a18');
  grad.addColorStop(1, '#ff2e88');
  for (var i = 0; i < words.length; i++) {
    var y = top + size + i * lineH;
    ctx.font = size + 'px Anton, "Arial Black", sans-serif';
    // Hard shadows, two depths.
    ctx.fillStyle = '#150829';
    ctx.fillText(words[i], left + 11, y + 13);
    ctx.fillStyle = '#7b2fbe';
    ctx.fillText(words[i], left + 6, y + 7);
    // Gradient fill.
    ctx.fillStyle = grad;
    ctx.fillText(words[i], left, y);
    // Thick dark outline for print depth.
    ctx.lineWidth = Math.max(4, Math.round(size * 0.045));
    ctx.strokeStyle = '#12081f';
    ctx.lineJoin = 'round';
    ctx.strokeText(words[i], left, y);
  }
  // Script subtitle, tucked under the title's last line, offset right.
  if (state.script) {
    var sSize = Math.round(W * 0.052);
    ctx.font = sSize + 'px Pacifico, cursive';
    ctx.textAlign = 'left';
    var sx = left + Math.round(W * 0.30);
    var sy = top + totalH + Math.round(sSize * 0.9);
    ctx.lineWidth = Math.max(3, Math.round(sSize * 0.14));
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(state.script, sx, sy);
    ctx.fillStyle = '#ff5da2';
    ctx.fillText(state.script, sx, sy);
  }
  ctx.restore();
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // Trunk.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -34, 14, -62);
  ctx.stroke();
  // Fronds.
  var fronds = [
    [[14, -62], [-34, -84], [-58, -72]],
    [[14, -62], [-6, -96], [-30, -102]],
    [[14, -62], [18, -100], [6, -112]],
    [[14, -62], [48, -92], [66, -78]],
    [[14, -62], [52, -66], [72, -64]],
    [[14, -62], [-44, -58], [-66, -48]],
  ];
  for (var i = 0; i < fronds.length; i++) {
    var f = fronds[i];
    ctx.beginPath();
    ctx.moveTo(f[0][0], f[0][1]);
    ctx.quadraticCurveTo(f[1][0], f[1][1], f[2][0], f[2][1]);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  var rnd = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = '#111111';
  var bx = x;
  while (bx < x + w - 2) {
    var bw = 1 + Math.floor(rnd() * 4);
    if (rnd() > 0.45) ctx.fillRect(bx, y, bw, h);
    bx += bw + 1 + Math.floor(rnd() * 3);
  }
  ctx.restore();
}

// Bottom strip: palm silhouettes on a dark band, tagline centre, gold seal
// left, barcode right, WANTED stars above the tagline. Thin and full of
// content — never an empty band.
function drawStrip(ctx, state, W, H, stripH) {
  var y0 = H - stripH;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 4, 26, 0.94)';
  ctx.fillRect(0, y0, W, stripH);
  ctx.fillStyle = 'rgba(123, 47, 190, 0.35)';
  ctx.fillRect(0, y0, W, 3);
  // Palm silhouettes, low contrast, framing the strip.
  drawPalm(ctx, W * 0.055, y0 + stripH * 0.92, stripH / 95, 'rgba(255, 122, 24, 0.5)');
  drawPalm(ctx, W * 0.115, y0 + stripH * 0.98, stripH / 130, 'rgba(255, 46, 136, 0.45)');
  drawPalm(ctx, W * 0.945, y0 + stripH * 0.92, stripH / 105, 'rgba(255, 210, 63, 0.4)');
  // Gold EST. 2026 seal.
  if (state.seal) {
    var cx = W * 0.185, cy = y0 + stripH / 2, r = stripH * 0.36;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#c9962e'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3a2503';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(r * 0.42) + 'px "PT Sans", sans-serif';
    ctx.fillText('EST.', cx, cy - r * 0.22);
    ctx.fillText('2026', cx, cy + r * 0.26);
  }
  // Tagline + WANTED stars, centre.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var tag = (state.tagline || 'SUNSHINE · SIN · SPEED').toUpperCase();
  ctx.font = 'bold ' + Math.round(stripH * 0.26) + 'px "PT Sans", sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(tag.split('').join(' '), W * 0.52, y0 + stripH * 0.62);
  ctx.font = 'bold ' + Math.round(stripH * 0.20) + 'px "PT Sans", sans-serif';
  ctx.fillStyle = '#ff5da2';
  ctx.fillText('WANTED  ★★★★★', W * 0.52, y0 + stripH * 0.24);
  // Barcode, right.
  drawBarcode(ctx, W * 0.845, y0 + stripH * 0.22, W * 0.085, stripH * 0.56, 90210);
  ctx.restore();
}

function drawRibbon(ctx, W, H) {
  // Diagonal corner ribbon. Short and tucked into the corner: a long band
  // would slash across the whole top-right panel and cover its subject.
  var len = W * 0.22;
  ctx.save();
  ctx.translate(W * 0.93, H * 0.06);
  ctx.rotate((45 * Math.PI) / 180);
  ctx.fillStyle = '#d90429';
  ctx.fillRect(-len / 2, -Math.round(H * 0.02), len, Math.round(H * 0.02) * 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + Math.round(W * 0.0125) + 'px "PT Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("COLLECTOR'S EDITION", 0, 0);
  ctx.restore();
}

function drawVolBadge(ctx, W, H) {
  // Masthead position, top-left above the title — opposite corner from the
  // ribbon, so the two can never collide.
  ctx.save();
  ctx.font = 'bold ' + Math.round(W * 0.02) + 'px "PT Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(12,4,26,0.85)';
  var label = 'VOL. 06';
  var tw = ctx.measureText(label).width;
  var x = Math.round(W * 0.035);
  var y = Math.round(H * 0.008);
  ctx.fillRect(x - 8, y, tw + 16, Math.round(W * 0.026) + 6);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(label, x, y + 3);
  ctx.restore();
}

// Main entry: render the whole cover onto a canvas of the given size.
async function drawCover(canvas, state) {
  var W = canvas.width, H = canvas.height;
  var ctx = canvas.getContext('2d');
  var grade = GRADES[state.grade] || GRADES.sunset;
  var geo = layoutRects(state.layout || 'collage', W, H);
  ctx.save();
  ctx.fillStyle = '#150829';
  ctx.fillRect(0, 0, W, H);
  if (state.layout === 'tilted') {
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#ff7a18');
    bg.addColorStop(0.5, '#ff2e88');
    bg.addColorStop(1, '#2a0a4a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, geo.bodyH);
  }
  var imgs = [];
  for (var i = 0; i < geo.rects.length; i++) {
    var panel = state.panels[i] || {};
    var src = panel.src || SAMPLES[i % SAMPLES.length].src;
    imgs.push(await loadImage(src));
  }
  for (var j = 0; j < geo.rects.length; j++) {
    drawPanel(ctx, imgs[j], geo.rects[j], grade, state.panels[j] || {});
  }
  if (state.halftone) drawHalftone(ctx, W, geo.bodyH, 0.10);
  if (state.grain) {
    var tile = grainTile();
    var pat = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  drawTitle(ctx, state, W, H);
  drawVolBadge(ctx, W, H);
  if (state.ribbon) drawRibbon(ctx, W, H);
  drawStrip(ctx, state, W, H, geo.stripH);
  ctx.restore();
  return canvas;
}

function exportCover(state, w, h) {
  var canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return drawCover(canvas, state).then(function () { return canvas; });
}

function canvasToBlob(canvas) {
  return new Promise(function (resolve) {
    canvas.toBlob(function (b) { resolve(b); }, 'image/png');
  });
}
