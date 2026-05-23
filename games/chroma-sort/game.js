// ============================================================
//  CHROMA SORT
// ============================================================

// FreshPlay shim
if (!window.FreshPlay) {
  window.FreshPlay = {
    currentLevel: 1,
    levelComplete: (cb) => { 
        window.FreshPlay.currentLevel++;
        setTimeout(cb, 800); 
    },
    getCurrentPalette: () => ({
      background: '#07080f',
      interface:  '#111827',
      playerCore: '#00f0ff',
      hostile:    '#ff2060',
      fxAccent:   '#aa44ff',
    }),
  };
}

// ============================================================
//  CONSTANTS
// ============================================================
const TUBE_CAPACITY = 4;
const LAYER_H       = 48;
const TUBE_W        = 52;
const TUBE_INNER_H  = TUBE_CAPACITY * LAYER_H;  // 192
const POUR_MS       = 380;
const WAVE_AMP      = 5;
const HEADER_H      = 76;

// ============================================================
//  ROBUST COLOR PARSERS (Restores Original Dark UI)
// ============================================================
function hexToStr(h) {
  if (typeof h === 'string') return h.startsWith('#') ? h : '#' + h;
  if (typeof h === 'number') return '#' + h.toString(16).padStart(6, '0');
  return '#ffffff';
}

function getPalette() {
  let p = window.FreshPlay && window.FreshPlay.getCurrentPalette ? window.FreshPlay.getCurrentPalette() : null;
  if (!p) p = { background: '#07080f', interface: '#111827', playerCore: '#00f0ff', hostile: '#ff2060', fxAccent: '#aa44ff' };
  
  return {
    background: hexToStr(p.background || '#07080f'),
    interface:  '#111827', 
    playerCore: hexToStr(p.playerCore || '#00f0ff'),
    hostile:    hexToStr(p.hostile || '#ff2060'),
    fxAccent:   hexToStr(p.fxAccent || '#aa44ff')
  };
}

// ============================================================
//  HELPERS
// ============================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function lighten(hex, t) {
  const c = hexToRgb(hex);
  return rgbToHex({
    r: Math.min(255, Math.round(c.r + (255 - c.r) * t)),
    g: Math.min(255, Math.round(c.g + (255 - c.g) * t)),
    b: Math.min(255, Math.round(c.b + (255 - c.b) * t)),
  });
}
function darken(hex, t) {
  const c = hexToRgb(hex);
  return rgbToHex({
    r: Math.round(c.r * (1 - t)),
    g: Math.round(c.g * (1 - t)),
    b: Math.round(c.b * (1 - t)),
  });
}
function phColor(hex) {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}
function shiftHue(hex, deg) {
  const { r, g, b } = hexToRgb(hex);
  let rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      default: h = ((rn - gn) / d + 4) / 6;
    }
  }
  h = (h + deg / 360 + 2) % 1;
  const hue2rgb = (p, q, t) => {
    t = (t + 1) % 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2  = 2 * l - q2;
  return rgbToHex({
    r: Math.round(hue2rgb(p2, q2, h + 1/3) * 255),
    g: Math.round(hue2rgb(p2, q2, h) * 255),
    b: Math.round(hue2rgb(p2, q2, h - 1/3) * 255),
  });
}
function bezier(a, b, c, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

// ============================================================
//  LEVEL CONFIG
// ============================================================
function getLevelConfig(level) {
  const colors = Math.min(2 + Math.floor((level - 1) / 2), 5);
  const empty  = level >= 5 ? 2 : 1;
  return { colors, tubes: colors + empty };
}

// ============================================================
//  MAIN SCENE
// ============================================================
class ChromaSortScene extends Phaser.Scene {
  constructor() { super({ key: 'ChromaSort' }); }

  // ──────────────────────────────────────────────────────────
  create() {
    this.pal          = getPalette();
    this.level        = window.FreshPlay.currentLevel || (this.registry.get('level') || 1);
    this.tubes        = [];
    this.selected     = -1;
    this.pouring      = false;
    this.moves        = 0;
    this.completedSet = new Set();
    this.history      = [];

    this._buildColorPalette();
    this._drawBackground();
    this._buildHeader();

    // Layered containers
    this.layerTubes = this.add.layer();
    this.layerWaves = this.add.layer();
    this.layerFX    = this.add.layer();

    // Per-tube display arrays
    this._tubeGfx  = [];
    this._tubeGlow = [];
    this._waveGfx  = [];
    this._tubePos  = [];

    this._newLevel();

    this._spawnAmbient();

    this.input.on('pointerdown', this._onTap, this);
    this.input.keyboard.on('keydown-R', this._restartLevel, this);
    this.input.keyboard.on('keydown-U', this._undoMove,    this);
  }

  update(time) {
    this._tickWaves(time);
  }

  // ══════════════════════════════════════════════════════════
  //  COLOR PALETTE
  // ══════════════════════════════════════════════════════════
  _buildColorPalette() {
    const p = this.pal;
    this.colorPalette = [
      p.playerCore,
      p.hostile,
      p.fxAccent,
      shiftHue(p.playerCore,  60),
      shiftHue(p.hostile,     75),
      shiftHue(p.fxAccent,   -65),
      shiftHue(p.playerCore, -105),
      shiftHue(p.hostile,    -115),
    ];
  }

  // ══════════════════════════════════════════════════════════
  //  BACKGROUND
  // ══════════════════════════════════════════════════════════
  _drawBackground() {
    const W = this.scale.width, H = this.scale.height;
    const p = this.pal;

    // Gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      phColor(p.background), phColor(p.background),
      phColor(darken(p.background, 0.4)), phColor(darken(p.background, 0.4)),
      1
    );
    bg.fillRect(0, 0, W, H);

    // Dot grid
    const dots = this.add.graphics();
    dots.fillStyle(0xffffff, 0.03);
    for (let x = 22; x < W; x += 36)
      for (let y = HEADER_H + 10; y < H - 40; y += 36)
        dots.fillCircle(x, y, 1);

    // Scan lines
    const scan = this.add.graphics();
    scan.lineStyle(1, 0xffffff, 0.016);
    for (let y = HEADER_H; y < H; y += 4) scan.lineBetween(0, y, W, y);
  }

  // ══════════════════════════════════════════════════════════
  //  HEADER
  // ══════════════════════════════════════════════════════════
  _buildHeader() {
    const W = this.scale.width;
    const p = this.pal;

    const hdr = this.add.graphics();
    hdr.fillStyle(phColor(darken(p.interface, 0.08)), 0.92);
    hdr.fillRect(0, 0, W, HEADER_H);
    hdr.lineStyle(1, phColor(p.playerCore), 0.28);
    hdr.lineBetween(0, HEADER_H, W, HEADER_H);
    hdr.lineStyle(2, phColor(p.playerCore), 0.07);
    hdr.lineBetween(0, HEADER_H + 1, W, HEADER_H + 1);

    this.lblLevel = this.add.text(W / 2, HEADER_H / 2, 'LEVEL 1', {
      fontFamily: 'monospace', fontSize: '20px',
      color: '#ffffff', letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(W - 16, 14, 'MOVES', {
      fontFamily: 'monospace', fontSize: '14px',
      color: p.fxAccent, letterSpacing: 3,
    }).setOrigin(1, 0).setAlpha(0.7);

    this.lblMoves = this.add.text(W - 16, 30, '0', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
    }).setOrigin(1, 0);

    const rBtn = this.add.text(16, HEADER_H / 2, '↺  RESTART', {
      fontFamily: 'monospace', fontSize: '14px',
      color: p.playerCore, letterSpacing: 2,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    rBtn.on('pointerover', () => rBtn.setAlpha(0.6));
    rBtn.on('pointerout',  () => rBtn.setAlpha(1));
    rBtn.on('pointerdown', this._restartLevel, this);

    this.lblHint = this.add.text(W / 2, this.scale.height - 20, 'TAP A TUBE TO SELECT', {
      fontFamily: 'monospace', fontSize: '14px',
      color: '#ffffff', letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0.32);
  }

  _refreshHUD() {
    this.lblLevel.setText(`LEVEL ${this.level}`);
    this.lblMoves.setText(String(this.moves));
  }

  // ══════════════════════════════════════════════════════════
  //  LEVEL GENERATION
  // ══════════════════════════════════════════════════════════
  _newLevel() {
    this.completedSet.clear();
    this.selected = -1;
    this.pouring  = false;
    this.moves    = 0;
    this.history  = [];

    this._generateTubes();
    this._refreshHUD();
    this._layoutTubeGraphics();
    this._redrawAll();
  }

  _generateTubes() {
    const { colors: nc, tubes: nt } = getLevelConfig(this.level);
    const picked = this.colorPalette.slice(0, nc);

    let pool = [];
    picked.forEach(c => { for (let i = 0; i < TUBE_CAPACITY; i++) pool.push(c); });

    // Shuffle until no tube is pre-sorted
    let ok = false, tries = 0;
    while (!ok && tries++ < 500) {
      shuffle(pool);
      ok = true;
      for (let t = 0; t < nc; t++) {
        const sl = pool.slice(t * TUBE_CAPACITY, (t + 1) * TUBE_CAPACITY);
        if (sl.every(c => c === sl[0])) { ok = false; break; }
      }
    }

    this.tubes = [];
    for (let t = 0; t < nt; t++) {
      this.tubes.push({ layers: t < nc ? pool.splice(0, TUBE_CAPACITY) : [] });
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LAYOUT — create / recreate per-tube graphics objects
  // ══════════════════════════════════════════════════════════
  _layoutTubeGraphics() {
    // Destroy previous graphics
    this.layerTubes.removeAll(true);
    this.layerWaves.removeAll(true);

    this._tubeGfx  = [];
    this._tubeGlow = [];
    this._waveGfx  = [];
    this._tubePos  = [];

    const W = this.scale.width, H = this.scale.height;
    const n = this.tubes.length;

    const maxCols = n <= 4 ? n : Math.ceil(n / 2);
    const cols    = Math.min(n, maxCols);
    const rows    = Math.ceil(n / cols);

    const padX    = 28;
    const colStep = Math.min((W - padX * 2) / cols, TUBE_W + 38);
    const playH   = H - HEADER_H - 52;
    const rowStep = Math.min(playH / rows, TUBE_INNER_H + 72);

    const totalW  = colStep * (cols - 1);
    const totalRH = rowStep * (rows - 1);
    const startX  = W / 2 - totalW / 2;
    const startY  = HEADER_H + 16 + TUBE_INNER_H / 2 + (playH - totalRH - TUBE_INNER_H) / 2;

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = startX + col * colStep;
      const y   = startY + row * rowStep;
      this._tubePos.push({ x, y });

      const glow = this.add.graphics();
      this._tubeGlow.push(glow);
      this.layerTubes.add(glow);

      const g = this.add.graphics();
      this._tubeGfx.push(g);
      this.layerTubes.add(g);

      const wv = this.add.graphics();
      this._waveGfx.push(wv);
      this.layerWaves.add(wv);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  DRAWING
  // ══════════════════════════════════════════════════════════
  _redrawAll() {
    for (let i = 0; i < this.tubes.length; i++) this._drawTube(i);
  }

  _drawTube(i, opts = {}) {
    const p      = this.pal;
    const tube   = this.tubes[i];
    const { x, y } = this._tubePos[i];
    const g      = this._tubeGfx[i];
    const glow   = this._tubeGlow[i];
    g.clear(); glow.clear();

    const isSel   = (this.selected === i);
    const isDone  = this.completedSet.has(i);
    const isValid = !!opts.isValid;
    const wall    = 5;
    const br      = 13;
    const lx      = x - TUBE_W / 2;
    const ty      = y - TUBE_INNER_H / 2;
    const innerW  = TUBE_W - wall * 2;

    // Glow halos
    if (isSel) {
      glow.fillStyle(phColor(p.playerCore), 0.14);
      glow.fillRoundedRect(lx - 12, ty - 12, TUBE_W + 24, TUBE_INNER_H + 52, 18);
    }
    if (isDone && tube.layers[0]) {
      glow.fillStyle(phColor(tube.layers[0]), 0.22);
      glow.fillRoundedRect(lx - 14, ty - 14, TUBE_W + 28, TUBE_INNER_H + 56, 20);
    }
    if (isValid) {
      glow.fillStyle(phColor(p.fxAccent), 0.13);
      glow.fillRoundedRect(lx - 10, ty - 10, TUBE_W + 20, TUBE_INNER_H + 48, 16);
    }

    // Liquid layers
    for (let li = 0; li < tube.layers.length; li++) {
      const col  = tube.layers[li];
      const lyY  = ty + TUBE_INNER_H - (li + 1) * LAYER_H;
      const clipL = lx + wall;

      g.fillGradientStyle(phColor(lighten(col, 0.28)), phColor(lighten(col, 0.28)), phColor(col), phColor(col), 0.95);
      if (li === 0) {
        g.fillRoundedRect(clipL, lyY, innerW, LAYER_H, { bl: br - 2, br: br - 2, tl: 0, tr: 0 });
      } else {
        g.fillRect(clipL, lyY, innerW, LAYER_H);
        g.lineStyle(1, 0xffffff, 0.10);
        g.lineBetween(clipL, lyY + LAYER_H, clipL + innerW, lyY + LAYER_H);
      }
      g.fillStyle(0xffffff, 0.07);
      g.fillRect(clipL, lyY, innerW * 0.28, LAYER_H);
    }

    // Glass walls
    g.fillStyle(phColor(p.interface), 0.62);
    g.fillRect(lx, ty, wall, TUBE_INNER_H + wall);
    g.fillRect(lx + TUBE_W - wall, ty, wall, TUBE_INNER_H + wall);
    g.fillRoundedRect(lx, ty + TUBE_INNER_H, TUBE_W, wall * 3.5, br);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(lx + wall, ty, 3, TUBE_INNER_H);

    // Border
    const bc  = isSel  ? phColor(p.playerCore)
              : isDone ? phColor(tube.layers[0] || p.playerCore)
              : isValid ? phColor(p.fxAccent)
              : 0x2a3a4a;
    const ba  = isSel ? 0.9 : isDone ? 0.85 : isValid ? 0.75 : 0.35;
    const bw  = isSel || isDone ? 2 : 1.5;
    g.lineStyle(bw, bc, ba);
    g.lineBetween(lx, ty, lx, ty + TUBE_INNER_H + wall);
    g.lineBetween(lx + TUBE_W, ty, lx + TUBE_W, ty + TUBE_INNER_H + wall);
    g.strokeRoundedRect(lx, ty + TUBE_INNER_H - wall / 2, TUBE_W, wall * 4, br);
    g.lineStyle(bw, bc, ba * 0.5);
    g.lineBetween(lx, ty, lx + TUBE_W, ty);

    // Empty guide dashes
    if (tube.layers.length === 0) {
      g.lineStyle(1, 0x2a4050, 0.35);
      for (let li = 0; li < TUBE_CAPACITY; li++) {
        const lineY = ty + TUBE_INNER_H - (li + 1) * LAYER_H;
        g.lineBetween(lx + wall + 4, lineY + LAYER_H - 1, lx + TUBE_W - wall - 4, lineY + LAYER_H - 1);
      }
    }

    // Completion badge
    if (isDone && tube.layers[0]) {
      const by = ty - 20;
      g.fillStyle(phColor(tube.layers[0]), 1);
      g.fillCircle(x, by, 11);
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(x - 5, by, x - 1, by + 4);
      g.lineBetween(x - 1, by + 4, x + 7, by - 5);
    }
  }

  _tickWaves(time) {
    if (!this._waveGfx || this._waveGfx.length === 0) return;
    const t = time * 0.0022;
    for (let i = 0; i < this.tubes.length; i++) {
      const wv = this._waveGfx[i];
      if (!wv) continue;
      wv.clear();
      const tube = this.tubes[i];
      if (tube.layers.length === 0) continue;
      const { x, y }  = this._tubePos[i];
      const wall      = 5;
      const lx        = x - TUBE_W / 2;
      const ty        = y - TUBE_INNER_H / 2;
      const innerW    = TUBE_W - wall * 2;
      const topIdx    = tube.layers.length - 1;
      const surfaceY  = ty + TUBE_INNER_H - (topIdx + 1) * LAYER_H;
      const col       = lighten(tube.layers[topIdx], 0.55);

      wv.lineStyle(2, phColor(col), 0.5);
      wv.beginPath();
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const px = lx + wall + (innerW / steps) * s;
        const py = surfaceY + Math.sin(t + s * 0.9 + i * 1.3) * WAVE_AMP;
        s === 0 ? wv.moveTo(px, py) : wv.lineTo(px, py);
      }
      wv.strokePath();

      wv.fillStyle(0xffffff, 0.28);
      wv.fillCircle(
        lx + wall + innerW * 0.28,
        surfaceY + Math.sin(t + 1.5 + i) * WAVE_AMP - 1.5,
        2
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  //  INPUT
  // ══════════════════════════════════════════════════════════
  _onTap(pointer) {
    if (this.pouring) return;

    let hit = -1;
    const hw = (TUBE_W + 28) / 2, hh = (TUBE_INNER_H + 60) / 2;
    for (let i = 0; i < this._tubePos.length; i++) {
      const { x, y } = this._tubePos[i];
      if (pointer.x >= x - hw && pointer.x <= x + hw &&
          pointer.y >= y - hh && pointer.y <= y + hh) {
        hit = i; break;
      }
    }

    if (hit === -1) { this._deselect(); return; }

    if (this.selected === -1) {
      if (this.tubes[hit].layers.length === 0) return;
      if (this.completedSet.has(hit)) return;
      this.selected = hit;
      this._playTick(880, 0.08);
      this._highlightValidTargets();
      this._bounceUp(hit);
      this.lblHint.setText('TAP DESTINATION TUBE');
    } else {
      if (hit === this.selected) { this._deselect(); return; }
      if (this._canPour(this.selected, hit)) {
        this._executePour(this.selected, hit);
      } else {
        this._shakeRed(hit);
        this._deselect();
      }
    }
  }

  _deselect() {
    this.selected = -1;
    this._redrawAll();
    this.lblHint.setText('TAP A TUBE TO SELECT');
  }

  _highlightValidTargets() {
    for (let i = 0; i < this.tubes.length; i++) {
      if (i === this.selected) {
        this._drawTube(i);
      } else if (this._canPour(this.selected, i)) {
        this._drawTube(i, { isValid: true });
      } else {
        this._drawTube(i);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  GAME LOGIC
  // ══════════════════════════════════════════════════════════
  _canPour(from, to) {
    if (from === to) return false;
    const src = this.tubes[from], dst = this.tubes[to];
    if (src.layers.length === 0) return false;
    if (dst.layers.length >= TUBE_CAPACITY) return false;
    if (this.completedSet.has(to)) return false;
    if (dst.layers.length === 0) return true;
    return src.layers[src.layers.length - 1] === dst.layers[dst.layers.length - 1];
  }

  _countPourable(from, to) {
    const src      = this.tubes[from], dst = this.tubes[to];
    const topColor = src.layers[src.layers.length - 1];
    const space    = TUBE_CAPACITY - dst.layers.length;
    let count = 0;
    for (let i = src.layers.length - 1; i >= 0 && count < space; i--) {
      if (src.layers[i] === topColor) count++;
      else break;
    }
    return count;
  }

  _executePour(from, to) {
    const count = this._countPourable(from, to);
    if (count === 0) { this._deselect(); return; }

    this.history.push(this.tubes.map(t => ({ layers: [...t.layers] })));
    if (this.history.length > 40) this.history.shift();

    const color    = this.tubes[from].layers[this.tubes[from].layers.length - 1];
    const dstDepth = this.tubes[to].layers.length;

    this.tubes[from].layers.splice(-count, count);

    this.moves++;
    this.selected = -1;
    this.pouring  = true;
    this._refreshHUD();
    this.lblHint.setText('');
    this._drawTube(from);   

    this._animPour(from, to, count, color, dstDepth, () => {
      for (let i = 0; i < count; i++) this.tubes[to].layers.push(color);
      this.pouring = false;

      this._checkComplete(from);
      this._checkComplete(to);
      this._redrawAll();
      this.lblHint.setText('TAP A TUBE TO SELECT');

      if (this._isLevelDone()) {
        this.time.delayedCall(450, this._showWin, [], this);
      }
    });
  }

  _undoMove() {
    if (this.pouring || this.history.length === 0) return;
    this.tubes = this.history.pop();
    this.selected = -1;
    this.completedSet.clear();
    for (let i = 0; i < this.tubes.length; i++) this._checkCompleteQuiet(i);
    this._redrawAll();
    this.moves = Math.max(0, this.moves - 1);
    this._refreshHUD();
    this.lblHint.setText('TAP A TUBE TO SELECT');
  }

  _restartLevel() {
    if (this.pouring) return;
    this.layerFX.removeAll(true);
    this._newLevel();
  }

  _checkComplete(i) {
    const tube = this.tubes[i];
    if (tube.layers.length === TUBE_CAPACITY &&
        tube.layers.every(c => c === tube.layers[0])) {
      if (!this.completedSet.has(i)) {
        this.completedSet.add(i);
        this._burstComplete(i);
        this._playComplete();
      }
    }
  }

  _checkCompleteQuiet(i) {
    const tube = this.tubes[i];
    if (tube.layers.length === TUBE_CAPACITY &&
        tube.layers.every(c => c === tube.layers[0])) {
      this.completedSet.add(i);
    }
  }

  _isLevelDone() {
    return this.tubes.every((t, i) =>
      t.layers.length === 0 || this.completedSet.has(i)
    );
  }

  // ══════════════════════════════════════════════════════════
  //  POUR ANIMATION
  // ══════════════════════════════════════════════════════════
  _animPour(from, to, count, color, dstDepth, onDone) {
    const srcPos   = this._tubePos[from];
    const dstPos   = this._tubePos[to];

    const srcX     = srcPos.x;
    const srcY     = srcPos.y - TUBE_INNER_H / 2 - 14;
    const dstX     = dstPos.x;
    const dstBaseY = dstPos.y + TUBE_INNER_H / 2;
    const dstFillY = dstBaseY - dstDepth * LAYER_H;

    const cpX = (srcX + dstX) / 2;
    const cpY = Math.min(srcY, dstFillY) - 52 - Math.abs(srcX - dstX) * 0.16;

    const colMain  = phColor(color);
    const colLight = phColor(lighten(color, 0.45));

    const pourGfx = this.add.graphics();
    this.layerFX.add(pourGfx);

    const startMs = this.time.now;
    this._playPour(count, dstDepth);

    const tick = () => {
      const elapsed = this.time.now - startMs;
      const raw     = Math.min(elapsed / POUR_MS, 1);
      const ease    = 1 - Math.pow(1 - raw, 3);

      pourGfx.clear();

      const STEPS = 18;
      for (let s = 0; s <= STEPS; s++) {
        const st   = (s / STEPS) * ease;
        const bx   = bezier(srcX, cpX, dstX, st);
        const by   = bezier(srcY, cpY, dstFillY, st);
        const size = 4 + Math.sin(st * Math.PI) * 6;
        pourGfx.fillStyle(colLight, 0.88 - st * 0.22);
        pourGfx.fillCircle(bx, by, size);
      }

      if (ease > 0.42) {
        const fillPct = (ease - 0.42) / 0.58;
        const fillH   = fillPct * count * LAYER_H;
        const innerW  = TUBE_W - 10;
        pourGfx.fillStyle(colMain, 0.88);
        pourGfx.fillRect(dstX - innerW / 2, dstFillY - fillH, innerW, fillH);
      }

      if (ease > 0.08 && ease < 0.92) {
        const t2   = (ease * 6) % 1;
        const dropX = bezier(srcX, cpX, dstX, ease * 0.78);
        const dropY = bezier(srcY, cpY, dstFillY, ease * 0.78) + t2 * 16;
        pourGfx.fillStyle(colLight, (1 - t2) * 0.55);
        pourGfx.fillCircle(dropX, dropY, 3);
      }

      if (raw < 1) {
        this.time.delayedCall(14, tick);
      } else {
        pourGfx.destroy();
        onDone();
      }
    };
    tick();
  }

  // ══════════════════════════════════════════════════════════
  //  CELEBRATIONS
  // ══════════════════════════════════════════════════════════
  _burstComplete(i) {
    const { x, y } = this._tubePos[i];
    const color     = this.tubes[i].layers[0];
    const col       = phColor(color);
    const colL      = phColor(lighten(color, 0.5));

    const ring = this.add.graphics();
    this.layerFX.add(ring);
    this.tweens.add({
      targets: { r: 12, alpha: 0.7 },
      r: 75, alpha: 0,
      duration: 580,
      ease: 'Power2',
      onUpdate: (tw, tgt) => {
        ring.clear();
        ring.lineStyle(3, col, tgt.alpha);
        ring.strokeCircle(x, y, tgt.r);
      },
      onComplete: () => ring.destroy(),
    });

    for (let s = 0; s < 20; s++) {
      const angle = (s / 20) * Math.PI * 2;
      const speed = 60 + Math.random() * 95;
      const vx    = Math.cos(angle) * speed;
      const vy    = Math.sin(angle) * speed - 75;
      const sp    = this.add.graphics();
      this.layerFX.add(sp);
      this.tweens.add({
        targets: { sz: 4, alpha: 1 },
        sz: 0.3, alpha: 0,
        duration: 620 + Math.random() * 260,
        ease: 'Power2',
        onUpdate: (tw, tgt) => {
          sp.clear();
          sp.fillStyle(colL, tgt.alpha);
          sp.fillCircle(
            x + vx * tw.progress,
            y + vy * tw.progress + 170 * tw.progress * tw.progress,
            tgt.sz
          );
        },
        onComplete: () => sp.destroy(),
      });
    }
  }

  _showWin() {
    const W  = this.scale.width, H = this.scale.height;
    const p  = this.pal;
    const cx = W / 2;

    this._confettiRain();

    const dim = this.add.graphics();
    dim.alpha = 0;
    this.layerFX.add(dim);
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, W, H);
    this.tweens.add({ targets: dim, alpha: 1, duration: 380 });

    const pW = Math.min(320, W - 48), pH = 272;
    const pX = cx - pW / 2, pY = H / 2 - pH / 2;

    const panel = this.add.graphics();
    panel.alpha = 0;
    this.layerFX.add(panel);
    // Explicitly use the dark interface color for the panel
    panel.fillStyle(phColor(darken(p.interface, 0.05)), 0.97);
    panel.fillRoundedRect(pX, pY, pW, pH, 22);
    panel.lineStyle(2, phColor(p.playerCore), 0.75);
    panel.strokeRoundedRect(pX, pY, pW, pH, 22);
    panel.lineStyle(6, phColor(p.playerCore), 0.07);
    panel.strokeRoundedRect(pX - 2, pY - 2, pW + 4, pH + 4, 24);

    const mkText = (txt, x2, y2, size, color) => {
      const t = this.add.text(x2, y2, txt, {
        fontFamily: 'monospace', fontSize: size, color, letterSpacing: 5,
      }).setOrigin(0.5).setAlpha(0);
      this.layerFX.add(t);
      return t;
    };

    const title    = mkText('SORTED!', cx, pY + 60, '40px', p.playerCore);
    const sub      = mkText(`LEVEL  ${this.level}  COMPLETE`, cx, pY + 112, '12px', '#aabbcc');
    const moveTxt  = mkText(`${this.moves} MOVE${this.moves !== 1 ? 'S' : ''}`, cx, pY + 150, '24px', p.fxAccent);

    const btnW = 170, btnH = 46;
    const btnX = cx - btnW / 2, btnY = pY + pH - 78;

    const btnGfx = this.add.graphics();
    btnGfx.alpha = 0;
    this.layerFX.add(btnGfx);
    btnGfx.fillStyle(phColor(p.playerCore), 1);
    btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 10);

    const btnTxt = mkText('NEXT LEVEL  →', cx, btnY + btnH / 2, '14px', darken(p.background, -0.5) || '#000000');
    btnTxt.setStyle({ color: '#000000' });

    const undoTxt = mkText('UNDO  [U]   RESTART  [R]', cx, btnY + btnH + 20, '10px', p.fxAccent);
    undoTxt.setAlpha(0);
    this.layerFX.add(undoTxt);

    this.tweens.add({
      targets: [panel, title, sub, moveTxt, btnGfx, btnTxt, undoTxt],
      alpha: 1,
      duration: 500,
      delay: 180,
      ease: 'Power2',
    });
    undoTxt.setAlpha(0);
    this.tweens.add({ targets: undoTxt, alpha: 0.6, duration: 500, delay: 300 });

    const hitNext = this.add.rectangle(cx, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001);
    this.layerFX.add(hitNext);

    hitNext.on('pointerover', () => { btnGfx.setAlpha(0.75); });
    hitNext.on('pointerout',  () => { btnGfx.setAlpha(1); });
    hitNext.on('pointerdown', () => {
      hitNext.disableInteractive();

      // EXPLICIT AD TRIGGER
      if (this.level % 5 === 0) {
        try {
          ['showAd','showVideoAd','playAd','displayAd'].forEach(fn=>{
            if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
          });
        } catch(_){}
      }

      window.FreshPlay.levelComplete(() => {
        this.level++;
        this.registry.set('level', this.level);
        this.layerFX.removeAll(true);
        this._newLevel();
      });
    });
  }

  _confettiRain() {
    const W    = this.scale.width;
    const cols = this.colorPalette.map(c => phColor(c));
    for (let i = 0; i < 72; i++) {
      const cx2  = Math.random() * W;
      const size = 5 + Math.random() * 7;
      const col  = cols[Math.floor(Math.random() * cols.length)];
      const vx   = (Math.random() - 0.5) * 85;
      const dur  = 1300 + Math.random() * 1000;
      const g    = this.add.graphics();
      this.layerFX.add(g);
      this.tweens.add({
        targets: { py: -24, prog: 0 },
        py: this.scale.height + 30,
        prog: 1,
        duration: dur,
        delay: Math.random() * 750,
        ease: 'Linear',
        onUpdate: (tw, tgt) => {
          g.clear();
          g.fillStyle(col, 1 - tgt.prog * 0.45);
          g.fillRect(
            cx2 + vx * tgt.prog + Math.sin(tgt.prog * 11) * 12,
            tgt.py,
            size, size * 0.55
          );
        },
        onComplete: () => g.destroy(),
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  //  MICRO FEEDBACK
  // ══════════════════════════════════════════════════════════
  _bounceUp(i) {
    const g = this._tubeGfx[i];
    this.tweens.add({ targets: g, y: '-=10', duration: 105, yoyo: true, ease: 'Power2' });
  }

  _shakeRed(i) {
    const g = this._tubeGfx[i];
    this.tweens.add({
      targets: g, x: '+=9', duration: 44, yoyo: true, repeat: 3, ease: 'Linear',
      onComplete: () => { g.x = 0; },
    });
    const { x, y } = this._tubePos[i];
    const flash = this.add.graphics();
    this.layerFX.add(flash);
    flash.fillStyle(0xff1133, 0.28);
    flash.fillRoundedRect(x - TUBE_W / 2 - 10, y - TUBE_INNER_H / 2 - 10, TUBE_W + 20, TUBE_INNER_H + 50, 14);
    this.tweens.add({ targets: flash, alpha: 0, duration: 270, onComplete: () => flash.destroy() });
  }

  // ══════════════════════════════════════════════════════════
  //  AMBIENT PARTICLES
  // ══════════════════════════════════════════════════════════
  _spawnAmbient() {
    const W = this.scale.width, H = this.scale.height;
    const p = this.pal;
    const spawn = () => {
      if (!this.scene || !this.scene.isActive('ChromaSort')) return;
      const px  = Math.random() * W;
      const col = Math.random() < 0.5 ? phColor(p.playerCore) : phColor(p.fxAccent);
      const sz  = 1 + Math.random() * 1.8;
      const wob = (Math.random() - 0.5) * 24;
      const g   = this.add.graphics();
      g.fillStyle(col, 0.55);
      g.fillCircle(px, H + 4, sz);
      this.tweens.add({
        targets: { py: H + 4, prog: 0 },
        py: -12, prog: 1,
        duration: 5500 + Math.random() * 5000,
        ease: 'Linear',
        onUpdate: (tw, tgt) => {
          g.clear();
          g.fillStyle(col, 0.55 * (1 - tgt.prog));
          g.fillCircle(px + Math.sin(tgt.prog * 9) * wob, tgt.py, sz);
        },
        onComplete: () => g.destroy(),
      });
      this.time.delayedCall(220 + Math.random() * 680, spawn);
    };
    spawn();
  }

  // ══════════════════════════════════════════════════════════
  //  AUDIO
  // ══════════════════════════════════════════════════════════
  _getACtx() {
    if (!this._actx) {
      try { this._actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { /* no audio */ }
    }
    return this._actx;
  }

  _playTick(freq, gain = 0.12, type = 'sine', dur = 0.1) {
    const ctx = this._getACtx(); if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.connect(amp); amp.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      amp.gain.setValueAtTime(gain, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch (e) { /* silenced */ }
  }

  _playPour(count, dstDepth) {
    for (let i = 0; i < count; i++) {
      const freq = 290 + (dstDepth + i) * 98;
      this.time.delayedCall(i * (POUR_MS / count / 1.5), () => {
        this._playTick(freq, 0.065, 'sine', 0.22);
      });
    }
  }

  _playComplete() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.time.delayedCall(i * 72, () => this._playTick(f, 0.11, 'sine', 0.35))
    );
  }
}

// ============================================================
//  BOOT
// ============================================================
function bootChromaSort() {
  if (window._chromaSortInst) return;
  window._chromaSortInst = new Phaser.Game({
    type: Phaser.AUTO,
    width: 500, height: 820,
    backgroundColor: '#07080f',
    parent: 'game-container',
    scene: [ChromaSortScene],
    // FIX: Disabled autoCenter so the index.html Flexbox layout flawlessly centers the canvas
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, powerPreference: 'high-performance' },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootChromaSort);
} else {
  bootChromaSort();
}
