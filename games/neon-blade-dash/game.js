// ============================================================
//  NEON BLADE DASH
// ============================================================

// Utility helpers
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hexToRgb = (hex) => ({
	r: (hex >> 16) & 0xff,
	g: (hex >> 8) & 0xff,
	b: hex & 0xff
});
const lerpColor = (c1, c2, t) => {
	const a = hexToRgb(c1), b = hexToRgb(c2);
	const r = Math.round(lerp(a.r, b.r, t));
	const g = Math.round(lerp(a.g, b.g, t));
	const bl = Math.round(lerp(a.b, b.b, t));
	return (r << 16) | (g << 8) | bl;
};

// Palette definitions (one per 5-level bracket)
const PALETTES = [
	{ bg: 0xc4e2f5, road: 0x00234f, target: [0x48d1cc, 0x003d7a, 0x00234f], hostile: 0xff0044, ui: 0x00234f, fx: 0x00ffff, name: 'MATRIX' },
	{ bg: 0xd0e8f6, road: 0xff00ff, target: [0x00e5ff, 0x00234f, 0x88ffcc], hostile: 0xffaa00, ui: 0x00234f, fx: 0xff00ff, name: 'VAPORWAVE' },
	{ bg: 0xd4eee6, road: 0x00ff88, target: [0xffaa00, 0xffff00, 0x00234f], hostile: 0xaa00ff, ui: 0x00234f, fx: 0x00ff88, name: 'TOXIC' },
	{ bg: 0xc4e2f5, road: 0x003d7a, target: [0x00234f, 0x003d7a, 0x48d1cc], hostile: 0xff3366, ui: 0x00234f, fx: 0x3366ff, name: 'OCEAN' },
	{ bg: 0xf5ecd4, road: 0xffd700, target: [0xffd700, 0x00234f, 0xffaa00], hostile: 0xcc00ff, ui: 0x00234f, fx: 0xffd700, name: 'GOLD' },
	{ bg: 0xf0d8ec, road: 0xff44cc, target: [0xff44cc, 0x00234f, 0xaa00ff], hostile: 0x00ffcc, ui: 0x00234f, fx: 0xff44cc, name: 'SAKURA' },
	{ bg: 0xf5ecd4, road: 0xff6600, target: [0xff6600, 0xffdd00, 0x00234f], hostile: 0x00aaff, ui: 0x00234f, fx: 0xff6600, name: 'FIRE' },
	{ bg: 0xc4e2f5, road: 0x00234f, target: [0x00234f, 0xcccccc, 0x00ff00], hostile: 0x333333, ui: 0x00ff00, fx: 0xff0000, name: 'VOID' },
];

// Boot / Preload Scen
class BootScene extends Phaser.Scene {
	constructor() { super('BootScene'); }

	preload() {
		// Build minimal textures in preload
		this.makeTexture('particle', 8, (gfx) => {
			gfx.fillStyle(0x00234f, 1);
			gfx.fillCircle(4, 4, 4);
		});
		this.makeTexture('glow_particle', 16, (gfx) => {
			const steps = 8;
			for (let i = steps; i >= 1; i--) {
				const alpha = (i / steps) * 0.8;
				const r = (i / steps) * 8;
				gfx.fillStyle(0x00234f, alpha);
				gfx.fillCircle(8, 8, r);
			}
		});
		this.makeTexture('slash_particle', 6, (gfx) => {
			gfx.fillStyle(0x00234f, 1);
			gfx.fillRect(0, 0, 6, 2);
		});
	}

	makeTexture(key, size, drawFn) {
		const gfx = this.make.graphics({ x: 0, y: 0, add: false });
		drawFn(gfx);
		gfx.generateTexture(key, size, size);
		gfx.destroy();
	}

	create() {
		this.scene.start('PlayScene');
	}
}

// Main Play Scen
class PlayScene extends Phaser.Scene {
	constructor() { super('PlayScene'); }

	// ini
	init() {
		this.score = 0;
		this.lives = 3;
		this.combo = 0;
		this.maxCombo = 0;
		this.comboTimer = 0;
		this.COMBO_WINDOW = 2.5; // seconds to keep combo alive
		this.isGameOver = false;
		this.isPaused = false;
		this.currentLevel = 1;
		this.levelScore = 0;
		this.LEVEL_THRESHOLD = 100;
		this.spawnRate = 950;       // ms between spawns
		this.MIN_SPAWN_RATE = 300;
		this.paletteIndex = 0;
		this.targetPaletteIndex = 0;
		this.paletteBlend = 0;      // 0→1 blend when transitioning
		this.isBlending = false;
		this.shakeIntensity = 0;
		this.shakeDecay = 0.85;
		this.hostileSpikeBonus = 0; // Extra hostile % added every 5 levels
		this.streaks = [];
		this.trail = [];
		this.popups = [];
		this.ripples = [];
		this.slashFlashes = [];
	}

	// create
	create() {
		const w = this.scale.width;
		const h = this.scale.height;

		// Disable built-in focus loss pause
		this.game.events.off('blur');
		this.game.events.off('hidden');

		// Audio context
		if (!window._fpAudioCtx) {
			window._fpAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
			// Compressor to prevent clipping
			window._fpMaster = window._fpAudioCtx.createDynamicsCompressor();
			window._fpMaster.connect(window._fpAudioCtx.destination);
		}
		this.audioCtx = window._fpAudioCtx;
		this.master = window._fpMaster;
		this.musicStep = 0;

		// Background layer
		this.bgGraphics = this.add.graphics().setDepth(0);
		this.roadGraphics = this.add.graphics().setDepth(1);
		this.glowGraphics = this.add.graphics().setDepth(2);

		// Speed streaks
		for (let i = 0; i < 50; i++) {
			this.streaks.push({
				lane: Phaser.Math.FloatBetween(-0.48, 0.48),
				progress: Phaser.Math.FloatBetween(0, 1),
				speed: Phaser.Math.FloatBetween(0.006, 0.02),
				length: Phaser.Math.FloatBetween(0.04, 0.12),
				alpha: Phaser.Math.FloatBetween(0.3, 0.9),
			});
		}

		// Entity groups
		this.targets = this.add.group();
		this.hostiles = this.add.group();

		// Blade graphics
		this.bladeGlow = this.add.graphics().setDepth(55);
		this.bladeCore = this.add.graphics().setDepth(56);

		// HU
		this.buildHUD();

		// Palette flash overla
		this.paletteFlash = this.add.rectangle(0, 0, w * 3, h * 3, 0x00234f, 0).setDepth(200);

		// Input
		this.input.mouse.disableContextMenu();
		this.input.on('pointermove', this.handleSwipe, this);

		// Pause
		this.input.keyboard.on('keydown-ESC', () => this.togglePause());
		this.input.keyboard.on('keydown-P', () => this.togglePause());

		// Start music on first interaction
		this._startMusicOnInteraction();

		// Spawn time
		this.nextSpawnTime = 0;

		// Sync SDK level
		if (window.FreshPlay) window.FreshPlay.currentLevel = 1;

		// Entrance animatio
		this._playEntranceAnimation();
	}

	// HUD builde
	buildHUD() {
		const w = this.scale.width;
		const h = this.scale.height;
		const style = { fontFamily: 'Courier New, Courier, monospace', fontStyle: 'bold' };

		// Score
		this.scoreLabelText = this.add.text(20, 18, 'SCORE', { ...style, fontSize: '10px', color: '#00234f', letterSpacing: 4 }).setDepth(100);
		this.scoreText = this.add.text(20, 30, '0', { ...style, fontSize: '28px', color: '#00234f' }).setDepth(100);

		// Level badge
		this.levelBg = this.add.rectangle(w / 2, 28, 110, 36, 0x00234f, 0.5).setDepth(99);
		this.levelText = this.add.text(w / 2, 20, 'LEVEL', { ...style, fontSize: '10px', color: '#00234f', letterSpacing: 4 }).setOrigin(0.5, 0).setDepth(100);
		this.levelNum = this.add.text(w / 2, 30, '1', { ...style, fontSize: '28px', color: '#00234f' }).setOrigin(0.5, 0).setDepth(100);

		// Palette name
		this.paletteName = this.add.text(w / 2, 58, '— MATRIX —', { ...style, fontSize: '9px', color: '#00234f', letterSpacing: 3 }).setOrigin(0.5, 0).setDepth(100);

		// Lives
		this.livesText = this.add.text(w - 20, 18, 'LIVES', { ...style, fontSize: '10px', color: '#00234f', letterSpacing: 4 }).setOrigin(1, 0).setDepth(100);
		this.livesDiamonds = this.add.text(w - 20, 30, '◆ ◆ ◆', { ...style, fontSize: '20px', color: '#00234f' }).setOrigin(1, 0).setDepth(100);

		// Combo
		this.comboContainer = this.add.container(w / 2, h - 60).setDepth(100).setAlpha(0);
		const comboBg = this.add.rectangle(0, 0, 200, 44, 0x00234f, 0.6);
		this.comboLabel = this.add.text(0, -12, 'COMBO', { ...style, fontSize: '9px', color: '#00234f', letterSpacing: 4 }).setOrigin(0.5);
		this.comboValueText = this.add.text(0, 4, 'x1', { ...style, fontSize: '28px', color: '#00234f' }).setOrigin(0.5);
		this.comboContainer.add([comboBg, this.comboLabel, this.comboValueText]);

		// Combo bar (progress timer)
		this.comboBarBg = this.add.rectangle(w / 2, h - 30, 200, 4, 0xb0d4ea).setDepth(100).setAlpha(0);
		this.comboBar = this.add.rectangle(w / 2 - 100, h - 30, 1, 4, 0x00234f).setOrigin(0, 0.5).setDepth(101).setAlpha(0);

		// Pause button
		this.pauseBtn = this.add.text(w - 20, h - 20, '[ II PAUSE ]', { ...style, fontSize: '11px', color: '#00234f' })
			.setOrigin(1, 1).setDepth(100).setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.togglePause())
			.on('pointerover', () => this.pauseBtn.setColor('#cccccc'))
			.on('pointerout', () => this.pauseBtn.setColor('#00234f'));

		// High score
		this.hiScoreText = this.add.text(20, 68, `HI ${this._getHiScore()}`, { ...style, fontSize: '10px', color: '#00234f', letterSpacing: 2 }).setDepth(100);

		this.scale.on('resize', this._onResize, this);
	}

	_onResize(gameSize) {
		const w = gameSize.width, h = gameSize.height;
		this.levelBg.setPosition(w / 2, 28);
		this.levelText.setPosition(w / 2, 20);
		this.levelNum.setPosition(w / 2, 30);
		this.paletteName.setPosition(w / 2, 58);
		this.livesText.setPosition(w - 20, 18);
		this.livesDiamonds.setPosition(w - 20, 30);
		this.comboContainer.setPosition(w / 2, h - 60);
		this.comboBarBg.setPosition(w / 2, h - 30);
		this.comboBar.setPosition(w / 2 - 100, h - 30);
		this.pauseBtn.setPosition(w - 20, h - 20);
	}

	// Hi-score persistenc
	_getHiScore() {
		try { return parseInt(localStorage.getItem('fp_nbd_hi') || '0'); } catch { return 0; }
	}
	_saveHiScore(score) {
		try { if (score > this._getHiScore()) localStorage.setItem('fp_nbd_hi', score); } catch { }
	}

	// Entrance animation
	_playEntranceAnimation() {
		const w = this.scale.width, h = this.scale.height;
		const flash = this.add.rectangle(0, 0, w * 2, h * 2, 0x00234f, 1).setDepth(300);
		this.tweens.add({
			targets: flash, alpha: 0, duration: 600, ease: 'Power2',
			onComplete: () => flash.destroy()
		});

		// Drop-in text
		const title = this.add.text(w / 2, -60, 'NEON BLADE DASH', {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '28px', color: '#00234f',
			stroke: '#000000', strokeThickness: 4
		}).setOrigin(0.5).setDepth(301);

		this.tweens.add({
			targets: title, y: h / 2 - 20, duration: 500, ease: 'Back.Out',
			onComplete: () => {
				this.time.delayedCall(800, () => {
					this.tweens.add({ targets: title, alpha: 0, y: h / 2 - 60, duration: 400, onComplete: () => title.destroy() });
				});
			}
		});
	}

	// Music
	_startMusicOnInteraction() {
		const resume = () => {
			if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
			if (!this._bgmTimer) this._startBGM();
		};
		this.input.once('pointerdown', resume);
		if (this.audioCtx.state === 'running' && !this._bgmTimer) this._startBGM();
	}

	_startBGM() {
		const scales = [
			[261.63, 311.13, 369.99, 440.00],
			[293.66, 349.23, 392.00, 466.16],
		];
		let scaleIdx = 0;
		let stepIdx = 0;
		let beatCount = 0;

		this._bgmTimer = this.time.addEvent({
			delay: 180,
			loop: true,
			callback: () => {
				if (this.isGameOver || this.isPaused) return;
				const notes = scales[scaleIdx];
				const freq = notes[stepIdx];
				stepIdx = (stepIdx + 1) % notes.length;
				beatCount++;
				if (beatCount % 16 === 0) scaleIdx = (scaleIdx + 1) % scales.length;

				const osc = this.audioCtx.createOscillator();
				const gain = this.audioCtx.createGain();
				const filter = this.audioCtx.createBiquadFilter();
				filter.type = 'lowpass';
				filter.frequency.value = 800;
				osc.connect(filter);
				filter.connect(gain);
				gain.connect(this.master);
				osc.type = 'square';
				osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
				gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
				gain.gain.linearRampToValueAtTime(0.04, this.audioCtx.currentTime + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.16);
				osc.start(this.audioCtx.currentTime);
				osc.stop(this.audioCtx.currentTime + 0.18);
			}
		});
	}

	_playSound(type) {
		if (this.audioCtx.state !== 'running') return;
		const ctx = this.audioCtx;

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.master);

		const now = ctx.currentTime;

		if (type === 'slice') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(1200, now);
			osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
			gain.gain.setValueAtTime(0.25, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
			osc.start(now); osc.stop(now + 0.12);
		} else if (type === 'combo') {
			[0, 0.06, 0.12].forEach((delay, i) => {
				const o2 = ctx.createOscillator();
				const g2 = ctx.createGain();
				o2.connect(g2); g2.connect(this.master);
				o2.type = 'sine';
				o2.frequency.setValueAtTime(440 * Math.pow(1.25, i), now + delay);
				g2.gain.setValueAtTime(0.15, now + delay);
				g2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
				o2.start(now + delay); o2.stop(now + delay + 0.15);
			});
			return;
		} else if (type === 'hostile') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(120, now);
			osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
			gain.gain.setValueAtTime(0.4, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
			osc.start(now); osc.stop(now + 0.4);
		} else if (type === 'levelup') {
			const freqs = [523, 659, 784, 1047];
			freqs.forEach((f, i) => {
				const o2 = ctx.createOscillator();
				const g2 = ctx.createGain();
				o2.connect(g2); g2.connect(this.master);
				o2.type = 'square';
				o2.frequency.setValueAtTime(f, now + i * 0.1);
				g2.gain.setValueAtTime(0.12, now + i * 0.1);
				g2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.18);
				o2.start(now + i * 0.1); o2.stop(now + i * 0.1 + 0.2);
			});
			return;
		} else if (type === 'gameover') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(200, now);
			osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
			gain.gain.setValueAtTime(0.3, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
			osc.start(now); osc.stop(now + 1.3);
		}
	}

	// Palette managemen
	get palette() {
		if (!this.isBlending) return PALETTES[this.paletteIndex];
		const a = PALETTES[this.paletteIndex];
		return a;
	}

	_triggerPaletteTransition(newIndex) {
		this.targetPaletteIndex = newIndex;
		this.isBlending = true;
		this.paletteBlend = 0;

		const col = PALETTES[newIndex].road;
		this.paletteFlash.setFillStyle(col, 0.6);
		this.tweens.add({
			targets: this.paletteFlash, alpha: 0, duration: 800, ease: 'Power3'
		});

		const w = this.scale.width, h = this.scale.height;
		const announcement = this.add.text(w / 2, h / 2, `— ${PALETTES[newIndex].name} —`, {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '32px',
			color: '#00234f', stroke: '#000000', strokeThickness: 6
		}).setOrigin(0.5).setDepth(250).setAlpha(0);

		this.tweens.add({ targets: announcement, alpha: 1, y: h / 2 - 20, duration: 300, ease: 'Back.Out' });
		this.time.delayedCall(1000, () => {
			this.tweens.add({ targets: announcement, alpha: 0, y: h / 2 - 80, duration: 400, onComplete: () => announcement.destroy() });
		});
	}

	_finishBlend() {
		this.paletteIndex = this.targetPaletteIndex;
		this.isBlending = false;
		this.paletteBlend = 0;
		this.paletteName.setText(`— ${PALETTES[this.paletteIndex].name} —`);
	}

	// Spawning targets and hostiles
	spawnEntity() {
		if (this.isGameOver || this.isPaused) return;

		const pal = PALETTES[this.paletteIndex];
		const isHostile = Math.random() < 0.22 + (this.currentLevel * 0.008) + this.hostileSpikeBonus;
		const lane = Phaser.Math.FloatBetween(-0.42, 0.42);
		let entity;

		// Mobile phones (width < 500px) get slightly smaller icons; tablets/desktop unchanged
		const mob = this.scale.width < 500;

		if (isHostile) {
			const innerR = mob ? 13 : 17;
			const outerR = mob ? 27 : 36;
			entity = this.add.star(this.scale.width / 2, -30, 6, innerR, outerR, 0xff0000).setDepth(10);
			entity.setData('isHostile', true);
			this.hostiles.add(entity);
		} else {
			const color = Phaser.Utils.Array.GetRandom(pal.target);
			let available = ['circle'];
			if (this.currentLevel >= 2) available.push('triangle');
			if (this.currentLevel >= 4) available.push('diamond');
			if (this.currentLevel >= 6) available.push('hexagon');
			if (this.currentLevel >= 8) available.push('ring');
			const shape = Phaser.Utils.Array.GetRandom(available);

			const cr = mob ? 22 : 30;       // circle/ring radius
			const ts = mob ? 45 : 60;       // triangle size base
			const ds = mob ? 34 : 45;       // diamond side
			const hs = mob ? 0.75 : 1;      // hexagon scale factor

			switch (shape) {
				case 'circle':
					entity = this.add.circle(this.scale.width / 2, -30, cr, color); break;
				case 'triangle':
					entity = this.add.triangle(this.scale.width / 2, -30, 0, ts, ts * 0.5, 0, ts, ts, color); break;
				case 'diamond':
					entity = this.add.rectangle(this.scale.width / 2, -30, ds, ds, color);
					entity.rotation = Math.PI / 4; break;
				case 'hexagon':
					entity = this.add.polygon(this.scale.width / 2, -30, [28 * hs, 0, 56 * hs, 15 * hs, 56 * hs, 46 * hs, 28 * hs, 61 * hs, 0, 46 * hs, 0, 15 * hs], color); break;
				case 'ring':
					entity = this.add.circle(this.scale.width / 2, -30, cr, 0xc4e2f5);
					entity.setStrokeStyle(mob ? 4 : 5, color); break;
			}
			entity.setDepth(10);
			entity.setData('isHostile', false);
			entity.setData('color', color);
			this.targets.add(entity);

			this.tweens.add({ targets: entity, alpha: { from: 0, to: 1 }, duration: 120 });
		}

		entity.setData('lane', lane);
		entity.setData('speed', 80 + this.currentLevel * 5);
		entity.setData('rotSpeed', Phaser.Math.FloatBetween(0.04, 0.1) * (Math.random() < 0.5 ? 1 : -1));
		entity.setScale(0.01);
	}

	// Swipe / Trail handling
	handleSwipe(pointer) {
		if (!pointer.isDown || this.isGameOver || this.isPaused) {
			this.trail = [];
			this.bladeCore.clear();
			this.bladeGlow.clear();
			return;
		}

		const pt = new Phaser.Math.Vector2(pointer.x, pointer.y);
		const last = this.trail[this.trail.length - 1];
		if (!last || !last.equals(pt)) this.trail.push(pt);
		if (this.trail.length > 10) this.trail.shift();

		this._drawBlade();
		this._checkSlices();
	}

	_drawBlade() {
		const pal = PALETTES[this.paletteIndex];
		const roadColor = pal.road;
		const pts = this.trail;
		if (pts.length < 2) return;

		this.bladeGlow.clear();
		this.bladeCore.clear();

		// Clean 2px core with distinct glow
		this.bladeCore.lineStyle(2, 0x00234f, 1);
		this.bladeGlow.lineStyle(10, roadColor, 0.6);

		this.bladeCore.beginPath();
		this.bladeGlow.beginPath();

		pts.forEach((p, i) => {
			if (i === 0) {
				this.bladeCore.moveTo(p.x, p.y);
				this.bladeGlow.moveTo(p.x, p.y);
			} else {
				this.bladeCore.lineTo(p.x, p.y);
				this.bladeGlow.lineTo(p.x, p.y);
			}
		});

		this.bladeCore.strokePath();
		this.bladeGlow.strokePath();
	}

	// Collision detection
	_checkSlices() {
		if (this.trail.length < 2) return;
		const p1 = this.trail[this.trail.length - 2];
		const p2 = this.trail[this.trail.length - 1];
		const bladeLine = new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y);

		// Targets
		[...this.targets.getChildren()].forEach(t => {
			if (!t.active) return;
			const r = 55 * t.scaleX;
			const circle = new Phaser.Geom.Circle(t.x, t.y, r);
			if (Phaser.Geom.Intersects.LineToCircle(bladeLine, circle)) {
				this._onTargetSliced(t);
			}
		});

		// Hostiles
		[...this.hostiles.getChildren()].forEach(h => {
			if (!h.active) return;
			const sz = 70 * h.scaleX;
			const rect = new Phaser.Geom.Rectangle(h.x - sz / 2, h.y - sz / 2, sz, sz);
			if (Phaser.Geom.Intersects.LineToRectangle(bladeLine, rect)) {
				this._onHostileSliced(h);
			}
		});
	}

	_onTargetSliced(target) {
		const color = target.getData('color') || 0x00ff00;
		const x = target.x, y = target.y;

		this.combo = Math.min(this.combo + 1, 20);
		this.comboTimer = this.COMBO_WINDOW;
		if (this.combo > this.maxCombo) this.maxCombo = this.combo;

		const multiplier = 1 + Math.floor(this.combo / 3);
		const pts = 5 * multiplier;
		this._addScore(pts);

		this._playSound('slice');
		if (this.combo > 1 && this.combo % 3 === 0) this._playSound('combo');

		this._spawnSliceEffect(x, y, color);
		this._spawnRipple(x, y, color);
		this._spawnPopup(x, y, `+${pts}`, '#00234f', multiplier > 1 ? 1.4 : 1);

		if (this.combo >= 3) {
			this._spawnPopup(x, y - 40, `${this.combo}x COMBO!`, '#00234f', 1.2);
		}

		target.destroy();
	}

	_onHostileSliced(hostile) {
		const x = hostile.x, y = hostile.y;

		this._playSound('hostile');
		this.lives--;
		this.combo = 0;
		this.comboTimer = 0;
		this._updateLivesHUD();
		this._addScore(-30);
		this._spawnSliceEffect(x, y, 0xff0044);
		this._spawnPopup(x, y, '-30', '#00234f');
		this._shakeCamera(0.025, 400);

		const flash = this.add.rectangle(0, 0, this.scale.width * 3, this.scale.height * 3, 0xff0000, 0.3).setDepth(190);
		this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

		hostile.destroy();

		if (this.lives <= 0) this._triggerGameOver();
	}

	// Scoring and leveling
	_addScore(pts) {
		this.score = Math.max(0, this.score + pts);
		this.scoreText.setText(this.score.toLocaleString());
		this.levelScore += pts;
		if (this.levelScore >= this.LEVEL_THRESHOLD) {
			this.levelScore = 0;
			this._levelUp();
		}
	}

	_levelUp() {
		this.currentLevel++;
		this.levelNum.setText(this.currentLevel);

		// Difficulty: standard per-level speed increase
		this.spawnRate = Math.max(this.MIN_SPAWN_RATE, this.spawnRate - 65);

		// Difficulty SPIKE every 5 level
		const isAdLevel = this.currentLevel % 5 === 0;
		if (isAdLevel) {
			// Extra spawn rate crunch at the 5-level boundary
			this.spawnRate = Math.max(this.MIN_SPAWN_RATE, this.spawnRate - 50);
			// Permanently raise hostile probability by 4% per 5-level bracket
			this.hostileSpikeBonus = Math.min(this.hostileSpikeBonus + 0.04, 0.25);
		}

		// Sound + camera feedback
		this._playSound('levelup');
		this._shakeCamera(0.01, 200);

		// Palette transitio
		const newPalIdx = Math.floor((this.currentLevel - 1) / 5) % PALETTES.length;
		if (newPalIdx !== this.paletteIndex) {
			this._triggerPaletteTransition(newPalIdx);
		}

		// Level-up popup
		const w = this.scale.width, h = this.scale.height;
		const pop = this.add.text(w / 2, h / 2 + 40, `LEVEL ${this.currentLevel}`, {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '36px',
			color: '#00234f', stroke: '#000000', strokeThickness: 5
		}).setOrigin(0.5).setDepth(200).setAlpha(0);
		this.tweens.add({ targets: pop, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 200, yoyo: true });
		this.time.delayedCall(600, () => {
			this.tweens.add({ targets: pop, alpha: 0, y: h / 2 - 20, duration: 300, onComplete: () => pop.destroy() });
		});

		// FreshPlay SDK: notify every level; ad break every 5
		if (window.FreshPlay) {
			// levelComplete notifies the SDK on every level.
			// The portal handles showing the ad at its own cadence.
			window.FreshPlay.levelComplete();
		}
	}

	// Visual FX
	_spawnSliceEffect(x, y, color) {
		const count = 14 + this.combo;
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * Math.PI * 2;
			const speed = Phaser.Math.FloatBetween(60, 200 + this.combo * 8);
			const p = this.add.image(x, y, 'glow_particle').setDepth(60).setTint(color).setAlpha(1).setScale(Phaser.Math.FloatBetween(0.3, 0.9));
			this.tweens.add({
				targets: p,
				x: x + Math.cos(angle) * speed,
				y: y + Math.sin(angle) * speed,
				alpha: 0,
				scale: 0,
				duration: 350 + Math.random() * 200,
				ease: 'Power2',
				onComplete: () => p.destroy()
			});
		}

		for (let i = 0; i < 4; i++) {
			const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
			const len = Phaser.Math.FloatBetween(20, 60);
			const g = this.add.graphics().setDepth(58);
			g.lineStyle(Phaser.Math.FloatBetween(1, 3), color, 1);
			g.beginPath();
			g.moveTo(x, y);
			g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
			g.strokePath();
			this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
		}
	}

	_spawnRipple(x, y, color) {
		this.ripples.push({ x, y, color, radius: 0, maxRadius: 60 + this.combo * 3, alpha: 0.8, life: 1 });
	}

	_spawnPopup(x, y, text, color = '#00234f', scale = 1) {
		const pop = this.add.text(x, y, text, {
			fontFamily: 'Courier New', fontStyle: 'bold',
			fontSize: `${Math.round(22 * scale)}px`,
			color: color,
			stroke: '#000000', strokeThickness: 3
		}).setOrigin(0.5).setDepth(150);
		this.popups.push({ obj: pop, life: 1.0 });
	}

	_shakeCamera(intensity, duration) {
		this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
		this.time.delayedCall(duration, () => {
			this.shakeIntensity = 0;
		});
	}

	// Game Over
	_triggerGameOver() {
		if (this.isGameOver) return;
		this.isGameOver = true;

		this._saveHiScore(this.score);

		if (window.FreshPlay) window.FreshPlay.gameOver(this.score);
		if (this._bgmTimer) { this._bgmTimer.remove(); this._bgmTimer = null; }
		this._playSound('gameover');

		const w = this.scale.width, h = this.scale.height;
		const overlay = this.add.rectangle(0, 0, w * 2, h * 2, 0x00234f, 0).setDepth(210);
		this.tweens.add({ targets: overlay, alpha: 0.75, duration: 600 });

		const ui = this.add.container(w / 2, h / 2).setDepth(220).setAlpha(0);
		const panel = this.add.rectangle(0, 0, 320, 260, 0x00234f, 0.95);
		panel.setStrokeStyle(2, 0x48d1cc, 1);

		const goText = this.add.text(0, -95, 'GAME OVER', {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '30px', color: '#00234f'
		}).setOrigin(0.5);

		const scoreLabel = this.add.text(0, -40, 'FINAL SCORE', {
			fontFamily: 'Courier New', fontSize: '11px', color: '#00234f', letterSpacing: 4
		}).setOrigin(0.5);

		const scoreFinal = this.add.text(0, -18, this.score.toLocaleString(), {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '38px', color: '#00234f'
		}).setOrigin(0.5);

		const hiLabel = this.add.text(0, 28, `HI SCORE: ${this._getHiScore().toLocaleString()}`, {
			fontFamily: 'Courier New', fontSize: '13px', color: '#00234f'
		}).setOrigin(0.5);

		const comboLabel = this.add.text(0, 54, `MAX COMBO: x${this.maxCombo}  |  LEVEL: ${this.currentLevel}`, {
			fontFamily: 'Courier New', fontSize: '11px', color: '#00234f'
		}).setOrigin(0.5);

		const restartBtn = this.add.text(0, 95, '[ PLAY AGAIN ]', {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '16px',
			color: '#000000', backgroundColor: 0xc4e2f5, padding: { x: 18, y: 8 }
		}).setOrigin(0.5).setInteractive({ useHandCursor: true });

		restartBtn.on('pointerover', () => restartBtn.setColor('#00234f').setBackgroundColor('#000000'));
		restartBtn.on('pointerout', () => restartBtn.setColor('#000000').setBackgroundColor('#00234f'));
		restartBtn.on('pointerdown', () => this.scene.restart());

		ui.add([panel, goText, scoreLabel, scoreFinal, hiLabel, comboLabel, restartBtn]);

		this.time.delayedCall(400, () => {
			this.tweens.add({ targets: ui, alpha: 1, y: h / 2 - 10, duration: 400, ease: 'Back.Out' });
		});
	}

	// Pause
	togglePause() {
		if (this.isGameOver) return;
		this.isPaused = !this.isPaused;
		if (this.isPaused) {
			const w = this.scale.width, h = this.scale.height;
			this._pauseOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x00234f, 0.7).setDepth(300);
			this._pauseText = this.add.text(w / 2, h / 2, 'PAUSED\n\n[ESC or P to resume]', {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '28px', color: '#00234f', align: 'center'
			}).setOrigin(0.5).setDepth(301);
		} else {
			if (this._pauseOverlay) { this._pauseOverlay.destroy(); this._pauseOverlay = null; }
			if (this._pauseText) { this._pauseText.destroy(); this._pauseText = null; }
		}
	}

	// HUD update
	_updateLivesHUD() {
		const filled = '◆ '.repeat(Math.max(0, this.lives)).trim();
		const empty = '◇ '.repeat(Math.max(0, 3 - this.lives)).trim();
		this.livesDiamonds.setText((filled + ' ' + empty).trim());
		this.tweens.add({ targets: this.livesDiamonds, scaleX: 1.4, scaleY: 1.4, duration: 80, yoyo: true });
	}

	_updateComboHUD(dt) {
		if (this.combo > 0) {
			this.comboTimer -= dt;
			if (this.comboTimer <= 0) {
				this.combo = 0;
				this.comboTimer = 0;
				this.tweens.add({ targets: [this.comboContainer, this.comboBarBg, this.comboBar], alpha: 0, duration: 200 });
			} else {
				const t = clamp(this.comboTimer / this.COMBO_WINDOW, 0, 1);
				this.comboBar.width = 200 * t;
				this.comboValueText.setText(`x${this.combo}`);

				if (this.comboContainer.alpha < 1) {
					this.tweens.add({ targets: [this.comboContainer, this.comboBarBg, this.comboBar], alpha: 1, duration: 150 });
				}
			}
		}
	}

	// Road drawin
	_drawRoad(time) {
		const w = this.scale.width, h = this.scale.height;
		const pal = PALETTES[this.paletteIndex];
		const roadColor = pal.road;
		const bgColor = pal.bg;

		this.bgGraphics.clear();
		this.bgGraphics.fillStyle(bgColor, 1);
		this.bgGraphics.fillRect(0, 0, w, h);

		this.bgGraphics.lineStyle(1, roadColor, 0.04);
		for (let gx = 0; gx <= w; gx += 60) {
			this.bgGraphics.beginPath();
			this.bgGraphics.moveTo(gx, 0);
			this.bgGraphics.lineTo(gx, h);
			this.bgGraphics.strokePath();
		}

		const topW = w * 0.13;
		const botW = w * 2.1;
		const topL = w / 2 - topW / 2;
		const topR = w / 2 + topW / 2;
		const botL = w / 2 - botW / 2;
		const botR = w / 2 + botW / 2;

		this.roadGraphics.clear();

		[
			{ alpha: 0.08, widthMult: 1.3 },
			{ alpha: 0.15, widthMult: 1.15 },
			{ alpha: 0.35, widthMult: 1.0 },
		].forEach(({ alpha, widthMult }) => {
			this.roadGraphics.fillStyle(roadColor, alpha);
			this.roadGraphics.beginPath();
			this.roadGraphics.moveTo(w / 2 - (topW * widthMult) / 2, 0);
			this.roadGraphics.lineTo(w / 2 + (topW * widthMult) / 2, 0);
			this.roadGraphics.lineTo(botR * widthMult - w * (widthMult - 1) / 2, h);
			this.roadGraphics.lineTo(botL * widthMult + w * (widthMult - 1) / 2, h);
			this.roadGraphics.closePath();
			this.roadGraphics.fillPath();
		});

		this.roadGraphics.lineStyle(2, roadColor, 0.9);
		this.roadGraphics.beginPath();
		this.roadGraphics.moveTo(topL, 0); this.roadGraphics.lineTo(botL, h);
		this.roadGraphics.strokePath();
		this.roadGraphics.beginPath();
		this.roadGraphics.moveTo(topR, 0); this.roadGraphics.lineTo(botR, h);
		this.roadGraphics.strokePath();

		const dashCount = 16;
		for (let i = 0; i < dashCount; i++) {
			const p0 = i / dashCount;
			const p1 = (i + 0.4) / dashCount;
			const y0 = p0 * h;
			const y1 = p1 * h;
			const cx = w / 2;
			const dashAlpha = 0.3 + 0.4 * p0;
			this.roadGraphics.lineStyle(2, 0x00234f, dashAlpha * (0.6 + 0.4 * Math.sin(time * 0.003 + i)));
			this.roadGraphics.beginPath();
			this.roadGraphics.moveTo(cx, y0);
			this.roadGraphics.lineTo(cx, y1);
			this.roadGraphics.strokePath();
		}

		this.glowGraphics.clear();
		this.streaks.forEach(s => {
			s.progress += s.speed;
			if (s.progress > 1) { s.progress = 0; s.lane = Phaser.Math.FloatBetween(-0.45, 0.45); }

			const p0 = s.progress;
			const p1 = Math.min(1, s.progress + s.length);
			const y0 = p0 * h, y1 = p1 * h;
			const cw0 = topW + (botW - topW) * p0;
			const cw1 = topW + (botW - topW) * p1;
			const x0 = w / 2 + s.lane * cw0;
			const x1 = w / 2 + s.lane * cw1;

			this.glowGraphics.lineStyle(1.5, roadColor, s.alpha * (0.5 + 0.5 * p0));
			this.glowGraphics.beginPath();
			this.glowGraphics.moveTo(x0, y0);
			this.glowGraphics.lineTo(x1, y1);
			this.glowGraphics.strokePath();
		});

		this.ripples = this.ripples.filter(r => {
			r.radius += 3;
			r.alpha *= 0.92;
			r.life = r.alpha;
			if (r.alpha < 0.05) return false;
			this.glowGraphics.lineStyle(2, r.color, r.alpha);
			this.glowGraphics.strokeCircle(r.x, r.y, r.radius);
			return true;
		});
	}

	// Entity movement and logic
	_updateEntities(delta) {
		const w = this.scale.width, h = this.scale.height;
		const topW = w * 0.13;
		const botW = w * 2.1;

		const updateOne = (obj) => {
			if (!obj || !obj.active) return;

			let spd = obj.getData('speed');
			spd += 2.5 * (delta / 16);
			obj.setData('speed', spd);
			obj.y += spd * (delta / 1000);

			const progress = clamp(obj.y / h, 0, 1);
			const scale = 0.04 + progress * 1.6;
			obj.setScale(scale);

			const cw = topW + (botW - topW) * progress;
			obj.x = w / 2 + obj.getData('lane') * cw;

			obj.rotation += obj.getData('rotSpeed') * (delta / 16);

			if (!obj.getData('isHostile')) {
				const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.005 + obj.x);
				obj.setAlpha(pulse);
			}

			if (obj.y > h + 100) {
				if (!obj.getData('isHostile')) {
					if (this.combo > 0) {
						this.combo = 0;
						this.comboTimer = 0;
					}
				}
				obj.destroy();
			}
		};

		this.targets.getChildren().forEach(updateOne);
		this.hostiles.getChildren().forEach(updateOne);
	}

	// Popup updat
	_updatePopups(delta) {
		this.popups = this.popups.filter(p => {
			p.life -= delta / 700;
			p.obj.y -= delta / 1000 * 55;
			p.obj.setAlpha(Math.max(0, p.life));
			if (p.life <= 0) { p.obj.destroy(); return false; }
			return true;
		});
	}

	// Palette blend update
	_updatePaletteBlend(delta) {
		if (!this.isBlending) return;
		this.paletteBlend += delta / 1000;
		if (this.paletteBlend >= 1) this._finishBlend();
	}

	// Camera shak
	_updateCameraShake(delta) {
		if (this.shakeIntensity > 0) {
			const dx = (Math.random() - 0.5) * this.shakeIntensity * this.scale.width;
			const dy = (Math.random() - 0.5) * this.shakeIntensity * this.scale.height;
			this.cameras.main.setScroll(dx, dy);
			this.shakeIntensity *= this.shakeDecay;
			if (this.shakeIntensity < 0.001) {
				this.shakeIntensity = 0;
				this.cameras.main.setScroll(0, 0);
			}
		}
	}

	// Main update loop
	update(time, delta) {
		if (this.isPaused) return;

		const dt = delta / 1000;

		if (!this.isGameOver && time > this.nextSpawnTime) {
			this.spawnEntity();
			this.nextSpawnTime = time + this.spawnRate + Phaser.Math.FloatBetween(-120, 120);
		}

		this._drawRoad(time);

		if (!this.isGameOver) this._updateEntities(delta);

		this._updateComboHUD(dt);
		this._updatePopups(delta);
		this._updatePaletteBlend(delta);
		this._updateCameraShake(delta);

		if (!this.input.activePointer.isDown && this.trail.length > 0) {
			this.trail = [];
			this.bladeCore.clear();
			this.bladeGlow.clear();
		}

		const hi = this._getHiScore();
		if (this.score >= hi && hi > 0) {
			this.hiScoreText.setColor(Math.sin(time * 0.008) > 0 ? '#ffff00' : '#00234f');
			this.hiScoreText.setText(`★ HI ${hi.toLocaleString()}`);
		}
	}
}

// Game configuration and initialization
const config = {
	type: Phaser.AUTO,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: '100%',
		height: '100%',
	},
	backgroundColor: 0xc4e2f5,
	physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
	scene: [BootScene, PlayScene],
	render: {
		antialias: true,
		powerPreference: 'high-performance',
	},
	fps: {
		target: 60,
		forceSetTimeOut: false,
	}
};

const game = new Phaser.Game(config);
