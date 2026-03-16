// ─── Pokopia Planner · app.js ─────────────────────────────────────────────────

// ─── Tile Definitions (Pokopia palette) ───────────────────────────────────────
const TILES = [
  { id: 'field-grass',       label: 'Field grass',        icon: 'tiles/field-grass.webp',       top: '#8CC840', side: '#DDB888', dark: '#C8A070' },
  { id: 'ordinary-soil',    label: 'Ordinary soil',      icon: 'tiles/ordinary-soil.webp',     top: '#E8C8A0', side: '#DDB888', dark: '#C8A070' },
  { id: 'mossy-soil',        label: 'Mossy soil',         icon: 'tiles/mossy-soil.webp',        top: '#C8CC48', side: '#B8B840', dark: '#A0A030' },
  { id: 'hardwood-flooring', label: 'Hardwood flooring', icon: 'tiles/hardwood-flooring.webp', top: '#E0A838', side: '#D09830', dark: '#B88028' },
  { id: 'wooden-wall',      label: 'Wooden wall',       icon: 'tiles/wooden-wall.webp',      top: '#C89030', side: '#B88028', dark: '#986818' },
  { id: 'cobblestone-wall', label: 'Cobblestone wall',  icon: 'tiles/cobblestone-wall.webp', top: '#A0A098', side: '#888880', dark: '#707068' },
];

const TILE_MAP = Object.fromEntries(TILES.map(t => [t.id, t]));

// Preload tile icons
const tileImages = {};
let imagesLoaded = 0;
TILES.forEach(tile => {
  const img = new Image();
  img.src = tile.icon;
  img.onload = () => { imagesLoaded++; if (imagesLoaded === TILES.length) drawAll(); };
  tileImages[tile.id] = img;
});

// ─── Config ───────────────────────────────────────────────────────────────────
const GRID_W     = 24;
const GRID_H     = 24;
const MAX_LAYERS = 8;
const ISO_TW     = 40;
const ISO_TH     = 20;
const ISO_DEPTH  = 20;

// ─── State ────────────────────────────────────────────────────────────────────
const voxelData = Array.from({ length: MAX_LAYERS }, () =>
  Array.from({ length: GRID_H }, () => Array(GRID_W).fill(null))
);

let activeLayer = 0;
let activeTile  = TILES[0].id;
let undoStack   = [];
let isLeftDown  = false;
let isRightDown = false;
let paintedThisStroke = new Set();

// Iso pan/zoom/rotation
let isoPanX = 0, isoPanY = 0;
let isPanning = false;
let panStartX = 0, panStartY = 0;
let isoZoom     = 1.0;
let isoRotation = 0; // 0, 1, 2, 3 (90° increments CW)
let highlightLayer = true;

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const viewport     = document.getElementById('viewport');
const isoContainer = document.getElementById('iso-container');
const isoCanvas    = document.getElementById('iso-canvas');
const isoCtx       = isoCanvas.getContext('2d');
const tdContainer  = document.getElementById('topdown-container');
const tdCanvas     = document.getElementById('topdown-canvas');
const tdCtx        = tdCanvas.getContext('2d');

function resizeCanvases() {
  isoCanvas.width  = isoContainer.clientWidth;
  isoCanvas.height = isoContainer.clientHeight;
  tdCanvas.width   = tdContainer.clientWidth;
  tdCanvas.height  = tdContainer.clientHeight;
  drawAll();
}
new ResizeObserver(resizeCanvases).observe(viewport);

// ─── View Swap ───────────────────────────────────────────────────────────────
function swapViews() {
  const isoIsMain = isoContainer.classList.contains('view-main');
  isoContainer.classList.toggle('view-main', !isoIsMain);
  isoContainer.classList.toggle('view-mini', isoIsMain);
  tdContainer.classList.toggle('view-main', isoIsMain);
  tdContainer.classList.toggle('view-mini', !isoIsMain);

  // Move swap button to whichever pane is now the minimap
  const miniPane = isoIsMain ? isoContainer : tdContainer;
  miniPane.appendChild(document.getElementById('swap-view-btn'));

  resizeCanvases();
}
document.getElementById('swap-view-btn').addEventListener('click', swapViews);

// ─── Rotation Helpers ─────────────────────────────────────────────────────────
function rotateGrid(col, row) {
  switch (isoRotation) {
    case 0: return [col, row];
    case 1: return [GRID_H - 1 - row, col];
    case 2: return [GRID_W - 1 - col, GRID_H - 1 - row];
    case 3: return [row, GRID_W - 1 - col];
  }
}
function unrotateGrid(rc, rr) {
  switch (isoRotation) {
    case 0: return [rc, rr];
    case 1: return [rr, GRID_H - 1 - rc];
    case 2: return [GRID_W - 1 - rc, GRID_H - 1 - rr];
    case 3: return [GRID_W - 1 - rr, rc];
  }
}

// ─── Isometric Projection ─────────────────────────────────────────────────────
function isoProject(col, row, layer) {
  const [rc, rr] = rotateGrid(col, row);
  const cx = isoCanvas.width  / 2 + isoPanX;
  const cy = isoCanvas.height * 0.38 + isoPanY;
  const z  = isoZoom;
  const tw = ISO_TW * z, th = ISO_TH * z, dp = ISO_DEPTH * z;
  return {
    x: cx + (rc - rr) * (tw / 2),
    y: cy + (rc + rr) * (th / 2) - layer * dp,
  };
}

function drawIsoTile(ctx, col, row, layer, tile, isGhost = false) {
  const { x, y } = isoProject(col, row, layer);
  const z  = isoZoom;
  const tw = ISO_TW * z, th = ISO_TH * z, dp = ISO_DEPTH * z;
  const isAboveLayer = !isGhost && highlightLayer && layer > activeLayer;
  ctx.globalAlpha = isGhost ? 0.42 : isAboveLayer ? 0.35 : 1.0;

  // Front-left face
  ctx.beginPath();
  ctx.moveTo(x,          y + th);
  ctx.lineTo(x - tw / 2, y + th / 2);
  ctx.lineTo(x - tw / 2, y + th / 2 + dp);
  ctx.lineTo(x,          y + th + dp);
  ctx.closePath();
  ctx.fillStyle = tile.dark;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Front-right face
  ctx.beginPath();
  ctx.moveTo(x,          y + th);
  ctx.lineTo(x + tw / 2, y + th / 2);
  ctx.lineTo(x + tw / 2, y + th / 2 + dp);
  ctx.lineTo(x,          y + th + dp);
  ctx.closePath();
  ctx.fillStyle = tile.side;
  ctx.fill();
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(x,          y);
  ctx.lineTo(x + tw / 2, y + th / 2);
  ctx.lineTo(x,          y + th);
  ctx.lineTo(x - tw / 2, y + th / 2);
  ctx.closePath();
  ctx.fillStyle = tile.top;
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 1.0;
}

function drawIsoGrid() {
  const ctx = isoCtx;
  ctx.clearRect(0, 0, isoCanvas.width, isoCanvas.height);

  // Sky gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, isoCanvas.height);
  grad.addColorStop(0,   '#A8D8F0');
  grad.addColorStop(0.4, '#C8ECF8');
  grad.addColorStop(1,   '#D8F0C0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, isoCanvas.width, isoCanvas.height);

  // Tiles: all layers, back to front (iterate in rotated space)
  for (let layer = 0; layer < MAX_LAYERS; layer++) {
    for (let rr = 0; rr < GRID_H; rr++) {
      for (let rc = 0; rc < GRID_W; rc++) {
        const [col, row] = unrotateGrid(rc, rr);
        const tid = voxelData[layer][row][col];
        if (!tid) {
          if (layer === 0) {
            // Faint ground grid
            const { x, y } = isoProject(col, row, 0);
            const z = isoZoom, tw = ISO_TW * z, th = ISO_TH * z;
            ctx.beginPath();
            ctx.moveTo(x,          y);
            ctx.lineTo(x + tw / 2, y + th / 2);
            ctx.lineTo(x,          y + th);
            ctx.lineTo(x - tw / 2, y + th / 2);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(88,160,48,0.16)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          continue;
        }
        const tile = TILE_MAP[tid];
        if (tile) drawIsoTile(ctx, col, row, layer, tile);
      }
    }
  }

  // Ghost preview
  if (ghostCell && shapeMode && shapeStart) {
    const cells = getShapeCells(ghostCell);
    const tile = TILE_MAP[activeTile];
    if (tile && shapeBtn === 0) {
      cells.forEach(c => drawIsoTile(ctx, c.col, c.row, activeLayer, tile, true));
    } else {
      ctx.globalAlpha = 0.3;
      cells.forEach(c => {
        const { x, y } = isoProject(c.col, c.row, activeLayer);
        const z = isoZoom, tw = ISO_TW * z, th = ISO_TH * z, dp = ISO_DEPTH * z;
        ctx.fillStyle = '#E83030';
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + tw/2, y + th/2); ctx.lineTo(x, y + th); ctx.lineTo(x - tw/2, y + th/2);
        ctx.closePath(); ctx.fill();
      });
      ctx.globalAlpha = 1.0;
    }
  } else if (ghostCell && !isRightDown) {
    const tile = TILE_MAP[activeTile];
    if (tile) drawIsoTile(ctx, ghostCell.col, ghostCell.row, activeLayer, tile, true);
  }

  // Hover ground outline
  if (ghostCell) {
    const { x, y } = isoProject(ghostCell.col, ghostCell.row, 0);
    const z = isoZoom, tw = ISO_TW * z, th = ISO_TH * z;
    ctx.beginPath();
    ctx.moveTo(x,          y);
    ctx.lineTo(x + tw / 2, y + th / 2);
    ctx.lineTo(x,          y + th);
    ctx.lineTo(x - tw / 2, y + th / 2);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,58,16,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ─── Top-Down Drawing ─────────────────────────────────────────────────────────
function drawTopDown() {
  const ctx = tdCtx;
  const W = tdCanvas.width, H = tdCanvas.height;
  ctx.clearRect(0, 0, W, H);

  const isMini = tdContainer.classList.contains('view-mini');
  const labelMargin = isMini ? 0 : Math.max(12, Math.min(20, Math.floor(Math.min(W, H) * 0.04)));
  const cell = Math.min(Math.floor((W - labelMargin) / GRID_W), Math.floor((H - labelMargin) / GRID_H));
  const offX = labelMargin + Math.floor((W - labelMargin - cell * GRID_W) / 2);
  const offY = labelMargin + Math.floor((H - labelMargin - cell * GRID_H) / 2);

  // Background
  ctx.fillStyle = '#EEF7E4';
  ctx.fillRect(0, 0, W, H);

  if (!isMini) {
    // Column labels (top)
    ctx.fillStyle = '#527838';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelFs = Math.max(6, Math.min(11, cell * 0.45));
    ctx.font = `700 ${labelFs}px Nunito, sans-serif`;
    for (let col = 0; col < GRID_W; col++) {
      ctx.fillText(col + 1, offX + col * cell + cell / 2, offY - 2);
    }

    // Row labels (left)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < GRID_H; row++) {
      ctx.fillText(row + 1, offX - 3, offY + row * cell + cell / 2);
    }
  }

  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      const x = offX + col * cell;
      const y = offY + row * cell;

      // Find topmost tile up to active layer
      let topTile = null;
      for (let l = activeLayer; l >= 0; l--) {
        if (voxelData[l][row][col]) { topTile = voxelData[l][row][col]; break; }
      }

      if (topTile) {
        ctx.fillStyle = TILE_MAP[topTile].top;
        ctx.fillRect(x, y, cell, cell);
      } else {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#E0EDD0' : '#D4E4C4';
        ctx.fillRect(x, y, cell, cell);
      }

      // Active-layer tile outline
      if (voxelData[activeLayer][row][col]) {
        ctx.strokeStyle = 'rgba(30,58,16,0.35)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(88,160,48,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, cell, cell);
    }
  }

  // Ghost
  if (tdGhostCell && shapeMode && shapeStart) {
    const cells = getShapeCells(tdGhostCell);
    ctx.globalAlpha = 0.48;
    ctx.fillStyle = shapeBtn === 0 ? TILE_MAP[activeTile]?.top || '#888' : '#E83030';
    cells.forEach(c => ctx.fillRect(offX + c.col * cell, offY + c.row * cell, cell, cell));
    ctx.globalAlpha = 1.0;
  } else if (tdGhostCell && !isRightDown) {
    const { row, col } = tdGhostCell;
    const tile = TILE_MAP[activeTile];
    if (tile) {
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = tile.top;
      ctx.fillRect(offX + col * cell, offY + row * cell, cell, cell);
      ctx.globalAlpha = 1.0;
    }
  }

  // Outer border
  ctx.strokeStyle = '#7AB858';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(offX, offY, cell * GRID_W, cell * GRID_H);

  // Store for hit testing
  tdCanvas._cell = cell;
  tdCanvas._offX = offX;
  tdCanvas._offY = offY;
}

function drawAll() { drawIsoGrid(); drawTopDown(); updateStats(); }

// ─── Ghost State ──────────────────────────────────────────────────────────────
let ghostCell   = null;
let tdGhostCell = null;

// ─── Shape Drawing (line / rect) ─────────────────────────────────────────────
let shapeStart = null; // { row, col } set on mousedown when shift or ctrl held
let shapeMode  = null; // 'line' | 'rect' | null
let shapeBtn   = null; // 0 (place) or 2 (erase)

function lineCells(r0, c0, r1, c1) {
  const cells = [];
  const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
  let err = dc - dr, r = r0, c = c0;
  while (true) {
    cells.push({ row: r, col: c });
    if (r === r1 && c === c1) break;
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 <  dc) { err += dc; r += sr; }
  }
  return cells;
}

function rectCells(r0, c0, r1, c1) {
  const cells = [];
  const rMin = Math.min(r0, r1), rMax = Math.max(r0, r1);
  const cMin = Math.min(c0, c1), cMax = Math.max(c0, c1);
  for (let r = rMin; r <= rMax; r++)
    for (let c = cMin; c <= cMax; c++)
      cells.push({ row: r, col: c });
  return cells;
}

function getShapeCells(endCell) {
  if (!shapeStart || !endCell || !shapeMode) return [];
  if (shapeMode === 'line') return lineCells(shapeStart.row, shapeStart.col, endCell.row, endCell.col);
  if (shapeMode === 'rect') return rectCells(shapeStart.row, shapeStart.col, endCell.row, endCell.col);
  return [];
}

function commitShape(endCell) {
  const cells = getShapeCells(endCell);
  const batch = [];
  cells.forEach(({ row, col }) => {
    if (shapeBtn === 0) {
      const prev = voxelData[activeLayer][row][col];
      if (prev !== activeTile) {
        batch.push({ layer: activeLayer, row, col, prev });
        voxelData[activeLayer][row][col] = activeTile;
      }
    } else {
      const prev = voxelData[activeLayer][row][col];
      if (prev) {
        batch.push({ layer: activeLayer, row, col, prev });
        voxelData[activeLayer][row][col] = null;
      }
    }
  });
  if (batch.length) undoStack.push(batch);
  shapeStart = null;
  shapeMode = null;
  shapeBtn = null;
  drawAll();
}

// ─── Iso → Grid ──────────────────────────────────────────────────────────────
function isoMouseToGrid(mx, my) {
  const cx = isoCanvas.width  / 2 + isoPanX;
  const cy = isoCanvas.height * 0.38 + isoPanY;
  const z  = isoZoom;
  const tw = ISO_TW * z, th = ISO_TH * z;
  const dx = mx - cx;
  const dp = ISO_DEPTH * z;
  const dy = my - cy + activeLayer * dp - th / 2 - dp;
  const rc = Math.round((dx / (tw / 2) + dy / (th / 2)) / 2);
  const rr = Math.round((dy / (th / 2) - dx / (tw / 2)) / 2);
  const [col, row] = unrotateGrid(rc, rr);
  if (col >= 0 && col < GRID_W && row >= 0 && row < GRID_H) return { col, row };
  return null;
}

// ─── Top-Down → Grid ─────────────────────────────────────────────────────────
function tdMouseToGrid(mx, my) {
  const cell = tdCanvas._cell, offX = tdCanvas._offX, offY = tdCanvas._offY;
  if (!cell) return null;
  const col = Math.floor((mx - offX) / cell);
  const row = Math.floor((my - offY) / cell);
  if (col >= 0 && col < GRID_W && row >= 0 && row < GRID_H) return { col, row };
  return null;
}

// ─── Place / Erase ───────────────────────────────────────────────────────────
let strokeBatch = [];

function placeTile(row, col) {
  const key = `${activeLayer},${row},${col}`;
  if (paintedThisStroke.has(key)) return;
  const prev = voxelData[activeLayer][row][col];
  if (prev === activeTile) return;
  strokeBatch.push({ layer: activeLayer, row, col, prev });
  voxelData[activeLayer][row][col] = activeTile;
  paintedThisStroke.add(key);
  drawAll();
}

function eraseTile(row, col) {
  const key = `${activeLayer},${row},${col}`;
  if (paintedThisStroke.has(key)) return;
  const prev = voxelData[activeLayer][row][col];
  if (!prev) return;
  strokeBatch.push({ layer: activeLayer, row, col, prev });
  voxelData[activeLayer][row][col] = null;
  paintedThisStroke.add(key);
  drawAll();
}

function flushStroke() {
  if (strokeBatch.length) {
    undoStack.push(strokeBatch);
    strokeBatch = [];
  }
  paintedThisStroke.clear();
}

// ─── Iso Events ───────────────────────────────────────────────────────────────
isoCanvas.addEventListener('mousemove', (e) => {
  const rect = isoCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if (isPanning) {
    isoPanX += mx - panStartX; isoPanY += my - panStartY;
    panStartX = mx; panStartY = my;
    drawAll(); return;
  }
  ghostCell = isoMouseToGrid(mx, my);
  if (!shapeMode && ghostCell) {
    if (isLeftDown)  placeTile(ghostCell.row, ghostCell.col);
    if (isRightDown) eraseTile(ghostCell.row, ghostCell.col);
  }
  drawAll();
});

isoCanvas.addEventListener('mousedown', (e) => {
  if (e.button === 1) {
    isPanning = true;
    const rect = isoCanvas.getBoundingClientRect();
    panStartX = e.clientX - rect.left; panStartY = e.clientY - rect.top;
    return;
  }
  const rect = isoCanvas.getBoundingClientRect();
  const cell = isoMouseToGrid(e.clientX - rect.left, e.clientY - rect.top);
  const wantsShape = cell && (e.button === 0 || e.button === 2) && (e.shiftKey || ((e.ctrlKey || e.metaKey) && e.button === 0));
  if (wantsShape) {
    shapeMode = e.shiftKey ? 'line' : 'rect';
    shapeStart = cell;
    shapeBtn = e.button;
    return;
  }
  flushStroke();
  if (e.button === 0) { isLeftDown = true;  if (cell) placeTile(cell.row, cell.col); }
  if (e.button === 2) { isRightDown = true; if (cell) eraseTile(cell.row, cell.col); }
});

isoCanvas.addEventListener('mouseup', (e) => {
  if (shapeMode) { if (ghostCell) commitShape(ghostCell); shapeStart = null; shapeMode = null; shapeBtn = null; return; }
  if (e.button === 0) isLeftDown = false;
  if (e.button === 1) isPanning = false;
  if (e.button === 2) isRightDown = false;
  flushStroke();
});
isoCanvas.addEventListener('mouseleave', () => { ghostCell = null; isLeftDown = false; isRightDown = false; isPanning = false; shapeStart = null; shapeMode = null; shapeBtn = null; drawAll(); });
isoCanvas.addEventListener('contextmenu', e => e.preventDefault());
isoCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  isoZoom = Math.max(0.35, Math.min(2.8, isoZoom - e.deltaY * 0.001));
  drawAll();
}, { passive: false });

// ─── Top-Down Events ──────────────────────────────────────────────────────────
tdCanvas.addEventListener('mousemove', (e) => {
  const rect = tdCanvas.getBoundingClientRect();
  tdGhostCell = tdMouseToGrid(e.clientX - rect.left, e.clientY - rect.top);
  if (!shapeMode && tdGhostCell) {
    if (isLeftDown)  placeTile(tdGhostCell.row, tdGhostCell.col);
    if (isRightDown) eraseTile(tdGhostCell.row, tdGhostCell.col);
  }
  drawTopDown();
});

tdCanvas.addEventListener('mousedown', (e) => {
  const rect = tdCanvas.getBoundingClientRect();
  const cell = tdMouseToGrid(e.clientX - rect.left, e.clientY - rect.top);
  const wantsShape = cell && (e.button === 0 || e.button === 2) && (e.shiftKey || ((e.ctrlKey || e.metaKey) && e.button === 0));
  if (wantsShape) {
    shapeMode = e.shiftKey ? 'line' : 'rect';
    shapeStart = cell;
    shapeBtn = e.button;
    return;
  }
  flushStroke();
  if (e.button === 0) { isLeftDown = true;  if (cell) placeTile(cell.row, cell.col); }
  if (e.button === 2) { isRightDown = true; if (cell) eraseTile(cell.row, cell.col); }
});

tdCanvas.addEventListener('mouseup', (e) => {
  if (shapeMode) { if (tdGhostCell) commitShape(tdGhostCell); shapeStart = null; shapeMode = null; shapeBtn = null; return; }
  if (e.button === 0) isLeftDown = false;
  if (e.button === 2) isRightDown = false;
  flushStroke();
});
tdCanvas.addEventListener('mouseleave', () => { tdGhostCell = null; isLeftDown = false; isRightDown = false; shapeStart = null; shapeMode = null; shapeBtn = null; drawTopDown(); });
tdCanvas.addEventListener('contextmenu', e => e.preventDefault());

// ─── Tile Palette ─────────────────────────────────────────────────────────────
function buildPalette() {
  const grid = document.getElementById('tile-palette');
  grid.innerHTML = '';
  TILES.forEach(tile => {
    const btn = document.createElement('button');
    btn.className = 'tile-btn' + (tile.id === activeTile ? ' selected' : '');
    btn.title = tile.label;
    btn.style.background = tile.top;
    btn.innerHTML = `<img src="${tile.icon}" alt="${tile.label}" class="tile-icon"><span class="tile-label">${tile.label}</span>`;
    btn.onclick = () => setActiveTile(tile.id);
    grid.appendChild(btn);
  });
}

function setActiveTile(id) {
  activeTile = id;
  document.querySelectorAll('.tile-btn').forEach((b, i) => {
    b.classList.toggle('selected', TILES[i].id === id);
  });
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function buildLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = '';
  TILES.slice(0, 9).forEach(tile => {
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.innerHTML = `<img src="${tile.icon}" alt="" class="legend-icon"> ${tile.label}`;
    el.appendChild(row);
  });
}

// ─── Layer ────────────────────────────────────────────────────────────────────
function setLayer(l) {
  activeLayer = Math.max(0, Math.min(MAX_LAYERS - 1, l));
  document.getElementById('layer-display').textContent   = activeLayer;
  document.getElementById('td-layer-label').textContent  = activeLayer;
  document.getElementById('stat-layer').textContent      = activeLayer;
  drawAll();
}
document.getElementById('layer-up').onclick   = () => setLayer(activeLayer + 1);
document.getElementById('layer-down').onclick = () => setLayer(activeLayer - 1);

// ─── Rotation ────────────────────────────────────────────────────────────────
function rotateView(dir) {
  isoRotation = (isoRotation + dir + 4) % 4;
  drawAll();
}
document.getElementById('rotate-left').onclick  = () => rotateView(-1);
document.getElementById('rotate-right').onclick = () => rotateView(1);

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  let total = 0;
  const layersUsed = new Set();
  for (let l = 0; l < MAX_LAYERS; l++)
    for (let r = 0; r < GRID_H; r++)
      for (let c = 0; c < GRID_W; c++)
        if (voxelData[l][r][c]) { total++; layersUsed.add(l); }
  document.getElementById('stat-tiles').textContent  = total;
  document.getElementById('stat-layers').textContent = layersUsed.size;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'w' || e.key === 'W') setLayer(activeLayer + 1);
  if (e.key === 's' || e.key === 'S') setLayer(activeLayer - 1);
  if (e.key === 'q' || e.key === 'Q') rotateView(-1);
  if (e.key === 'e' || e.key === 'E') rotateView(1);
  if (e.key === 'h' || e.key === 'H') { highlightLayer = !highlightLayer; drawAll(); }
  if (e.key === ' ') { e.preventDefault(); swapViews(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); APP.undo(); }
});

// ─── Public API ───────────────────────────────────────────────────────────────
window.APP = {
  undo() {
    if (!undoStack.length) { showToast('Nothing to undo'); return; }
    const group = undoStack.pop();
    for (let i = group.length - 1; i >= 0; i--) {
      const a = group[i];
      voxelData[a.layer][a.row][a.col] = a.prev;
    }
    drawAll();
    showToast('Undo ↩');
  },
  confirmClear() {
    if (!confirm('Clear the entire map? This cannot be undone.')) return;
    for (let l = 0; l < MAX_LAYERS; l++)
      for (let r = 0; r < GRID_H; r++)
        voxelData[l][r].fill(null);
    undoStack.length = 0;
    drawAll();
    showToast('Map cleared 🗑');
  },
  save() {
    const blob = new Blob([JSON.stringify({ version: 2, gridW: GRID_W, gridH: GRID_H, layers: voxelData })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pokopia-map.json';
    a.click();
    showToast('Saved 💾 pokopia-map.json');
  },
  load() {
    document.getElementById('file-input').click();
  },
};

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.layers) {
        for (let l = 0; l < MAX_LAYERS; l++)
          for (let r = 0; r < GRID_H; r++)
            for (let c = 0; c < GRID_W; c++)
              voxelData[l][r][c] = data.layers[l]?.[r]?.[c] ?? null;
        undoStack.length = 0;
        drawAll();
        showToast('Map loaded 🗺');
      }
    } catch { showToast('⚠️ Error loading file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ─── Init ─────────────────────────────────────────────────────────────────────
// Fill layer 0 with field grass
for (let r = 0; r < GRID_H; r++)
  for (let c = 0; c < GRID_W; c++)
    voxelData[0][r][c] = 'field-grass';

buildPalette();
buildLegend();
isoCanvas.style.cursor = tdCanvas.style.cursor = 'crosshair';
setLayer(1);
resizeCanvases();
showToast('Welcome to Pokopia Planner 🌿');
