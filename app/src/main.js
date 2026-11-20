// Vice State Cover Studio — editor logic (v4).
// Classic script, zero network: loads the local sample photos, wires the
// layout / grade / words / cast / photo controls, renders the live stage
// canvas through CoverArt.drawCover, and exports PNGs at three post sizes.
// Supports ?shot=cover|editor&size=square|portrait|wide for screenshots.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var sctx = stage.getContext('2d');
  var state = CoverArt.defaultState();
  var images = {};
  var selected = 0;
  var exportBusy = false;

  var EXPORT_SIZES = {
    square: { w: 1080, h: 1080, label: '1080 × 1080' },
    portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
    wide: { w: 1920, h: 1080, label: '1920 × 1080' }
  };
  var currentSize = 'portrait';

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function sampleUrl(name) { return 'samples/' + name; }

  function preload() {
    var jobs = CoverArt.SAMPLES.map(function (name) {
      return loadImage(sampleUrl(name)).then(function (img) { images[name] = img; });
    });
    return Promise.all(jobs).then(function () {
      // Uploads are data URLs; keep them in the same map under their key.
      state.panels.forEach(function (p) {
        if (p.src && p.src.indexOf('data:') === 0 && !images[p.src]) {
          var img = new Image();
          img.src = p.src;
          images[p.src] = img;
        }
      });
    });
  }

  function stageSize() {
    var box = stage.parentElement.getBoundingClientRect();
    var size = EXPORT_SIZES[currentSize];
    var scale = Math.min((box.width - 8) / size.w, 560 / size.h, 1);
    return { w: Math.max(320, Math.floor(size.w * scale)), h: Math.max(320, Math.floor(size.h * scale)) };
  }

  function render() {
    var s = stageSize();
    if (stage.width !== s.w || stage.height !== s.h) { stage.width = s.w; stage.height = s.h; }
    CoverArt.drawCover(sctx, s.w, s.h, state, images);
    var sel = document.querySelectorAll('.photo-row.selected');
    sel.forEach(function (el) { el.classList.remove('selected'); });
    var row = $('photo-row-' + selected);
    if (row) row.classList.add('selected');
  }

  // ---- photo panels -------------------------------------------------------
  function panelRects() {
    var s = stageSize();
    var area = { x: s.w * 0.012, y: s.h * 0.048, w: s.w * 0.976, h: s.h * 0.635 - s.h * 0.048 };
    return CoverArt.layoutRects(state.layout, area);
  }

  function pickPanel(clientX, clientY) {
    var rect = stage.getBoundingClientRect();
    var x = clientX - rect.left, y = clientY - rect.top;
    var rects = panelRects();
    for (var i = 0; i < 6; i++) {
      var r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  var drag = null;
  stage.addEventListener('pointerdown', function (ev) {
    var i = pickPanel(ev.clientX, ev.clientY);
    if (i < 0) return;
    selected = i;
    var p = state.panels[i];
    drag = { x: ev.clientX, y: ev.clientY, ox: p.ox, oy: p.oy, rect: panelRects()[i] };
    stage.setPointerCapture(ev.pointerId);
    render();
  });
  stage.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var p = state.panels[selected];
    var r = drag.rect;
    p.ox = Math.max(0, Math.min(1, drag.ox - (ev.clientX - drag.x) / Math.max(40, r.w)));
    p.oy = Math.max(0, Math.min(1, drag.oy - (ev.clientY - drag.y) / Math.max(40, r.h)));
    render();
  });
  stage.addEventListener('pointerup', function () { drag = null; });
  stage.addEventListener('pointercancel', function () { drag = null; });

  // ---- exports ------------------------------------------------------------
  function exportCover(sizeKey) {
    if (exportBusy) return;
    exportBusy = true;
    var size = EXPORT_SIZES[sizeKey];
    var off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    var octx = off.getContext('2d');
    CoverArt.drawCover(octx, size.w, size.h, state, images);
    off.toBlob(function (blob) {
      exportBusy = false;
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vice-state-cover-' + sizeKey + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    }, 'image/png');
  }

  // Deterministic surprise: rotate sample assignment, grade and tagline.
  var SURPRISE_TAGLINES = [
    'CHASE THE SUN · STEAL THE NIGHT',
    'ONE COAST · SIX STORIES · NO CURFEW',
    'GOLDEN HOUR · NO WAY BACK',
    'SIX STRANGERS · ONE LAST SUMMER'
  ];
  function surprise() {
    var pool = CoverArt.SAMPLES.slice();
    var offset = 1 + Math.floor(Math.random() * 5);
    state.panels.forEach(function (p, i) {
      p.src = pool[(i + offset) % pool.length];
      p.role = CoverArt.DEFAULT_ROLES[i];
      p.zoom = 1.05 + Math.random() * 0.25;
      p.ox = 0.35 + Math.random() * 0.3;
      p.oy = 0.3 + Math.random() * 0.3;
    });
    var grades = Object.keys(CoverArt.GRADES);
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.tagline = SURPRISE_TAGLINES[Math.floor(Math.random() * SURPRISE_TAGLINES.length)];
    syncControls();
    render();
  }

  // ---- controls -----------------------------------------------------------
  function buildLayoutButtons() {
    var wrap = $('layout-buttons');
    ['collage', 'grid', 'tilted'].forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (state.layout === name ? ' active' : '');
      b.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      b.addEventListener('click', function () { state.layout = name; syncControls(); render(); });
      wrap.appendChild(b);
    });
  }

  function buildGradeButtons() {
    var wrap = $('grade-buttons');
    var labels = {
      'vice-sunset': 'Vice Sunset', 'neon-nights': 'Neon Nights',
      'golden-hour': 'Golden Hour', 'palm-noir': 'Palm Noir', 'bubblegum': 'Bubblegum'
    };
    Object.keys(CoverArt.GRADES).forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'grade' + (state.grade === key ? ' active' : '');
      b.dataset.grade = key;
      var sw = document.createElement('span');
      sw.className = 'swatch ' + key;
      b.appendChild(sw);
      b.appendChild(document.createTextNode(labels[key]));
      b.addEventListener('click', function () { state.grade = key; syncControls(); render(); });
      wrap.appendChild(b);
    });
  }

  function bindWord(id, key) {
    var el = $(id);
    el.value = state[key];
    el.addEventListener('input', function () { state[key] = el.value; render(); });
  }

  function buildWords() {
    bindWord('word-title', 'title');
    bindWord('word-subtitle', 'subtitle');
    bindWord('word-tagline', 'tagline');
    bindWord('word-quote', 'quote');
    bindWord('word-outlet', 'outlet');
    bindWord('word-production', 'production');
    bindWord('word-production2', 'production2');
    bindWord('word-coming', 'comingSoon');
    var ht = $('toggle-halftone');
    var gr = $('toggle-grain');
    ht.checked = state.halftone;
    gr.checked = state.grain;
    ht.addEventListener('change', function () { state.halftone = ht.checked; render(); });
    gr.addEventListener('change', function () { state.grain = gr.checked; render(); });
  }

  function buildCast() {
    var wrap = $('cast-list');
    state.panels.forEach(function (p, i) {
      var row = document.createElement('label');
      row.className = 'cast-row';
      row.textContent = 'Panel ' + (i + 1);
      var input = document.createElement('input');
      input.type = 'text';
      input.value = p.role;
      input.maxLength = 18;
      input.addEventListener('input', function () { state.panels[i].role = input.value.toUpperCase(); render(); });
      row.appendChild(input);
      wrap.appendChild(row);
    });
  }

  function buildPhotos() {
    var wrap = $('photo-list');
    state.panels.forEach(function (p, i) {
      var row = document.createElement('div');
      row.className = 'photo-row';
      row.id = 'photo-row-' + i;
      var head = document.createElement('div');
      head.className = 'photo-head';
      head.textContent = 'Panel ' + (i + 1) + ' — ' + p.role;
      row.appendChild(head);

      var sel = document.createElement('select');
      CoverArt.SAMPLES.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.replace('.jpg', '');
        sel.appendChild(opt);
      });
      sel.value = CoverArt.SAMPLES.indexOf(p.src) >= 0 ? p.src : CoverArt.SAMPLES[i % CoverArt.SAMPLES.length];
      sel.addEventListener('change', function () {
        p.src = sel.value;
        p.zoom = 1.1; p.ox = 0.5; p.oy = 0.45;
        render();
      });
      row.appendChild(sel);

      var up = document.createElement('label');
      up.className = 'upload-btn';
      up.textContent = 'Upload photo';
      var file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.hidden = true;
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          var key = 'upload-' + i + '-' + Date.now();
          var img = new Image();
          img.onload = function () {
            images[key] = img;
            p.src = key;
            p.zoom = 1.1; p.ox = 0.5; p.oy = 0.45;
            render();
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(f);
      });
      up.appendChild(file);
      row.appendChild(up);

      var zoom = document.createElement('input');
      zoom.type = 'range';
      zoom.min = '1'; zoom.max = '2.2'; zoom.step = '0.05';
      zoom.value = String(p.zoom);
      zoom.setAttribute('aria-label', 'Zoom panel ' + (i + 1));
      zoom.addEventListener('input', function () { p.zoom = parseFloat(zoom.value); render(); });
      row.appendChild(zoom);

      row.addEventListener('click', function () { selected = i; render(); });
      wrap.appendChild(row);
    });
  }

  function buildExports() {
    var wrap = $('export-buttons');
    Object.keys(EXPORT_SIZES).forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill wide';
      b.textContent = 'PNG ' + EXPORT_SIZES[key].label;
      b.addEventListener('click', function () { exportCover(key); });
      wrap.appendChild(b);
    });
    $('surprise-btn').addEventListener('click', surprise);
    document.querySelectorAll('[data-size]').forEach(function (b) {
      b.addEventListener('click', function () {
        currentSize = b.dataset.size;
        document.querySelectorAll('[data-size]').forEach(function (x) { x.classList.toggle('active', x === b); });
        render();
      });
    });
  }

  function syncControls() {
    document.querySelectorAll('#layout-buttons .pill').forEach(function (b, i) {
      b.classList.toggle('active', ['collage', 'grid', 'tilted'][i] === state.layout);
    });
    document.querySelectorAll('#grade-buttons .grade').forEach(function (b) {
      b.classList.toggle('active', b.dataset.grade === state.grade);
    });
  }

  // ---- shot modes (used by the screenshot script) --------------------------
  function applyShotParams() {
    var q = new URLSearchParams(window.location.search);
    var shot = q.get('shot');
    if (!shot) return false;
    if (q.get('size') && EXPORT_SIZES[q.get('size')]) currentSize = q.get('size');
    if (q.get('title')) state.title = q.get('title');
    if (q.get('subtitle')) state.subtitle = q.get('subtitle');
    if (q.get('layout') && ['collage', 'grid', 'tilted'].indexOf(q.get('layout')) >= 0) {
      state.layout = q.get('layout');
    }
    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      // Full-bleed cover: keep the export bitmap size, scale the element to
      // fit the viewport so a screenshot captures the whole poster.
      var size = EXPORT_SIZES[currentSize];
      var scale = Math.min(window.innerWidth / size.w, window.innerHeight / size.h);
      stage.style.width = Math.floor(size.w * scale) + 'px';
      stage.style.height = Math.floor(size.h * scale) + 'px';
      stage.width = size.w;
      stage.height = size.h;
      CoverArt.drawCover(sctx, size.w, size.h, state, images);
      return true;
    }
    return false;
  }

  function init() {
    buildLayoutButtons();
    buildGradeButtons();
    buildWords();
    buildCast();
    buildPhotos();
    buildExports();
    window.addEventListener('resize', render);
    preload().then(function () {
      var shotDone = applyShotParams();
      // Fonts are local @font-face files; wait for them before first paint so
      // the title renders in Anton/Pacifico, not a fallback.
      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      return fontsReady.then(function () {
        if (!shotDone) render();
        // One more pass after fonts settle: canvas text uses loaded fonts.
        setTimeout(function () { if (!shotDone) render(); }, 300);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
