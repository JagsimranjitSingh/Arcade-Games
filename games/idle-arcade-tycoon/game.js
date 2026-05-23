// ============================================================
//  IDLE ARCADE TYCOON 
// ============================================================

/* FreshPlay shim */
if (!window.FreshPlay) {
	window.FreshPlay = {
		_lvl: 1,
		levelComplete(cb) {
			this._lvl++;
			if (typeof cb === 'function') setTimeout(cb, 500);
		},
		getCurrentPalette() {
			const P = [
				{ background: '#0a0a1a', playerCore: '#00ffe7', interface: '#111128', fxAccent: '#ff00aa' },
				{ background: '#0d1117', playerCore: '#f7c948', interface: '#141920', fxAccent: '#00d4ff' },
				{ background: '#0f0a1e', playerCore: '#b44fff', interface: '#150f25', fxAccent: '#39ff14' },
				{ background: '#071a07', playerCore: '#39ff14', interface: '#0a200a', fxAccent: '#ff6b00' },
				{ background: '#1a0808', playerCore: '#ff6b35', interface: '#220e0e', fxAccent: '#00ffe7' },
			];
			return P[(this._lvl - 1) % P.length];
		}
	};
}

// helpers
const hex = s => parseInt(s.replace('#', ''), 16);

// Constants
const TILE_W = 100, TILE_H = 60;
const ISO_OX = 420, ISO_OY = 195;

const CABINET_TYPES = [
	{ id: 0, name: 'PONG-X', baseCPS: 0.5, buyCost: 0, w: 70, h: 90 },
	{ id: 1, name: 'SPACE-RAY', baseCPS: 2, buyCost: 50, w: 70, h: 100 },
	{ id: 2, name: 'TANK-RUSH', baseCPS: 8, buyCost: 200, w: 80, h: 110 },
	{ id: 3, name: 'PIXEL-RPG', baseCPS: 30, buyCost: 800, w: 85, h: 120 },
	{ id: 4, name: 'HYPER-Z', baseCPS: 120, buyCost: 3000, w: 90, h: 130 },
	{ id: 5, name: 'QUANTUM-Q', baseCPS: 500, buyCost: 12000, w: 95, h: 140 },
];
const CAB_COLORS = [0x00ffe7, 0xf7c948, 0xb44fff, 0x39ff14, 0xff6b35, 0xff00aa];

const MILESTONES = [500, 1000, 5000, 10000, 50000, 100000, 500000, 1e6];
const SAVE_KEY = 'iat_save_v2';

function isoXY(col, row) {
	return { x: ISO_OX + (col - row) * (TILE_W / 2), y: ISO_OY + (col + row) * (TILE_H / 2) };
}
function fmtN(n) {
	if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
	if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
	return Math.floor(n).toString();
}

// AudioManager
class AudioManager {
	constructor() {
		try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
		catch (_) { this.ctx = null; }
		this._pitch = 0; this._pitchTimer = null;
	}
	_r() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
	_osc(freq, type, gain, dur, ramp) {
		if (!this.ctx) return;
		this._r();
		const c = this.ctx.currentTime;
		const g = this.ctx.createGain(), o = this.ctx.createOscillator();
		o.type = type; o.frequency.setValueAtTime(freq, c);
		if (ramp) o.frequency.exponentialRampToValueAtTime(ramp, c + dur);
		g.gain.setValueAtTime(gain, c);
		g.gain.exponentialRampToValueAtTime(0.001, c + dur);
		o.connect(g); g.connect(this.ctx.destination);
		o.start(); o.stop(c + dur);
	}
	coin() { this._osc(880, 'sine', 0.12, 0.1); this._osc(1320, 'sine', 0.07, 0.08); }
	tap() {
		clearTimeout(this._pitchTimer);
		this._pitch = Math.min(this._pitch + 45, 450);
		this._osc(280 + this._pitch, 'square', 0.05, 0.05);
		this._pitchTimer = setTimeout(() => this._pitch = 0, 700);
	}
	place() { this._osc(70, 'sawtooth', 0.22, 0.35); setTimeout(() => this._osc(220, 'sine', 0.1, 0.2), 110); }
	upgrade() { [440, 550, 660, 880].forEach((f, i) => setTimeout(() => this._osc(f, 'sine', 0.11, 0.14), i * 55)); }
	levelUp() { [330, 440, 550, 660, 880, 1100].forEach((f, i) => setTimeout(() => this._osc(f, 'triangle', 0.13, 0.22), i * 75)); }
	ching() { this._osc(1760, 'sine', 0.18, 0.15); this._osc(2200, 'sine', 0.1, 0.1); }
}

// GameState
class GameState {
	constructor() {
		this.coins = 0;
		this.totalEarned = 0;
		this.cabinets = [];   // {col,row,typeId,level}
		this.milestoneIdx = 0;
		this.level = 1;
		this.palette = window.FreshPlay.getCurrentPalette();
		this.costMult = 1;
		this.gridCols = 6;
		this.gridRows = 5;
		this.stats = { totalClicks: 0, totalUpgrades: 0, cabinetsPlaced: 0 };
	}
	get cps() {
		return this.cabinets.reduce((s, c) => {
			return s + CABINET_TYPES[c.typeId].baseCPS * c.level;
		}, 0);
	}
	add(n) { this.coins += n; this.totalEarned += n; }
	occupied(col, row) { return this.cabinets.some(c => c.col === col && c.row === row); }
	place(col, row, typeId) {
		this.cabinets.push({ col, row, typeId, level: 1 });
		this.stats.cabinetsPlaced++;
	}
	upgradeCost(idx) {
		const c = this.cabinets[idx];
		return Math.floor(CABINET_TYPES[c.typeId].buyCost * 0.6 * c.level * this.costMult + 30);
	}
	buyUpgrade(idx) {
		const cost = this.upgradeCost(idx);
		if (this.coins < cost) return 0;
		this.coins -= cost; this.cabinets[idx].level++;
		this.stats.totalUpgrades++;
		return cost;
	}
	checkMilestone() {
		const m = MILESTONES[this.milestoneIdx];
		if (m !== undefined && this.totalEarned >= m) { this.milestoneIdx++; return m; }
		return null;
	}
	save() {
		try {
			localStorage.setItem(SAVE_KEY, JSON.stringify({
				coins: this.coins, totalEarned: this.totalEarned,
				cabinets: this.cabinets, milestoneIdx: this.milestoneIdx,
				level: this.level, costMult: this.costMult,
				gridCols: this.gridCols, gridRows: this.gridRows, stats: this.stats
			}));
			return true;
		} catch (_) { return false; }
	}
	load() {
		try {
			const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
			if (!d) return false;
			Object.assign(this, d);
			// Re-sync FreshPlay level counter
			for (let i = 1; i < this.level; i++) window.FreshPlay._lvl = (this.level);
			this.palette = window.FreshPlay.getCurrentPalette();
			return true;
		} catch (_) { return false; }
	}
}

// ══════════════════════════════════════════════════════════════
//  BOOT SCENE  — generates all programmatic textures
// ══════════════════════════════════════════════════════════════
class BootScene extends Phaser.Scene {
	constructor() { super('Boot'); }

	preload() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });

		// Coin
		g.clear();
		for (let r = 18; r > 0; r -= 2) {
			const t = r / 18;
			g.fillStyle(Phaser.Display.Color.GetColor(
				Math.floor(255 * t + 180 * (1 - t)),
				Math.floor(215 * t + 150 * (1 - t)), 0), 1);
			g.fillCircle(18, 18, r);
		}
		g.fillStyle(0xffec80, 1); g.fillCircle(14, 14, 6);
		g.generateTexture('coin', 36, 36);

		// ISO tile
		g.clear();
		g.fillStyle(0x1a2035, 1);
		g.fillPoints([{ x: 50, y: 0 }, { x: 100, y: 30 }, { x: 50, y: 60 }, { x: 0, y: 30 }], true);
		g.lineStyle(1.5, 0x2a3555, 1);
		g.strokePoints([{ x: 50, y: 0 }, { x: 100, y: 30 }, { x: 50, y: 60 }, { x: 0, y: 30 }], true);
		g.generateTexture('tile', 100, 60);

		// ISO tile hover
		g.clear();
		g.fillStyle(0x3355aa, 0.35);
		g.fillPoints([{ x: 50, y: 0 }, { x: 100, y: 30 }, { x: 50, y: 60 }, { x: 0, y: 30 }], true);
		g.lineStyle(2, 0x66aaff, 0.8);
		g.strokePoints([{ x: 50, y: 0 }, { x: 100, y: 30 }, { x: 50, y: 60 }, { x: 0, y: 30 }], true);
		g.generateTexture('tile_hover', 100, 60);

		// ISO wall left
		g.clear();
		g.fillStyle(0x111825, 1);
		g.fillPoints([{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 50, y: 90 }, { x: 0, y: 60 }], true);
		g.lineStyle(1, 0x1e2d45, 1);
		g.strokePoints([{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 50, y: 90 }, { x: 0, y: 60 }], true);
		g.generateTexture('wall_left', 50, 90);

		// ISO wall right
		g.clear();
		g.fillStyle(0x0d131e, 1);
		g.fillPoints([{ x: 0, y: 0 }, { x: 50, y: -30 }, { x: 50, y: 30 }, { x: 0, y: 60 }], true);
		g.lineStyle(1, 0x182030, 1);
		g.strokePoints([{ x: 0, y: 0 }, { x: 50, y: -30 }, { x: 50, y: 30 }, { x: 0, y: 60 }], true);
		g.generateTexture('wall_right', 50, 60);

		// Cabinet textures
		CABINET_TYPES.forEach((t, i) => {
			const c = CAB_COLORS[i];
			const dark = Phaser.Display.Color.IntegerToColor(c).darken(45).color;
			const mid = Phaser.Display.Color.IntegerToColor(c).darken(20).color;
			g.clear();
			// Shadow base
			g.fillStyle(0x000000, 0.4);
			g.fillEllipse(t.w / 2 + 4, t.h + 4, t.w * 0.8, 14);
			// Cabinet side (3D feel)
			g.fillStyle(dark, 1);
			g.fillRect(t.w - 8, 22, 8, t.h - 22);
			// Main body
			g.fillStyle(dark, 1);
			g.fillRect(0, 20, t.w - 6, t.h - 20);
			// Body highlight
			g.fillStyle(mid, 0.3);
			g.fillRect(0, 20, 6, t.h - 20);
			// Screen bezel
			g.fillStyle(0x050508, 1);
			g.fillRect(8, 26, t.w - 22, 36);
			// Screen glow
			g.fillStyle(c, 0.9);
			g.fillRect(10, 28, t.w - 26, 32);
			// Scanlines
			for (let sy = 30; sy < 60; sy += 4) {
				g.fillStyle(0x000000, 0.25);
				g.fillRect(10, sy, t.w - 26, 2);
			}
			// Pixel art cross on screen
			g.fillStyle(0xffffff, 0.6);
			const sx = 10 + (t.w - 26) / 2, sy2 = 28 + 32 / 2;
			g.fillRect(sx - 1, sy2 - 6, 2, 12); g.fillRect(sx - 6, sy2 - 1, 12, 2);
			// Marquee top
			g.fillStyle(c, 1);
			g.fillRect(0, 0, t.w - 6, 22);
			g.fillStyle(0x000000, 0.55);
			g.fillRect(5, 4, t.w - 16, 14);
			// Marquee text bar
			g.fillStyle(c, 0.8);
			g.fillRect(7, 7, t.w - 20, 8);
			// Bottom base
			g.fillStyle(0x0a0a0a, 1);
			g.fillRect(4, t.h - 14, t.w - 16, 14);
			// Coin slot
			g.fillStyle(0x222222, 1);
			g.fillRect(t.w / 2 - 15, t.h - 10, 30, 5);
			g.fillStyle(0x000000, 1);
			g.fillRect(t.w / 2 - 8, t.h - 8, 16, 2);
			// Joystick base
			g.fillStyle(0x1a1a1a, 1);
			g.fillEllipse(t.w / 2 - 12, t.h - 22, 18, 10);
			g.fillStyle(0x888888, 1);
			g.fillCircle(t.w / 2 - 12, t.h - 26, 5);
			g.fillStyle(0x333333, 1);
			g.fillCircle(t.w / 2 - 12, t.h - 29, 3);
			// Buttons
			const btns = [0xff2222, 0x22aaff, 0xffff00];
			btns.forEach((bc, bi) => {
				g.fillStyle(bc, 1);
				g.fillCircle(t.w / 2 + 8 + bi * 9, t.h - 24, 4);
				g.fillStyle(0xffffff, 0.3);
				g.fillCircle(t.w / 2 + 7 + bi * 9, t.h - 25, 1.5);
			});
			g.generateTexture(`cabinet_${i}`, t.w + 8, t.h + 6);
		});

		// Glow blob
		g.clear();
		for (let r = 32; r > 0; r -= 4) {
			g.fillStyle(0xffffff, 0.06 * (1 - r / 32) + 0.02);
			g.fillCircle(32, 32, r);
		}
		g.generateTexture('glow', 64, 64);

		// Particle dot
		g.clear();
		g.fillStyle(0xffffff, 1); g.fillCircle(5, 5, 5);
		g.generateTexture('dot', 10, 10);

		// Star burst (for level-up)
		g.clear();
		g.fillStyle(0xffd700, 1);
		for (let a = 0; a < 8; a++) {
			const ang = a * Math.PI / 4;
			g.fillTriangle(
				20 + Math.cos(ang) * 2, 20 + Math.sin(ang) * 2,
				20 + Math.cos(ang + 0.3) * 18, 20 + Math.sin(ang + 0.3) * 18,
				20 + Math.cos(ang - 0.3) * 18, 20 + Math.sin(ang - 0.3) * 18
			);
		}
		g.fillStyle(0xffffc0, 1); g.fillCircle(20, 20, 6);
		g.generateTexture('star_burst', 40, 40);

		g.destroy();
	}

	create() { this.scene.start('Game'); }
}

// ══════════════════════════════════════════════════════════════
//  GAME SCENE
// ══════════════════════════════════════════════════════════════
class GameScene extends Phaser.Scene {
	constructor() { super('Game'); }

	init() {
		this.state = new GameState();
		this.audio = new AudioManager();
		this.sprites = [];          // cabinet sprite records
		this._placing = null;        // typeId being placed, or null
		this._selIdx = -1;          // selected cabinet idx
		this._infoOpen = false;
		this._shopOpen = false;
		this._levelUpLock = false;    // prevent re-entrant level-up
		this._saveTimer = 0;
	}

	create() {
		const W = this.scale.width, H = this.scale.height;

		// Try load save
		const loaded = this.state.load();

		// Layers
		this.bgRect = this.add.rectangle(0, 0, W, H, hex(this.state.palette.background)).setOrigin(0, 0).setDepth(0);
		this.bgGfx = this.add.graphics().setDepth(1);
		this.wallGfx = this.add.graphics().setDepth(2);
		this.tileGrp = this.add.group();
		this.cabLayer = this.add.layer().setDepth(10);

		this._drawBg();
		this._drawGrid();

		// Particles
		this.particles = this.add.particles(0, 0, 'dot', {
			speed: { min: 30, max: 100 }, angle: { min: 240, max: 300 },
			scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
			lifespan: 700, tint: hex(this.state.palette.fxAccent),
			quantity: 0, emitting: false,
		}).setDepth(50);

		this.coinParticles = this.add.particles(0, 0, 'coin', {
			speed: { min: 20, max: 60 }, angle: { min: 260, max: 280 },
			scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
			lifespan: 900, quantity: 0, emitting: false,
			gravityY: 120,
		}).setDepth(51);

		// Cabinet sprites
		if (!loaded) this.state.place(2, 2, 0);
		this._syncSprites();

		// HUD
		this._buildHUD();
		this._buildShopPanel();
		this._buildInfoPanel();
		this._buildStatsOverlay();

		// Timer: auto-save every 10s
		this.time.addEvent({
			delay: 10000, loop: true, callback: () => {
				this.state.save(); this._showToast('AUTO-SAVED');
			}
		});

		// CPS tick 100ms
		this.time.addEvent({ delay: 100, loop: true, callback: this._tick, callbackScope: this });

		// Placing cursor hint
		this.placingHint = this.add.text(W / 2, 90, '', {
			fontFamily: "'Courier New',monospace", fontSize: '14px',
			color: '#ffffff', stroke: '#000000', strokeThickness: 4,
			align: 'center'
		}).setOrigin(0.5).setDepth(5000).setAlpha(0);

		this._applyPalette();

		// Intro fade
		this.cameras.main.setAlpha(0);
		this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 900, ease: 'Power2' });

		if (loaded) this._showToast('SAVE LOADED ✓');
	}

	//  DRAWING
	_drawBg() {
		const pal = this.state.palette;
		const W = this.scale.width, H = this.scale.height;
		this.bgRect.setFillStyle(hex(pal.background));
		this.bgGfx.clear();
		// Radial glow halo
		const core = hex(pal.playerCore);
		for (let r = Math.max(W, H) * 0.85; r > 0; r -= 35) {
			const a = 0.055 * (1 - r / (Math.max(W, H) * 0.85));
			this.bgGfx.fillStyle(core, a);
			this.bgGfx.fillCircle(W / 2, H * 0.38, r);
		}
		// Subtle horizontal scan lines in bg
		for (let y = 0; y < H; y += 6) {
			this.bgGfx.fillStyle(0x000000, 0.04);
			this.bgGfx.fillRect(0, y, W, 1);
		}
	}

	_drawGrid() {
		this.tileGrp.clear(true, true);
		this.wallGfx.clear();
		const pal = this.state.palette;
		const cols = this.state.gridCols, rows = this.state.gridRows;

		// Draw walls along back edges
		for (let col = 0; col < cols; col++) {
			const p = isoXY(col, 0);
			this.wallGfx.fillStyle(hex(pal.playerCore), 0.08);
			this.wallGfx.fillRect(p.x - 50, p.y - 60, 100, 60);
		}

		// Tiles — back to front so depth sorts correctly
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const pos = isoXY(col, row);
				const depth = (row * 100 + col);

				const tile = this.add.image(pos.x, pos.y, 'tile')
					.setDepth(depth)
					.setInteractive({ useHandCursor: true });

				tile._col = col; tile._row = row;

				// Hover: swap texture
				tile.on('pointerover', () => {
					if (this._placing !== null) tile.setTexture('tile_hover');
				});
				tile.on('pointerout', () => { tile.setTexture('tile'); });
				tile.on('pointerdown', () => this._onTileClick(col, row));
				this.tileGrp.add(tile);
			}
		}
	}

	//  CABINET SPRITES
	_syncSprites() {
		// Destroy existing
		this.sprites.forEach(s => {
			s.sprite?.destroy(); s.glow?.destroy(); s.lvlTxt?.destroy();
			s.scanAnim?.remove();
		});
		this.sprites = [];

		this.state.cabinets.forEach((cab, idx) => {
			const t = CABINET_TYPES[cab.typeId];
			const pos = isoXY(cab.col, cab.row);
			const depth = (cab.row * 100 + cab.col) + 5;

			// Glow
			const glow = this.add.image(pos.x, pos.y - t.h * 0.5, 'glow')
				.setScale(3.2).setDepth(depth - 1).setAlpha(0.45)
				.setTint(hex(this.state.palette.playerCore));
			this.tweens.add({
				targets: glow, alpha: { from: 0.25, to: 0.65 }, scale: { from: 3, to: 3.6 },
				duration: 1400 + idx * 180, yoyo: true, repeat: -1, ease: 'Sine.InOut'
			});

			// Cabinet sprite
			const sprite = this.add.image(pos.x, pos.y - t.h * 0.5, 'cabinet_' + cab.typeId)
				.setDepth(depth).setInteractive({ useHandCursor: true });
			sprite.on('pointerover', () => { sprite.setTint(0xffffff); });
			sprite.on('pointerout', () => { sprite.clearTint(); });
			sprite.on('pointerdown', () => this._onCabClick(idx));

			// Level badge
			const lvlTxt = this.add.text(
				pos.x + t.w * 0.25, pos.y - t.h - 2,
				`LV${cab.level}`, {
				fontFamily: "'Courier New',monospace",
				fontSize: '11px', fontStyle: 'bold',
				color: this.state.palette.fxAccent,
				stroke: '#000000', strokeThickness: 3
			}
			).setDepth(depth + 1).setOrigin(0.5);

			this.sprites.push({ sprite, glow, lvlTxt, cabinetIdx: idx });
		});
	}

	_bounceCab(idx) {
		const s = this.sprites[idx];
		if (!s) return;
		this.tweens.add({
			targets: s.sprite, y: s.sprite.y - 14, duration: 70,
			yoyo: true, ease: 'Power2'
		});
		this.tweens.add({
			targets: s.glow, scaleX: 4, scaleY: 4, duration: 120,
			yoyo: true, ease: 'Power1'
		});
	}

	//  HUD
	_buildHUD() {
		const W = this.scale.width, pal = this.state.palette;

		// Top bar
		this.hudBg = this.add.rectangle(0, 0, W, 74, hex(pal.interface), 0.96)
			.setOrigin(0, 0).setDepth(2000);
		this.hudLine = this.add.rectangle(0, 74, W, 2, hex(pal.playerCore))
			.setOrigin(0, 0).setDepth(2000);
		this.hudGlow = this.add.rectangle(0, 74, W, 20, hex(pal.playerCore), 0.07)
			.setOrigin(0, 0).setDepth(2000);

		// Coin icon
		this.hudCoinIco = this.add.image(28, 37, 'coin').setScale(1.3).setDepth(2001);

		// Coin count
		this.hudCoins = this.add.text(58, 14, '0', {
			fontFamily: "'Courier New',monospace",
			fontSize: '30px', fontStyle: 'bold',
			color: pal.fxAccent,
			shadow: { offsetX: 0, offsetY: 0, color: pal.fxAccent, blur: 12, fill: true }
		}).setDepth(2001);

		// CPS
		this.hudCPS = this.add.text(58, 50, '0.0 /sec', {
			fontFamily: "'Courier New',monospace",
			fontSize: '12px', color: pal.playerCore, alpha: 0.9
		}).setDepth(2001);

		// Right: LEVEL
		this.hudLvlBg = this.add.rectangle(W - 12, 37, 130, 52, hex(pal.playerCore), 0.12)
			.setOrigin(1, 0.5).setDepth(2000).setStrokeStyle(1, hex(pal.playerCore), 0.4);
		this.hudLvlLbl = this.add.text(W - 22, 18, 'LEVEL', {
			fontFamily: "'Courier New',monospace", fontSize: '10px', color: pal.playerCore
		}).setOrigin(1, 0).setDepth(2001);
		this.hudLvlNum = this.add.text(W - 22, 30, `${this.state.level}`, {
			fontFamily: "'Courier New',monospace",
			fontSize: '26px', fontStyle: 'bold', color: pal.fxAccent,
			shadow: { offsetX: 0, offsetY: 0, color: pal.fxAccent, blur: 10, fill: true }
		}).setOrigin(1, 0).setDepth(2001);

		// Centre: milestone progress
		const mw = 200;
		this.hudMileBg = this.add.rectangle(W / 2, 60, mw, 7, 0x111111)
			.setOrigin(0.5).setDepth(2001).setStrokeStyle(1, hex(pal.playerCore), 0.3);
		this.hudMileBar = this.add.rectangle(W / 2 - mw / 2, 60, 2, 7, hex(pal.fxAccent))
			.setOrigin(0, 0.5).setDepth(2002);
		this.hudMileLbl = this.add.text(W / 2, 40, 'NEXT LEVEL: 500', {
			fontFamily: "'Courier New',monospace", fontSize: '11px',
			color: pal.playerCore, alpha: 0.8
		}).setOrigin(0.5).setDepth(2001);

		// Bottom buttons
		const bY = this.scale.height - 44;
		this.btnShop = this._mkBtn(W / 2 - 95, bY, '🛒  SHOP', () => this._toggleShop());
		this.btnExpand = this._mkBtn(W / 2 + 95, bY, '⚡  EXPAND', () => this._tryExpand());
		this.btnSave = this._mkBtn(W - 60, bY, '💾', () => { this.state.save(); this._showToast('SAVED ✓'); }, 80, 38);
		this.btnStats = this._mkBtn(60, bY, '📊', () => this._toggleStats(), 80, 38);

		// Placing hint strip
		this.hintBg = this.add.rectangle(W / 2, 90, 340, 30, 0x000000, 0)
			.setOrigin(0.5).setDepth(4999);
	}

	_mkBtn(x, y, label, cb, w = 150, h = 42) {
		const pal = this.state.palette;
		const bg = this.add.rectangle(x, y, w, h, hex(pal.interface))
			.setDepth(2000).setInteractive({ useHandCursor: true })
			.setStrokeStyle(1.5, hex(pal.playerCore), 0.7);
		const txt = this.add.text(x, y, label, {
			fontFamily: "'Courier New',monospace",
			fontSize: '13px', fontStyle: 'bold', color: pal.playerCore
		}).setOrigin(0.5).setDepth(2001);
		bg.on('pointerover', () => { bg.setFillStyle(hex(pal.playerCore), 0.18); });
		bg.on('pointerout', () => { bg.setFillStyle(hex(pal.interface), 1); });
		bg.on('pointerdown', () => {
			this.tweens.add({ targets: [bg, txt], scaleX: 0.92, scaleY: 0.92, duration: 70, yoyo: true });
			cb();
		});
		return { bg, txt };
	}

	_updateHUD() {
		const pal = this.state.palette;
		this.hudCoins.setText(fmtN(Math.floor(this.state.coins)));
		this.hudCPS.setText(this.state.cps.toFixed(1) + ' /sec');
		this.hudLvlNum.setText(`${this.state.level}`);
		// Milestone bar
		const mi = this.state.milestoneIdx;
		const target = MILESTONES[mi] || MILESTONES[MILESTONES.length - 1];
		const prev = mi > 0 ? MILESTONES[mi - 1] : 0;
		const prog = Math.min((this.state.totalEarned - prev) / (target - prev), 1);
		this.hudMileBar.width = Math.max(2, 200 * prog);
		this.hudMileLbl.setText(`NEXT: ${fmtN(target)}`);
	}

	//  SHOP PANEL
	_buildShopPanel() {
		const W = this.scale.width, H = this.scale.height;
		const pal = this.state.palette;

		// Adaptive panel height
		const PH = Math.max(280, Math.min(320, H * 0.55));
		const cardAreaH = PH - 48;
		const rowGap = Math.floor(cardAreaH / 2);
		const cardH = rowGap - 8;
		const colW = Math.floor(W / 3);
		const iw = colW - 12;
		const btnH = 22;

		this.shopCont = this.add.container(0, H + 10).setDepth(3000);
		this._shopClosedY = H + 10;
		this._shopOpenY = Math.max(78, H - PH);

		// Panel bg
		const bg = this.add.rectangle(0, 0, W, PH, hex(pal.interface), 0.97).setOrigin(0, 0);
		const topBar = this.add.rectangle(0, 0, W, 3, hex(pal.playerCore)).setOrigin(0, 0);
		const title = this.add.text(W / 2, 14, '⬡  ARCADE SHOP  ⬡', {
			fontFamily: "'Courier New',monospace", fontSize: '13px',
			fontStyle: 'bold', color: pal.fxAccent
		}).setOrigin(0.5, 0);

		// Close
		const closeBtn = this.add.text(W - 18, 12, '✕', {
			fontFamily: "'Courier New',monospace", fontSize: '22px', color: pal.fxAccent
		}).setOrigin(1, 0).setInteractive({ useHandCursor: true });
		closeBtn.on('pointerdown', () => this._toggleShop(false));

		this.shopCont.add([bg, topBar, title, closeBtn]);
		this.shopItems = [];

		CABINET_TYPES.forEach((t, i) => {
			const col = i % 3, rowIdx = Math.floor(i / 3);
			const ix = 6 + col * colW;
			const iy = 44 + rowIdx * rowGap;

			const card = this.add.rectangle(ix, iy, iw, cardH, hex(pal.background), 1)
				.setOrigin(0, 0).setStrokeStyle(1, hex(pal.playerCore), 0.5)
				.setInteractive({ useHandCursor: true });

			const thumbScale = Math.min(0.45, cardH / 220);
			const thumb = this.add.image(ix + iw / 2, iy + 25, `cabinet_${i}`).setScale(thumbScale);
			
			const name = this.add.text(ix + iw / 2, iy + 52, t.name, {
				fontFamily: "'Courier New',monospace", fontSize: '10px',
				fontStyle: 'bold', color: pal.playerCore
			}).setOrigin(0.5);
			
			const cpsT = this.add.text(ix + iw / 2, iy + 64, `+${t.baseCPS}/s`, {
				fontFamily: "'Courier New',monospace", fontSize: '9px', color: pal.fxAccent
			}).setOrigin(0.5);
			
			const costT = this.add.text(ix + iw / 2, iy + 76, t.buyCost === 0 ? 'FREE' : `🪙${fmtN(t.buyCost)}`, {
				fontFamily: "'Courier New',monospace", fontSize: '10px',
				color: t.buyCost === 0 ? '#00ff99' : '#eeeeee'
			}).setOrigin(0.5);

			const btnY = iy + cardH - btnH / 2 - 4;
			const placeBtn = this.add.rectangle(ix + iw / 2, btnY, iw - 10, btnH, hex(pal.playerCore))
				.setOrigin(0.5).setInteractive({ useHandCursor: true });
			const placeTxt = this.add.text(ix + iw / 2, btnY, '▶ PLACE', {
				fontFamily: "'Courier New',monospace", fontSize: '10px',
				fontStyle: 'bold', color: pal.background
			}).setOrigin(0.5);

			placeBtn.on('pointerover', () => placeBtn.setAlpha(0.75));
			placeBtn.on('pointerout', () => placeBtn.setAlpha(1));
			placeBtn.on('pointerdown', () => this._startPlacing(i));
			card.on('pointerover', () => card.setFillStyle(hex(pal.playerCore), 0.1));
			card.on('pointerout', () => card.setFillStyle(hex(pal.background), 1));

			this.shopCont.add([card, thumb, name, cpsT, costT, placeBtn, placeTxt]);
			this.shopItems.push({ card, costT, placeBtn, placeTxt, typeId: i });
		});
	}

	_toggleShop(force) {
		const open = force !== undefined ? force : !this._shopOpen;
		this._shopOpen = open;
		if (open) this._updateShopCosts();
		this.tweens.add({
			targets: this.shopCont,
			y: open ? this._shopOpenY : this._shopClosedY,
			duration: 400, ease: 'Back.Out'
		});
	}

	_updateShopCosts() {
		this.shopItems.forEach(si => {
			const t = CABINET_TYPES[si.typeId];
			const cost = Math.floor(t.buyCost * this.state.costMult);
			si.costT.setText(cost === 0 ? 'FREE' : `🪙${fmtN(cost)}`);
			const can = this.state.coins >= cost;
			si.placeBtn.setAlpha(can ? 1 : 0.35);
			si.placeTxt.setAlpha(can ? 1 : 0.35);
		});
	}

	//  INFO / UPGRADE PANEL
	_buildInfoPanel() {
		const W = this.scale.width, pal = this.state.palette;
		const PW = 230;

		this.infoCont = this.add.container(W + PW, 90).setDepth(3000);
		this._infoClosedX = W + 10;
		this._infoOpenX = W - PW - 4;

		const bg = this.add.rectangle(0, 0, PW, 230, hex(pal.interface), 0.97)
			.setOrigin(0, 0).setStrokeStyle(1.5, hex(pal.playerCore), 0.7);
		const topLine = this.add.rectangle(0, 0, PW, 3, hex(pal.playerCore)).setOrigin(0, 0);

		this.iTitle = this.add.text(PW / 2, 14, '─ CABINET ─', {
			fontFamily: "'Courier New',monospace", fontSize: '11px',
			fontStyle: 'bold', color: pal.fxAccent
		}).setOrigin(0.5, 0);

		this.iThumb = this.add.image(PW / 2, 60, 'cabinet_0').setScale(0.7);

		this.iName = this.add.text(PW / 2, 108, '', {
			fontFamily: "'Courier New',monospace", fontSize: '14px',
			fontStyle: 'bold', color: pal.playerCore
		}).setOrigin(0.5, 0);

		this.iLevel = this.add.text(PW / 2, 128, '', {
			fontFamily: "'Courier New',monospace", fontSize: '12px', color: '#cccccc'
		}).setOrigin(0.5, 0);

		this.iCPS = this.add.text(PW / 2, 146, '', {
			fontFamily: "'Courier New',monospace", fontSize: '12px', color: pal.fxAccent
		}).setOrigin(0.5, 0);

		this.iCostLbl = this.add.text(PW / 2, 164, '', {
			fontFamily: "'Courier New',monospace", fontSize: '11px', color: '#888888'
		}).setOrigin(0.5, 0);

		// Upgrade btn
		const upBg = this.add.rectangle(PW / 2, 200, PW - 28, 34, hex(pal.playerCore))
			.setOrigin(0.5).setInteractive({ useHandCursor: true });
		const upTxt = this.add.text(PW / 2, 200, '⬆  UPGRADE', {
			fontFamily: "'Courier New',monospace", fontSize: '13px',
			fontStyle: 'bold', color: pal.background
		}).setOrigin(0.5);
		upBg.on('pointerover', () => upBg.setAlpha(0.78));
		upBg.on('pointerout', () => upBg.setAlpha(1));
		upBg.on('pointerdown', () => this._doUpgrade());
		this.iUpBtn = upBg; this.iUpTxt = upTxt;

		// Close
		const closeX = this.add.text(PW - 10, 10, '✕', {
			fontFamily: "'Courier New',monospace", fontSize: '16px', color: pal.fxAccent
		}).setOrigin(1, 0).setInteractive({ useHandCursor: true });
		closeX.on('pointerdown', () => this._closeInfo());

		this.infoCont.add([bg, topLine, this.iTitle, this.iThumb,
			this.iName, this.iLevel, this.iCPS, this.iCostLbl,
			upBg, upTxt, closeX]);
	}

	_openInfo(idx) {
		this._selIdx = idx;
		this._refreshInfo();
		if (!this._infoOpen) {
			this._infoOpen = true;
			this.tweens.add({ targets: this.infoCont, x: this._infoOpenX, duration: 320, ease: 'Back.Out' });
		}
	}

	_closeInfo() {
		this._infoOpen = false; this._selIdx = -1;
		this.tweens.add({ targets: this.infoCont, x: this._infoClosedX, duration: 260, ease: 'Back.In' });
	}

	_refreshInfo() {
		const idx = this._selIdx;
		if (idx < 0 || idx >= this.state.cabinets.length) return;
		const cab = this.state.cabinets[idx];
		const t = CABINET_TYPES[cab.typeId];
		const cost = this.state.upgradeCost(idx);
		const can = this.state.coins >= cost;
		this.iThumb.setTexture('cabinet_' + cab.typeId);
		this.iName.setText(t.name);
		this.iLevel.setText(`Level  ${cab.level}`);
		this.iCPS.setText(`${(t.baseCPS * cab.level).toFixed(1)} coins/sec`);
		this.iCostLbl.setText(`Upgrade: 🪙${fmtN(cost)}`);
		this.iUpBtn.setAlpha(can ? 1 : 0.35);
		this.iUpTxt.setAlpha(can ? 1 : 0.35);
	}

	_doUpgrade() {
		const cost = this.state.buyUpgrade(this._selIdx);
		if (!cost) return;
		this.audio.upgrade();
		this._syncSprites();
		this._refreshInfo();
		const cab = this.state.cabinets[this._selIdx];
		const pos = isoXY(cab.col, cab.row);
		this._float(pos.x, pos.y - 80, '⬆ UPGRADED!', this.state.palette.playerCore, 18);
		this._emitBurst(pos.x, pos.y - 60, 8);
	}

	//  STATS OVERLAY
	_buildStatsOverlay() {
		const W = this.scale.width, H = this.scale.height, pal = this.state.palette;
		this.statsCont = this.add.container(W / 2, H / 2).setDepth(4000).setAlpha(0).setVisible(false);

		// bg and title added FIRST so they render behind everything else
		const bg = this.add.rectangle(0, 0, 340, 260, hex(pal.interface), 0.98)
			.setStrokeStyle(2, hex(pal.playerCore), 0.8);
		const title = this.add.text(0, -108, '📊  STATISTICS', {
			fontFamily: "'Courier New',monospace", fontSize: '15px', fontStyle: 'bold', color: pal.fxAccent
		}).setOrigin(0.5);
		this.statsCont.add([bg, title]);

		this.statLines = [];
		const fields = ['Total Earned', 'Machines', 'Upgrades', 'Clicks', 'Total CPS', 'Level'];
		fields.forEach((f, i) => {
			const y = -78 + i * 32;
			// Both label AND value added to container (not scene level)
			const lbl = this.add.text(-140, y, f + ':', {
				fontFamily: "'Courier New',monospace", fontSize: '13px', color: pal.playerCore
			}).setOrigin(0, 0);
			const v = this.add.text(140, y, '—', {
				fontFamily: "'Courier New',monospace", fontSize: '13px', color: '#ffffff'
			}).setOrigin(1, 0);
			this.statsCont.add([lbl, v]);
			this.statLines.push(v);
		});

		const closeBtn = this.add.rectangle(0, 114, 160, 34, hex(pal.playerCore))
			.setInteractive({ useHandCursor: true }).setOrigin(0.5);
		const closeTxt = this.add.text(0, 114, 'CLOSE', {
			fontFamily: "'Courier New',monospace", fontSize: '13px', fontStyle: 'bold', color: pal.background
		}).setOrigin(0.5);
		closeBtn.on('pointerdown', () => this._toggleStats(false));
		this.statsCont.add([closeBtn, closeTxt]);
	}

	_toggleStats(force) {
		const show = force !== undefined ? force : !this.statsCont.visible;
		if (show) {
			const s = this.state;
			const vals = [
				fmtN(s.totalEarned),
				s.cabinets.length.toString(),
				s.stats.totalUpgrades.toString(),
				s.stats.totalClicks.toString(),
				s.cps.toFixed(1),
				s.level.toString()
			];
			this.statLines.forEach((l, i) => l.setText(vals[i] || '—'));
			this.statsCont.setVisible(true).setAlpha(0);
			this.tweens.add({ targets: this.statsCont, alpha: 1, duration: 200 });
		} else {
			this.tweens.add({
				targets: this.statsCont, alpha: 0, duration: 160,
				onComplete: () => this.statsCont.setVisible(false)
			});
		}
	}

	//  PLACEMENT MODE
	_startPlacing(typeId) {
		const t = CABINET_TYPES[typeId];
		const cost = Math.floor(t.buyCost * this.state.costMult);
		if (this.state.coins < cost) {
			this._float(this.scale.width / 2, 110, 'NOT ENOUGH COINS!', '#ff4444', 15);
			return;
		}
		this._placing = typeId;
		this._toggleShop(false);
		// Show placement hint strip
		this.placingHint.setText(`[ CLICK A TILE TO PLACE ${t.name} · ESC TO CANCEL ]`);
		this.tweens.add({ targets: this.placingHint, alpha: 1, duration: 200 });
		this.tweens.add({
			targets: this.placingHint, alpha: { from: 1, to: 0.4 },
			duration: 700, yoyo: true, repeat: -1
		});
	}

	_cancelPlacing() {
		if (this._placing === null) return;
		this._placing = null;
		this.tweens.killTweensOf(this.placingHint);
		this.tweens.add({ targets: this.placingHint, alpha: 0, duration: 200 });
	}

	_onTileClick(col, row) {
		if (this._placing === null) return;
		if (this.state.occupied(col, row)) {
			this._float(...Object.values(isoXY(col, row)), 'OCCUPIED!', '#ff4444');
			return;
		}
		const typeId = this._placing;
		const t = CABINET_TYPES[typeId];
		const cost = Math.floor(t.buyCost * this.state.costMult);
		this.state.coins -= cost;
		this.state.place(col, row, typeId);
		this._placing = null;
		this.audio.place();
		this._syncSprites();
		const pos = isoXY(col, row);
		this._float(pos.x, pos.y - 70, `+ ${t.name}`, this.state.palette.playerCore, 17);
		this._emitBurst(pos.x, pos.y - 40, 12);
		this.cameras.main.shake(220, 0.005);
		this.tweens.killTweensOf(this.placingHint);
		this.tweens.add({ targets: this.placingHint, alpha: 0, duration: 200 });
	}

	_onCabClick(idx) {
		if (this._placing !== null) { this._cancelPlacing(); return; }
		const cab = this.state.cabinets[idx];
		const t = CABINET_TYPES[cab.typeId];
		const pos = isoXY(cab.col, cab.row);
		const earned = t.baseCPS * cab.level * 0.6;
		this.state.add(earned);
		this.state.stats.totalClicks++;
		this.audio.tap();
		this._float(pos.x, pos.y - 85, `+${fmtN(earned)}`, this.state.palette.fxAccent, 16);
		this._emitBurst(pos.x, pos.y - 50, 5);
		this._bounceCab(idx);
		this._openInfo(idx);
		this._checkMilestone();
	}

	//  TICK / MILESTONES
	_tick() {
		const earned = this.state.cps * 0.1;
		this.state.add(earned);

		// Random coin burst from random cabinet
		if (earned > 0 && this.state.cabinets.length > 0) {
			const cab = Phaser.Utils.Array.GetRandom(this.state.cabinets);
			const pos = isoXY(cab.col, cab.row);
			this.particles.emitParticleAt(pos.x, pos.y - 40, 2);
			if (Math.random() < 0.1) this.coinParticles.emitParticleAt(pos.x, pos.y - 50, 1);
			// Tiny CPS sound — sparse
			if (Math.random() < 0.08) this.audio.coin();
		}

		this._updateHUD();
		this._checkMilestone();
		if (this._infoOpen) this._refreshInfo();
		if (this._shopOpen) this._updateShopCosts();
	}

	_checkMilestone() {
		if (this._levelUpLock) return;
		const hit = this.state.checkMilestone();
		if (hit) this._doLevelUp(hit);
	}

	_doLevelUp(milestone) {
		this._levelUpLock = true;
		this.audio.levelUp();
		this.audio.ching();

		// Big burst
		const W = this.scale.width, H = this.scale.height;
		for (let i = 0; i < 3; i++) {
			this.time.delayedCall(i * 180, () => {
				this.particles.emitParticleAt(W / 2, H / 2, 20);
				this.coinParticles.emitParticleAt(W / 2, H / 2, 8);
			});
		}
		this.cameras.main.flash(800, 255, 255, 255, false);
		this.cameras.main.shake(500, 0.01);

		// DOM overlay
		const newLevel = this.state.level + 1;

		// EXPLICIT AD TRIGGER
		if (newLevel % 5 === 0) {
			try {
				['showAd','showVideoAd','playAd','displayAd'].forEach(fn => {
					if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
				});
			} catch(_){}
		}

		window.FreshPlay.levelComplete(() => {
			this.state.level++;
			this.state.costMult *= 1.25;
			this.state.palette = window.FreshPlay.getCurrentPalette();
			this._applyPalette();
			this._syncSprites();
			this._levelUpLock = false;
			this._showToast(`LEVEL ${this.state.level} UNLOCKED`);
		});

		// Show overlay
		this._showLevelUpOverlay(newLevel, milestone);
	}

	_showLevelUpOverlay(level, milestone) {
		const pal = this.state.palette;
		const overlay = document.getElementById('lvlup-overlay');
		document.getElementById('lvlup-num').textContent = `LEVEL ${level}`;
		document.getElementById('lvlup-sub').textContent = `${fmtN(milestone)} COINS MILESTONE`;
		document.getElementById('lvlup-detail').textContent =
			`New color theme unlocked  ·  Upgrade costs ×1.25`;
		// CSS vars for dynamic colour
		overlay.style.setProperty('--core', pal.playerCore);
		overlay.style.setProperty('--fx', pal.fxAccent);
		overlay.classList.add('show');
		setTimeout(() => overlay.classList.remove('show'), 3200);
	}

	//  EXPAND
	_tryExpand() {
		const cost = Math.floor(600 * this.state.level * this.state.costMult);
		if (this.state.coins < cost) {
			this._float(this.scale.width / 2, 110, `NEED 🪙${fmtN(cost)}`, '#ff4444');
			return;
		}
		this.state.coins -= cost;
		this.state.gridCols = Math.min(this.state.gridCols + 1, 10);
		this.state.gridRows = Math.min(this.state.gridRows + 1, 9);
		this._drawGrid();
		this.audio.place();
		this._float(this.scale.width / 2, 110, 'ARCADE EXPANDED!', this.state.palette.playerCore, 20);
		this.cameras.main.shake(300, 0.006);
	}

	//  PALETTE / THEME
	_applyPalette() {
		const pal = this.state.palette;
		this._drawBg();
		this._drawGrid();
		// HUD colours
		this.hudBg.setFillStyle(hex(pal.interface), 0.96);
		this.hudLine.setFillStyle(hex(pal.playerCore));
		this.hudGlow.setFillStyle(hex(pal.playerCore), 0.07);
		this.hudCoins.setColor(pal.fxAccent).setShadow(0, 0, pal.fxAccent, 12, true, true);
		this.hudCPS.setColor(pal.playerCore);
		this.hudLvlBg.setFillStyle(hex(pal.playerCore), 0.12).setStrokeStyle(1, hex(pal.playerCore), 0.4);
		this.hudLvlLbl.setColor(pal.playerCore);
		this.hudLvlNum.setColor(pal.fxAccent).setShadow(0, 0, pal.fxAccent, 10, true, true);
		this.hudMileBg.setStrokeStyle(1, hex(pal.playerCore), 0.3);
		this.hudMileBar.setFillStyle(hex(pal.fxAccent));
		this.hudMileLbl.setColor(pal.playerCore);
		// Buttons
		[this.btnShop, this.btnExpand, this.btnSave, this.btnStats].forEach(b => {
			if (!b) return;
			b.bg.setFillStyle(hex(pal.interface)).setStrokeStyle(1.5, hex(pal.playerCore), 0.7);
			b.txt.setColor(pal.playerCore);
		});
		// Particles
		this.particles.setParticleTint(hex(pal.fxAccent));
		// Sprites glow
		this.sprites.forEach(s => s.glow?.setTint(hex(pal.playerCore)));
	}

	//  UTILS
	_float(x, y, text, color = '#ffffff', size = 16) {
		const t = this.add.text(x, y, text, {
			fontFamily: "'Courier New',monospace",
			fontSize: `${size}px`, fontStyle: 'bold',
			color, stroke: '#000000', strokeThickness: 4
		}).setOrigin(0.5).setDepth(5000);
		this.tweens.add({
			targets: t, y: y - 80, alpha: { from: 1, to: 0 },
			duration: 1100, ease: 'Power2',
			onComplete: () => t.destroy()
		});
	}

	_emitBurst(x, y, count = 6) {
		this.particles.emitParticleAt(x, y, count);
	}

	_showToast(msg) {
		const el = document.getElementById('toast');
		el.textContent = msg;
		el.classList.add('show');
		setTimeout(() => el.classList.remove('show'), 2000);
	}

	//  UPDATE LOOP
	update(time) {
		// Coin icon wobble
		if (this.hudCoinIco) {
			this.hudCoinIco.rotation = Math.sin(time / 360) * 0.18;
			this.hudCoinIco.scaleY = 1.25 + Math.sin(time / 280) * 0.1;
		}
		// ESC to cancel placing
		if (this._placing !== null) {
			const esc = this.input.keyboard?.addKey('ESC');
			if (esc?.isDown) this._cancelPlacing();
		}
		// Cabinet idle bob
		this.sprites.forEach((s, i) => {
			if (s.sprite && s.sprite.active) {
				s.sprite.y += Math.sin(time / 900 + i * 0.7) * 0.15;
			}
		});
	}
}

// ══════════════════════════════════════════════════════════════
//  PHASER CONFIG
// ══════════════════════════════════════════════════════════════
const config = {
	type: Phaser.AUTO,
	width: 860,
	height: 640,
	backgroundColor: '#000000',
	parent: 'game-container',
	scene: [BootScene, GameScene],
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		min: { width: 480, height: 270 },
		max: { width: 1920, height: 1080 },
	},
	render: { antialias: true, pixelArt: false },
	input: { keyboard: true, touch: true },
};

window.addEventListener('DOMContentLoaded', () => {
	window._iat = new Phaser.Game(config);
});
