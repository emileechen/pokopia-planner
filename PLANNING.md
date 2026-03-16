# Pokopia Planner — Planning & Spec

> Living document. Update this as the project evolves.

---

## What is Pokopia?

**Pokopia** is a cozy Pokémon-themed game that blends:
- 🟩 **Animal Crossing** — island life, town planning, cozy vibes
- 🟦 **Minecraft** — voxel/block-based world building
- 🔴 **Pokémon** — creatures, habitats

**Pokopia Planner** is a companion web app for planning your Pokopia towns before (or while) building it in-game. Similar to the Happy Island Designer web app, but for Pokopia.

---

## Design Direction

### Visual Style
- Derived from the official Pokopia cover art
- Cozy, soft, isometric — like looking into a diorama
- Typography: **Fredoka One** (display/logo) + **Nunito** (body/UI)

### Palette (from cover art)

| Role | Name | Hex |
|---|---|---|
| ? | Ditto purple | `#E1C7F9` |

---

## Architecture

### Tech Stack
- **Vite** — dev server + build tool (zero config)
- **Vanilla JS (ES modules)** — no framework, keeps it lean
- **HTML5 Canvas 2D** — for both isometric and top-down rendering
- **No Three.js** — using a custom canvas-based isometric renderer for performance and simplicity

### File Structure
```
pokopia-planner/
├── index.html       # App shell, layout, CSS
├── app.js           # All logic: rendering, state, events
├── package.json     # Vite only, no runtime deps
└── PLANNING.md      # This file
```

### Data Model
```js
// voxelData[layer][row][col] = tileId | null
// e.g. voxelData[0][5][3] = 'grass'
const voxelData = Array(MAX_LAYERS)
  .fill(null)
  .map(() => Array(GRID_H)
    .fill(null)
    .map(() => Array(GRID_W).fill(null))
  );
```

- **Grid size:** 24 × 24 tiles
- **Layers:** 8 (layer 0 = ground, layer 7 = highest elevation)
- **Tile IDs:** string keys e.g. `'grass'`, `'water'`, `'house'`
- **Save format:** JSON — `{ version, gridW, gridH, layers }`

---

## Views

### 1. Isometric View (main, top-left section)
- Custom canvas-based isometric renderer
- Each voxel drawn as 3 faces: top (lightest), right side (mid), left side (darkest)
- Emoji icon on top face at zoom ≥ 0.65×
- Faint grid lines on ground layer (layer 0) when no tile placed
- Sky gradient background: `#A8D8F0` → `#C8ECF8` → `#D8F0C0`
- **Controls:**
  - Left-click / drag: place tiles
  - Right-click / middle-click + drag: pan camera
  - Scroll wheel: zoom (0.35× – 2.8×)
  - Ghost preview voxel follows cursor

### 2. Top-Down View (bottom section, below isometric)
- 2D flat grid showing topmost tile at each cell across all layers
- Active layer tiles get a subtle outline
- Ghost preview follows cursor
- Also supports click-to-place and right-click-to-erase
- Stays in sync with isometric view in real time
- Layer label shown in corner: "🗺 Top-Down · Layer N"

---

## Tile Library

| ID | Label | Emoji | Notes |
|---|---|---|---|
| `grass` | Field grass | 🌿 | Default ground tile |
| `soil` | Ordinary soil | 🟫 | Basic earth tile |

---

## Editing Modes

| Mode | Key | Description |
|---|---|---|
| Place | — | Click/drag to paint tiles |
| Erase | `E` | Click/drag to remove tiles |
| Fill | `F` | Flood fill from clicked cell |
| Pick | `P` | Sample tile type from map |

Right-click always erases regardless of mode.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `E` | Toggle erase mode |
| `F` | Toggle fill mode |
| `P` | Toggle pick mode |
| `[` | Layer down |
| `]` | Layer up |
| `⌘Z` / `Ctrl+Z` | Undo |
| Scroll | Zoom isometric view |
| Middle-click drag | Pan isometric view |
| Right-click drag | Pan isometric view |

---

## Implemented Features ✅

- [x] Dual-view layout (isometric + top-down)
- [x] 18-tile palette with Pokopia colors
- [x] Place, erase, fill, pick modes
- [x] 8-layer system with layer switching
- [x] Ghost/preview tile
- [x] Undo stack
- [x] Pan + zoom on isometric view
- [x] Save to JSON
- [x] Load from JSON
- [x] Clear map
- [x] Keyboard shortcuts
- [x] Stats panel (tiles placed, layers used)
- [x] Pokopia color palette applied throughout UI

---

## Backlog / Ideas

### High priority
- [ ] **Export to image** — screenshot the isometric view as a PNG
- [ ] **Named zones** — label areas of the map (e.g. "Berry Forest", "Gym District")
- [ ] **Pokémon placement** — place Pokémon icons as non-terrain markers on the map
- [ ] **Tile categories** — group palette into Terrain / Structures / Special tabs

### Medium priority
- [ ] **Minimap** — small always-visible overview in corner
- [ ] **Multiple maps** — save/load multiple named maps
- [ ] **Grid size options** — 16×16, 24×24 (current), 32×32
- [ ] **Rotate / mirror** — transform selected regions
- [ ] **Selection tool** — select + move a region of tiles
- [ ] **Copy/paste** — duplicate regions
- [ ] **Terrain auto-tiling** — smart edges between grass and water

### Low priority / stretch
- [ ] **Pokémon habitat rules** — visual indicator showing which Pokémon could live in each zone
- [ ] **Path auto-connect** — paths snap and connect visually
- [ ] **Day/night mode** — toggle a night-time lighting overlay
- [ ] **Share link** — encode map in URL for easy sharing
- [ ] **Undo history panel** — see + jump to past states
- [ ] **Mobile touch support** — pinch zoom, tap to place

---

## Decisions Log

| Date | Decision | Reason |
|---|---|---|
| v0.1 | Started with Three.js | 3D voxel builder, WebGL rendering |
| v0.2 | Switched to canvas 2D + isometric | Better accessibility, simpler, no runtime deps, suits planner use case |
| v0.2 | No framework (vanilla JS) | Keeps bundle tiny, canvas owns the render loop anyway |
| v0.2 | 24×24 grid, 8 layers | Matches Pokopia's island scale; enough layers for elevation + buildings |
| v0.2 | Pokopia palette from cover art | Visual consistency with the actual game aesthetic |

---

## Running Locally

```bash
# Install
npm install

# Dev server (live reload)
npm run dev
# → http://localhost:5173

# Production build
npm run build

# Preview production build
npm run preview
```

**Requirements:** Node.js 18+, a modern browser (Chrome/Firefox/Safari/Edge)

---

## Version History

| Version | Description |
|---|---|
| v0.1 | Three.js 3D voxel builder, basic palette, undo, save/load |
| v0.2 | Full redesign — isometric canvas renderer, dual views, Pokopia palette, 18 tiles, layer system |
