// ============================================================
//  LIGHT LINKER 
// ============================================================

// FreshPlay shim
if (typeof window.FreshPlay === 'undefined') {
	window.FreshPlay = {
		currentLevel: 1,
		levelComplete(cb) { this.currentLevel++; setTimeout(cb, 1800); },
		showAd() { console.log('[FreshPlay] Ad shown'); },
		getCurrentPalette: () => ({
			background: '#0a0e1a',
			interface: '#1e293b',
			playerCore: '#00e5ff',
			fxAccent: '#f72585',
			hostile: '#ffd166',
		}),
	};
}

// Constants
const PATH_WIDTH = 10;
const NODE_RADIUS = 16;
const GLOW_BLUR = 20;
const SNAP_VOL = 0.32;
const EMPTY = -1;
const DIRS = [{ dc: 0, dr: -1 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }];

// Robust Color Helpers
const hexToInt = (h) => {
	if (typeof h === 'number') return h;
	if (typeof h === 'string') return parseInt(h.replace('#', ''), 16);
	return 0x000000;
};

// Safely converts both strings and numbers to CSS String ('#ff0000') for Text
const hexToStr = (h) => {
	if (typeof h === 'string') return h.startsWith('#') ? h : '#' + h;
	if (typeof h === 'number') return '#' + h.toString(16).padStart(6, '0');
	return '#00e5ff';
};

const cellKey = (c, r) => `${c},${r}`;

function lerpColor(a, b, t) {
	const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
	const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
	return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// ============================================================
//  LEVEL GENERATOR  — Hamiltonian-path partition
// ============================================================
function generateLevel(gridSize, numPairs) {
	numPairs = Math.max(2, Math.min(numPairs, 5));
	const totalCells = gridSize * gridSize;
	numPairs = Math.min(numPairs, Math.floor(totalCells / 3));

	for (let attempt = 0; attempt < 500; attempt++) {
		const master = buildHamiltonianPath(gridSize);
		if (!master || master.length !== totalCells) continue;
		const level = cutIntoSubpaths(master, numPairs, gridSize);
		if (level) return level;
	}
	return hardcodedFallback();
}

function buildHamiltonianPath(n) {
	const total = n * n;
	const visited = new Uint8Array(total);
	const path = [];
	const idx = (c, r) => r * n + c;

	function dfs(c, r) {
		visited[idx(c, r)] = 1;
		path.push({ col: c, row: r });
		if (path.length === total) return true;

		const nexts = [];
		for (const d of DIRS) {
			const nc = c + d.dc, nr = r + d.dr;
			if (nc >= 0 && nc < n && nr >= 0 && nr < n && !visited[idx(nc, nr)]) {
				let deg = 0;
				for (const d2 of DIRS) {
					const nc2 = nc + d2.dc, nr2 = nr + d2.dr;
					if (nc2 >= 0 && nc2 < n && nr2 >= 0 && nr2 < n && !visited[idx(nc2, nr2)]) deg++;
				}
				nexts.push({ nc, nr, deg });
			}
		}
		nexts.sort((a, b) => a.deg - b.deg || (Math.random() < 0.5 ? -1 : 1));

		for (const { nc, nr } of nexts) {
			if (dfs(nc, nr)) return true;
		}
		visited[idx(c, r)] = 0;
		path.pop();
		return false;
	}

	const start = Math.floor(Math.random() * total);
	return dfs(start % n, Math.floor(start / n)) ? path : null;
}

function cutIntoSubpaths(master, numPairs, gridSize) {
	const total = master.length;
	if (total < numPairs * 2) return null;

	const avail = [];
	for (let i = 1; i < total - 1; i++) avail.push(i);
	shuffle(avail);

	const cuts = avail.slice(0, numPairs - 1).sort((a, b) => a - b);
	const bounds = [0, ...cuts, total];
	for (let i = 0; i < bounds.length - 1; i++) {
		if (bounds[i + 1] - bounds[i] < 2) return null;
	}

	const nodes = [];
	const solution = [];

	for (let p = 0; p < numPairs; p++) {
		const cells = master.slice(bounds[p], bounds[p + 1]);
		const ci = p;

		solution.push({ colorIndex: ci, cells });
		nodes.push({ col: cells[0].col, row: cells[0].row, colorIndex: ci });
		nodes.push({ col: cells[cells.length - 1].col, row: cells[cells.length - 1].row, colorIndex: ci });
	}

	const nodeSet = new Set(nodes.map(n => cellKey(n.col, n.row)));
	if (nodeSet.size !== nodes.length) return null;

	return { gridSize, numPairs, nodes, solution };
}

function hardcodedFallback() {
	return {
		gridSize: 4, numPairs: 2,
		nodes: [
			{ col: 0, row: 0, colorIndex: 0 }, { col: 3, row: 1, colorIndex: 0 },
			{ col: 0, row: 2, colorIndex: 1 }, { col: 3, row: 3, colorIndex: 1 },
		],
		solution: [
			{
				colorIndex: 0, cells: [
					{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }, { col: 3, row: 1 }
				]
			},
			{
				colorIndex: 1, cells: [
					{ col: 0, row: 2 }, { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
					{ col: 2, row: 2 }, { col: 1, row: 2 }, { col: 1, row: 3 }, { col: 2, row: 3 },
					{ col: 3, row: 3 }, { col: 3, row: 2 }, { col: 0, row: 3 }
				]
			},
		],
	};
}

function levelConfig(n) {
	return {
		gridSize: Math.min(4 + Math.floor((n - 1) / 3), 8),
		numPairs: Math.min(2 + Math.floor((n - 1) / 2), 5),
	};
}

// ============================================================
//  AUDIO
// ============================================================
let _actx = null;
function getACtx() {
	if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
	if (_actx.state === 'suspended') _actx.resume();
	return _actx;
}
function playTone(freq, type = 'sine', dur = 0.22, vol = SNAP_VOL, freqEnd = null) {
	try {
		const ctx = getACtx(), osc = ctx.createOscillator(), gain = ctx.createGain();
		osc.connect(gain); gain.connect(ctx.destination);
		osc.type = type;
		osc.frequency.setValueAtTime(freq, ctx.currentTime);
		if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + 0.06);
		gain.gain.setValueAtTime(vol, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
		osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
	} catch (_) { }
}
const playSnap = (f = 880) => playTone(f, 'sine', 0.22, SNAP_VOL, f * 1.6);
const playErase = () => playTone(260, 'sawtooth', 0.13, 0.12, 110);
const playWin = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playSnap(f), i * 90));

// ============================================================
//  BOOT
// ============================================================

// ─────────────────────────────────────────────────────────────
//  LANDSCAPE PROMPT SCENE
// ─────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
	constructor() { super('Boot'); }
	  create() {
		this.scene.start('Game');
	}
}

// ============================================================
//  GAME SCENE
// ============================================================
class GameScene extends Phaser.Scene {
	constructor() { super('Game'); }

	init() {
		this.levelNum = window.FreshPlay.currentLevel || 1;
		this.palette = window.FreshPlay.getCurrentPalette();
		const cfg = levelConfig(this.levelNum);
		this.levelData = generateLevel(cfg.gridSize, cfg.numPairs);
		this.gridSize = this.levelData.gridSize;
		this.numPairs = this.levelData.numPairs;
		this._lastW = 0;
		this._lastH = 0;
	}

	get nodeColors() {
		const p = this.palette;
		return [
			hexToInt(p.playerCore),
			hexToInt(p.fxAccent),
			hexToInt(p.hostile),
			lerpColor(hexToInt(p.playerCore), hexToInt(p.fxAccent), 0.5),
			lerpColor(hexToInt(p.fxAccent), hexToInt(p.hostile), 0.5),
		];
	}

	create() {
		this.add.rectangle(0, 0, 8000, 8000, hexToInt(this.palette.background), 1)
			.setOrigin(0).setScrollFactor(0).setDepth(-1);

		this.bgGfx = this.add.graphics().setDepth(0);
		this.gridGfx = this.add.graphics().setDepth(1);
		this.glowGfx = this.add.graphics().setDepth(2);
		this.pathGfx = this.add.graphics().setDepth(3);

		this.paths = {};
		this.cellOwner = {};
		this.dragging = false;
		this.dragColor = EMPTY;
		this.dragPath = [];
		this.complete = false;

		this.titleTxt = this.add.text(0, 0, 'LIGHT LINKER', {
			fontFamily: '"Courier New",monospace', fontSize: '13px',
			color: hexToStr(this.palette.playerCore), letterSpacing: 5,
		}).setAlpha(0.78).setDepth(10);

		this.levelTxt = this.add.text(0, 0, `LEVEL  ${this.levelNum}`, {
			fontFamily: '"Courier New",monospace', fontSize: '13px',
			color: hexToStr(this.palette.interface), letterSpacing: 3,
		}).setOrigin(1, 0).setDepth(10);

		this.hudLineGfx = this.add.graphics().setDepth(10);
		this.dotsGfx = [];
		for (let i = 0; i < this.numPairs; i++)
			this.dotsGfx.push(this.add.graphics().setDepth(10));

		this.nodeMap = {};
		this.nodeBodyGfx = this.add.graphics().setDepth(5);
		this.nodeHaloGfx = this.add.graphics().setDepth(4);
		for (const nd of this.levelData.nodes) {
			this.nodeMap[cellKey(nd.col, nd.row)] = {
				colorIndex: nd.colorIndex, col: nd.col, row: nd.row,
			};
		}

		this._haloAlpha = 0.6;
		this._haloDir = -1;

		this.input.on('pointerdown', this._onDown, this);
		this.input.on('pointermove', this._onMove, this);
		this.input.on('pointerup', this._onUp, this);

		this.cameras.main.setAlpha(0);
		this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 420, ease: 'Cubic.Out' });
	}

	update(time, delta) {
		delta = Math.min(delta || 16.6, 33.3);
		const W = this.scale.width, H = this.scale.height;
		if (W !== this._lastW || H !== this._lastH) {
			this._lastW = W; this._lastH = H;
			this._reLayout(W, H);
		}

		if (this.levelTxt)
			this.levelTxt.setAlpha(0.55 + 0.3 * Math.sin(time * 0.0022));

		if (!this.complete) {
			this._haloAlpha += this._haloDir * (delta / 1000) * 0.9;
			if (this._haloAlpha <= 0.08) { this._haloAlpha = 0.08; this._haloDir = 1; }
			if (this._haloAlpha >= 0.6) { this._haloAlpha = 0.6; this._haloDir = -1; }
			this._drawNodeHalos();
		}
	}

	_reLayout(W, H) {
		const margin = 36;
		const hudH = 78;
		const boardSide = Math.min(W - margin * 2, H - hudH - margin * 2);
		this.cellSize = Math.floor(boardSide / this.gridSize);
		this.boardX = Math.floor((W - this.cellSize * this.gridSize) / 2);
		this.boardY = hudH + Math.floor((H - hudH - this.cellSize * this.gridSize) / 2);

		this._drawBg(W, H);
		this._drawGrid();
		this._drawHUD(W);
		this._drawNodeBodies();
		this._redrawPaths();
	}

	_drawBg(W, H) {
		const g = this.bgGfx; g.clear();
		g.lineStyle(1, hexToInt(this.palette.interface), 0.032);
		for (let x = 0; x <= W; x += 38) g.lineBetween(x, 0, x, H);
		for (let y = 0; y <= H; y += 38) g.lineBetween(0, y, W, y);
	}

	_drawGrid() {
		const g = this.gridGfx; g.clear();
		const n = this.gridSize, cs = this.cellSize, x0 = this.boardX, y0 = this.boardY;
		for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
			g.fillStyle(0x3b82f6, 0.016);
			g.fillRect(x0 + c * cs + 1, y0 + r * cs + 1, cs - 2, cs - 2);
		}
		g.lineStyle(1, hexToInt(this.palette.interface), 0.18);
		for (let i = 0; i <= n; i++) {
			g.lineBetween(x0 + i * cs, y0, x0 + i * cs, y0 + n * cs);
			g.lineBetween(x0, y0 + i * cs, x0 + n * cs, y0 + i * cs);
		}
		g.lineStyle(2, hexToInt(this.palette.playerCore), 0.28);
		g.strokeRect(x0, y0, n * cs, n * cs);
	}

	_drawHUD(W) {
		this.titleTxt.setPosition(26, 22);
		this.levelTxt.setPosition(W - 26, 22);
		this.hudLineGfx.clear();
		this.hudLineGfx.lineStyle(1, hexToInt(this.palette.interface), 0.13);
		this.hudLineGfx.lineBetween(0, 66, W, 66);

		const gap = Math.min(22, (W * 0.4) / Math.max(this.numPairs, 1));
		const dotsW = (this.numPairs - 1) * gap;
		this.dotsGfx.forEach((g, i) => {
			g.clear();
			const x = W / 2 - dotsW / 2 + i * gap;
			if (this.paths[i]?.complete) {
				g.fillStyle(this.nodeColors[i], 1);
				g.fillCircle(x, 38, 6);
				g.lineStyle(1.5, 0x3b82f6, 0.5);
				g.strokeCircle(x, 38, 6);
			} else {
				g.lineStyle(1.5, this.nodeColors[i], 0.5);
				g.strokeCircle(x, 38, 5.5);
			}
		});
	}

	_drawNodeBodies() {
		const g = this.nodeBodyGfx; g.clear();
		const colors = this.nodeColors;
		const cs = this.cellSize, x0 = this.boardX, y0 = this.boardY;
		for (const k in this.nodeMap) {
			const nd = this.nodeMap[k];
			const cx = x0 + (nd.col + 0.5) * cs;
			const cy = y0 + (nd.row + 0.5) * cs;
			const c = colors[nd.colorIndex];
			g.fillStyle(c, 1);
			g.fillCircle(cx, cy, NODE_RADIUS);
			g.lineStyle(2, 0x3b82f6, 0.3);
			g.strokeCircle(cx, cy, NODE_RADIUS);
			g.fillStyle(0x3b82f6, 0.55);
			g.fillCircle(cx, cy, NODE_RADIUS * 0.28);
		}
	}

	_drawNodeHalos() {
		if (!this.cellSize) return;
		const g = this.nodeHaloGfx; g.clear();
		const colors = this.nodeColors;
		const cs = this.cellSize, x0 = this.boardX, y0 = this.boardY;
		for (const k in this.nodeMap) {
			const nd = this.nodeMap[k];
			const cx = x0 + (nd.col + 0.5) * cs;
			const cy = y0 + (nd.row + 0.5) * cs;
			const c = colors[nd.colorIndex];
			g.lineStyle(2, c, this._haloAlpha);
			g.strokeCircle(cx, cy, NODE_RADIUS + 7);
		}
	}

	// ============================================================
	//  INPUT
	// ============================================================
	_onDown(ptr) {
		if (this.complete) return;
		const cell = this._cellAt(ptr.x, ptr.y); if (!cell) return;
		const k = cellKey(cell.col, cell.row);
		const node = this._nodeAt(cell.col, cell.row);

		let ci = EMPTY;
		if (node) ci = node.colorIndex;
		else if (this.cellOwner[k] !== undefined) ci = this.cellOwner[k];
		if (ci === EMPTY) return;

		// Tap mid-path → truncate
		const existing = this.paths[ci];
		if (existing && !node) {
			const idx = existing.cells.findIndex(c => c.col === cell.col && c.row === cell.row);
			if (idx >= 0) {
				for (let i = idx + 1; i < existing.cells.length; i++)
					delete this.cellOwner[cellKey(existing.cells[i].col, existing.cells[i].row)];
				const kept = existing.cells.slice(0, idx + 1);
				delete this.paths[ci];
				this.dragging = true; this.dragColor = ci; this.dragPath = kept;
				this._redrawPaths();
				return;
			}
		}

		this._erasePath(ci, true);
		this.dragging = true; this.dragColor = ci;
		this.dragPath = [{ col: cell.col, row: cell.row }];
		this.cellOwner[k] = ci;
		this._redrawPaths();
	}

	_onMove(ptr) {
		if (!this.dragging || this.complete) return;
		const cell = this._cellAt(ptr.x, ptr.y); if (!cell) return;

		const last = this.dragPath[this.dragPath.length - 1];
		if (cell.col === last.col && cell.row === last.row) return;
		if (Math.abs(cell.col - last.col) + Math.abs(cell.row - last.row) !== 1) return;

		// Backtrack
		if (this.dragPath.length >= 2) {
			const prev = this.dragPath[this.dragPath.length - 2];
			if (cell.col === prev.col && cell.row === prev.row) {
				const lk = cellKey(last.col, last.row);
				if (!this._nodeAt(last.col, last.row)) delete this.cellOwner[lk];
				this.dragPath.pop();
				this._redrawPaths();
				return;
			}
		}

		const k = cellKey(cell.col, cell.row);
		const node = this._nodeAt(cell.col, cell.row);

		if (this.cellOwner[k] !== undefined && this.cellOwner[k] !== this.dragColor) return;

		if (node && node.colorIndex === this.dragColor) {
			const start = this.dragPath[0];
			if (node.col === start.col && node.row === start.row) return;
			this.dragPath.push({ col: cell.col, row: cell.row });
			this.cellOwner[k] = this.dragColor;
			this._completePath(this.dragColor);
			return;
		}

		if (node && node.colorIndex !== this.dragColor) return;
		if (this.dragPath.some(c => c.col === cell.col && c.row === cell.row)) return;

		this.dragPath.push({ col: cell.col, row: cell.row });
		this.cellOwner[k] = this.dragColor;
		this._redrawPaths();
	}

	_onUp() {
		if (!this.dragging) return;
		this.dragging = false;
		const ci = this.dragColor; this.dragColor = EMPTY;
		if (ci === EMPTY) { this.dragPath = []; return; }

		if (this.dragPath.length > 1) {
			this.paths[ci] = { colorIndex: ci, cells: [...this.dragPath], complete: false };
		} else if (this.dragPath.length === 1) {
			const k = cellKey(this.dragPath[0].col, this.dragPath[0].row);
			if (!this._nodeAt(this.dragPath[0].col, this.dragPath[0].row))
				delete this.cellOwner[k];
		}
		this.dragPath = [];
		this._redrawPaths();
	}

	// Path management
	_erasePath(ci, silent = false) {
		const p = this.paths[ci];
		if (p) {
			for (const cell of p.cells) {
				const k = cellKey(cell.col, cell.row);
				if (this.cellOwner[k] === ci) delete this.cellOwner[k];
			}
			delete this.paths[ci];
		}
		for (const cell of this.dragPath) {
			const k = cellKey(cell.col, cell.row);
			if (this.cellOwner[k] === ci) delete this.cellOwner[k];
		}
		this._drawHUD(this.scale.width);
		if (!silent) playErase();
	}

	_completePath(ci) {
		this.paths[ci] = { colorIndex: ci, cells: [...this.dragPath], complete: true };
		for (const cell of this.dragPath)
			this.cellOwner[cellKey(cell.col, cell.row)] = ci;

		this.dragging = false; this.dragColor = EMPTY; this.dragPath = [];
		this._redrawPaths();
		this._drawHUD(this.scale.width);
		playSnap(560 + ci * 140);
		this._burstAt(ci);
		this._checkWin();
	}

	// Win check
	_checkWin() {
		for (let ci = 0; ci < this.numPairs; ci++) {
			if (!this.paths[ci]?.complete) return;
		}

		this.complete = true;
		playWin();
		this._showWinUI();

		if (this.levelNum % 5 === 0) {
			try {
				['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
					if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
				});
			} catch (_) { }
		}

		window.FreshPlay.levelComplete(() => { this.scene.start('Game'); });
	}

	// Win UI
	_showWinUI() {
		const W = this.scale.width, H = this.scale.height;

		const ov = this.add.rectangle(0, 0, W, H, hexToInt(this.palette.playerCore), 0)
			.setOrigin(0).setDepth(20);
		this.tweens.add({ targets: ov, alpha: 0.15, duration: 260, yoyo: true, hold: 240 });

		const t = this.add.text(W / 2, H / 2 - 26, 'LINKED', {
			fontFamily: '"Courier New",monospace', fontSize: '50px',
			color: hexToStr(this.palette.playerCore), letterSpacing: 14,
		}).setOrigin(0.5).setAlpha(0).setDepth(21);
		this.tweens.add({
			targets: t, alpha: 1,
			scaleX: { from: 0.5, to: 1 }, scaleY: { from: 0.5, to: 1 },
			duration: 440, ease: 'Back.Out'
		});

		const s = this.add.text(W / 2, H / 2 + 40, `LEVEL ${this.levelNum} COMPLETE`, {
			fontFamily: '"Courier New",monospace', fontSize: '12px',
			color: hexToStr(this.palette.interface), letterSpacing: 6,
		}).setOrigin(0.5).setAlpha(0).setDepth(21);
		this.tweens.add({ targets: s, alpha: 0.8, delay: 260, duration: 360 });

		for (let i = 0; i < 26; i++) {
			this.time.delayedCall(i * 45, () => {
				const rx = this.boardX + Math.random() * this.gridSize * this.cellSize;
				const ry = this.boardY + Math.random() * this.gridSize * this.cellSize;
				this._spawnSpark(rx, ry, this.nodeColors[i % this.numPairs]);
			});
		}
	}

	// Sparks / bursts
	_burstAt(ci) {
		this.levelData.nodes.filter(n => n.colorIndex === ci).forEach(nd => {
			const cx = this.boardX + (nd.col + 0.5) * this.cellSize;
			const cy = this.boardY + (nd.row + 0.5) * this.cellSize;
			for (let i = 0; i < 9; i++)
				this.time.delayedCall(i * 18, () => this._spawnSpark(cx, cy, this.nodeColors[ci]));
		});
	}

	_spawnSpark(x, y, color) {
		const g = this.add.graphics().setDepth(15);
		g.fillStyle(color, 1);
		g.fillCircle(0, 0, 2.5 + Math.random() * 3);
		g.x = x; g.y = y;
		const ang = Math.random() * Math.PI * 2, dist = 45 + Math.random() * 90;
		this.tweens.add({
			targets: g,
			x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist,
			alpha: 0, scaleX: 0.1, scaleY: 0.1,
			duration: 440 + Math.random() * 280, ease: 'Cubic.Out',
			onComplete: () => g.destroy(),
		});
	}

	// Path drawing
	_redrawPaths() {
		this.pathGfx.clear();
		this.glowGfx.clear();
		const cs = this.cellSize;
		if (!cs) return;

		const toDraw = [...Object.values(this.paths)];
		if (this.dragging && this.dragPath.length >= 2)
			toDraw.push({ colorIndex: this.dragColor, cells: this.dragPath, complete: false });

		for (const pd of toDraw) {
			const { colorIndex: ci, cells, complete: done } = pd;
			if (!cells || cells.length < 2) continue;
			const color = this.nodeColors[ci];
			const pts = cells.map(c => ({
				x: this.boardX + (c.col + 0.5) * cs,
				y: this.boardY + (c.row + 0.5) * cs,
			}));

			this.glowGfx.lineStyle(PATH_WIDTH + GLOW_BLUR, color, done ? 0.22 : 0.12);
			this._stroke(this.glowGfx, pts);
			this.glowGfx.lineStyle(PATH_WIDTH + 7, color, done ? 0.35 : 0.22);
			this._stroke(this.glowGfx, pts);
			this.pathGfx.lineStyle(PATH_WIDTH, color, done ? 1 : 0.9);
			this._stroke(this.pathGfx, pts);
			this.pathGfx.lineStyle(2.5, 0x3b82f6, done ? 0.52 : 0.26);
			this._stroke(this.pathGfx, pts);
			if (!done) {
				for (let i = 1; i < pts.length - 1; i++) {
					this.pathGfx.fillStyle(0x3b82f6, 0.20);
					this.pathGfx.fillCircle(pts[i].x, pts[i].y, 2.5);
				}
			}
		}

		if (this.dragging && this.dragPath.length >= 1) {
			const tail = this.dragPath[this.dragPath.length - 1];
			const tx = this.boardX + (tail.col + 0.5) * cs;
			const ty = this.boardY + (tail.row + 0.5) * cs;
			const c = this.nodeColors[this.dragColor];
			this.pathGfx.fillStyle(c, 0.6);
			this.pathGfx.fillCircle(tx, ty, 7);
			this.pathGfx.fillStyle(0x3b82f6, 0.9);
			this.pathGfx.fillCircle(tx, ty, 2.5);
		}
	}

	_stroke(g, pts) {
		g.beginPath();
		g.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
		g.strokePath();
	}

	// Helpers
	_cellAt(px, py) {
		if (!this.cellSize) return null;
		const col = Math.floor((px - this.boardX) / this.cellSize);
		const row = Math.floor((py - this.boardY) / this.cellSize);
		if (col < 0 || col >= this.gridSize || row < 0 || row >= this.gridSize) return null;
		return { col, row };
	}

	_nodeAt(col, row) {
		return this.levelData.nodes.find(n => n.col === col && n.row === row) || null;
	}
}

// ============================================================
//  CONFIG & LAUNCH
// ============================================================
const config = {
	type: Phaser.AUTO,
	backgroundColor: '#0a0e1a',
	parent: 'game-container',
	scene: [BootScene, GameScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
	scale: {
		mode: Phaser.Scale.RESIZE,
		width: '100%',
		height: '100%',
	},
	render: {
		antialias: true,
		antialiasGL: true,
		powerPreference: 'high-performance',
	},
};

window.addEventListener('DOMContentLoaded', () => {
	if (!document.getElementById('game-container')) {
		const div = document.createElement('div');
		div.id = 'game-container';
		Object.assign(div.style, {
			position: 'fixed', inset: '0',
			display: 'flex', alignItems: 'center', justifyContent: 'center',
			background: '#0a0e1a',
		});
		document.body.appendChild(div);
		document.body.style.cssText = 'margin:0;overflow:hidden;background:#0a0a12';
	}
	window._lightLinkerGame = new Phaser.Game(config);
});
