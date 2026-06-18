// ============================================================
//  HEXA MERGE
// ============================================================

/* FreshPlay shim (safe fallback when SDK is absent) */
if (typeof window.FreshPlay === 'undefined') {
	window.FreshPlay = {
		currentLevel: 1,
		levelComplete: (cb) => {
			window.FreshPlay.currentLevel++;
			setTimeout(cb, 1200);
		},
		showAd: () => { console.log('[FreshPlay] Ad shown'); },
		getCurrentPalette: () => ({
			background: '#f0f4f8',
			playerCore: '#3b82f6',
			interface: '#cbd5e1',
			fxAccent: '#ff3cac',
		}),
	};
}

// ============================================================
//  CONSTANTS & ROBUST PARSERS
// ============================================================
const HEX_SIZE = 44;
const HEX_RINGS = 2;
const QUEUE_LEN = 3;
const BASE_SCORE = [0, 10, 30, 80, 180, 400, 900, 2000, 5000, 12000, 30000];

// Safely handles both SDK pure numbers (0xff0000) and String Fallbacks ('#ff0000')
const hexToInt = (h) => {
	if (typeof h === 'number') return h;
	if (typeof h === 'string') return parseInt(h.replace('#', ''), 16);
	return 0x000000;
};

// Safely converts to pure CSS string for Text objects
const hexToStr = (h) => {
	if (typeof h === 'string') return h.startsWith('#') ? h : '#' + h;
	if (typeof h === 'number') return '#' + h.toString(16).padStart(6, '0');
	return '#0f172a';
};

// Axial → pixel (pointy-top)
function hexToPixel(q, r, size) {
	return {
		x: size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r),
		y: size * (3 / 2 * r),
	};
}

// All axial coords within `rings` distance from origin
function hexRing(rings) {
	const cells = [];
	for (let q = -rings; q <= rings; q++) {
		for (let r = -rings; r <= rings; r++) {
			if (Math.abs(q + r) <= rings) cells.push({ q, r });
		}
	}
	return cells;
}

// Axial neighbours
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
function neighbours(q, r) {
	return DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

// ============================================================
//  SCENE: Boot
// ============================================================
class BootScene extends Phaser.Scene {
	constructor() { super('Boot'); }
	preload() { }
	create() {
		this.scene.start('Game');
	}
}

// ============================================================
//  SCENE: Game
// ============================================================
class GameScene extends Phaser.Scene {
	constructor() { super('Game'); }

	// initialize or reset all game state variables
	init() {
		this.level = window.FreshPlay.currentLevel || 1;
		this.score = 0;
		this.combo = 0;
		this.palette = window.FreshPlay.getCurrentPalette();
		this.levelTarget = this._levelTarget();
		this.cells = {};
		this.queue = [];
		this.ghostCell = null;
		this.merging = false;
		this.particles = [];
		this._advancing = false;
	}

	// create game objects, set up input and audio, etc
	create() {
		this.events.once('shutdown', () => {
			if (this.bgmTimer) this.bgmTimer.remove();
		});

		const W = this.scale.width, H = this.scale.height;
		this.cx = W / 2;
		this.cy = H / 2 + 20;

		// --- Audio Engine Setup ---
		if (!window.retroAudioCtx) {
			window.retroAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
			window._hmMasterGain = window.retroAudioCtx.createDynamicsCompressor();
			window._hmMasterGain.connect(window.retroAudioCtx.destination);
		}
		this.audioCtx = window.retroAudioCtx;
		this.masterGain = window._hmMasterGain;

		if (this.audioCtx.state === 'running') {
			this.startContinuousBGM();
		} else {
			this.input.once('pointerdown', () => {
				if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
				this.startContinuousBGM();
			});
		}

		this._buildBackground();
		this._buildBoard();
		this._buildHUD();
		this._buildQueue();
		this._fillQueue();
		this._drawQueue();
		this._drawHUD();

		this.input.on('pointermove', this._onMove, this);
		this.input.on('pointerdown', this._onDown, this);
	}

	update(time, delta) {
		delta = Math.min(delta || 16.6, 33.3);
		this._tickParticles(delta);
		if (this.ghostCell && !this.merging) this._drawGhost();
	}

	// ──────────────────────────────────────────────────────────
	//  AUDIO
	// ──────────────────────────────────────────────────────────
	startContinuousBGM() {
		if (this.bgmTimer) return;
		this.bgmTimer = this.time.addEvent({
			delay: 1000,
			callback: () => {
				const osc = this.audioCtx.createOscillator();
				const gain = this.audioCtx.createGain();
				osc.connect(gain); gain.connect(this.masterGain);
				osc.type = 'sine';
				osc.frequency.setValueAtTime(110 + (Math.random() * 5), this.audioCtx.currentTime);
				gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
				gain.gain.linearRampToValueAtTime(0.03, this.audioCtx.currentTime + 0.5);
				gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.0);
				osc.start(); osc.stop(this.audioCtx.currentTime + 1.0);
			}, loop: true
		});
	}

	playSound(type) {
		if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
		const osc = this.audioCtx.createOscillator();
		const gain = this.audioCtx.createGain();
		osc.connect(gain); gain.connect(this.masterGain);
		const now = this.audioCtx.currentTime;

		if (type === 'place') {
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(300, now);
			osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
			gain.gain.setValueAtTime(0.1, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
			osc.start(now); osc.stop(now + 0.1);
		} else if (type === 'merge') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(400, now);
			osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
			gain.gain.setValueAtTime(0.15, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
			osc.start(now); osc.stop(now + 0.2);
		} else if (type === 'levelup') {
			[0, 0.1, 0.2].forEach((d, i) => {
				const o2 = this.audioCtx.createOscillator();
				const g2 = this.audioCtx.createGain();
				o2.connect(g2); g2.connect(this.masterGain);
				o2.type = 'square';
				o2.frequency.setValueAtTime([440, 554, 659][i], now + d);
				g2.gain.setValueAtTime(0.1, now + d);
				g2.gain.exponentialRampToValueAtTime(0.01, now + d + 0.15);
				o2.start(now + d); o2.stop(now + d + 0.2);
			});
		} else if (type === 'gameover') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(200, now);
			osc.frequency.exponentialRampToValueAtTime(50, now + 0.6);
			gain.gain.setValueAtTime(0.2, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
			osc.start(now); osc.stop(now + 0.6);
		}
	}

	// ──────────────────────────────────────────────────────────
	//  BACKGROUND
	// ──────────────────────────────────────────────────────────
	_buildBackground() {
		const W = this.scale.width, H = this.scale.height;
		const bg = this.add.graphics();
		const col = hexToInt(this.palette.background);
		bg.fillStyle(col, 1);
		bg.fillRect(0, 0, W, H);

		const gridGfx = this.add.graphics();
		const gridCol = hexToInt(this.palette.playerCore);
		gridGfx.lineStyle(0.3, gridCol, 0.06);
		for (let gq = -8; gq <= 8; gq++) {
			for (let gr = -8; gr <= 8; gr++) {
				const p = hexToPixel(gq, gr, HEX_SIZE * 1.7);
				this._strokeHex(gridGfx, this.cx + p.x, this.cy + p.y, HEX_SIZE * 1.7);
			}
		}

		const glowW = 420, glowH = 420;
		const rt = this.add.renderTexture(0, 0, glowW, glowH);
		const g = this.make.graphics({ add: false });
		const accentCol = hexToInt(this.palette.playerCore);

		const steps = 20;
		for (let i = steps; i >= 0; i--) {
			const alpha = 0.04 * (1 - i / steps);
			g.fillStyle(accentCol, alpha);
			g.fillCircle(glowW / 2, glowH / 2, (i / steps) * 200);
		}
		rt.draw(g, 0, 0);
		rt.setPosition(this.cx - glowW / 2, this.cy - glowH / 2);
		g.destroy();
	}

	// ──────────────────────────────────────────────────────────
	//  BOARD
	// ──────────────────────────────────────────────────────────
	_buildBoard() {
		this.boardCells = hexRing(HEX_RINGS);
		this.boardGfx = this.add.graphics();
		this.cellGfxMap = {};
		this.ghostGfx = this.add.graphics();
		this.overlayGfx = this.add.graphics();

		this._drawBoard();
	}

	_drawBoard() {
		const gfx = this.boardGfx;
		gfx.clear();
		const fgCol = hexToInt(this.palette.playerCore);
		const bgCol = hexToInt(this.palette.background);

		this.boardCells.forEach(({ q, r }) => {
			const p = hexToPixel(q, r, HEX_SIZE);
			const px = this.cx + p.x, py = this.cy + p.y;
			gfx.fillStyle(0x000000, 0.4);
			this._fillHex(gfx, px + 2, py + 3, HEX_SIZE - 1);
			gfx.fillStyle(bgCol, 1);
			this._fillHex(gfx, px, py, HEX_SIZE - 2);
			gfx.lineStyle(1, fgCol, 0.18);
			this._strokeHex(gfx, px, py, HEX_SIZE - 2);
		});
	}

	_cellKey(q, r) { return `${q},${r}`; }

	_isBoardCell(q, r) {
		return this.boardCells.some(c => c.q === q && c.r === r);
	}

	// ──────────────────────────────────────────────────────────
	//  TILE RENDERING
	// ──────────────────────────────────────────────────────────
	_placeTile(q, r, value, animated = false) {
		const key = this._cellKey(q, r);
		const p = hexToPixel(q, r, HEX_SIZE);
		const px = this.cx + p.x, py = this.cy + p.y;

		if (this.cellGfxMap[key]) {
			this.cellGfxMap[key].container.destroy();
		}

		const container = this.add.container(px, py);
		const gfx = this.add.graphics();
		const label = this._makeTileLabel(value);

		container.add([gfx, label]);
		this.cellGfxMap[key] = { container, gfx, label };
		this.cells[key] = { q, r, value };

		this._styleTile(gfx, label, value, HEX_SIZE - 3);

		if (animated) {
			container.setScale(0.3);
			this.tweens.add({
				targets: container,
				scaleX: 1, scaleY: 1,
				duration: 180,
				ease: 'Back.Out',
			});
		}
	}

	_makeTileLabel(value) {
		const text = this.add.text(0, 0, String(value), {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: value >= 100 ? '13px' : '17px',
			fontStyle: 'bold',
			color: hexToStr(this.palette.background),
			align: 'center',
		}).setOrigin(0.5);
		return text;
	}

	_styleTile(gfx, label, value, size) {
		gfx.clear();
		const hue = (value * 47) % 360;
		const col = Phaser.Display.Color.HSVToRGB(hue / 360, 0.7, 1.0);
		const tileCol = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
		const glowCol = hexToInt(this.palette.fxAccent);

		gfx.fillStyle(glowCol, 0.15);
		this._fillHex(gfx, 0, 0, size + 4);
		gfx.fillStyle(tileCol, 1);
		this._fillHex(gfx, 0, 0, size);
		gfx.fillStyle(0x3b82f6, 0.25);
		this._fillHex(gfx, 0, -size * 0.15, size * 0.55);
		gfx.lineStyle(1.5, 0x3b82f6, 0.4);
		this._strokeHex(gfx, 0, 0, size);

		label.setText(String(value));
		label.setFontSize(value >= 1000 ? '11px' : value >= 100 ? '13px' : '17px');
	}

	// ──────────────────────────────────────────────────────────
	//  GHOST / HOVER
	// ──────────────────────────────────────────────────────────
	_drawGhost() {
		const gfx = this.ghostGfx;
		gfx.clear();
		if (!this.ghostCell) return;
		const { q, r } = this.ghostCell;
		if (this.cells[this._cellKey(q, r)]) return;

		const p = hexToPixel(q, r, HEX_SIZE);
		const px = this.cx + p.x, py = this.cy + p.y;
		const fgCol = hexToInt(this.palette.playerCore);

		const nextValue = this.queue[0];
		const hue = (nextValue * 47) % 360;
		const col = Phaser.Display.Color.HSVToRGB(hue / 360, 0.7, 1.0);
		const tileCol = Phaser.Display.Color.GetColor(col.r, col.g, col.b);

		gfx.fillStyle(tileCol, 0.35);
		this._fillHex(gfx, px, py, HEX_SIZE - 3);
		gfx.lineStyle(2, fgCol, 0.7);
		this._strokeHex(gfx, px, py, HEX_SIZE - 3);
	}

	// ──────────────────────────────────────────────────────────
	//  INPUT
	// ──────────────────────────────────────────────────────────
	_onMove(ptr) {
		if (this.merging) return;
		const cell = this._pixelToHex(ptr.x, ptr.y);
		if (cell && this._isBoardCell(cell.q, cell.r) && !this.cells[this._cellKey(cell.q, cell.r)]) {
			this.ghostCell = cell;
		} else {
			this.ghostCell = null;
			this.ghostGfx.clear();
		}
	}

	_onDown(ptr) {
		if (this.merging) return;

		const cell = this._pixelToHex(ptr.x, ptr.y);
		if (cell && this._isBoardCell(cell.q, cell.r)) {
			const key = this._cellKey(cell.q, cell.r);
			if (!this.cells[key]) {
				const value = this.queue[0];
				this.playSound('place');
				this._dropTile(cell.q, cell.r, value, 0);
			}
		}

		this.ghostGfx.clear();
		this._onMove(ptr);
	}

	_dropTile(q, r, value, slotIdx) {
		this._placeTile(q, r, value, true);

		this.queue.splice(slotIdx, 1);
		this._fillQueue();
		this._drawQueue();

		this.time.delayedCall(220, () => {
			this._checkMerges(q, r);
		});
	}

	// ──────────────────────────────────────────────────────────
	//  MERGE LOGIC
	// ──────────────────────────────────────────────────────────
	_checkMerges(q, r) {
		if (this.merging) return;
		const key = this._cellKey(q, r);
		if (!this.cells[key]) return;
		const value = this.cells[key].value;

		const group = [];
		const visited = new Set();
		const stack = [{ q, r }];
		while (stack.length) {
			const cur = stack.pop();
			const k = this._cellKey(cur.q, cur.r);
			if (visited.has(k)) continue;
			visited.add(k);
			if (this.cells[k] && this.cells[k].value === value) {
				group.push(cur);
				neighbours(cur.q, cur.r).forEach(nb => {
					if (!visited.has(this._cellKey(nb.q, nb.r))) stack.push(nb);
				});
			}
		}

		if (group.length >= 3) {
			this.merging = true;
			this.combo++;
			this.playSound('merge');
			this._doMerge(group, value);
		} else {
			this.combo = 0;
			this._checkGameOver();
		}
	}

	_doMerge(group, value) {
		const newValue = value + 1;
		group.forEach(({ q, r }) => {
			const key = this._cellKey(q, r);
			const ctr = this.cellGfxMap[key]?.container;
			if (ctr) {
				this.tweens.add({
					targets: ctr,
					scaleX: 1.25, scaleY: 1.25,
					duration: 100,
					yoyo: true,
				});
			}
		});

		this.time.delayedCall(160, () => {
			const target = group[0];
			group.forEach(({ q, r }) => {
				const p = hexToPixel(q, r, HEX_SIZE);
				const tp = hexToPixel(target.q, target.r, HEX_SIZE);
				const key = this._cellKey(q, r);
				const ctr = this.cellGfxMap[key]?.container;
				if (ctr) {
					this.tweens.add({
						targets: ctr,
						x: this.cx + tp.x, y: this.cy + tp.y,
						scaleX: 0.1, scaleY: 0.1,
						duration: 220,
						ease: 'Quad.In',
						onComplete: () => ctr.destroy(),
					});
				}
				delete this.cellGfxMap[key];
				delete this.cells[key];
			});

			this.time.delayedCall(240, () => {
				const p = hexToPixel(target.q, target.r, HEX_SIZE);
				this._burst(this.cx + p.x, this.cy + p.y);
				this._placeTile(target.q, target.r, newValue, true);

				const pts = (BASE_SCORE[Math.min(newValue, 10)] || newValue * 500)
					* Math.max(1, this.combo);
				this._addScore(pts, this.cx + p.x, this.cy + p.y);
				this._drawHUD();

				this.merging = false;

				this.time.delayedCall(300, () => {
					this._checkMerges(target.q, target.r);
				});
			});
		});
	}

	// ──────────────────────────────────────────────────────────
	//  SCORE & LEVEL
	// ──────────────────────────────────────────────────────────
	_addScore(pts, px, py) {
		this.score += pts;
		this._floatingText(px, py - 20, `+${pts}${this.combo > 1 ? ` ×${this.combo}` : ''}`);
		if (this.score >= this.levelTarget && !this._advancing) {
			this._advancing = true;
			this.time.delayedCall(600, () => this._levelUp());
		}
	}

	_levelUp() {
		this.level++;
		this.playSound('levelup');
		this.levelTarget = this._levelTarget();

		if (this.level % 5 === 1) {
			this.palette = window.FreshPlay.getCurrentPalette();
		}

		// Explicit Ad trigger logic
		if ((this.level - 1) % 5 === 0) {
			try {
				['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
					if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
				});
			} catch (_) { }
		}

		window.FreshPlay.levelComplete(() => {
			this._advancing = false;
			this._drawHUD();
			const flash = this.add.graphics();
			const fgCol = hexToInt(this.palette.playerCore);
			flash.fillStyle(fgCol, 0.25);
			flash.fillRect(0, 0, this.scale.width, this.scale.height);
			this.tweens.add({
				targets: flash, alpha: 0, duration: 600,
				onComplete: () => flash.destroy()
			});
		});
	}

	_levelTarget() {
		return 500 * this.level * this.level;
	}

	// ──────────────────────────────────────────────────────────
	//  PARTICLES
	// ──────────────────────────────────────────────────────────
	_burst(px, py) {
		const accentCol = hexToInt(this.palette.fxAccent);
		const coreCol = hexToInt(this.palette.playerCore);
		const count = 24 + this.combo * 6;

		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 60 + Math.random() * 180;
			const col = Math.random() > 0.5 ? accentCol : coreCol;
			const size = 2 + Math.random() * 4;
			this.particles.push({
				x: px, y: py,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				alpha: 1,
				life: 0.6 + Math.random() * 0.5,
				maxLife: 0,
				size,
				col: col,
				gfx: this.add.graphics(),
			});
			this.particles[this.particles.length - 1].maxLife =
				this.particles[this.particles.length - 1].life;
		}
		const ring = this.add.graphics();
		ring.lineStyle(3, accentCol, 1);
		ring.strokeCircle(px, py, 5);
		this.tweens.add({
			targets: ring,
			scaleX: 5, scaleY: 5, alpha: 0,
			duration: 400, ease: 'Quad.Out',
			onComplete: () => ring.destroy(),
		});
	}

	_tickParticles(delta) {
		const dt = delta / 1000;
		this.particles = this.particles.filter(p => {
			p.life -= dt;
			if (p.life <= 0) { p.gfx.destroy(); return false; }
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += 120 * dt;
			const a = p.life / p.maxLife;
			p.gfx.clear();
			p.gfx.fillStyle(p.col, a);
			p.gfx.fillCircle(p.x, p.y, p.size * a);
			return true;
		});
	}

	// ──────────────────────────────────────────────────────────
	//  HUD
	// ──────────────────────────────────────────────────────────
	_buildHUD() {
		const W = this.scale.width;
		const ifCol = hexToStr(this.palette.interface);
		const pcCol = hexToStr(this.palette.playerCore);

		this.hudBarGfx = this.add.graphics();
		this.hudBarGfx.fillStyle(0x000000, 0.5);
		this.hudBarGfx.fillRect(0, 0, W, 64);

		this.add.text(20, 10, 'SCORE', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '10px', color: pcCol, alpha: 0.7,
		});
		this.scoreText = this.add.text(20, 24, '0', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '22px', fontStyle: 'bold', color: ifCol,
		});

		this.add.text(W / 2, 10, 'HEXA MERGE', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '11px', color: pcCol, align: 'center',
		}).setOrigin(0.5, 0);

		this.add.text(W - 20, 10, 'LEVEL', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '10px', color: pcCol, align: 'right',
		}).setOrigin(1, 0);
		this.levelText = this.add.text(W - 20, 24, '1', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '22px', fontStyle: 'bold', color: ifCol, align: 'right',
		}).setOrigin(1, 0);

		this.progressBarBg = this.add.graphics();
		this.progressBarFg = this.add.graphics();
		this._drawProgressBar();
	}

	_drawHUD() {
		this.scoreText.setText(this._fmtScore(this.score));
		this.levelText.setText(String(this.level));
		this._drawProgressBar();
	}

	_drawProgressBar() {
		const W = this.scale.width;
		const pct = Math.min(1, this.score / this.levelTarget);
		const pcColInt = hexToInt(this.palette.playerCore);

		this.progressBarBg.clear();
		this.progressBarBg.fillStyle(0xffffff, 0.97);
		this.progressBarBg.fillRect(0, 58, W, 4);

		this.progressBarFg.clear();
		this.progressBarFg.fillStyle(pcColInt, 0.9);
		this.progressBarFg.fillRect(0, 58, W * pct, 4);
	}

	_fmtScore(n) {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return String(n);
	}

	// ──────────────────────────────────────────────────────────
	//  QUEUE (next tiles panel)
	// ──────────────────────────────────────────────────────────
	_buildQueue() {
		const H = this.scale.height;
		const W = this.scale.width;
		this.queueGfx = this.add.graphics();
		this.queueTiles = [];

		this.queueGfx.fillStyle(0x000000, 0.45);
		this.queueGfx.fillRoundedRect(W / 2 - 110, H - 120, 220, 110, 14);

		this.add.text(W / 2, H - 115, 'NEXT', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '10px', color: hexToStr(this.palette.playerCore), align: 'center',
		}).setOrigin(0.5, 0);
	}

	_fillQueue() {
		while (this.queue.length < QUEUE_LEN) {
			const maxVal = 1 + Math.floor(this.level / 3);
			this.queue.push(Phaser.Math.Between(1, Math.min(maxVal, 6)));
		}
	}

	_drawQueue() {
		const W = this.scale.width, H = this.scale.height;
		this.queueTiles.forEach(c => c.destroy());
		this.queueTiles = [];

		const spacing = 68;
		const startX = W / 2 - spacing * (QUEUE_LEN - 1) / 2;
		const qy = H - 68;
		const sz = 26;

		this.queue.forEach((val, i) => {
			const qx = startX + i * spacing;
			const gfx = this.add.graphics();
			const lbl = this.add.text(qx, qy, String(val), {
				fontFamily: "'Courier New', Courier, monospace",
				fontSize: '14px', fontStyle: 'bold',
				color: hexToStr(this.palette.background), align: 'center',
			}).setOrigin(0.5);

			const hue = (val * 47) % 360;
			const col = Phaser.Display.Color.HSVToRGB(hue / 360, 0.7, 1.0);
			const tcol = Phaser.Display.Color.GetColor(col.r, col.g, col.b);

			if (i === 0) {
				gfx.fillStyle(tcol, 1);
				gfx.lineStyle(2.5, 0x3b82f6, 0.8);
			} else {
				gfx.fillStyle(tcol, 0.5);
				gfx.lineStyle(1.5, 0x3b82f6, 0.3);
				lbl.setAlpha(0.6);
			}

			this._fillHex(gfx, qx, qy, sz);
			this._strokeHex(gfx, qx, qy, sz);

			this.queueTiles.push(gfx, lbl);
		});
	}

	// ──────────────────────────────────────────────────────────
	//  FLOATING TEXT
	// ──────────────────────────────────────────────────────────
	_floatingText(px, py, msg) {
		const fxColStr = hexToStr(this.palette.fxAccent);
		const t = this.add.text(px, py, msg, {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '18px', fontStyle: 'bold',
			color: fxColStr,
			stroke: '#ffffff', strokeThickness: 3,
		}).setOrigin(0.5);
		this.tweens.add({
			targets: t,
			y: py - 60, alpha: 0,
			duration: 900, ease: 'Quad.Out',
			onComplete: () => t.destroy(),
		});
	}

	// ──────────────────────────────────────────────────────────
	//  GAME OVER CHECK
	// ──────────────────────────────────────────────────────────
	_checkGameOver() {
		const occupied = Object.keys(this.cells).length;
		if (occupied < this.boardCells.length) return;

		this.playSound('gameover');
		this._showGameOver();
	}

	_showGameOver() {
		const W = this.scale.width, H = this.scale.height;
		const overlay = this.add.graphics();
		overlay.fillStyle(0x000000, 0.75);
		overlay.fillRect(0, 0, W, H);

		const pcColStr = hexToStr(this.palette.playerCore);
		const ifColStr = hexToStr(this.palette.interface);
		const bgColStr = hexToStr(this.palette.background);
		const pcColInt = hexToInt(this.palette.playerCore);

		this.add.text(W / 2, H / 2 - 80, 'GAME OVER', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '36px', fontStyle: 'bold', color: pcColStr,
			align: 'center',
		}).setOrigin(0.5);

		this.add.text(W / 2, H / 2 - 30, `SCORE: ${this._fmtScore(this.score)}`, {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '20px', color: ifColStr, align: 'center',
		}).setOrigin(0.5);

		const btnGfx = this.add.graphics();
		btnGfx.fillStyle(pcColInt, 1);
		btnGfx.fillRoundedRect(W / 2 - 80, H / 2 + 20, 160, 44, 8);
		const btnTxt = this.add.text(W / 2, H / 2 + 42, 'PLAY AGAIN', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '14px', fontStyle: 'bold',
			color: bgColStr, align: 'center',
		}).setOrigin(0.5);

		btnGfx.setInteractive(
			new Phaser.Geom.Rectangle(W / 2 - 80, H / 2 + 20, 160, 44),
			Phaser.Geom.Rectangle.Contains
		);
		btnGfx.on('pointerdown', () => {
			this.scene.restart();
		});
	}

	// ──────────────────────────────────────────────────────────
	//  HEX GEOMETRY HELPERS
	// ──────────────────────────────────────────────────────────
	_hexPoints(cx, cy, size) {
		const pts = [];
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 180) * (60 * i - 30);
			pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
		}
		return pts;
	}

	_fillHex(gfx, cx, cy, size) {
		const pts = this._hexPoints(cx, cy, size);
		gfx.fillPoints(pts, true);
	}

	_strokeHex(gfx, cx, cy, size) {
		const pts = this._hexPoints(cx, cy, size);
		gfx.strokePoints(pts, true);
	}

	_pixelToHex(px, py) {
		const dx = px - this.cx;
		const dy = py - this.cy;
		const q = (Math.sqrt(3) / 3 * dx - 1 / 3 * dy) / HEX_SIZE;
		const r = (2 / 3 * dy) / HEX_SIZE;
		return this._hexRound(q, r);
	}

	_hexRound(q, r) {
		const s = -q - r;
		let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
		const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
		if (dq > dr && dq > ds) rq = -rr - rs;
		else if (dr > ds) rr = -rq - rs;
		return { q: rq, r: rr };
	}
}

// ============================================================
//  PHASER CONFIG
// ============================================================
const config = {
	type: Phaser.AUTO,
	width: 400,
	height: 680,
	backgroundColor: '#f8fafc',
	scene: [BootScene, GameScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
	parent: 'game-container',
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: 400,
		height: 680,
	},
	render: {
		antialias: true,
		pixelArt: false,
		roundPixels: false,
	},
};

// ── Boot ──
window.addEventListener('load', () => {
	new Phaser.Game(config);
});
