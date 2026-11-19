// main.js — Vice State Cover Studio: the editor.
// Wires the cover renderer (cover.js) to the page: photo uploads via
// FileReader (photos never leave the machine), click-to-select panels,
// drag to crop and position each photo, layouts, grades, sizes, editable
// caption, a one-click "Surprise me" cover, and PNG export in the three
// common post sizes. All lettering is original, set in OFL fonts shipped
// under app/fonts. No network request is made by this app, ever.

'use strict';

/** The built-in photo set: image-model-made Vice City scenes, each with
 *  the location label it carries on the cover and the focal point the
 *  smart auto-fill crops around, so the good part stays in frame. */
const SAMPLES = [
  { file: 'convertible.jpg', label: 'OCEAN DRIVE', time: '6:42 PM', flavor: 'LOOKING FOR TROUBLE', fx: 0.68, fy: 0.6 },
  { file: 'gas-station.jpg', label: 'NEON FUEL', time: '9:15 PM', flavor: 'FILL UP AND VANISH', fx: 0.5, fy: 0.42 },
  { file: 'coastal-road.jpg', label: 'COASTAL HWY', time: '5:58 PM', flavor: 'CHASING THE SUN', fx: 0.52, fy: 0.42 },
  { file: 'marina.jpg', label: 'MARINA DEL SOL', time: '7:48 PM', flavor: 'NO WITNESSES', fx: 0.45, fy: 0.58 },
  { file: 'lifeguard.jpg', label: 'SOUTH BEACH', time: '6:05 PM', flavor: 'OFF DUTY', fx: 0.58, fy: 0.42 },
  { file: 'night-street.jpg', label: 'OCEAN DRIVE', time: '11:20 PM', flavor: 'THE CITY NEVER SLEEPS', fx: 0.7, fy: 0.72 },
  { file: 'boulevard.jpg', label: 'PALM BOULEVARD', time: '6:30 PM', flavor: 'GOLDEN HOUR', fx: 0.5, fy: 0.5 },
  { file: 'pier.jpg', label: 'SUNSET PIER', time: '7:12 PM', flavor: 'LAST LIGHT', fx: 0.5, fy: 0.5 },
];

/** The three post sizes the app exports. */
const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

const TITLES = ['VICE STATE', 'NEON TIDE', 'PALM HEAT', 'SUNSET CITY', 'OCEAN DRIVE', 'GOLDEN COAST', 'NIGHT DRIVE', 'COASTAL HEAT'];
const SUBTITLES = ['Neon Tide', 'Golden Hour', 'No Rules', 'Coming Soon', 'One Coast', 'After Dark', 'Summer 2026', 'Palms & Neon'];
const TAGLINES = [
  'ONE COAST · NO RULES · COMING SOON',
  'SIX PANELS · ONE SUNSET · ZERO MERCY',
  'DRIVE FAST · SHINE BRIGHT · STAY GOLDEN',
  'EVERY SUNSET IS A GETAWAY',
  'WELCOME TO THE STATE OF NEON',
];

/** The editor state. A panel's photo is a key into `images`: a sample
 *  path like "samples/convertible.jpg" or an upload key "upload:3". */
const state = {
  layout: 'collage',
  grade: 'sunset',
  size: '1920x1080',
  title: 'VICE STATE',
  subtitle: 'Neon Tide',
  tagline: 'ONE COAST · NO RULES · COMING SOON',
  selected: 0,
  panels: [],
};

const images = new Map(); // photo key -> loaded HTMLImageElement
const uploads = []; // {key, name, dataUrl, label, time, flavor}

function samplePanel(sample, i) {
  return {
    photo: `samples/${sample.file}`,
    ox: sample.fx, oy: sample.fy, zoom: 1,
    label: sample.label, time: sample.time, flavor: sample.flavor,
    name: `Panel ${i + 1}`,
  };
}

/** The default cover: the hero convertible plus five more scenes. */
function defaultPanels() {
  const order = [0, 1, 2, 3, 4, 5]; // convertible hero, then the rest
  return order.map((si, i) => samplePanel(SAMPLES[si], i));
}
state.panels = defaultPanels();
state.panels[0].name = 'Panel 1 · Hero';

/** Load an image by key (sample path or data URL). Resolves when the
 *  image is ready to draw; stores it in `images` for the renderer. */
function loadPhoto(key, src) {
  if (images.has(key)) return Promise.resolve(images.get(key));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(key, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadAllPhotos() {
  const jobs = [];
  for (const panel of state.panels) jobs.push(loadPhoto(panel.photo, panel.photo));
  for (const s of SAMPLES) jobs.push(loadPhoto(`samples/${s.file}`, `samples/${s.file}`));
  return Promise.all(jobs);
}

/** The preview canvas: renders the cover at a screen-friendly scale
 *  (long side at most 920 px) with the same drawing as the export. */
const preview = document.getElementById('preview');
function previewSize() {
  const s = SIZES[state.size];
  const scale = Math.min(1, 920 / Math.max(s.w, s.h));
  return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
}

function renderPreview() {
  const { w, h } = previewSize();
  window.ViceCover.renderCover(preview, w, h, state, images);
  updatePanelForm();
}

/** The selected panel's form fields follow the selection. */
function updatePanelForm() {
  const p = state.panels[state.selected];
  if (!p) return;
  document.getElementById('panelName').textContent = p.name || `Panel ${state.selected + 1}`;
  document.getElementById('labelInput').value = p.label || '';
  document.getElementById('timeInput').value = p.time || '';
  document.getElementById('flavorInput').value = p.flavor || '';
  document.getElementById('zoomRange').value = String(p.zoom || 1);
  document.querySelectorAll('.photo-thumb').forEach((el) => {
    el.classList.toggle('active', el.dataset.key === p.photo);
  });
}

/** The photo strip: built-in samples first, then the user's uploads.
 *  Clicking a thumbnail assigns that photo to the selected panel. */
function buildPhotoStrip() {
  const strip = document.getElementById('photoStrip');
  strip.innerHTML = '';
  for (const s of SAMPLES) {
    strip.appendChild(photoThumb(`samples/${s.file}`, `samples/${s.file}`, s.label));
  }
  for (const u of uploads) {
    strip.appendChild(photoThumb(u.key, u.dataUrl, u.name));
  }
}

function photoThumb(key, src, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'photo-thumb';
  b.dataset.key = key;
  b.title = title;
  const img = document.createElement('img');
  img.src = src;
  img.alt = title;
  b.appendChild(img);
  b.addEventListener('click', () => {
    assignPhotoToSelected(key);
  });
  return b;
}

/** Assign a photo to the selected panel, cropping around its focal
 *  point (a sample's preset, or the centre for an upload). */
function assignPhotoToSelected(key) {
  const p = state.panels[state.selected];
  const sample = SAMPLES.find((s) => `samples/${s.file}` === key);
  p.photo = key;
  if (sample) {
    p.ox = sample.fx; p.oy = sample.fy;
    p.label = sample.label; p.time = sample.time; p.flavor = sample.flavor;
  } else {
    p.ox = 0.5; p.oy = 0.5;
    const u = uploads.find((x) => x.key === key);
    if (u) { p.label = u.label; p.time = u.time; p.flavor = u.flavor; }
  }
  p.zoom = 1;
  loadPhoto(key, key.startsWith('upload:') ? (uploads.find((x) => x.key === key) || {}).dataUrl : key)
    .then(renderPreview);
  renderPreview();
}

/** Uploads: FileReader, photos stay on this machine, never uploaded. */
function wireUpload() {
  const input = document.getElementById('uploadInput');
  document.getElementById('uploadBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    let done = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const key = `upload:${uploads.length}`;
        uploads.push({
          key, name: file.name, dataUrl: reader.result,
          label: 'YOUR SHOT', time: 'RIGHT NOW', flavor: 'SHOT ON LOCATION',
        });
        loadPhoto(key, reader.result).then(() => {
          done++;
          if (done === files.length) {
            buildPhotoStrip();
            assignPhotoToSelected(key);
            setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded — kept on this machine, never uploaded.`);
          }
        });
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  });
}

/** Drag on the preview: click selects a panel, dragging pans its photo
 *  (the photo follows the pointer). Coordinates are cover pixels. */
function wirePreviewDrag() {
  let drag = null;
  const toCover = (e) => {
    const r = preview.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * preview.width,
      y: ((e.clientY - r.top) / r.height) * preview.height,
    };
  };
  const panelAt = (x, y) => {
    const rects = window.ViceCover.panelRects(state.layout, preview.width, preview.height);
    return rects.findIndex((rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h);
  };
  preview.addEventListener('pointerdown', (e) => {
    const { x, y } = toCover(e);
    const i = panelAt(x, y);
    if (i < 0) return;
    state.selected = i;
    const p = state.panels[i];
    drag = { x, y, ox: p.ox, oy: p.oy, img: images.get(p.photo) };
    preview.setPointerCapture(e.pointerId);
    renderPreview();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { x, y } = toCover(e);
    const p = state.panels[state.selected];
    const img = drag.img;
    if (!img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const rect = window.ViceCover.panelRects(state.layout, preview.width, preview.height)[state.selected];
    const base = Math.max(rect.w / iw, rect.h / ih) * (p.zoom || 1);
    p.ox = clamp(drag.ox - (x - drag.x) / (iw * base), 0, 1);
    p.oy = clamp(drag.oy - (y - drag.y) / (ih * base), 0, 1);
    renderPreview();
  });
  const end = () => { drag = null; };
  preview.addEventListener('pointerup', end);
  preview.addEventListener('pointercancel', end);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** "Surprise me": a fresh cover in one click — random layout, grade,
 *  words and a shuffled photo set, each panel cropped on its focal point. */
function surpriseMe() {
  state.layout = Math.random() < 0.7 ? 'collage' : 'grid';
  const grades = Object.keys(window.ViceCover.GRADES);
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  state.title = TITLES[Math.floor(Math.random() * TITLES.length)];
  state.subtitle = SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)];
  state.tagline = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  const shuffled = [...SAMPLES].sort(() => Math.random() - 0.5).slice(0, 6);
  state.panels = shuffled.map((s, i) => {
    const p = samplePanel(s, i);
    p.ox = clamp(s.fx + (Math.random() - 0.5) * 0.16, 0.1, 0.9);
    p.oy = clamp(s.fy + (Math.random() - 0.5) * 0.16, 0.1, 0.9);
    p.zoom = 1 + Math.random() * 0.25;
    return p;
  });
  state.panels[0].name = 'Panel 1 · Hero';
  state.selected = 0;
  syncControlStates();
  loadAllPhotos().then(renderPreview);
  setStatus('Surprise cover ready — tweak it or export it.');
}

/** Keep the buttons and inputs showing the current state. */
function syncControlStates() {
  document.getElementById('titleInput').value = state.title;
  document.getElementById('subtitleInput').value = state.subtitle;
  document.getElementById('taglineInput').value = state.tagline;
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  updatePanelForm();
}

function setStatus(text) {
  document.getElementById('statusLine').textContent = text;
}

/** Export the cover at full resolution as a PNG download. */
function exportCover(sizeKey) {
  const s = SIZES[sizeKey || state.size];
  const off = document.createElement('canvas');
  window.ViceCover.renderCover(off, s.w, s.h, state, images, { showSelection: false });
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      if (!blob) { setStatus('Export failed — the canvas was empty.'); resolve(null); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vice-state-cover-${s.w}x${s.h}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus(`Exported ${s.w} × ${s.h} PNG — share it anywhere.`);
      resolve({ w: s.w, h: s.h, bytes: blob.size });
    }, 'image/png');
  });
}

function wireControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.addEventListener('click', () => { state.layout = b.dataset.layout; syncControlStates(); renderPreview(); });
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.addEventListener('click', () => { state.grade = b.dataset.grade; syncControlStates(); renderPreview(); });
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.addEventListener('click', () => { state.size = b.dataset.size; syncControlStates(); renderPreview(); });
  });
  document.getElementById('titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  document.getElementById('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  document.getElementById('taglineInput').addEventListener('input', (e) => { state.tagline = e.target.value; renderPreview(); });
  document.getElementById('labelInput').addEventListener('input', (e) => { state.panels[state.selected].label = e.target.value; renderPreview(); });
  document.getElementById('timeInput').addEventListener('input', (e) => { state.panels[state.selected].time = e.target.value; renderPreview(); });
  document.getElementById('flavorInput').addEventListener('input', (e) => { state.panels[state.selected].flavor = e.target.value; renderPreview(); });
  document.getElementById('zoomRange').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = parseFloat(e.target.value);
    renderPreview();
  });
  document.getElementById('surpriseBtn').addEventListener('click', surpriseMe);
  document.getElementById('exportBtn').addEventListener('click', () => exportCover());
}

/** A small handle for automated checks: the screenshot harness drives
 *  the app through this instead of guessing at the DOM. */
window.__vice = {
  state,
  SIZES,
  renderPreview,
  exportCover,
  surpriseMe,
  assignPhotoToSelected,
  setTitle(t) { state.title = t; syncControlStates(); renderPreview(); },
  setSize(k) { state.size = k; syncControlStates(); renderPreview(); },
  setLayout(k) { state.layout = k; syncControlStates(); renderPreview(); },
  setGrade(k) { state.grade = k; syncControlStates(); renderPreview(); },
};

/** Boot: load the OFL fonts and the default photos, then paint. */
function boot() {
  buildPhotoStrip();
  wireUpload();
  wirePreviewDrag();
  wireControls();
  syncControlStates();
  const fonts = Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.load('700 20px "PT Sans"'),
    document.fonts.load('400 20px "PT Sans"'),
  ]).catch(() => null);
  Promise.all([fonts, loadAllPhotos()]).then(() => {
    renderPreview();
    window.__coverReady = true;
    setStatus('Ready — pick a panel, drop in your photos, export a cover.');
  });
}

boot();
