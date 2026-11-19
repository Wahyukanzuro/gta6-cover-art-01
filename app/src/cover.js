// cover.js — Vice State Cover Studio: the cover renderer.
// Draws a GTA-style multi-panel poster (hero + smaller panels, giant
// gradient title, neon script subtitle, GTA microcopy kit) onto any canvas
// at any of the three post sizes. All lettering is original work set in
// OFL fonts shipped under app/fonts (Anton, Pacifico, PT Sans). No
// Rockstar logo, artwork or font is used anywhere in this app.
//
// Everything here is resolution-independent: every size is derived from
// the canvas width W and height H, so the live preview and the exported
// PNG are the same drawing at different scales.

'use strict';

/** The five colour grades. Each grades every panel photo the same way so
 *  the collage reads as one shoot: a saturate/contrast filter, a tinted
 *  gradient overlay, and a vignette. */
const GRADES = {
  sunset: {
    label: 'Vice Sunset', sat: 1.28, con: 1.06,
    overlay: [[0, 'rgba(255,122,47,0.20)'], [0.55, 'rgba(255,46,136,0.10)'], [1, 'rgba(120,20,140,0.22)']],
    mode: 'overlay', vignette: 0.22,
  },
  neon: {
    label: 'Neon Nights', sat: 1.38, con: 1.08,
    overlay: [[0, 'rgba(255,0,170,0.16)'], [0.5, 'rgba(120,40,255,0.08)'], [1, 'rgba(0,214,255,0.18)']],
    mode: 'overlay', vignette: 0.26,
  },
  gold: {
    label: 'Golden Hour', sat: 1.16, con: 1.04,
    overlay: [[0, 'rgba(255,186,66,0.22)'], [1, 'rgba(255,120,40,0.10)']],
    mode: 'soft-light', vignette: 0.18,
  },
  noir: {
    label: 'Palm Noir', sat: 0.82, con: 1.2,
    overlay: [[0, 'rgba(30,0,70,0.30)'], [1, 'rgba(10,0,30,0.34)']],
    mode: 'multiply', vignette: 0.38,
  },
  bubble: {
    label: 'Bubblegum', sat: 1.48, con: 1.02,
    overlay: [[0, 'rgba(255,110,200,0.18)'], [1, 'rgba(140,60,255,0.18)']],
    mode: 'soft-light', vignette: 0.16,
  },
};

/** Panel geometry for both layouts. Returns six rects {x, y, w, h} in
 *  pixels, in the order the panels are numbered. `gap` is the white
 *  gutter between panels. The title band, tagline and footer are drawn
 *  by drawTitleBand below the panel zone. */
function panelRects(layout, W, H) {
  const m = Math.round(W * 0.022); // outer margin
  const gap = Math.max(4, Math.round(W * 0.006));
  const zoneTop = Math.round(H * 0.028);
  const zoneBottom = Math.round(H * (layout === 'grid' ? 0.66 : 0.64));
  const zoneH = zoneBottom - zoneTop;
  const rects = [];
  if (layout === 'grid') {
    const cols = H > W ? 2 : 3; // portrait: 2x3, landscape/square: 3x2
    const rows = cols === 2 ? 3 : 2;
    const cw = (W - m * 2 - gap * (cols - 1)) / cols;
    const ch = (zoneH - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        rects.push({ x: m + c * (cw + gap), y: zoneTop + r * (ch + gap), w: cw, h: ch });
      }
    }
    return rects;
  }
  // Collage: one big hero + five smaller panels.
  if (W >= H) {
    // Landscape / square: hero left, right side 2x2 + one wide strip.
    const heroW = (W - m * 2 - gap) * 0.56;
    const rightX = m + heroW + gap;
    const rightW = W - m - rightX;
    const smallH = (zoneH - gap * 2) * 0.36;
    const wideH = zoneH - smallH * 2 - gap * 2;
    const smallW = (rightW - gap) / 2;
    rects.push({ x: m, y: zoneTop, w: heroW, h: zoneH });
    rects.push({ x: rightX, y: zoneTop, w: smallW, h: smallH });
    rects.push({ x: rightX + smallW + gap, y: zoneTop, w: smallW, h: smallH });
    rects.push({ x: rightX, y: zoneTop + smallH + gap, w: smallW, h: smallH });
    rects.push({ x: rightX + smallW + gap, y: zoneTop + smallH + gap, w: smallW, h: smallH });
    rects.push({ x: rightX, y: zoneTop + smallH * 2 + gap * 2, w: rightW, h: wideH });
    return rects;
  }
  // Portrait: hero full-width on top, 2x2 grid, one wide strip.
  const heroH = zoneH * 0.44;
  const gridY = zoneTop + heroH + gap;
  const gridH = zoneH - heroH - gap - gap - zoneH * 0.16;
  const smallW = (W - m * 2 - gap) / 2;
  const smallH = (gridH - gap) / 2;
  const wideY = gridY + gridH + gap;
  const wideH = zoneTop + zoneH - wideY;
  rects.push({ x: m, y: zoneTop, w: W - m * 2, h: heroH });
  rects.push({ x: m, y: gridY, w: smallW, h: smallH });
  rects.push({ x: m + smallW + gap, y: gridY, w: smallW, h: smallH });
  rects.push({ x: m, y: gridY + smallH + gap, w: smallW, h: smallH });
  rects.push({ x: m + smallW + gap, y: gridY + smallH + gap, w: smallW, h: smallH });
  rects.push({ x: m, y: wideY, w: W - m * 2, h: wideH });
  return rects;
}

/** The vertical bands below the panel zone, in pixels. */
function bandGeometry(W, H) {
  return {
    titleTop: Math.round(H * 0.665),
    titleBottom: Math.round(H * 0.865),
    tagTop: Math.round(H * 0.878),
    tagBottom: Math.round(H * 0.925),
    footTop: Math.round(H * 0.94),
    footBottom: Math.round(H * 0.985),
  };
}

/** Shrink a font size until `text` fits `maxWidth`, then return it. */
function fitFont(ctx, text, family, weight, startSize, maxWidth) {
  const fontOf = (size) => (weight ? `${weight} ${size}px ${family}` : `${size}px ${family}`);
  let size = startSize;
  ctx.font = fontOf(size);
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size = Math.floor(size * 0.94);
    ctx.font = fontOf(size);
  }
  return size;
}

/** Draw one photo into its panel rect, cover-fit around the panel's
 *  focal point (ox, oy in 0..1) and zoom, then grade it, vignette it,
 *  frame it and stamp its location label chip. */
function drawPanelPhoto(ctx, img, rect, panel, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(w / iw, h / ih) * (panel.zoom || 1);
  const sw = w / base;
  const sh = h / base;
  let sx = (panel.ox ?? 0.5) * iw - sw / 2;
  let sy = (panel.oy ?? 0.5) * ih - sh / 2;
  sx = Math.max(0, Math.min(iw - sw, sx));
  sy = Math.max(0, Math.min(ih - sh, sy));
  ctx.filter = `saturate(${grade.sat}) contrast(${grade.con})`;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.filter = 'none';
  // Grade tint.
  const tint = ctx.createLinearGradient(x, y, x, y + h);
  for (const [stop, color] of grade.overlay) tint.addColorStop(stop, color);
  ctx.globalCompositeOperation = grade.mode;
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // Vignette.
  const vg = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.35,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(10,0,20,${grade.vignette})`);
  ctx.fillStyle = vg;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // White poster frame around the panel.
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, Math.round(W0(ctx) * 0.0022));
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // Location label chip, bottom-left of the panel.
  if (panel.label) {
    const pad = Math.max(6, w * 0.02);
    const fs1 = Math.max(10, Math.round(w * 0.042));
    const fs2 = Math.max(9, Math.round(w * 0.033));
    ctx.font = `700 ${fs1}px "PT Sans", sans-serif`;
    const line1 = `${panel.label}  ·  ${panel.time || ''}`.trim();
    ctx.font = `400 ${fs2}px "PT Sans", sans-serif`;
    const line2 = panel.flavor || '';
    ctx.font = `700 ${fs1}px "PT Sans", sans-serif`;
    const w1 = ctx.measureText(line1).width;
    ctx.font = `400 ${fs2}px "PT Sans", sans-serif`;
    const w2 = ctx.measureText(line2).width;
    const chipW = Math.max(w1, w2) + pad * 2;
    const chipH = pad * 1.4 + fs1 + (line2 ? fs2 * 1.25 : 0);
    const cx = x + Math.max(6, w * 0.02);
    const cy = y + h - chipH - Math.max(6, h * 0.04);
    ctx.fillStyle = 'rgba(12,4,20,0.82)';
    roundRect(ctx, cx, cy, chipW, chipH, Math.max(3, pad * 0.4));
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = `700 ${fs1}px "PT Sans", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(line1, cx + pad, cy + pad * 0.8 + fs1);
    if (line2) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `400 ${fs2}px "PT Sans", sans-serif`;
      ctx.fillText(line2, cx + pad, cy + pad * 0.8 + fs1 + fs2 * 1.25);
    }
  }
}

/** The canvas width, for stroke widths that scale with the cover. */
function W0(ctx) {
  return ctx.canvas.width;
}

/** A filled rounded rectangle path (no fill call inside, so callers can
 *  set their own fill style first). */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** The giant gradient block-letter title, neon script subtitle, and the
 *  whole GTA microcopy kit: VOL. 06, WANTED stars, COLLECTOR'S EDITION
 *  ribbon, EST. 2026 seal, tagline strip, footer print and barcode. */
function drawTitleBand(ctx, W, H, state) {
  const b = bandGeometry(W, H);
  const cx = W / 2;
  // Title: Anton, gradient fill, black outline, hard drop shadow.
  const title = (state.title || 'VICE STATE').toUpperCase();
  const titleMax = W * 0.94;
  let tSize = fitFont(ctx, title, 'Anton', '', Math.round(W * 0.17), titleMax);
  // Fit the height too: the title must sit inside its band.
  const bandH = b.titleBottom - b.titleTop;
  tSize = Math.min(tSize, Math.round(bandH * 0.92));
  ctx.font = `${tSize}px Anton, sans-serif`;
  const titleY = b.titleTop + (bandH + tSize * 0.72) / 2;
  const grad = ctx.createLinearGradient(W * 0.03, 0, W * 0.97, 0);
  grad.addColorStop(0, '#ffc233');
  grad.addColorStop(0.32, '#ff7a2f');
  grad.addColorStop(0.62, '#ff2e88');
  grad.addColorStop(1, '#ff5ea8');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  // Hard drop shadow: the same letters, solid black, offset down-right.
  ctx.fillStyle = '#12041a';
  ctx.fillText(title, cx + tSize * 0.045, titleY + tSize * 0.06);
  ctx.fillStyle = grad;
  ctx.fillText(title, cx, titleY);
  ctx.strokeStyle = '#160418';
  ctx.lineWidth = Math.max(3, tSize * 0.085);
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, cx, titleY);
  ctx.restore();
  // Neon script subtitle, overlapping the title's lower edge, tilted.
  const sub = state.subtitle || '';
  if (sub) {
    const sSize = Math.round(W * 0.042);
    ctx.save();
    ctx.translate(cx + W * 0.16, b.titleTop + bandH * 0.86);
    ctx.rotate(-0.045);
    ctx.font = `${sSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2ec4';
    ctx.shadowBlur = sSize * 0.55;
    ctx.fillStyle = '#ff8ae2';
    ctx.fillText(sub, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd7f2';
    ctx.fillText(sub, 0, 0);
    ctx.restore();
  }
  // COLLECTOR'S EDITION ribbon, top-left of the title band.
  const ribH = Math.max(18, Math.round(H * 0.026));
  const ribText = "COLLECTOR'S EDITION";
  ctx.save();
  ctx.translate(W * 0.028, b.titleTop - ribH * 0.28);
  ctx.rotate(-0.06);
  ctx.font = `700 ${Math.round(ribH * 0.52)}px "PT Sans", sans-serif`;
  const ribW = ctx.measureText(ribText).width + ribH * 1.1;
  ctx.fillStyle = '#f5c542';
  ctx.fillRect(0, 0, ribW, ribH);
  ctx.fillStyle = '#1a0a12';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ribText, ribH * 0.55, ribH * 0.54);
  ctx.restore();
  // VOL. 06, top-left corner of the cover.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const volSize = Math.max(13, Math.round(W * 0.016));
  ctx.font = `700 ${volSize}px "PT Sans", sans-serif`;
  ctx.fillStyle = 'rgba(12,4,20,0.8)';
  const volText = 'VOL. 06';
  const volW = ctx.measureText(volText).width + volSize;
  ctx.fillRect(W * 0.022, H * 0.028 - volSize * 0.35, volW, volSize * 1.7);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(volText, W * 0.022 + volSize * 0.5, H * 0.028 + volSize * 0.95);
  // WANTED + five stars, top-right corner.
  const wantSize = Math.max(13, Math.round(W * 0.017));
  ctx.font = `700 ${wantSize}px "PT Sans", sans-serif`;
  const wantText = 'WANTED ★★★★★';
  const wantW = ctx.measureText(wantText).width + wantSize;
  ctx.fillStyle = 'rgba(12,4,20,0.8)';
  ctx.fillRect(W - W * 0.022 - wantW, H * 0.028 - wantSize * 0.35, wantW, wantSize * 1.7);
  ctx.fillStyle = '#ffd23e';
  ctx.textAlign = 'right';
  ctx.fillText(wantText, W - W * 0.022 - wantSize * 0.5, H * 0.028 + wantSize * 0.95);
  ctx.restore();
  // EST. 2026 gold seal, bottom-right, overlapping the title band.
  const sealR = Math.max(26, Math.round(W * 0.042));
  const sealX = W - W * 0.075;
  const sealY = b.titleBottom - sealR * 0.35;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
  ctx.fillStyle = '#f5c542';
  ctx.fill();
  ctx.lineWidth = Math.max(2, sealR * 0.06);
  ctx.strokeStyle = '#8a5a00';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR * 0.8, 0, Math.PI * 2);
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = Math.max(1, sealR * 0.03);
  ctx.stroke();
  ctx.fillStyle = '#3a2400';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(sealR * 0.32)}px "PT Sans", sans-serif`;
  ctx.fillText('EST.', sealX, sealY - sealR * 0.34);
  ctx.font = `700 ${Math.round(sealR * 0.48)}px "PT Sans", sans-serif`;
  ctx.fillText('2026', sealX, sealY + sealR * 0.08);
  ctx.font = `700 ${Math.round(sealR * 0.22)}px "PT Sans", sans-serif`;
  ctx.fillText('★ ORIGINAL ★', sealX, sealY + sealR * 0.48);
  ctx.restore();
  // Tagline strip: pink rules, letterspaced caps, centred.
  const tag = (state.tagline || '').toUpperCase();
  if (tag) {
    const tagSize = Math.max(12, Math.round(W * 0.02));
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(2, H * 0.002);
    ctx.beginPath();
    ctx.moveTo(W * 0.06, b.tagTop + (b.tagBottom - b.tagTop) * 0.18);
    ctx.lineTo(W * 0.94, b.tagTop + (b.tagBottom - b.tagTop) * 0.18);
    ctx.moveTo(W * 0.06, b.tagBottom - (b.tagBottom - b.tagTop) * 0.18);
    ctx.lineTo(W * 0.94, b.tagBottom - (b.tagBottom - b.tagTop) * 0.18);
    ctx.stroke();
    ctx.font = `700 ${tagSize}px "PT Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    const spaced = tag.split('').join(' ');
    ctx.fillText(spaced, cx, (b.tagTop + b.tagBottom) / 2);
    ctx.restore();
  }
  // Footer: tiny print left, barcode right.
  const footSize = Math.max(9, Math.round(W * 0.011));
  ctx.save();
  ctx.font = `400 ${footSize}px "PT Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(
    'VICE STATE STUDIO  ·  FAN-MADE COVER MAKER  ·  NOT AFFILIATED WITH ROCKSTAR GAMES  ·  ALL PHOTOS IMAGE-MODEL MADE',
    W * 0.022, (b.footTop + b.footBottom) / 2,
  );
  // Barcode.
  const barW = Math.round(W * 0.075);
  const barH = (b.footBottom - b.footTop) * 0.72;
  const barX = W - W * 0.022 - barW;
  const barY = (b.footTop + b.footBottom) / 2 - barH / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#111111';
  let bx = barX + 3;
  let seed = 202606;
  while (bx < barX + barW - 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const bw = 1 + (seed % 3) * Math.max(1, Math.round(W * 0.0012));
    if (seed % 3 !== 0) ctx.fillRect(bx, barY + 2, bw, barH - 8);
    bx += bw + Math.max(1, Math.round(W * 0.0012));
  }
  ctx.restore();
}

/** Render the whole cover into `canvas` at W x H. `state` holds layout,
 *  grade, title, subtitle, tagline and six panels; `images` maps a photo
 *  key to a loaded HTMLImageElement. Panels whose photo has not loaded
 *  yet draw as a sunset gradient placeholder so the preview never blanks. */
function renderCover(canvas, W, H, state, images, options) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // The editor draws a dashed gold outline around the selected panel;
  // the exported PNG never carries it (it is an editor affordance, not
  // part of the cover art).
  const showSelection = !options || options.showSelection !== false;
  // Backdrop: deep violet with a warm glow at the bottom.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1c0b2e');
  bg.addColorStop(0.55, '#150a1e');
  bg.addColorStop(1, '#2b0f22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const grade = GRADES[state.grade] || GRADES.sunset;
  const rects = panelRects(state.layout || 'collage', W, H);
  state.panels.forEach((panel, i) => {
    const rect = rects[i];
    if (!rect) return;
    // `images` is a Map (key -> loaded HTMLImageElement); bracket
    // access on a Map reads nothing, so look the photo up properly.
    const img = typeof images.get === 'function' ? images.get(panel.photo) : images[panel.photo];
    if (img && img.complete && (img.naturalWidth || img.width) > 0) {
      drawPanelPhoto(ctx, img, rect, panel, grade);
    } else {
      // Placeholder: warm gradient + the panel's label, until the photo loads.
      const ph = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      ph.addColorStop(0, '#ff7a2f');
      ph.addColorStop(1, '#ff2e88');
      ctx.fillStyle = ph;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    }
    if (i === state.selected && showSelection) {
      ctx.save();
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = Math.max(3, Math.round(W * 0.0035));
      ctx.setLineDash([Math.round(W * 0.012), Math.round(W * 0.006)]);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
      ctx.restore();
    }
  });
  drawTitleBand(ctx, W, H, state);
  // Thin neon frame around the whole cover.
  ctx.strokeStyle = 'rgba(255,94,168,0.55)';
  ctx.lineWidth = Math.max(2, Math.round(W * 0.0016));
  ctx.strokeRect(4, 4, W - 8, H - 8);
  return canvas;
}

// Exposed for the editor (classic scripts share the global scope).
window.ViceCover = { GRADES, panelRects, renderCover, fitFont };
