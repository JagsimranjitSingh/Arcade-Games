// ============================================================
//  TOWER DEFENSE MINIMAL
// ============================================================

(() => {
	"use strict";

	//  PALETTE DEFAULTS  (overridden by FreshPlay)
	const DEFAULT_PALETTE = {
		background: "#c4e2f5",
		playerCore: '#00234f',
		hostile: "#ff2d55",
		fxAccent: "#ffe600",
		interface: '#daedf8',
	};

	function getPalette() {
		try {
			const p = window.FreshPlay?.getCurrentPalette?.();
			return p && typeof p === "object" ? { ...DEFAULT_PALETTE, ...p } : { ...DEFAULT_PALETTE };
		} catch (_) { return { ...DEFAULT_PALETTE }; }
	}

	// hex → 0xRRGGBB number
	function hex(str) {
		return parseInt(str.replace("#", ""), 16);
	}

	//  GRID & PATH CONSTANTS
	const CELL = 48;          // grid cell size
	const COLS = 18;
	const ROWS = 13;
	const W = COLS * CELL; // 864
	const H = ROWS * CELL; // 624

	// Path defined as grid column,row waypoints
	const PATH_WAYPOINTS = [
		{ col: 0, row: 2 },
		{ col: 4, row: 2 },
		{ col: 4, row: 6 },
		{ col: 8, row: 6 },
		{ col: 8, row: 2 },
		{ col: 12, row: 2 },
		{ col: 12, row: 10 },
		{ col: 16, row: 10 },
		{ col: 16, row: 6 },
		{ col: 17, row: 6 },   // exit → core
	];

	function wpPx(wp) {
		return { x: wp.col * CELL + CELL / 2, y: wp.row * CELL + CELL / 2 };
	}

	// Cells that are ON the path (blocked from tower placement)
	function buildPathSet() {
		const s = new Set();
		for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
			const a = PATH_WAYPOINTS[i], b = PATH_WAYPOINTS[i + 1];
			if (a.col === b.col) {
				const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
				for (let r = minR; r <= maxR; r++) s.add(`${a.col},${r}`);
			} else {
				const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
				for (let c = minC; c <= maxC; c++) s.add(`${c},${a.row}`);
			}
		}
		return s;
	}
	const PATH_SET = buildPathSet();

	//  AUDIO SYNTHESIS  (Web Audio API)
	let audioCtx = null;
	function getAudioCtx() {
		if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		return audioCtx;
	}

	function playLaser() {
		try {
			const ctx = getAudioCtx();
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.connect(g); g.connect(ctx.destination);
			o.type = "square";
			o.frequency.setValueAtTime(1200, ctx.currentTime);
			o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
			g.gain.setValueAtTime(0.18, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
			o.start(ctx.currentTime);
			o.stop(ctx.currentTime + 0.1);
		} catch (_) { }
	}

	function playExplosion() {
		try {
			const ctx = getAudioCtx();
			const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
			const data = buf.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
			const src = ctx.createBufferSource();
			src.buffer = buf;
			const f = ctx.createBiquadFilter();
			f.type = "lowpass"; f.frequency.value = 400;
			const g = ctx.createGain();
			g.gain.setValueAtTime(0.6, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
			src.connect(f); f.connect(g); g.connect(ctx.destination);
			src.start();
		} catch (_) { }
	}

	function playFail() {
		try {
			const ctx = getAudioCtx();
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.connect(g); g.connect(ctx.destination);
			o.type = "sawtooth";
			o.frequency.setValueAtTime(180, ctx.currentTime);
			o.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.5);
			g.gain.setValueAtTime(0.5, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
			o.start(ctx.currentTime);
			o.stop(ctx.currentTime + 0.6);
		} catch (_) { }
	}

	function playPlace() {
		try {
			const ctx = getAudioCtx();
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.connect(g); g.connect(ctx.destination);
			o.type = "sine";
			o.frequency.setValueAtTime(600, ctx.currentTime);
			o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06);
			g.gain.setValueAtTime(0.2, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
			o.start(ctx.currentTime);
			o.stop(ctx.currentTime + 0.1);
		} catch (_) { }
	}

	//  WAVE CONFIGURATION
	function waveConfig(level) {
		return {
			count: 5 + level * 3,
			hp: 30 + level * 20,
			speed: 55 + level * 8,
			reward: 12 + level * 3,
			delay: Math.max(300, 900 - level * 40),   // ms between spawns
		};
	}

	//  MAIN SCENE
	class GameScene extends Phaser.Scene {
		constructor() { super({ key: "GameScene" }); }

		// init
		init() {
			this.pal = getPalette();
			this.level = 1;
			this.energy = 80;
			this.score = 0;
			this.coreHp = 20;
			this.maxCoreHp = 20;
			this.towers = [];
			this.viruses = [];
			this.lasers = [];
			this.particles = [];
			this.selectedTower = null;
			this.waveActive = false;
			this.waveClearing = false;
			this.spawnQueue = 0;
			this.spawnTimer = 0;
			this.waveKills = 0;
			this.waveTotal = 0;
			this.gameEnded = false;
		}

		// preload
		preload() { }

		// create
		create() {
			this.pal = getPalette();
			this._buildGraphics();
			this._buildHUD();
			this._buildUpgradePanel();
			this._startWave();

			this.input.on("pointerdown", this._onPointerDown, this);

			// Refresh palette every 5 levels (handled in _clearLevel)
		}

		// _buildGraphics
		_buildGraphics() {
			const pal = this.pal;

			// Background
			this.add.rectangle(W / 2, H / 2, W, H, hex(pal.background)).setDepth(0);

			// Grid dots
			const gridGfx = this.add.graphics().setDepth(1);
			gridGfx.fillStyle(hex(pal.interface), 0.18);
			for (let c = 0; c < COLS; c++) {
				for (let r = 0; r < ROWS; r++) {
					gridGfx.fillRect(c * CELL + CELL / 2 - 1, r * CELL + CELL / 2 - 1, 2, 2);
				}
			}

			// Path
			this.pathGfx = this.add.graphics().setDepth(2);
			this._drawPath();

			// Core base (last waypoint area)
			const coreWP = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
			const cpx = coreWP.col * CELL + CELL / 2;
			const cpy = coreWP.row * CELL + CELL / 2;
			this.coreGfx = this.add.graphics().setDepth(3);
			this._drawCore(cpx, cpy);
			this.corePx = cpx; this.corePy = cpy;

			// Tower preview (follows mouse when not over path)
			this.previewGfx = this.add.graphics().setDepth(8);

			// Lasers layer
			this.laserGfx = this.add.graphics().setDepth(9);

			// Particles layer
			this.particleGfx = this.add.graphics().setDepth(10);

			// Tower graphics container
			this.towerContainer = this.add.container(0, 0).setDepth(4);

			// Virus container
			this.virusContainer = this.add.container(0, 0).setDepth(5);

			this.input.on("pointermove", this._onPointerMove, this);
		}

		_drawPath() {
			const pal = this.pal;
			const g = this.pathGfx;
			g.clear();

			// Path fill
			g.lineStyle(CELL - 4, hex(pal.interface), 0.45);
			g.beginPath();
			const first = wpPx(PATH_WAYPOINTS[0]);
			g.moveTo(first.x, first.y);
			for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
				const p = wpPx(PATH_WAYPOINTS[i]);
				g.lineTo(p.x, p.y);
			}
			g.strokePath();

			// Path center line (neon)
			g.lineStyle(2, hex(pal.playerCore), 0.25);
			g.beginPath();
			g.moveTo(first.x, first.y);
			for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
				const p = wpPx(PATH_WAYPOINTS[i]);
				g.lineTo(p.x, p.y);
			}
			g.strokePath();

			// Waypoint diamonds
			g.fillStyle(hex(pal.playerCore), 0.5);
			for (let i = 1; i < PATH_WAYPOINTS.length - 1; i++) {
				const p = wpPx(PATH_WAYPOINTS[i]);
				g.fillRect(p.x - 3, p.y - 3, 6, 6);
			}
		}

		_drawCore(cx, cy) {
			const g = this.coreGfx;
			g.clear();
			const c = hex(this.pal.playerCore);
			// Outer ring glow
			g.lineStyle(2, c, 0.3);
			g.strokeCircle(cx, cy, 28);
			g.lineStyle(1, c, 0.15);
			g.strokeCircle(cx, cy, 36);
			// Hexagon core
			g.fillStyle(hex(this.pal.background), 1);
			g.fillCircle(cx, cy, 22);
			g.lineStyle(2, c, 0.9);
			g.strokeCircle(cx, cy, 22);
			// Inner pulse dot
			g.fillStyle(c, 0.8);
			g.fillCircle(cx, cy, 8);
			// HP arc
			const ratio = this.coreHp / this.maxCoreHp;
			g.lineStyle(4, c, 0.9);
			g.beginPath();
			g.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2, false);
			g.strokePath();
		}

		// HUD
		_buildHUD() {
			const pal = this.pal;
			const hudY = H - 1;
			// HUD bar background
			this.hudBg = this.add.rectangle(W / 2, H - 20, W, 40, hex(pal.background), 0.95).setDepth(20);
			this.add.rectangle(W / 2, H - 39, W, 1, hex(pal.playerCore), 0.4).setDepth(21);

			const style = {
				fontFamily: "'Courier New', monospace",
				fontSize: "13px",
				color: "#" + pal.playerCore.replace("#", ""),
				stroke: "#000",
				strokeThickness: 2,
			};

			this.hudEnergy = this.add.text(14, H - 27, "⚡ 80", style).setDepth(22);
			this.hudLevel = this.add.text(W / 2, H - 27, "WAVE 1", { ...style, fontSize: "14px" }).setOrigin(0.5, 0).setDepth(22);
			this.hudScore = this.add.text(W - 14, H - 27, "0 pts", { ...style }).setOrigin(1, 0).setDepth(22);

			// Tower cost legend
			const legendStyle = { fontFamily: "'Courier New', monospace", fontSize: "10px", color: "#" + pal.interface.replace("#", "aa"), stroke: "#000", strokeThickness: 1 };
			this.add.text(W / 2 - 100, H - 14, "TAP GRID: Place Tower (30⚡)  |  TAP TOWER: Upgrade (20⚡)", legendStyle).setOrigin(0.5, 1).setDepth(22);

			this._refreshHUD();
		}

		_refreshHUD() {
			this.hudEnergy.setText(`⚡ ${this.energy}`);
			this.hudLevel.setText(`WAVE ${this.level}`);
			this.hudScore.setText(`${this.score} pts`);
		}

		// UPGRADE PANEL
		_buildUpgradePanel() {
			const pal = this.pal;
			this.upgradePanel = this.add.container(W / 2, H / 2).setDepth(30).setVisible(false);

			const bg = this.add.rectangle(0, 0, 240, 160, hex(pal.background), 0.97);
			bg.setStrokeStyle(1.5, hex(pal.playerCore), 0.8);

			const titleStyle = { fontFamily: "'Courier New', monospace", fontSize: "13px", color: "#" + pal.playerCore.replace("#", ""), stroke: "#000", strokeThickness: 2 };
			const btnStyle = { fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#" + pal.fxAccent.replace("#", ""), stroke: "#000", strokeThickness: 2 };

			this.upgTitle = this.add.text(0, -55, "TOWER LVL 1", titleStyle).setOrigin(0.5, 0.5);
			this.upgRangeBtn = this.add.text(0, -18, "[+] RANGE  (20⚡)", btnStyle).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
			this.upgRateBtn = this.add.text(0, 18, "[+] FIRE RATE (20⚡)", btnStyle).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
			this.upgClose = this.add.text(0, 60, "[ CLOSE ]", { ...btnStyle, color: "#888888" }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

			this.upgRangeBtn.on("pointerdown", () => this._upgradeRange());
			this.upgRateBtn.on("pointerdown", () => this._upgradeRate());
			this.upgClose.on("pointerdown", () => this._closeUpgrade());

			// Hover effects
			[this.upgRangeBtn, this.upgRateBtn, this.upgClose].forEach(btn => {
				btn.on("pointerover", () => btn.setAlpha(0.7));
				btn.on("pointerout", () => btn.setAlpha(1));
			});

			this.upgradePanel.add([bg, this.upgTitle, this.upgRangeBtn, this.upgRateBtn, this.upgClose]);
		}

		_openUpgrade(tower) {
			this.selectedTower = tower;
			this.upgTitle.setText(`TOWER LVL ${tower.level}  [${tower.upgrades} upgrades]`);
			this.upgradePanel.setVisible(true);
		}

		_closeUpgrade() {
			this.upgradePanel.setVisible(false);
			this.selectedTower = null;
		}

		_upgradeRange() {
			if (!this.selectedTower || this.energy < 20) return;
			this.energy -= 20;
			this.selectedTower.range += 30;
			this.selectedTower.level += 1;
			this.selectedTower.upgrades += 1;
			this._redrawTower(this.selectedTower);
			this.upgTitle.setText(`TOWER LVL ${this.selectedTower.level}  [${this.selectedTower.upgrades} upgrades]`);
			this._refreshHUD();
			playPlace();
		}

		_upgradeRate() {
			if (!this.selectedTower || this.energy < 20) return;
			this.energy -= 20;
			this.selectedTower.fireRate = Math.max(100, this.selectedTower.fireRate - 120);
			this.selectedTower.level += 1;
			this.selectedTower.upgrades += 1;
			this._redrawTower(this.selectedTower);
			this.upgTitle.setText(`TOWER LVL ${this.selectedTower.level}  [${this.selectedTower.upgrades} upgrades]`);
			this._refreshHUD();
			playPlace();
		}

		// TOWER DRAWING
		_drawTower(tower) {
			const g = this.add.graphics();
			this.towerContainer.add(g);
			tower.gfx = g;
			this._redrawTower(tower);
		}

		_redrawTower(tower) {
			const g = tower.gfx;
			const { x, y, range, level } = tower;
			const pal = this.pal;
			g.clear();

			const col = hex(pal.playerCore);
			const lvl = Math.min(level, 6);
			const glow = 0.12 + lvl * 0.06;

			// Range circle (subtle)
			if (this.selectedTower === tower) {
				g.lineStyle(1, col, 0.35);
				g.strokeCircle(x, y, range);
			}

			// Base platform
			g.fillStyle(hex(pal.background), 1);
			g.fillRect(x - 16, y - 16, 32, 32);
			g.lineStyle(1, col, 0.5);
			g.strokeRect(x - 16, y - 16, 32, 32);

			// Rotating hex shape
			g.fillStyle(col, glow);
			const pts = [];
			for (let i = 0; i < 6; i++) {
				const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
				pts.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14 });
			}
			g.fillPoints(pts, true);

			// Core dot
			g.fillStyle(col, 0.95);
			g.fillCircle(x, y, 4 + lvl);

			// Level pips
			for (let i = 0; i < Math.min(level - 1, 5); i++) {
				const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
				g.fillStyle(hex(pal.fxAccent), 0.9);
				g.fillCircle(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 2);
			}
		}

		// WAVE / SPAWNING
		_startWave() {
			const cfg = waveConfig(this.level);
			this.waveActive = true;
			this.waveClearing = false;
			this.spawnQueue = cfg.count;
			this.spawnTimer = 0;
			this.spawnDelay = cfg.delay;
			this.waveKills = 0;
			this.waveTotal = cfg.count;
			this._waveConfig = cfg;
		}

		_spawnVirus() {
			const cfg = this._waveConfig;
			const pal = this.pal;
			const startPx = wpPx(PATH_WAYPOINTS[0]);

			const gfx = this.add.graphics();
			this.virusContainer.add(gfx);

			const virus = {
				x: startPx.x,
				y: startPx.y,
				hp: cfg.hp,
				maxHp: cfg.hp,
				speed: cfg.speed,
				wpIdx: 1,
				reward: cfg.reward,
				gfx,
				dead: false,
				reached: false,
				rot: Math.random() * Math.PI * 2,
				shape: Phaser.Math.Between(0, 2),  // 0=tri, 1=diamond, 2=hex
				pulse: 0,
			};

			this.viruses.push(virus);
			this._drawVirus(virus);
		}

		_drawVirus(virus) {
			const g = virus.gfx;
			const pal = this.pal;
			const col = hex(pal.hostile);
			const { x, y, rot, shape, hp, maxHp } = virus;
			g.clear();

			const r = 10;
			const pulse = 1 + 0.12 * Math.sin(virus.pulse);

			g.fillStyle(col, 0.18);
			g.fillCircle(x, y, r * 1.6 * pulse);

			if (shape === 0) {
				// Triangle
				g.fillStyle(col, 0.9);
				const pts = [];
				for (let i = 0; i < 3; i++) {
					const a = rot + (i / 3) * Math.PI * 2;
					pts.push({ x: x + Math.cos(a) * r * pulse, y: y + Math.sin(a) * r * pulse });
				}
				g.fillPoints(pts, true);
			} else if (shape === 1) {
				// Diamond
				g.fillStyle(col, 0.9);
				const pts = [
					{ x, y: y - r * pulse },
					{ x: x + r * 0.7 * pulse, y },
					{ x, y: y + r * pulse },
					{ x: x - r * 0.7 * pulse, y },
				];
				g.fillPoints(pts, true);
			} else {
				// Hexagon
				g.fillStyle(col, 0.9);
				const pts = [];
				for (let i = 0; i < 6; i++) {
					const a = rot + (i / 6) * Math.PI * 2;
					pts.push({ x: x + Math.cos(a) * r * pulse, y: y + Math.sin(a) * r * pulse });
				}
				g.fillPoints(pts, true);
			}

			// HP bar
			const bw = 20, bh = 3;
			g.fillStyle(0x333333, 0.8);
			g.fillRect(x - bw / 2, y - r - 7, bw, bh);
			g.fillStyle(col, 1);
			g.fillRect(x - bw / 2, y - r - 7, bw * (hp / maxHp), bh);
		}

		// TOWER PLACEMENT & UPGRADES
		_onPointerMove(ptr) {
			const col = Math.floor(ptr.x / CELL);
			const row = Math.floor(ptr.y / CELL);
			const key = `${col},${row}`;
			const pal = this.pal;
			const g = this.previewGfx;
			g.clear();

			if (ptr.y > H - 40) return;
			if (PATH_SET.has(key)) return;

			const occupied = this.towers.some(t => t.col === col && t.row === row);
			const canAfford = this.energy >= 30;
			const alpha = (occupied || !canAfford) ? 0.2 : 0.5;

			g.lineStyle(1, hex(pal.playerCore), alpha);
			g.strokeRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
			g.fillStyle(hex(pal.playerCore), alpha * 0.3);
			g.fillRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
		}

		_onPointerDown(ptr) {
			if (this.gameEnded) return;

			// Close upgrade panel if clicking elsewhere
			if (this.upgradePanel.visible) {
				const dx = ptr.x - W / 2, dy = ptr.y - H / 2;
				if (Math.abs(dx) > 130 || Math.abs(dy) > 90) {
					this._closeUpgrade();
					return;
				}
				return; // let upgrade panel handle its own clicks
			}

			const col = Math.floor(ptr.x / CELL);
			const row = Math.floor(ptr.y / CELL);
			const key = `${col},${row}`;

			// HUD area
			if (ptr.y > H - 40) return;

			// Check if clicking existing tower
			const existing = this.towers.find(t => t.col === col && t.row === row);
			if (existing) {
				this._openUpgrade(existing);
				this._redrawTower(existing);
				return;
			}

			// Blocked by path
			if (PATH_SET.has(key)) return;

			// Place new tower
			if (this.energy < 30) {
				this._flashHUD("⚡ NOT ENOUGH ENERGY");
				return;
			}

			this.energy -= 30;
			const cx = col * CELL + CELL / 2;
			const cy = row * CELL + CELL / 2;

			const tower = {
				col, row,
				x: cx, y: cy,
				range: 110,
				fireRate: 700,
				lastFire: 0,
				level: 1,
				upgrades: 0,
				gfx: null,
			};

			this.towers.push(tower);
			this._drawTower(tower);
			this._refreshHUD();
			playPlace();
		}

		// HUD flash
		_flashHUD(msg) {
			const style = { fontFamily: "'Courier New', monospace", fontSize: "14px", color: "#ff2d55", stroke: "#000", strokeThickness: 2 };
			const txt = this.add.text(W / 2, H / 2, msg, style).setOrigin(0.5).setDepth(50).setAlpha(0);
			this.tweens.add({ targets: txt, alpha: { from: 1, to: 0 }, duration: 900, onComplete: () => txt.destroy() });
		}

		// LASER FIRING
		_fireTower(tower, virus, now) {
			tower.lastFire = now;
			const pal = this.pal;

			// damage
			virus.hp -= 10 + (tower.level - 1) * 5;

			// Laser entry
			this.lasers.push({
				x1: tower.x, y1: tower.y,
				x2: virus.x, y2: virus.y,
				life: 80,
				maxLife: 80,
				col: hex(pal.fxAccent),
			});

			playLaser();

			if (virus.hp <= 0) {
				this._killVirus(virus);
			}
		}

		_killVirus(virus) {
			if (virus.dead) return;
			virus.dead = true;
			this.score += 10 + this.level * 2;
			this.energy += virus.reward;
			this.waveKills++;
			this._spawnExplosion(virus.x, virus.y);
			playExplosion();
			this._refreshHUD();
		}

		_spawnExplosion(x, y) {
			const pal = this.pal;
			const count = 12;
			for (let i = 0; i < count; i++) {
				const angle = (i / count) * Math.PI * 2;
				const speed = 60 + Math.random() * 80;
				this.particles.push({
					x, y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					life: 1,
					maxLife: 0.5 + Math.random() * 0.3,
					col: hex(pal.fxAccent),
					size: 2 + Math.random() * 3,
				});
			}
			// Screen shake
			this.cameras.main.shake(120, 0.006);
		}

		// GAME OVER / LEVEL CLEAR
		_virusReachedCore(virus) {
			if (virus.reached) return;
			virus.reached = true;
			virus.dead = true;
			this.coreHp -= 1;
			this.waveKills++;
			this._drawCore(this.corePx, this.corePy);
			playFail();
			this.cameras.main.shake(200, 0.012);

			if (this.coreHp <= 0) {
				this._triggerGameOver();
			}
		}

		_triggerGameOver() {
			if (this.gameEnded) return;
			this.gameEnded = true;
			this.waveActive = false;

			const pal = this.pal;
			// Dark overlay
			this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(60);

			// Panel background
			const panelW = 320, panelH = 220;
			const panelBg = this.add.rectangle(W / 2, H / 2, panelW, panelH, 0x0a0e1a, 0.97).setDepth(61);
			panelBg.setStrokeStyle(1.5, hex(pal.hostile), 0.9);

			// Corner accents
			const cornerGfx = this.add.graphics().setDepth(62);
			cornerGfx.lineStyle(2, hex(pal.hostile), 1);
			const px = W / 2 - panelW / 2, py = H / 2 - panelH / 2;
			const cs = 18;
			[[px, py, 1, 1], [px + panelW, py, -1, 1], [px, py + panelH, 1, -1], [px + panelW, py + panelH, -1, -1]]
				.forEach(([bx, by, sx, sy]) => {
					cornerGfx.beginPath();
					cornerGfx.moveTo(bx + sx * cs, by);
					cornerGfx.lineTo(bx, by);
					cornerGfx.lineTo(bx, by + sy * cs);
					cornerGfx.strokePath();
				});

			// Title
			const breachStyle = { fontFamily: "'Courier New', monospace", fontSize: "26px", color: "#ff2d55", stroke: "#000", strokeThickness: 3 };
			this.add.text(W / 2, H / 2 - 72, "SYSTEM BREACH", breachStyle).setOrigin(0.5).setDepth(62);

			// Divider line
			const divGfx = this.add.graphics().setDepth(62);
			divGfx.lineStyle(1, hex(pal.hostile), 0.4);
			divGfx.beginPath();
			divGfx.moveTo(W / 2 - 100, H / 2 - 44);
			divGfx.lineTo(W / 2 + 100, H / 2 - 44);
			divGfx.strokePath();

			// Stats
			const s2 = { fontFamily: "'Courier New', monospace", fontSize: "14px", color: "#" + pal.playerCore.replace("#", ""), stroke: "#000", strokeThickness: 2 };
			this.add.text(W / 2, H / 2 - 18, "SCORE  " + String(this.score).padStart(6, "0"), s2).setOrigin(0.5).setDepth(62);
			this.add.text(W / 2, H / 2 + 8,  "WAVE   " + String(this.level).padStart(6, " "), s2).setOrigin(0.5).setDepth(62);

			// Retry button
			const retryNormal = { fontFamily: "'Courier New', monospace", fontSize: "15px", color: "#ffe600", stroke: "#000", strokeThickness: 2 };
			const retryBtn = this.add.text(W / 2, H / 2 + 60, "[ RETRY ]", retryNormal)
				.setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true });
			retryBtn.on("pointerover", () => retryBtn.setAlpha(0.6));
			retryBtn.on("pointerout",  () => retryBtn.setAlpha(1));
			retryBtn.on("pointerdown", () => {
				// Clean up audio context so it re-creates cleanly
				try { if (audioCtx) { audioCtx.close(); audioCtx = null; } } catch (_) {}
				this.scene.restart();
			});

			// Pulse animation on retry button
			this.tweens.add({
				targets: retryBtn,
				alpha: { from: 1, to: 0.45 },
				yoyo: true,
				repeat: -1,
				duration: 700,
				ease: "Sine.easeInOut",
			});

			try { window.FreshPlay?.gameOver?.(this.score); } catch (_) { }
		}

		_checkWaveClear() {
			if (this.waveClearing) return;
			if (!this.waveActive) return;
			if (this.spawnQueue > 0) return;
			if (this.viruses.some(v => !v.dead && !v.reached)) return;
			if (this.waveKills < this.waveTotal) return;

			this.waveClearing = true;
			this.waveActive = false;

			this.time.delayedCall(800, () => {
				if (this.level % 5 === 0) {
					try {
						['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
							if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
						});
					} catch (_) { }
				}
				try {
					window.FreshPlay?.levelComplete?.(() => {
						this.level++;
						this._startWave();
						this._refreshHUD();
						this._showLevelBanner();
					});
				} catch (_) {
					this.level++;
					this._startWave();
					this._refreshHUD();
					this._showLevelBanner();
				}
			});
		}

		_showLevelBanner() {
			const pal = this.pal;
			const style = { fontFamily: "'Courier New', monospace", fontSize: "28px", color: "#" + pal.playerCore.replace("#", ""), stroke: "#000", strokeThickness: 3 };
			const txt = this.add.text(W / 2, H / 2 - 60, `WAVE ${this.level}`, style).setOrigin(0.5).setDepth(50).setAlpha(0);
			this.tweens.add({
				targets: txt,
				alpha: { from: 1, to: 0 },
				y: { from: H / 2 - 60, to: H / 2 - 110 },
				duration: 1400,
				ease: "Cubic.easeOut",
				onComplete: () => txt.destroy(),
			});
		}

		_refreshPalette() {
			// Redraw static elements with new palette
			this._drawPath();
			this._drawCore(this.corePx, this.corePy);
			this.towers.forEach(t => this._redrawTower(t));
		}

		// UPDATE LOOP
		update(time, delta) {
			if (this.gameEnded) return;
			const dt = delta / 1000;

			// Spawn viruses
			if (this.waveActive && this.spawnQueue > 0) {
				this.spawnTimer -= delta;
				if (this.spawnTimer <= 0) {
					this._spawnVirus();
					this.spawnQueue--;
					this.spawnTimer = this.spawnDelay;
				}
			}

			// Move viruses
			for (const virus of this.viruses) {
				if (virus.dead || virus.reached) continue;
				virus.pulse += delta * 0.006;
				virus.rot += delta * 0.002;

				const target = PATH_WAYPOINTS[virus.wpIdx];
				if (!target) { this._virusReachedCore(virus); continue; }

				const tpx = wpPx(target);
				const dx = tpx.x - virus.x;
				const dy = tpx.y - virus.y;
				const dist = Math.hypot(dx, dy);

				if (dist < 4) {
					virus.wpIdx++;
					if (virus.wpIdx >= PATH_WAYPOINTS.length) {
						this._virusReachedCore(virus);
						continue;
					}
				} else {
					const spd = virus.speed * dt;
					virus.x += (dx / dist) * spd;
					virus.y += (dy / dist) * spd;
				}

				this._drawVirus(virus);
			}

			// Tower shooting
			for (const tower of this.towers) {
				if (time - tower.lastFire < tower.fireRate) continue;

				// Find nearest virus in range
				let nearest = null, nearDist = Infinity;
				for (const virus of this.viruses) {
					if (virus.dead || virus.reached) continue;
					const d = Math.hypot(virus.x - tower.x, virus.y - tower.y);
					if (d <= tower.range && d < nearDist) {
						nearest = virus;
						nearDist = d;
					}
				}
				if (nearest) this._fireTower(tower, nearest, time);
			}

			// Draw lasers
			this.laserGfx.clear();
			for (let i = this.lasers.length - 1; i >= 0; i--) {
				const l = this.lasers[i];
				l.life -= delta;
				if (l.life <= 0) { this.lasers.splice(i, 1); continue; }
				const alpha = l.life / l.maxLife;
				this.laserGfx.lineStyle(2 + alpha * 2, l.col, alpha * 0.9);
				this.laserGfx.beginPath();
				this.laserGfx.moveTo(l.x1, l.y1);
				this.laserGfx.lineTo(l.x2, l.y2);
				this.laserGfx.strokePath();
				// Core glow dot at impact
				this.laserGfx.fillStyle(l.col, alpha);
				this.laserGfx.fillCircle(l.x2, l.y2, 3);
			}

			// Draw particles
			this.particleGfx.clear();
			for (let i = this.particles.length - 1; i >= 0; i--) {
				const p = this.particles[i];
				p.life -= dt;
				if (p.life <= 0) { this.particles.splice(i, 1); continue; }
				const alpha = p.life / p.maxLife;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.vx *= 0.92;
				p.vy *= 0.92;
				this.particleGfx.fillStyle(p.col, alpha);
				this.particleGfx.fillCircle(p.x, p.y, p.size * alpha);
			}

			// Remove dead viruses
			for (let i = this.viruses.length - 1; i >= 0; i--) {
				const v = this.viruses[i];
				if (v.dead || v.reached) {
					v.gfx.destroy();
					this.viruses.splice(i, 1);
				}
			}

			// Tower range ring on selected tower
			if (this.selectedTower) {
				this._redrawTower(this.selectedTower);
			}

			// Check wave clear
			this._checkWaveClear();

			// Animate core
			if (time % 1200 < delta + 16) {
				this._drawCore(this.corePx, this.corePy);
			}
		}
	}

	//  BOOT SCENE  (first frame palette + launch)
	class BootScene extends Phaser.Scene {
		constructor() { super({ key: "BootScene" }); }
		create() {
			this.scene.start("GameScene");
		}
	}

	//  PHASER CONFIG
	const config = {
		type: Phaser.AUTO,
		width: W,
		height: H,
		backgroundColor: DEFAULT_PALETTE.background,
		parent: "game-container",
		scene: [BootScene, GameScene],
		antialias: true,
		roundPixels: false,
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		render: {
			pixelArt: false,
			antialias: true,
		},
	};

	//  LAUNCH
	window.addEventListener("DOMContentLoaded", () => {
		// Unlock audio on first interaction
		document.addEventListener("pointerdown", () => {
			try { getAudioCtx().resume(); } catch (_) { }
		}, { once: true });

		window.__TowerDefenseGame = new Phaser.Game(config);
	});
})();
