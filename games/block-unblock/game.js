// ============================================================
//  BLOCK UNBLOCK — Luxury Sliding Puzzle
// ============================================================

// FreshPlay shim (safe fallback when SDK is absent)
if (typeof window.FreshPlay === 'undefined') {
	window.FreshPlay = {
		currentLevel: 1,
		levelComplete: function (cb) {
			this.currentLevel++;
			setTimeout(cb, 1200);
		},
		getCurrentPalette: () => ({
			background: '#0a0e1a', playerCore: '#00e5ff', hostile: '#ff2d6b', fxAccent: '#ffaa00', interface: '#1e293b'
		}),
	};
}

// PERFECTLY CENTERED LAYOUT CONSTANTS
const CELL = 80, COLS = 6, ROWS = 6, GAP = 5;
const W = 800, H = 820;
const GX = (W - COLS * CELL) / 2;   // 160 — Horizontally centred
const GY = 180;                     // Mathematically balanced vertically
const EXIT_ROW = 2;
const BLOCK_RADIUS = 10;
const SNAP_DURATION = 140;

/* ROBUST COLOR PARSERS */
function getPalette() {
	try {
		const p = window.FreshPlay && window.FreshPlay.getCurrentPalette
			? window.FreshPlay.getCurrentPalette() : null;
		return (p && p.background) ? p : defaultPalette();
	} catch (_) { return defaultPalette(); }
}
function defaultPalette() {
	return { background: '#0a0e1a', playerCore: '#00e5ff', hostile: '#ff2d6b', fxAccent: '#ffaa00', interface: '#1e293b' };
}

// Safely converts both Strings and Ints to Number for Graphics
function hex2int(hex) {
	if (typeof hex === 'number') return hex;
	return parseInt((hex || '#000000').replace('#', ''), 16);
}

// Safely converts both Strings and Ints to CSS String for Text
function hexToStr(h) {
	if (typeof h === 'string') return h.startsWith('#') ? h : '#' + h;
	if (typeof h === 'number') return '#' + h.toString(16).padStart(6, '0');
	return '#00e5ff';
}

function lerpColor(c, t, target = 0x0f172a) {
	const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
	const tr = (target >> 16) & 0xff, tg = (target >> 8) & 0xff, tb = target & 0xff;
	return (Math.round(r + (tr - r) * t) << 16) | (Math.round(g + (tg - g) * t) << 8) | Math.round(b + (tb - b) * t);
}

/* ══════════════════════════════════════════════════════════════
	 WEB AUDIO SFX — fully synthesised, zero external files
══════════════════════════════════════════════════════════════ */
const SFX = (() => {
	let _ctx = null;
	function ctx() {
		if (!_ctx) try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
		if (_ctx.state === 'suspended') _ctx.resume().catch(() => { });
		return _ctx;
	}
	function tone(freq, endFreq, dur, vol = 0.13, type = 'sine') {
		const c = ctx(); if (!c) return;
		const o = c.createOscillator(), g = c.createGain();
		o.type = type; o.connect(g); g.connect(c.destination);
		o.frequency.setValueAtTime(freq, c.currentTime);
		if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + dur);
		g.gain.setValueAtTime(vol, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
		o.start(c.currentTime); o.stop(c.currentTime + dur);
	}
	return {
		pickup() { tone(380, 560, 0.07, 0.08); },
		slide() { tone(520, 180, 0.10, 0.11, 'sawtooth'); },
		snap() { tone(240, 200, 0.06, 0.07); },
		bump() {
			const c = ctx(); if (!c) return;
			const n = (c.sampleRate * 0.07) | 0, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
			for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
			const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
			flt.type = 'lowpass'; flt.frequency.value = 260;
			src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(c.destination);
			g.gain.value = 0.5; src.start();
		},
		win() {
			const c = ctx(); if (!c) return;
			[523, 659, 784, 1047].forEach((freq, i) => {
				const o = c.createOscillator(), g = c.createGain();
				o.type = 'triangle'; o.connect(g); g.connect(c.destination);
				const t = c.currentTime + i * 0.14;
				o.frequency.setValueAtTime(freq, t);
				g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.05);
				g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
				o.start(t); o.stop(t + 0.5);
			});
		}
	};
})();

/* ══════════════════════════════════════════════════════════════
	 BFS SOLVER — verifies solvability (master exits right edge)
══════════════════════════════════════════════════════════════ */
function isSolvable(defs) {
	const mi = defs.findIndex(b => b.isMaster);
	if (mi < 0) return false;

	function encode(pos) { return pos.map(p => p.r * 6 + p.c).join(','); }

	function nextStates(pos) {
		const g = [];
		for (let r = 0; r < ROWS; r++) g.push(new Int8Array(COLS).fill(-1));
		pos.forEach((p, i) => {
			const b = defs[i];
			if (b.dir === 'H') { for (let c = p.c; c < p.c + b.len && c < COLS; c++) g[p.r][c] = i; }
			else { for (let r = p.r; r < p.r + b.len && r < ROWS; r++) g[r][p.c] = i; }
		});
		const out = [];
		pos.forEach((p, i) => {
			const b = defs[i];
			if (b.dir === 'H') { for (let c = p.c; c < p.c + b.len && c < COLS; c++) g[p.r][c] = -1; }
			else { for (let r = p.r; r < p.r + b.len && r < ROWS; r++) g[r][p.c] = -1; }
			if (b.dir === 'H') {
				for (let nc = p.c - 1; nc >= 0 && g[p.r][nc] === -1; nc--)
					out.push(pos.map((x, j) => j === i ? { r: x.r, c: nc } : x));
				for (let nc = p.c + 1; nc + b.len - 1 < COLS && g[p.r][nc + b.len - 1] === -1; nc++)
					out.push(pos.map((x, j) => j === i ? { r: x.r, c: nc } : x));
			} else {
				for (let nr = p.r - 1; nr >= 0 && g[nr][p.c] === -1; nr--)
					out.push(pos.map((x, j) => j === i ? { r: nr, c: x.c } : x));
				for (let nr = p.r + 1; nr + b.len - 1 < ROWS && g[nr + b.len - 1][p.c] === -1; nr++)
					out.push(pos.map((x, j) => j === i ? { r: nr, c: x.c } : x));
			}
			if (b.dir === 'H') { for (let c = p.c; c < p.c + b.len && c < COLS; c++) g[p.r][c] = i; }
			else { for (let r = p.r; r < p.r + b.len && r < ROWS; r++) g[r][p.c] = i; }
		});
		return out;
	}

	const init = defs.map(b => ({ r: b.row, c: b.col }));
	const visited = new Set([encode(init)]);
	const queue = [init]; let head = 0, iter = 0;

	while (head < queue.length && iter++ < 2500) {
		const pos = queue[head++];
		if (pos[mi].c + defs[mi].len >= COLS) return true;
		for (const np of nextStates(pos)) {
			const k = encode(np);
			if (!visited.has(k)) { visited.add(k); queue.push(np); }
		}
	}
	return false;
}

/* ══════════════════════════════════════════════════════════════
	 PROCEDURAL LEVEL GENERATOR
══════════════════════════════════════════════════════════════ */
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i);[a[i], a[j]] = [a[j], a[i]]; } return a; }

function fits(grid, row, col, len, dir) {
	if (dir === 'H') {
		if (col < 0 || col + len > COLS || row < 0 || row >= ROWS) return false;
		for (let c = col; c < col + len; c++) if (grid[row][c]) return false;
	} else {
		if (row < 0 || row + len > ROWS || col < 0 || col >= COLS) return false;
		for (let r = row; r < row + len; r++) if (grid[r][col]) return false;
	}
	return true;
}
function stamp(grid, b) {
	if (b.dir === 'H') { for (let c = b.col; c < b.col + b.len; c++) grid[b.row][c] = true; }
	else { for (let r = b.row; r < b.row + b.len; r++) grid[r][b.col] = true; }
}

function tryGenerate(diff) {
	const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
	const blocks = [];

	const master = { row: EXIT_ROW, col: 0, len: 2, dir: 'H', isMaster: true };
	blocks.push(master); stamp(grid, master);

	const numV = Math.max(1, Math.min(diff, 4));
	const pathCols = shuffle([2, 3, 4, 5]);
	for (const pc of pathCols) {
		if (blocks.length - 1 >= numV) break;
		const len = Math.random() < 0.55 ? 2 : 3;
		const starts = [];
		for (let r = Math.max(0, EXIT_ROW - len + 1); r <= EXIT_ROW && r + len <= ROWS; r++)
			if (fits(grid, r, pc, len, 'V')) starts.push(r);
		if (!starts.length) continue;
		const r2 = starts[rnd(0, starts.length - 1)];
		const b = { row: r2, col: pc, len, dir: 'V' };
		blocks.push(b); stamp(grid, b);
	}
	if (blocks.length < 2) return null;

	const numCascade = Math.max(0, Math.min(diff - 2, 4));
	let cascAtt = 0;
	for (let ci = 0; ci < numCascade && cascAtt < 100; ci++, cascAtt++) {
		const vbs = blocks.filter(b => b.dir === 'V' && !b.isMaster);
		if (!vbs.length) break;
		const vb = vbs[rnd(0, vbs.length - 1)];
		const tryRow = vb.row === 0 ? vb.row + vb.len : vb.row - 1;
		if (tryRow < 0 || tryRow >= ROWS) continue;
		const len = Math.random() < 0.6 ? 2 : 3;
		for (let att = 0; att < 10; att++) {
			const col = rnd(0, COLS - len);
			if (fits(grid, tryRow, col, len, 'H')) {
				const b = { row: tryRow, col, len, dir: 'H' };
				blocks.push(b); stamp(grid, b); break;
			}
		}
	}

	const target = Math.min(blocks.length + 2 + Math.min(diff, 5), 13);
	let att = 0;
	while (blocks.length < target && att++ < 300) {
		const dir = Math.random() < 0.5 ? 'H' : 'V';
		const len = Math.random() < 0.6 ? 2 : 3;
		if (dir === 'H') {
			const row = rnd(0, ROWS - 1), col = rnd(0, COLS - len);
			if (fits(grid, row, col, len, 'H')) { const b = { row, col, len, dir }; blocks.push(b); stamp(grid, b); }
		} else {
			const col = rnd(0, COLS - 1), row = rnd(0, ROWS - len);
			if (fits(grid, row, col, len, 'V')) { const b = { row, col, len, dir }; blocks.push(b); stamp(grid, b); }
		}
	}
	return blocks;
}

function generateLevel(levelIdx) {
	const diff = Math.min(1 + Math.floor(levelIdx / 2), 9);

	for (let i = 0; i < 100; i++) {
		const b = tryGenerate(diff);
		if (b && isSolvable(b)) return b;
	}
	return [
		{ row: EXIT_ROW, col: 0, len: 2, dir: 'H', isMaster: true },
		{ row: 1, col: 3, len: 2, dir: 'V' },
		{ row: 4, col: 1, len: 3, dir: 'H' },
	];
}

/* ══════════════════════════════════════════════════════════════
	 GAME SCENE
══════════════════════════════════════════════════════════════ */
class GameScene extends Phaser.Scene {
	constructor() { super({ key: 'GameScene' }); }

	init() {
		this.levelIdx = window.FreshPlay && window.FreshPlay.currentLevel ? window.FreshPlay.currentLevel - 1 : 0;
		this.pal = getPalette();
		this.moves = 0;
		this.score = 0;
		this.transitioning = false;
		this.dragBlock = null;
		this.blockObjects = [];
		this.grid = null;
		this._hitMin = false;
		this._hitMax = false;
	}

	create() {
		this._buildBG();
		this._buildHUD();
		this._buildExit();
		this._loadLevel(this.levelIdx);
		this.input.on('pointerdown', this._onDown, this);
		this.input.on('pointermove', this._onMove, this);
		this.input.on('pointerup', this._onUp, this);
		this.input.on('pointerupoutside', this._onUp, this);
	}

	/* BACKGROUND */
	_buildBG() {
		const ic = hex2int(this.pal.interface), ac = hex2int(this.pal.fxAccent);
		this.cameras.main.setBackgroundColor(hex2int(this.pal.background));

		const dots = this.add.graphics();
		for (let x = 20; x < W; x += 32) for (let y = 20; y < H; y += 32) {
			dots.fillStyle(0x3b82f6, 0.022); dots.fillCircle(x, y, 1.2);
		}

		const cells = this.add.graphics();
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			cells.fillStyle(0x3b82f6, 0.028);
			cells.fillRoundedRect(GX + c * CELL + 2, GY + r * CELL + 2, CELL - 4, CELL - 4, 6);
		}

		const brd = this.add.graphics();
		brd.lineStyle(1.5, ic, 0.55); brd.strokeRect(GX - 1, GY - 1, COLS * CELL + 2, ROWS * CELL + 2);
		brd.lineStyle(8, ic, 0.05); brd.strokeRect(GX - 4, GY - 4, COLS * CELL + 8, ROWS * CELL + 8);

		const CS = 20, corners = [[GX - 3, GY - 3, 1, 1], [GX + COLS * CELL + 3, GY - 3, -1, 1],
		[GX - 3, GY + ROWS * CELL + 3, 1, -1], [GX + COLS * CELL + 3, GY + ROWS * CELL + 3, -1, -1]];
		const br = this.add.graphics(); br.lineStyle(2.5, ac, 0.9);
		corners.forEach(([cx, cy, dx, dy]) => {
			br.beginPath(); br.moveTo(cx, cy + dy * CS); br.lineTo(cx, cy); br.lineTo(cx + dx * CS, cy); br.strokePath();
		});

		const sc = this.add.graphics();
		for (let y = GY; y < GY + ROWS * CELL; y += 8) { sc.lineStyle(1, 0x3b82f6, 0.015); sc.lineBetween(GX, y, GX + COLS * CELL, y); }

		const dv = this.add.graphics();
		for (let c = 1; c < COLS; c++) { dv.lineStyle(1, ic, 0.10); dv.lineBetween(GX + c * CELL, GY, GX + c * CELL, GY + ROWS * CELL); }
		for (let r = 1; r < ROWS; r++) { dv.lineStyle(1, ic, 0.10); dv.lineBetween(GX, GY + r * CELL, GX + COLS * CELL, GY + r * CELL); }
	}

	/* EXIT MARKER */
	_buildExit() {
		const pcInt = hex2int(this.pal.playerCore);
		const pcStr = hexToStr(this.pal.playerCore);
		const bgInt = hex2int(this.pal.background);

		const ex = GX + COLS * CELL, ey = GY + EXIT_ROW * CELL;

		const gap = this.add.graphics();
		gap.fillStyle(bgInt, 1);
		gap.fillRect(ex - 2, ey + 4, 6, CELL - 8);

		const lane = this.add.graphics();
		for (let i = 3; i >= 0; i--) { lane.fillStyle(pcInt, 0.04 + i * 0.02); lane.fillRect(ex, ey + 2 + i * 2, 60 - i * 8, CELL - 4 - i * 4); }

		this._exitArrows = [];
		for (let i = 0; i < 3; i++) {
			const g = this.add.graphics(), ax = ex + 14 + i * 16, ay = ey + CELL / 2;
			g.fillStyle(pcInt, 1); g.fillTriangle(ax, ay - 7, ax + 11, ay, ax, ay + 7);
			this._exitArrows.push(g);
			this.tweens.add({ targets: g, alpha: { from: 0, to: 0.75 }, duration: 500, yoyo: true, repeat: -1, delay: i * 160, ease: 'Sine.easeInOut' });
		}

		this.add.text(ex + 12, ey + CELL + 10, 'EXIT', { fontSize: '9px', fontFamily: "'Courier New',monospace", color: pcStr, letterSpacing: 3 }).setOrigin(0, 0).setAlpha(0.55);
	}

	/* HUD */
	_buildHUD() {
		const icInt = hex2int(this.pal.interface);
		const icStr = hexToStr(this.pal.interface);
		const acStr = hexToStr(this.pal.fxAccent);
		const pcStr = hexToStr(this.pal.playerCore);

		this.add.text(W / 2, 30, 'BLOCK  UNBLOCK', { fontSize: '24px', fontFamily: "'Courier New',monospace", color: '#e2e8f0', letterSpacing: 9 }).setOrigin(0.5);
		const sep = this.add.graphics(); sep.lineStyle(1, icInt, 0.22); sep.lineBetween(GX, 55, GX + COLS * CELL, 55);

		const boxY = 75, boxH = 64, bxW = 120;
		[{ label: 'LEVEL', x: GX }, { label: 'MOVES', x: W / 2 - bxW / 2 }, { label: 'SCORE', x: GX + COLS * CELL - bxW }].forEach(({ label, x }) => {
			const bg2 = this.add.graphics();
			bg2.fillStyle(0x3b82f6, 0.03); bg2.fillRoundedRect(x, boxY, bxW, boxH, 6);
			bg2.lineStyle(1, icInt, 0.20); bg2.strokeRoundedRect(x, boxY, bxW, boxH, 6);
			this.add.text(x + 10, boxY + 10, label, { fontSize: '10px', fontFamily: "'Courier New',monospace", color: icStr, letterSpacing: 2 }).setAlpha(0.65);
		});

		const tcfg = { fontSize: '26px', fontFamily: "'Courier New',monospace" };
		this.levelText = this.add.text(GX + 10, boxY + 28, '01', { ...tcfg, color: acStr });
		this.movesText = this.add.text(W / 2 - bxW / 2 + 10, boxY + 28, '000', { ...tcfg, color: pcStr });
		this.scoreText = this.add.text(GX + COLS * CELL - bxW + 10, boxY + 28, '00000', { ...tcfg, color: '#e2e8f0' });
		const sep2 = this.add.graphics(); sep2.lineStyle(1, icInt, 0.15); sep2.lineBetween(GX, 155, GX + COLS * CELL, 155);
	}

	_updateHUD() {
		this.levelText.setText(String(this.levelIdx + 1).padStart(2, '0'));
		this.movesText.setText(String(this.moves).padStart(3, '0'));
		this.scoreText.setText(String(this.score).padStart(5, '0'));
	}
	_flashStat(obj) { this.tweens.add({ targets: obj, scaleX: 1.25, scaleY: 1.25, duration: 80, yoyo: true, ease: 'Quad.easeOut' }); }

	/* LEVEL LOAD */
	_loadLevel(idx) {
		if (this.blockObjects && this.blockObjects.length) {
			this.blockObjects.forEach(b => { if (b.glowTween) b.glowTween.stop(); b.container.destroy(); });
		}
		this.blockObjects = [];
		this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
		generateLevel(idx).forEach((bd, i) => {
			const blk = this._createBlock(bd, i);
			this.blockObjects.push(blk);
			this._markGrid(blk, true);
		});
		this._updateHUD();
	}

	/* BLOCK CREATION */
	_createBlock(bd, index) {
		const { row, col, len, dir, isMaster } = bd;
		const isH = dir === 'H';
		const bw = isH ? len * CELL - GAP * 2 : CELL - GAP * 2;
		const bh = isH ? CELL - GAP * 2 : len * CELL - GAP * 2;
		const pal = this.pal;
		const cycle = [pal.hostile, pal.fxAccent, pal.interface, pal.hostile, pal.interface, pal.fxAccent];

		// Fallbacks correctly converted to hex integers for drawing
		const colHex = isMaster ? pal.playerCore : cycle[index % cycle.length];
		const colInt = hex2int(colHex);

		const cx = GX + col * CELL + GAP + bw / 2, cy = GY + row * CELL + GAP + bh / 2;
		const container = this.add.container(cx, cy);

		const glowLayers = [];
		[18, 11, 5].forEach((ex, g) => {
			const gfx = this.add.graphics();
			gfx.fillStyle(colInt, [0.06, 0.10, 0.14][g]);
			gfx.fillRoundedRect(-bw / 2 - ex, -bh / 2 - ex, bw + ex * 2, bh + ex * 2, BLOCK_RADIUS + ex / 2);
			container.add(gfx); glowLayers.push(gfx);
		});

		const body = this.add.graphics();
		body.fillStyle(colInt, 0.18); body.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, BLOCK_RADIUS);
		container.add(body);

		const edge = this.add.graphics();
		edge.lineStyle(1.8, colInt, 1); edge.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, BLOCK_RADIUS);
		container.add(edge);

		const shine = this.add.graphics();
		shine.lineStyle(1, lerpColor(colInt, 0.7), 0.55);
		shine.beginPath(); shine.moveTo(-bw / 2 + BLOCK_RADIUS, -bh / 2 + 2); shine.lineTo(bw / 2 - BLOCK_RADIUS, -bh / 2 + 2); shine.strokePath();
		shine.beginPath(); shine.moveTo(-bw / 2 + 2, -bh / 2 + BLOCK_RADIUS); shine.lineTo(-bw / 2 + 2, bh / 2 - BLOCK_RADIUS); shine.strokePath();
		container.add(shine);

		const tf = this.add.graphics();
		tf.fillStyle(lerpColor(colInt, 0.35), 0.22);
		tf.fillRoundedRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, Math.min(bh * 0.4, 22), { tl: BLOCK_RADIUS - 2, tr: BLOCK_RADIUS - 2, bl: 0, br: 0 });
		container.add(tf);

		const dg = this.add.graphics(); dg.fillStyle(colInt, 0.45);
		if (isH) { for (let d = 0; d < len; d++) dg.fillCircle((-bw / 2 + GAP) + d * CELL + (CELL - GAP * 2) / 2, bh / 2 - 9, 2.5); }
		else { for (let d = 0; d < len; d++) dg.fillCircle(bw / 2 - 9, (-bh / 2 + GAP) + d * CELL + (CELL - GAP * 2) / 2, 2.5); }
		container.add(dg);

		let glowTween = null;
		if (isMaster) {
			const arr = this.add.graphics(), ax = bw / 2 - 20;
			arr.fillStyle(colInt, 0.85); arr.fillTriangle(ax, -6, ax + 12, 0, ax, 6);
			arr.fillStyle(colInt, 0.40); arr.fillTriangle(ax - 10, -5, ax, 0, ax - 10, 5);
			container.add(arr);
			glowTween = this.tweens.add({ targets: glowLayers, alpha: { from: 0.5, to: 1.0 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
		}

		return { container, row, col, len, dir, isMaster: !!isMaster, colInt, colHex, bw, bh, glowLayers, body, edge, glowTween, dragging: false, tweening: false, _startRow: row, _startCol: col };
	}

	/* GRID */
	_markGrid(block, occupied) {
		const val = occupied ? block : null;
		const { row, col, len, dir } = block;
		if (dir === 'H') { for (let c = col; c < col + len; c++) if (c >= 0 && c < COLS && row >= 0 && row < ROWS) this.grid[row][c] = val; }
		else { for (let r = row; r < row + len; r++) if (r >= 0 && r < ROWS && col >= 0 && col < COLS) this.grid[r][col] = val; }
	}
	_cellAt(row, col) { if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null; return this.grid[row][col]; }

	_getRange(block) {
		this._markGrid(block, false);
		let minPos, maxPos;
		if (block.dir === 'H') {
			let lo = block.col; while (lo > 0 && !this.grid[block.row][lo - 1]) lo--;
			let hi = block.col; while (hi + block.len < COLS && !this.grid[block.row][hi + block.len]) hi++;
			minPos = lo; maxPos = hi;
		} else {
			let lo = block.row; while (lo > 0 && !this.grid[lo - 1][block.col]) lo--;
			let hi = block.row; while (hi + block.len < ROWS && !this.grid[hi + block.len][block.col]) hi++;
			minPos = lo; maxPos = hi;
		}
		this._markGrid(block, true);
		return { min: minPos, max: maxPos };
	}

	/* INPUT */
	_onDown(ptr) {
		if (this.transitioning) return;
		const gc = Math.floor((ptr.x - GX) / CELL), gr = Math.floor((ptr.y - GY) / CELL);
		if (gc < 0 || gc >= COLS || gr < 0 || gr >= ROWS) return;
		const block = this._cellAt(gr, gc);
		if (!block || block.tweening) return;
		this.dragBlock = block; block.dragging = true;
		block._startRow = block.row; block._startCol = block.col;
		this._dragRange = this._getRange(block);
		this._dragOriginW = { x: ptr.x, y: ptr.y };
		this._hitMin = false; this._hitMax = false;
		this._markGrid(block, false);
		this.children.bringToTop(block.container);
		SFX.pickup();
		this.tweens.add({ targets: block.container, scaleX: 1.045, scaleY: 1.045, duration: 90, ease: 'Quad.easeOut' });
	}

	_onMove(ptr) {
		const block = this.dragBlock;
		if (!block || this.transitioning) return;
		const dx = ptr.x - this._dragOriginW.x, dy = ptr.y - this._dragOriginW.y;
		const r = this._dragRange;
		if (block.dir === 'H') {
			const startCX = GX + block._startCol * CELL + GAP + block.bw / 2;
			const minX = GX + r.min * CELL + GAP + block.bw / 2, maxX = GX + r.max * CELL + GAP + block.bw / 2;
			const rawX = startCX + dx, clamped = Phaser.Math.Clamp(rawX, minX, maxX);
			if (rawX < minX - 2 && !this._hitMin) { this._hitMin = true; this._bump(block, -1); }
			if (rawX > maxX + 2 && !this._hitMax) { this._hitMax = true; this._bump(block, +1); }
			if (rawX >= minX && rawX <= maxX) { this._hitMin = false; this._hitMax = false; }
			block.container.x = clamped;
		} else {
			const startCY = GY + block._startRow * CELL + GAP + block.bh / 2;
			const minY = GY + r.min * CELL + GAP + block.bh / 2, maxY = GY + r.max * CELL + GAP + block.bh / 2;
			const rawY = startCY + dy, clamped = Phaser.Math.Clamp(rawY, minY, maxY);
			if (rawY < minY - 2 && !this._hitMin) { this._hitMin = true; this._bump(block, -1); }
			if (rawY > maxY + 2 && !this._hitMax) { this._hitMax = true; this._bump(block, +1); }
			if (rawY >= minY && rawY <= maxY) { this._hitMin = false; this._hitMax = false; }
			block.container.y = clamped;
		}
	}

	_onUp() {
		const block = this.dragBlock;
		if (!block) return;
		this.dragBlock = null; block.dragging = false;
		const r = this._dragRange;
		let newPos, moved;
		if (block.dir === 'H') {
			const colF = (block.container.x - GX - GAP - block.bw / 2) / CELL;
			newPos = Phaser.Math.Clamp(Math.round(colF), r.min, r.max);
			moved = newPos !== block._startCol;
			const tgtX = GX + newPos * CELL + GAP + block.bw / 2;
			block.tweening = true;
			this.tweens.add({
				targets: block.container, x: tgtX, scaleX: 1, scaleY: 1, duration: SNAP_DURATION, ease: 'Cubic.easeOut',
				onComplete: () => { block.tweening = false; block.col = newPos; this._markGrid(block, true); this._afterSnap(block); }
			});
		} else {
			const rowF = (block.container.y - GY - GAP - block.bh / 2) / CELL;
			newPos = Phaser.Math.Clamp(Math.round(rowF), r.min, r.max);
			moved = newPos !== block._startRow;
			const tgtY = GY + newPos * CELL + GAP + block.bh / 2;
			block.tweening = true;
			this.tweens.add({
				targets: block.container, y: tgtY, scaleX: 1, scaleY: 1, duration: SNAP_DURATION, ease: 'Cubic.easeOut',
				onComplete: () => { block.tweening = false; block.row = newPos; this._markGrid(block, true); this._afterSnap(block); }
			});
		}
		if (moved) {
			SFX.slide(); this.moves++; this.score += 10;
			this._updateHUD(); this._flashStat(this.movesText);
		} else {
			SFX.snap();
		}
	}

	_afterSnap(block) {
		if (block.isMaster && block.col + block.len >= COLS) this._triggerWin();
	}

	/*  BUMP EFFECT */
	_bump(block, dir) {
		SFX.bump();
		this.cameras.main.shake(55, 0.0035);
		const prop = block.dir === 'H' ? 'x' : 'y';
		this.tweens.add({ targets: [block.body, block.edge], [prop]: dir * 4, duration: 40, yoyo: true, ease: 'Quad.easeOut' });
	}

	/* WIN SEQUENCE */
	_triggerWin() {
		if (this.transitioning) return;
		this.transitioning = true;
		const master = this.blockObjects.find(b => b.isMaster);
		if (!master) return;
		for (let t = 0; t < 4; t++) {
			this.time.delayedCall(t * 80, () => {
				const g = this.add.graphics();
				g.fillStyle(master.colInt, 0.18 - t * 0.04);
				g.fillRoundedRect(master.container.x - master.bw / 2, master.container.y - master.bh / 2, master.bw, master.bh, BLOCK_RADIUS);
				this.tweens.add({ targets: g, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
			});
		}
		this.tweens.add({ targets: master.container, x: W + 160, duration: 550, ease: 'Cubic.easeIn', onComplete: () => this._victoryShow() });
	}

	_victoryShow() {
		SFX.win();
		const pci = hex2int(this.pal.playerCore);
		const flash = this.add.graphics();
		flash.fillStyle(pci, 0.22); flash.fillRect(0, 0, W, H);
		this.tweens.add({ targets: flash, alpha: 0, duration: 700, ease: 'Cubic.easeOut' });

		for (let i = 0; i < 12; i++) {
			const angle = (i / 12) * Math.PI * 2, ln = this.add.graphics();
			ln.lineStyle(1.5, pci, 0.55);
			ln.lineBetween(W / 2, H / 2, W / 2 + Math.cos(angle) * 500, H / 2 + Math.sin(angle) * 500);
			this.tweens.add({ targets: ln, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 700, ease: 'Cubic.easeOut', delay: i * 18, onComplete: () => ln.destroy() });
		}

		const ct = this.add.text(W / 2, H / 2 - 22, 'LEVEL CLEAR', { fontSize: '46px', fontFamily: "'Courier New',monospace", color: hexToStr(this.pal.playerCore), letterSpacing: 6, stroke: hexToStr(this.pal.background), strokeThickness: 8 }).setOrigin(0.5).setAlpha(0).setScale(0.6);
		this.tweens.add({ targets: ct, alpha: 1, scaleX: 1, scaleY: 1, duration: 380, ease: 'Back.easeOut' });

		const bonus = Math.max(0, 500 - this.moves * 15);
		this.score += bonus; this._updateHUD();

		const bt = this.add.text(W / 2, H / 2 + 28, bonus > 0 ? `+${bonus} EFFICIENCY BONUS` : 'LEVEL COMPLETE', { fontSize: '14px', fontFamily: "'Courier New',monospace", color: hexToStr(this.pal.fxAccent), letterSpacing: 2 }).setOrigin(0.5).setAlpha(0);
		this.time.delayedCall(260, () => this.tweens.add({ targets: bt, alpha: 1, duration: 300 }));

		this._spawnParticles();

		this.time.delayedCall(1800, () => {
			this.tweens.add({
				targets: [ct, bt, flash], alpha: 0, y: '-=30', duration: 300, ease: 'Quad.easeIn',
				onComplete: () => { ct.destroy(); bt.destroy(); flash.destroy(); this._advanceLevel(); }
			});
		});
	}

	_spawnParticles() {
		const cols = [hex2int(this.pal.playerCore), hex2int(this.pal.fxAccent), hex2int(this.pal.interface), hex2int(this.pal.hostile)];
		for (let i = 0; i < 30; i++) {
			const g = this.add.graphics(), col = cols[i % cols.length], size = Phaser.Math.Between(3, 9);
			g.fillStyle(col, 1); g.fillCircle(0, 0, size);
			g.x = W / 2 + Phaser.Math.Between(-60, 60); g.y = H / 2 + Phaser.Math.Between(-30, 30);
			const angle = Math.random() * Math.PI * 2, dist = Phaser.Math.Between(90, 240);
			this.tweens.add({ targets: g, x: g.x + Math.cos(angle) * dist, y: g.y + Math.sin(angle) * dist, alpha: 0, scaleX: 0.15, scaleY: 0.15, duration: Phaser.Math.Between(500, 950), ease: 'Cubic.easeOut', delay: Phaser.Math.Between(0, 180), onComplete: () => g.destroy() });
		}
		for (let i = 0; i < 18; i++) {
			const sp = this.add.graphics(), col = cols[i % cols.length];
			sp.fillStyle(col, 0.8); sp.fillRect(-2, -5, 4, 10);
			sp.x = W / 2 + Phaser.Math.Between(-80, 80); sp.y = H / 2 + Phaser.Math.Between(-40, 40);
			sp.rotation = Math.random() * Math.PI;
			this.tweens.add({ targets: sp, y: sp.y - Phaser.Math.Between(80, 200), alpha: 0, rotation: sp.rotation + Math.PI, duration: Phaser.Math.Between(600, 1100), ease: 'Quad.easeOut', delay: Phaser.Math.Between(0, 200), onComplete: () => sp.destroy() });
		}
	}

	_advanceLevel() {
		const doNext = () => {
			this.levelIdx++;
			// Removed palette change on level%5 as per user instruction
			this.moves = 0; this.transitioning = false;
			this._transitionIn();
		};

		// EXPLICIT AD TRIGGER (Syncs dynamically with FreshPlay SDK every 5 levels)
		if ((this.levelIdx + 1) % 5 === 0) {
			try {
				['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
					if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
				});
			} catch (_) { }
		}

		try {
			if (window.FreshPlay && window.FreshPlay.levelComplete) window.FreshPlay.levelComplete(doNext);
			else doNext();
		} catch (_) { doNext(); }
	}

	_transitionIn() {
		const ov = this.add.graphics();
		ov.fillStyle(hex2int(this.pal.background), 1); ov.fillRect(0, 0, W, H);
		this._loadLevel(this.levelIdx);
		this.tweens.add({ targets: ov, alpha: 0, duration: 480, ease: 'Cubic.easeOut', onComplete: () => ov.destroy() });
		const lf = this.add.text(W / 2, H / 2, `LEVEL ${this.levelIdx + 1}`, { fontSize: '36px', fontFamily: "'Courier New',monospace", color: hexToStr(this.pal.interface), letterSpacing: 5 }).setOrigin(0.5).setAlpha(0);
		this.tweens.add({ targets: lf, alpha: { from: 1, to: 0 }, y: H / 2 - 30, duration: 600, ease: 'Quad.easeOut', delay: 100, onComplete: () => lf.destroy() });
	}
}

/* BOOT */
window.addEventListener('load', () => {
	const pal = getPalette();
	new Phaser.Game({
		type: Phaser.AUTO,
		width: W,
		height: H,
		parent: 'game-wrapper',
		backgroundColor: pal.background,
		scene: [GameScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		render: { antialias: true, pixelArt: false, roundPixels: false },
	});
});
