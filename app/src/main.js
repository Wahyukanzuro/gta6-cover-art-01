// Vice State Cover Studio — editor logic.
// Everything runs in the browser. Photos are read with FileReader and
// never leave the page; there are no network requests at all.

var DEFAULT_PANELS = [
  { src: 'samples/woman-convertible.jpg', zoom: 1.12, ox: 0.5, oy: 0.30 },
  { src: 'samples/man-portrait.jpg', zoom: 1.10, ox: 0.5, oy: 0.28 },
  { src: 'samples/fisherman-pier.jpg', zoom: 1.10, ox: 0.5, oy: 0.38 },
  { src: 'samples/friends-neon.jpg', zoom: 1.10, ox: 0.5, oy: 0.42 },
  { src: 'samples/gas-station.jpg', zoom: 1.05, ox: 0.5, oy: 0.5 },
  { src: 'samples/marina.jpg', zoom: 1.05, ox: 0.5, oy: 0.5 },
];

var state = {
  layout: 'collage',
  grade: 'sunset',
  title: 'VICE STATE',
  script: 'Neon Tide',
  tagline: 'SUNSHINE · SIN · SPEED',
  halftone: true,
  grain: true,
  ribbon: true,
  seal: true,
  panels: JSON.parse(JSON.stringify(DEFAULT_PANELS)),
};

var stage = null;
var renderQueued = false;
var fontsReady = false;

function $(id) { return document.getElementById(id); }

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(function () {
    renderQueued = false;
    renderPreview();
  });
}

async function renderPreview() {
  if (!stage) return;
  try {
    await drawCover(stage, state);
  } catch (err) {
    console.error(err);
  }
}

function loadFonts() {
  var loads = [
    document.fonts.load('80px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.load('bold 20px "PT Sans"'),
    document.fonts.load('20px "PT Sans"'),
  ];
  return Promise.all(loads).then(function () {
    fontsReady = true;
    return document.fonts.ready;
  }).catch(function () {
    fontsReady = true;
  });
}

function shortName(src) {
  if (src.indexOf('data:') === 0) return 'Your photo';
  var parts = src.split('/');
  return parts[parts.length - 1].replace('.jpg', '').replace(/-/g, ' ');
}

function buildPanelList() {
  var list = $('panel-list');
  list.innerHTML = '';
  state.panels.forEach(function (panel, i) {
    var row = document.createElement('div');
    row.className = 'panel-row';
    var thumb = document.createElement('img');
    thumb.className = 'panel-thumb';
    thumb.src = panel.src;
    thumb.alt = 'Panel ' + (i + 1);
    var body = document.createElement('div');
    body.className = 'panel-body';
    var head = document.createElement('div');
    head.className = 'panel-head';
    var num = document.createElement('span');
    num.className = 'panel-num';
    num.textContent = (i === 0 ? 'HERO' : 'PANEL ' + (i + 1));
    var name = document.createElement('span');
    name.className = 'panel-name';
    name.textContent = shortName(panel.src);
    head.appendChild(num);
    head.appendChild(name);
    var select = document.createElement('select');
    select.className = 'panel-select';
    select.setAttribute('aria-label', 'Sample photo for panel ' + (i + 1));
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Pick a sample…';
    select.appendChild(opt0);
    SAMPLES.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.src;
      o.textContent = s.label;
      if (s.src === panel.src) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', function () {
      if (!select.value) return;
      panel.src = select.value;
      thumb.src = panel.src;
      name.textContent = shortName(panel.src);
      queueRender();
    });
    var upload = document.createElement('label');
    upload.className = 'upload-btn';
    upload.textContent = 'Upload photo';
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        panel.src = String(reader.result);
        thumb.src = panel.src;
        name.textContent = f.name.length > 22 ? f.name.slice(0, 21) + '…' : f.name;
        select.value = '';
        queueRender();
      };
      reader.readAsDataURL(f);
    });
    upload.appendChild(file);
    var zoomRow = document.createElement('div');
    zoomRow.className = 'zoom-row';
    var zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom';
    var zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1'; zoom.max = '2.5'; zoom.step = '0.05';
    zoom.value = String(panel.zoom);
    zoom.setAttribute('aria-label', 'Zoom for panel ' + (i + 1));
    zoom.addEventListener('input', function () {
      panel.zoom = parseFloat(zoom.value);
      queueRender();
    });
    var centre = document.createElement('button');
    centre.type = 'button';
    centre.className = 'mini-btn';
    centre.textContent = 'Centre';
    centre.addEventListener('click', function () {
      panel.ox = 0.5; panel.oy = 0.5; panel.zoom = 1;
      zoom.value = '1';
      queueRender();
    });
    zoomRow.appendChild(zoomLabel);
    zoomRow.appendChild(zoom);
    zoomRow.appendChild(centre);
    body.appendChild(head);
    body.appendChild(select);
    body.appendChild(upload);
    body.appendChild(zoomRow);
    row.appendChild(thumb);
    row.appendChild(body);
    list.appendChild(row);
  });
}

function buildLayoutButtons() {
  var wrap = $('layout-buttons');
  Object.keys(LAYOUTS).forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-btn' + (state.layout === key ? ' active' : '');
    b.textContent = LAYOUTS[key].name;
    b.title = LAYOUTS[key].blurb;
    b.addEventListener('click', function () {
      state.layout = key;
      wrap.querySelectorAll('.seg-btn').forEach(function (el) { el.classList.remove('active'); });
      b.classList.add('active');
      queueRender();
    });
    wrap.appendChild(b);
  });
}

function buildGradeSwatches() {
  var wrap = $('grade-swatches');
  Object.keys(GRADES).forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'grade-btn' + (state.grade === key ? ' active' : '');
    var chip = document.createElement('span');
    chip.className = 'grade-chip grade-' + key;
    var label = document.createElement('span');
    label.textContent = GRADES[key].name;
    b.appendChild(chip);
    b.appendChild(label);
    b.addEventListener('click', function () {
      state.grade = key;
      wrap.querySelectorAll('.grade-btn').forEach(function (el) { el.classList.remove('active'); });
      b.classList.add('active');
      queueRender();
    });
    wrap.appendChild(b);
  });
}

function bindTextInputs() {
  $('title-input').addEventListener('input', function (e) {
    state.title = e.target.value || 'VICE STATE';
    queueRender();
  });
  $('script-input').addEventListener('input', function (e) {
    state.script = e.target.value;
    queueRender();
  });
  $('tagline-input').addEventListener('input', function (e) {
    state.tagline = e.target.value || 'SUNSHINE · SIN · SPEED';
    queueRender();
  });
}

function bindToggles() {
  [['toggle-halftone', 'halftone'], ['toggle-grain', 'grain'],
   ['toggle-ribbon', 'ribbon'], ['toggle-seal', 'seal']].forEach(function (pair) {
    $(pair[0]).addEventListener('change', function (e) {
      state[pair[1]] = e.target.checked;
      queueRender();
    });
  });
}

function bindDragPan() {
  var drag = null;
  function pointToPanel(e) {
    var rect = stage.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (stage.width / rect.width);
    var y = (e.clientY - rect.top) * (stage.height / rect.height);
    var geo = layoutRects(state.layout, stage.width, stage.height);
    for (var i = geo.rects.length - 1; i >= 0; i--) {
      var r = geo.rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }
  stage.addEventListener('pointerdown', function (e) {
    var i = pointToPanel(e);
    if (i < 0) return;
    drag = { index: i, x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    stage.style.cursor = 'grabbing';
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var rect = stage.getBoundingClientRect();
    var panel = state.panels[drag.index];
    var scaleX = stage.width / rect.width;
    var scaleY = stage.height / rect.height;
    var geo = layoutRects(state.layout, stage.width, stage.height);
    var r = geo.rects[drag.index];
    var dx = (e.clientX - drag.x) * scaleX;
    var dy = (e.clientY - drag.y) * scaleY;
    // Pan in the opposite direction of the drag, like grabbing the photo.
    panel.ox = Math.max(0, Math.min(1, panel.ox - dx / Math.max(40, r.w * 0.6)));
    panel.oy = Math.max(0, Math.min(1, panel.oy - dy / Math.max(40, r.h * 0.6)));
    drag.x = e.clientX;
    drag.y = e.clientY;
    queueRender();
  });
  function endDrag() {
    drag = null;
    stage.style.cursor = 'grab';
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
}

function surpriseMe() {
  var gradeKeys = Object.keys(GRADES);
  var layoutKeys = Object.keys(LAYOUTS);
  state.grade = gradeKeys[Math.floor(Math.random() * gradeKeys.length)];
  state.layout = layoutKeys[Math.floor(Math.random() * layoutKeys.length)];
  var pool = SAMPLES.slice();
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  state.panels.forEach(function (panel, idx) {
    panel.src = pool[idx % pool.length].src;
    panel.zoom = 1 + Math.random() * 0.25;
    panel.ox = 0.5;
    panel.oy = 0.3 + Math.random() * 0.3;
  });
  document.querySelectorAll('#grade-swatches .grade-btn').forEach(function (el, idx) {
    el.classList.toggle('active', gradeKeys[idx] === state.grade);
  });
  document.querySelectorAll('#layout-buttons .seg-btn').forEach(function (el, idx) {
    el.classList.toggle('active', layoutKeys[idx] === state.layout);
  });
  buildPanelList();
  queueRender();
}

async function exportPng(w, h, label) {
  var btn = document.querySelector('[data-export="' + label + '"]');
  if (btn) btn.disabled = true;
  try {
    var canvas = await exportCover(state, w, h);
    var blob = await canvasToBlob(canvas);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vice-state-cover-' + w + 'x' + h + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindExports() {
  document.querySelectorAll('[data-export]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var parts = btn.getAttribute('data-export').split('x');
      exportPng(parseInt(parts[0], 10), parseInt(parts[1], 10), btn.getAttribute('data-export'));
    });
  });
  $('surprise-btn').addEventListener('click', surpriseMe);
}

function init() {
  stage = $('stage');
  stage.width = 1080;
  stage.height = 1080;
  buildLayoutButtons();
  buildGradeSwatches();
  buildPanelList();
  bindTextInputs();
  bindToggles();
  bindDragPan();
  bindExports();
  loadFonts().then(function () { queueRender(); });
  queueRender();
}

document.addEventListener('DOMContentLoaded', init);
