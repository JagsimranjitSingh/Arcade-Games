// ============================================================
//  ORBIT STRIKER 
// ============================================================

// Utility functions
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;

const hexToRgb = hex => ({
	r: (hex >> 16) & 0xff,
	g: (hex >> 8) & 0xff,
	b: hex & 0xff
});
const rgbToHex = ({ r, g, b }) => (r << 16) | (g << 8) | b;
const lerpColor = (c1, c2, t) => {
	const a = hexToRgb(c1), b = hexToRgb(c2);
	return rgbToHex({
		r: Math.round(lerp(a.r, b.r, t)),
		g: Math.round(lerp(a.g, b.g, t)),
		b: Math.round(lerp(a.b, b.b, t))
	});
};
const hexCss = hex => '#' + hex.toString(16).padStart(6, '0');

// Default palette (used before FreshPlay SDK loads)
const DEFAULT_PALETTE = {
	background: 0xf0f4f8,
	playerCore:  0x3b82f6,
	fxAccent:    0xf97316,
	interface:   0x334155,
	hostile:     0xef4444
};

// Constants
const SHIELD_RADIUS       = 90;   // distance of shield from core center
const SHIELD_ARC          = 0.55; // half-arc in radians for each side (~63°)
const CORE_RADIUS         = 22;
const LASER_SPEED_BASE    = 260;
const SPAWN_INTERVAL_BASE = 1200; // ms
const MIN_SPAWN_INTERVAL  = 320;
const LIVES_MAX           = 3;
const SCORE_PER_LEVEL     = 100;
const ROTATION_SPEED      = 3.6; // rad/s when key held
const ROTATION_EASE       = 0.14; // lerp factor for smooth rotation

// Boot Scene
class BootScene extends Phaser.Scene {
	constructor() { super('BootScene'); }

	preload() {
		// Generate all textures procedurally
		this._makeTex('glow_dot', 32, g => {
			for (let i = 8; i >= 1; i--) {
				g.fillStyle(0xffffff, (i / 8) * 0.9);
				g.fillCircle(16, 16, i * 2);
			}
		});
		this._makeTex('ring_glow', 64, g => {
			for (let i = 5; i >= 1; i--) {
				g.lineStyle(i * 2, 0xffffff, (1 / i) * 0.4);
				g.strokeCircle(32, 32, 24);
			}
		});
		this._makeTex('laser_head', 20, g => {
			g.fillStyle(0xffffff, 1);
		g.fillCircle(10, 10, 10);
		});
		this._makeTex('spark', 8, g => {
			g.fillStyle(0xffffff, 1);
		g.fillRect(0, 2, 8, 4);
		});
	}

	_makeTex(key, size, fn) {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		fn(g);
		g.generateTexture(key, size, size);
		g.destroy();
	}

	create() { this.scene.start('PlayScene'); }
}

// Play Scene
class PlayScene extends Phaser.Scene {
	constructor() { super('PlayScene'); }

	// initialize game state
	init() {
		this.score          = 0;
		this.lives          = LIVES_MAX;
		this.level          = 1;
		this.levelScore     = 0;
		this.isGameOver     = false;
		this.isPaused       = false;
		this.isLeveling     = false;

		// Shield state
		this.shieldAngle    = -Math.PI / 2; // top
		this.shieldTarget   = -Math.PI / 2;
		this.shieldVelocity = 0;

		// Input
		this.rotLeft        = false;
		this.rotRight       = false;

		// Lasers
		this.lasers         = [];
		this.nextSpawn      = 0;
		this.spawnInterval  = SPAWN_INTERVAL_BASE;
		this.laserSpeed     = LASER_SPEED_BASE;

		// FX
		this.particles      = [];
		this.screenPulse    = 0; // 0-1, decays
		this.shakeAmt       = 0;

		// Palette
		this.palette        = this._getPalette();
		this.bgAlpha        = 0; // for entrance fade

		// Audio
		this.audioCtx       = null;
		this.masterGain     = null;

		// Touch
		this.touchLeft      = false;
		this.touchRight     = false;

		// Hi-score
		this.hiScore        = this._loadHi();
	}

	// create
	create() {
		const { width: W, height: H } = this.scale;

		this._initAudio();

		// Layer graphics
		this.bgGfx          = this.add.graphics().setDepth(0);
		this.gridGfx        = this.add.graphics().setDepth(1);
		this.orbitGfx       = this.add.graphics().setDepth(3);
		this.laserGfx       = this.add.graphics().setDepth(4);
		this.shieldGfx      = this.add.graphics().setDepth(5);
		this.coreGfx        = this.add.graphics().setDepth(6);
		this.fxGfx          = this.add.graphics().setDepth(7);
		this.uiGfx          = this.add.graphics().setDepth(10);

		// Glow particles 
		this.glowPool = this.add.group();

		// HUD
		this._buildHUD();

		// Input
		this._initInput();

		// Spawn timer
		this.nextSpawn = this.time.now + 800;

		// Entrance
		this._playEntrance();

		// Resize handler
		this.scale.on('resize', this._onResize, this);

		// First pointer — resume AudioContext
		this.input.once('pointerdown', () => {
			if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
		});
	}

	// Palette
	_getPalette() {
		try {
			if (window.FreshPlay?.getCurrentPalette) {
				const p = window.FreshPlay.getCurrentPalette();
				return {
					background: p.background ?? DEFAULT_PALETTE.background,
					colorA:     p.playerCore  ?? DEFAULT_PALETTE.playerCore,
					colorB:     p.fxAccent    ?? DEFAULT_PALETTE.fxAccent,
					ui:         p.interface   ?? DEFAULT_PALETTE.interface,
					hostile:    p.hostile     ?? DEFAULT_PALETTE.hostile
				};
			}
		} catch {}
		return {
			background: DEFAULT_PALETTE.background,
			colorA:     DEFAULT_PALETTE.playerCore,
			colorB:     DEFAULT_PALETTE.fxAccent,
			ui:         DEFAULT_PALETTE.interface,
			hostile:    DEFAULT_PALETTE.hostile
		};
	}

	// Audio
	_initAudio() {
		try {
			if (!window._osAudioCtx) {
				window._osAudioCtx   = new (window.AudioContext || window.webkitAudioContext)();
				window._osMasterGain = window._osAudioCtx.createDynamicsCompressor();
				window._osMasterGain.connect(window._osAudioCtx.destination);
			}
			this.audioCtx  = window._osAudioCtx;
			this.masterGain = window._osMasterGain;
		} catch {}
	}

	_sound(type) {
		if (!this.audioCtx || this.audioCtx.state !== 'running') return;
		const ctx = this.audioCtx;
		const now = ctx.currentTime;

		const osc  = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.masterGain);

		switch (type) {
			case 'deflect': {
				// Bright rising ping
				osc.type = 'sine';
				osc.frequency.setValueAtTime(660, now);
				osc.frequency.linearRampToValueAtTime(1320, now + 0.08);
				gain.gain.setValueAtTime(0.25, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
				osc.start(now); osc.stop(now + 0.2);
				break;
			}
			case 'miss': {
				// Heavy thud drop
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(180, now);
				osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
				gain.gain.setValueAtTime(0.35, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
				osc.start(now); osc.stop(now + 0.45);
				break;
			}
			case 'levelup': {
				[0, 0.09, 0.18, 0.28].forEach((d, i) => {
					const o2 = ctx.createOscillator();
					const g2 = ctx.createGain();
					o2.connect(g2); g2.connect(this.masterGain);
					o2.type = 'square';
					o2.frequency.setValueAtTime([523, 659, 784, 1047][i], now + d);
					g2.gain.setValueAtTime(0.12, now + d);
					g2.gain.exponentialRampToValueAtTime(0.001, now + d + 0.15);
					o2.start(now + d); o2.stop(now + d + 0.18);
				});
				return;
			}
			case 'gameover': {
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(220, now);
				osc.frequency.exponentialRampToValueAtTime(30, now + 1.4);
				gain.gain.setValueAtTime(0.3, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
				osc.start(now); osc.stop(now + 1.5);
				break;
			}
			case 'spawn': {
				osc.type = 'sine';
				osc.frequency.setValueAtTime(220, now);
				osc.frequency.linearRampToValueAtTime(200, now + 0.05);
				gain.gain.setValueAtTime(0.06, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
				osc.start(now); osc.stop(now + 0.1);
				break;
			}
		}
	}

	// HUD
	_buildHUD() {
		const { width: W, height: H } = this.scale;
		const pal = this.palette;
		const MONO = 'Courier New, Courier, monospace';

		const mk = (x, y, txt, size, color, depth = 10) =>
			this.add.text(x, y, txt, {
				fontFamily: MONO, fontSize: size + 'px', color: hexCss(color)
			}).setDepth(depth);

		// Score block — top left
		this.hudScoreLabel = mk(24, 20, 'SCORE', 9, pal.ui).setLetterSpacing(4);
		this.hudScore      = mk(24, 32, '0', 36, pal.ui);

		// Level block — top center
		this.hudLevelLabel = mk(W / 2, 20, 'LEVEL', 9, pal.ui).setOrigin(0.5, 0).setLetterSpacing(4);
		this.hudLevel      = mk(W / 2, 32, '1', 36, pal.ui).setOrigin(0.5, 0);

		// Hi-score — below score
		this.hudHi         = mk(24, 72, 'HI  ' + this.hiScore, 10, pal.ui).setLetterSpacing(2);

		// Lives — top right (diamond icons drawn in _drawUI)
		this.hudLivesLabel = mk(W - 24, 20, 'LIVES', 9, pal.ui).setOrigin(1, 0).setLetterSpacing(4);
		this.hudLivesDraw  = null; // drawn in _drawUI

		// Pause button
		this.hudPauseBtn   = this.add.text(W - 24, H - 22, '[ II ]', {
			fontFamily: MONO, fontSize: 12, color: hexCss(pal.ui)
		}).setOrigin(1, 1).setDepth(10).setInteractive({ useHandCursor: true });
		this.hudPauseBtn.on('pointerdown', () => this._togglePause());
		this.hudPauseBtn.on('pointerover', () => this.hudPauseBtn.setAlpha(0.6));
		this.hudPauseBtn.on('pointerout',  () => this.hudPauseBtn.setAlpha(1));

		// Color legend — bottom center
		this.hudLegendA = mk(W / 2 - 60, H - 22, '●', 16, pal.colorA).setOrigin(0.5, 1);
		this.hudLegendB = mk(W / 2 + 60, H - 22, '●', 16, pal.colorB).setOrigin(0.5, 1);
		this.hudLegendL = mk(W / 2, H - 24, 'MATCH LASERS', 8, pal.ui).setOrigin(0.5, 1).setLetterSpacing(3).setAlpha(0.5);
	}

	_updateHUD() {
		const pal  = this.palette;
		const { width: W } = this.scale;

		this.hudScore.setText(this.score.toLocaleString());
		this.hudLevel.setText(this.level.toString());
		this.hudHi.setText('HI  ' + Math.max(this.hiScore, this.score));

		// Pulse score on change
		this.tweens.add({ targets: this.hudScore, scaleX: 1.2, scaleY: 1.2, duration: 60, yoyo: true });

		this.hudLegendA.setColor(hexCss(pal.colorA));
		this.hudLegendB.setColor(hexCss(pal.colorB));
	}

	// Input
	_initInput() {
		const kb = this.input.keyboard;
		const kLeft  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		const kRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		const kA     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
		const kD     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);

		kb.on('keydown-ESC', () => this._togglePause());
		kb.on('keydown-P',   () => this._togglePause());

		this._kLeft  = [kLeft, kA];
		this._kRight = [kRight, kD];

		// Touch: left/right halves
		this.input.on('pointerdown', ptr => {
			if (ptr.x < this.scale.width / 2) this.touchLeft  = true;
			else                               this.touchRight = true;
		});
		this.input.on('pointerup', ptr => {
			this.touchLeft  = false;
			this.touchRight = false;
		});
		this.input.on('pointermove', ptr => {
			if (!ptr.isDown) return;
			this.touchLeft  = ptr.x < this.scale.width / 2;
			this.touchRight = ptr.x >= this.scale.width / 2;
		});
	}

	_isLeft()  { return this._kLeft.some(k  => k.isDown) || this.touchLeft; }
	_isRight() { return this._kRight.some(k => k.isDown) || this.touchRight; }

	// Hi-score
	_loadHi()   { try { return parseInt(localStorage.getItem('fp_os_hi') || '0'); } catch { return 0; } }
	_saveHi(s)  { try { if (s > this._loadHi()) localStorage.setItem('fp_os_hi', s); } catch {} }

	// Entrance animation
	_playEntrance() {
		const { width: W, height: H } = this.scale;
		const flash = this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0xffffff, 1).setDepth(500);
		this.tweens.add({ targets: flash, alpha: 0, duration: 700, ease: 'Power3', onComplete: () => flash.destroy() });

		const title = this.add.text(W / 2, H / 2 - 20, 'ORBIT STRIKER', {
			fontFamily: 'Courier New', fontSize: '32px',
			color: '#2563eb', stroke: '#ffffff', strokeThickness: 4
		}).setOrigin(0.5).setDepth(510).setAlpha(0);

		this.tweens.add({ targets: title, alpha: 1, y: H / 2 - 40, duration: 400, ease: 'Back.Out' });
		this.time.delayedCall(1200, () => {
			this.tweens.add({ targets: title, alpha: 0, y: H / 2 - 90, duration: 400, onComplete: () => title.destroy() });
		});
	}

	// Laser spawning
	_spawnLaser(time) {
		const { width: W, height: H } = this.scale;
		const cx = W / 2, cy = H / 2;

		// Random angle from any direction (edge of screen)
		const angle = Phaser.Math.FloatBetween(0, TAU);
		// Spawn off-screen
		const diag = Math.max(W, H) * 0.7;
		const sx = cx + Math.cos(angle) * diag;
		const sy = cy + Math.sin(angle) * diag;

		// Laser color: randomly colorA or colorB
		const isA = Math.random() < 0.5;
		const pal  = this.palette;
		const col  = isA ? pal.colorA : pal.colorB;

		// Direction toward center with a small offset for variety
		const towardAngle = angle + Math.PI + Phaser.Math.FloatBetween(-0.08, 0.08);

		this.lasers.push({
			x: sx, y: sy,
			vx: Math.cos(towardAngle) * this.laserSpeed,
			vy: Math.sin(towardAngle) * this.laserSpeed,
			color: col,
			isA,
			angle, // incoming angle (from center outward)
			length: 38,
			width: 3,
			alpha: 1,
			alive: true,
			warned: false,   // warning flash shown?
			warnAlpha: 0,
			birthTime: time,
			tailPts: []       // for glow trail
		});

		this._sound('spawn');
	}

	// Shield & core draw
	_drawShield(dt) {
		const { width: W, height: H } = this.scale;
		const cx = W / 2, cy = H / 2;
		const pal = this.palette;
		const sa  = this.shieldAngle;

		this.shieldGfx.clear();

		// Orbit ring
		this.orbitGfx.clear();
		this.orbitGfx.lineStyle(1, pal.ui, 0.08);
		this.orbitGfx.strokeCircle(cx, cy, SHIELD_RADIUS);

		// Draw two arcs: A = colorA (front half), B = colorB (back half)
		// Shield arc covers ~180° for each half (π radians each)
		const drawArc = (startA, endA, col, glow) => {
			// Outer glow
			for (let t = 3; t >= 1; t--) {
				this.shieldGfx.lineStyle(t * 5, col, glow * 0.12 * (4 - t));
				this.shieldGfx.beginPath();
				this.shieldGfx.arc(cx, cy, SHIELD_RADIUS, startA, endA, false);
				this.shieldGfx.strokePath();
			}
			// Core arc
			this.shieldGfx.lineStyle(4, col, 0.95);
			this.shieldGfx.beginPath();
			this.shieldGfx.arc(cx, cy, SHIELD_RADIUS, startA, endA, false);
			this.shieldGfx.strokePath();

			// End caps (small circles)
			const ax1 = cx + Math.cos(startA) * SHIELD_RADIUS;
			const ay1 = cy + Math.sin(startA) * SHIELD_RADIUS;
			const ax2 = cx + Math.cos(endA) * SHIELD_RADIUS;
			const ay2 = cy + Math.sin(endA) * SHIELD_RADIUS;
			this.shieldGfx.fillStyle(col, 1);
			this.shieldGfx.fillCircle(ax1, ay1, 4);
			this.shieldGfx.fillCircle(ax2, ay2, 4);
		};

		drawArc(sa - Math.PI * 0.5, sa + Math.PI * 0.5, pal.colorA, 1);
		drawArc(sa + Math.PI * 0.5, sa + Math.PI * 1.5, pal.colorB, 1);

		// Core
		this.coreGfx.clear();

		// Glow rings
		for (let i = 4; i >= 1; i--) {
			this.coreGfx.lineStyle(i * 4, pal.playerCore ?? pal.colorA, 0.07 * (5 - i));
			this.coreGfx.strokeCircle(cx, cy, CORE_RADIUS + i * 6);
		}

		// Core fill
		this.coreGfx.fillStyle(0xf0f4f8, 1);
		this.coreGfx.fillCircle(cx, cy, CORE_RADIUS);

		// Core inner glow gradient rings
		const coreCol = pal.colorA;
		this.coreGfx.lineStyle(3, coreCol, 0.9);
		this.coreGfx.strokeCircle(cx, cy, CORE_RADIUS);
		this.coreGfx.lineStyle(1.5, coreCol, 0.4);
		this.coreGfx.strokeCircle(cx, cy, CORE_RADIUS * 0.6);
	}

	// Laser update & draw
	_updateLasers(dt, time) {
		const { width: W, height: H } = this.scale;
		const cx = W / 2, cy = H / 2;
		const pal = this.palette;

		this.laserGfx.clear();

		for (let i = this.lasers.length - 1; i >= 0; i--) {
			const lz = this.lasers[i];
			if (!lz.alive) { this.lasers.splice(i, 1); continue; }

			lz.x += lz.vx * dt;
			lz.y += lz.vy * dt;

			// Trail
			lz.tailPts.unshift({ x: lz.x, y: lz.y });
			if (lz.tailPts.length > 14) lz.tailPts.pop();

			// Warning indicator
			const dist = Phaser.Math.Distance.Between(lz.x, lz.y, cx, cy);
			if (dist < 200 && !lz.warned) {
				lz.warned = true;
			}
			if (lz.warned) lz.warnAlpha = Math.min(1, lz.warnAlpha + dt * 5);

			// Cull if off-screen far side
			if (dist > Math.max(W, H)) { lz.alive = false; continue; }

			// Collision with SHIELD
			if (dist < SHIELD_RADIUS + 12 && dist > SHIELD_RADIUS - 12) {
				// Angle from center to laser
				const laserA = Math.atan2(lz.y - cy, lz.x - cx);

				// Which shield half covers that angle?
				// Shield front half: from (sa - π/2) to (sa + π/2)
				const sa = this.shieldAngle;
				const frontStart = sa - Math.PI / 2;
				const frontEnd   = sa + Math.PI / 2;

				// Normalize angle difference
				const angleDiff = Phaser.Math.Angle.Wrap(laserA - sa);
				const hitFront  = angleDiff > -Math.PI / 2 && angleDiff < Math.PI / 2;
				const hitBack   = !hitFront;

				const laserIsA = lz.isA;
				const match    = (laserIsA && hitFront) || (!laserIsA && hitBack);

				if (match) {
					this._onDeflect(lz, cx, cy);
				} else if (dist < SHIELD_RADIUS + 8) {
					this._onMiss(lz, cx, cy);
				}
				continue;
			}

			// Collision with CORE
			if (dist < CORE_RADIUS + 4) {
				this._onMiss(lz, cx, cy);
				continue;
			}

			// Draw laser
			const headX = lz.x;
			const headY = lz.y;
			const tailAmt = lz.tailPts.length;

			// Glow trail
			for (let t = 0; t < tailAmt - 1; t++) {
				const pct = 1 - t / tailAmt;
				this.laserGfx.lineStyle(lz.width * pct * 1.8, lz.color, pct * 0.35);
				this.laserGfx.beginPath();
				this.laserGfx.moveTo(lz.tailPts[t].x, lz.tailPts[t].y);
				this.laserGfx.lineTo(lz.tailPts[t + 1].x, lz.tailPts[t + 1].y);
				this.laserGfx.strokePath();
			}

			// Core beam
			const tailX = lz.tailPts[Math.min(7, tailAmt - 1)]?.x ?? headX;
			const tailY = lz.tailPts[Math.min(7, tailAmt - 1)]?.y ?? headY;
			this.laserGfx.lineStyle(lz.width, lz.color, lz.alpha);
			this.laserGfx.beginPath();
			this.laserGfx.moveTo(tailX, tailY);
			this.laserGfx.lineTo(headX, headY);
			this.laserGfx.strokePath();

			// Head glow
			this.laserGfx.fillStyle(lz.color, 0.8);
			this.laserGfx.fillCircle(headX, headY, 5);
			this.laserGfx.fillStyle(0xffffff, 0.9);
			this.laserGfx.fillCircle(headX, headY, 2.5);

			// Warning arc on orbit ring
			if (lz.warnAlpha > 0) {
				const warnA  = Math.atan2(lz.y - cy, lz.x - cx);
				const wSpan  = 0.18;
				this.laserGfx.lineStyle(3, pal.hostile, lz.warnAlpha * 0.5);
				this.laserGfx.beginPath();
				this.laserGfx.arc(cx, cy, SHIELD_RADIUS, warnA - wSpan, warnA + wSpan, false);
				this.laserGfx.strokePath();
			}
		}
	}

	// Deflect
	_onDeflect(lz, cx, cy) {
		lz.alive = false;

		this.score     += 10 + this.level;
		this.levelScore += 10 + this.level;
		this._updateHUD();
		this._sound('deflect');

		// FX: burst of sparks
		this._spawnBurst(lz.x, lz.y, lz.color, 16);
		this._spawnPopup(lz.x, lz.y, '+' + (10 + this.level), lz.color);

		// Screen pulse (green-ish)
		this.screenPulse = 0.4;

		// Check level up
		if (this.levelScore >= SCORE_PER_LEVEL && !this.isLeveling) {
			this._levelUp();
		}
	}

	// Miss
	_onMiss(lz, cx, cy) {
		lz.alive = false;
		this.lives--;
		this._updateLivesHUD();
		this._sound('miss');

		this._spawnBurst(cx, cy, this.palette.hostile, 22);
		this.shakeAmt = 14;

		// Red flash
		const { width: W, height: H } = this.scale;
		const fl = this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0xff0000, 0.28).setDepth(50);
		this.tweens.add({ targets: fl, alpha: 0, duration: 300, onComplete: () => fl.destroy() });

		if (this.lives <= 0) this._gameOver();
	}

	_updateLivesHUD() {
		// Rebuild lives display via uiGfx (drawn per frame in _drawUI)
	}

	// Level up
	_levelUp() {
		this.isLeveling  = true;
		this.levelScore  = 0;
		this.level++;
		this.hudLevel.setText(this.level.toString());
		this._sound('levelup');

		// Increase difficulty
		this.spawnInterval = Math.max(MIN_SPAWN_INTERVAL, this.spawnInterval - 80);
		this.laserSpeed    = Math.min(600, this.laserSpeed + 22);

		// Update palette
		this.palette = this._getPalette();
		this._refreshHUDColors();

		// Level popup
		const { width: W, height: H } = this.scale;
		const pop = this.add.text(W / 2, H / 2 + 60, 'LEVEL ' + this.level, {
			fontFamily: 'Courier New', fontSize: '34px',
			color: '#2563eb', stroke: '#ffffff', strokeThickness: 5
		}).setOrigin(0.5).setDepth(200).setAlpha(0);
		this.tweens.add({
			targets: pop, alpha: 1, scaleX: 1.2, scaleY: 1.2,
			duration: 200, yoyo: true,
			onComplete: () => {
				this.time.delayedCall(500, () => {
					this.tweens.add({ targets: pop, alpha: 0, y: H / 2, duration: 300, onComplete: () => pop.destroy() });
					this.isLeveling = false;
				});
			}
		});

		this.screenPulse = 0.7;

		// Notify SDK
		if (window.FreshPlay) {
			window.FreshPlay.levelComplete(() => {});
		}
	}

	_refreshHUDColors() {
		const pal = this.palette;
		[this.hudScoreLabel, this.hudScore, this.hudLevelLabel, this.hudLevel,
		 this.hudHi, this.hudLivesLabel, this.hudLegendL].forEach(t => {
			if (t) t.setColor(hexCss(pal.ui));
		});
		if (this.hudLegendA) this.hudLegendA.setColor(hexCss(pal.colorA));
		if (this.hudLegendB) this.hudLegendB.setColor(hexCss(pal.colorB));
	}

	// Burst FX
	_spawnBurst(x, y, color, count = 14) {
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * TAU + Phaser.Math.FloatBetween(-0.3, 0.3);
			const speed = Phaser.Math.FloatBetween(60, 220);
			const size  = Phaser.Math.FloatBetween(0.3, 1.0);
			const p     = this.add.image(x, y, 'glow_dot').setDepth(30)
				.setTint(color).setScale(size).setAlpha(1);
			this.tweens.add({
				targets: p,
				x: x + Math.cos(angle) * speed,
				y: y + Math.sin(angle) * speed,
				alpha: 0, scale: 0,
				duration: 300 + Math.random() * 250,
				ease: 'Power2',
				onComplete: () => p.destroy()
			});
		}

		// Ring pulse
		const ring = this.add.image(x, y, 'ring_glow').setDepth(29).setTint(color).setScale(0.5).setAlpha(0.9);
		this.tweens.add({
			targets: ring, scale: 3.5, alpha: 0, duration: 380, ease: 'Power2',
			onComplete: () => ring.destroy()
		});
	}

	// Score popup
	_spawnPopup(x, y, txt, color) {
		const pop = this.add.text(x, y, txt, {
			fontFamily: 'Courier New', fontSize: '20px',
			color: hexCss(color), stroke: '#ffffff', strokeThickness: 3
		}).setOrigin(0.5).setDepth(40);
		this.tweens.add({
			targets: pop, y: y - 55, alpha: 0,
			duration: 700, ease: 'Power2',
			onComplete: () => pop.destroy()
		});
	}

	// Background
	_drawBackground(time) {
		const { width: W, height: H } = this.scale;
		const cx = W / 2, cy = H / 2;
		const pal = this.palette;

		this.bgGfx.clear();
		this.bgGfx.fillStyle(pal.background, 1);
		this.bgGfx.fillRect(0, 0, W, H);

		// Subtle radial gradient via rings
		const numRings = 5;
		for (let i = numRings; i >= 1; i--) {
			const r    = (i / numRings) * Math.max(W, H) * 0.85;
			const a    = 0.03 * (i / numRings);
			this.bgGfx.lineStyle(1, pal.colorA, a);
			this.bgGfx.strokeCircle(cx, cy, r);
		}

		// Grid lines (perspective-style)
		this.gridGfx.clear();
		const GRID_COLS = 12;
		const GRID_ROWS = 10;
		const gridAlpha = 0.04;
		this.gridGfx.lineStyle(1, pal.colorA, gridAlpha);

		for (let c = 0; c <= GRID_COLS; c++) {
			const x = (c / GRID_COLS) * W;
			this.gridGfx.beginPath();
			this.gridGfx.moveTo(x, 0);
			this.gridGfx.lineTo(x, H);
			this.gridGfx.strokePath();
		}
		for (let r = 0; r <= GRID_ROWS; r++) {
			const y = (r / GRID_ROWS) * H;
			this.gridGfx.beginPath();
			this.gridGfx.moveTo(0, y);
			this.gridGfx.lineTo(W, y);
			this.gridGfx.strokePath();
		}

		// Slow-breathing outer border
		const breathe = 0.3 + 0.3 * Math.sin(time * 0.0007);
		this.bgGfx.lineStyle(2, pal.colorA, breathe * 0.3);
		this.bgGfx.strokeRect(6, 6, W - 12, H - 12);
	}

	// UI overlay (lives, progress bar)
	_drawUI(time) {
		const { width: W, height: H } = this.scale;
		const pal = this.palette;
		this.uiGfx.clear();

		// Lives diamonds — top right
		const livesCols = hexCss(pal.colorA);
		const livesEmptyCol = hexCss(lerpColor(pal.background, pal.ui, 0.2));
		const dSize = 12;
		const lx    = W - 24;
		const ly    = 40;

		for (let i = 0; i < LIVES_MAX; i++) {
			const alive = i < this.lives;
			const rx = lx - i * (dSize * 2 + 6);
			this.uiGfx.fillStyle(alive ? pal.colorA : lerpColor(pal.background, pal.ui, 0.12), 1);
			// Diamond shape
			this.uiGfx.beginPath();
			this.uiGfx.moveTo(rx, ly - dSize);
			this.uiGfx.lineTo(rx + dSize * 0.7, ly);
			this.uiGfx.lineTo(rx, ly + dSize);
			this.uiGfx.lineTo(rx - dSize * 0.7, ly);
			this.uiGfx.closePath();
			this.uiGfx.fillPath();

			if (alive) {
				this.uiGfx.lineStyle(1, 0x3b82f6, 0.5);
				this.uiGfx.beginPath();
				this.uiGfx.moveTo(rx, ly - dSize);
				this.uiGfx.lineTo(rx + dSize * 0.7, ly);
				this.uiGfx.lineTo(rx, ly + dSize);
				this.uiGfx.lineTo(rx - dSize * 0.7, ly);
				this.uiGfx.closePath();
				this.uiGfx.strokePath();
			}
		}

		// Level progress bar — bottom of screen
		const barW  = W * 0.4;
		const barX  = W / 2 - barW / 2;
		const barY  = H - 42;
		const pct   = clamp(this.levelScore / SCORE_PER_LEVEL, 0, 1);
		const fillW = barW * pct;

		this.uiGfx.fillStyle(lerpColor(pal.background, pal.ui, 0.1), 1);
		this.uiGfx.fillRect(barX, barY, barW, 3);
		this.uiGfx.fillStyle(pal.colorA, 1);
		this.uiGfx.fillRect(barX, barY, fillW, 3);

		// Glow on fill edge
		if (fillW > 0) {
			this.uiGfx.lineStyle(4, pal.colorA, 0.4);
			this.uiGfx.beginPath();
			this.uiGfx.moveTo(barX + fillW, barY);
			this.uiGfx.lineTo(barX + fillW, barY + 3);
			this.uiGfx.strokePath();
		}

		// Screen pulse overlay
		if (this.screenPulse > 0) {
			const cx = W / 2, cy = H / 2;
			this.uiGfx.fillStyle(pal.colorA, this.screenPulse * 0.18);
			this.uiGfx.fillRect(0, 0, W, H);
			this.screenPulse = Math.max(0, this.screenPulse - 0.04);
		}
	}

	// Pause
	_togglePause() {
		if (this.isGameOver) return;
		this.isPaused = !this.isPaused;

		if (this.isPaused) {
			const { width: W, height: H } = this.scale;
			this._pauseOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x475569, 0.72).setDepth(300);
			this._pauseText    = this.add.text(W / 2, H / 2, 'PAUSED\n\n[ ESC / P  to resume ]', {
				fontFamily: 'Courier New', fontSize: '28px',
				color: '#ffffff', align: 'center'
			}).setOrigin(0.5).setDepth(301);
		} else {
			this._pauseOverlay?.destroy(); this._pauseOverlay = null;
			this._pauseText?.destroy();   this._pauseText    = null;
		}
	}

	// Game over
	_gameOver() {
		if (this.isGameOver) return;
		this.isGameOver = true;

		if (!this.revived) {
			this.revived = true;
			const { width: W, height: H } = this.scale;
			const cx = W / 2, cy = H / 2;
			const pal = this.palette;

			const rBg = this.add.graphics().setDepth(400);
			rBg.fillStyle(0xffffff, 0.97);
			rBg.fillRect(cx - 160, cy - 80, 320, 160);
			rBg.lineStyle(2, pal.colorA, 1);
			rBg.strokeRect(cx - 160, cy - 80, 320, 160);

			const rTxt = this.add.text(cx, cy - 40, 'SECOND CHANCE?', {
				fontFamily: 'Courier New', fontSize: '24px', color: hexCss(pal.colorA)
			}).setOrigin(0.5).setDepth(401);

			const btnRevive = this.add.text(cx - 75, cy + 30, 'WATCH AD\nTO REVIVE', {
				fontFamily: 'Courier New', fontSize: '14px', color: '#475569',
				backgroundColor: hexCss(pal.colorA), padding: {x: 10, y: 10}, align: 'center'
			}).setOrigin(0.5).setDepth(401).setInteractive({useHandCursor: true});

			const btnSkip = this.add.text(cx + 75, cy + 30, 'SKIP', {
				fontFamily: 'Courier New', fontSize: '16px', color: '#2563eb',
				backgroundColor: '#f8fafc', padding: {x: 20, y: 15}
			}).setOrigin(0.5).setDepth(401).setInteractive({useHandCursor: true});

			const cleanUp = () => {
				rBg.destroy(); rTxt.destroy(); btnRevive.destroy(); btnSkip.destroy();
			};

			btnSkip.on('pointerdown', () => {
				cleanUp();
				this.isGameOver = false;
				this._gameOver();
			});

			btnRevive.on('pointerdown', () => {
				cleanUp();
				const doRevive = () => {
					this.isGameOver = false;
					this.lives = 1;
					this.lasers = []; // clear lasers
					this._updateLivesHUD();
				};

				if (window.FreshPlay && typeof window.FreshPlay.showVideoAd === 'function') {
					window.FreshPlay.showVideoAd(doRevive);
				} else {
					doRevive();
				}
			});
			return;
		}

		this._saveHi(this.score);
		this._sound('gameover');

		if (window.FreshPlay) window.FreshPlay.gameOver(this.score);

		const { width: W, height: H } = this.scale;
		const pal = this.palette;

		const overlay = this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x475569, 0).setDepth(400);
		this.tweens.add({ targets: overlay, alpha: 0.82, duration: 600 });

		this.time.delayedCall(350, () => {
			const panel = this.add.graphics().setDepth(401);
			const pw = 340, ph = 280, px = W / 2 - pw / 2, py = H / 2 - ph / 2;

			panel.fillStyle(0xffffff, 0.98);
			panel.fillRect(px, py, pw, ph);
			panel.lineStyle(2, pal.hostile, 0.8);
			panel.strokeRect(px, py, pw, ph);
			panel.lineStyle(1, pal.colorA, 0.3);
			panel.strokeRect(px + 4, py + 4, pw - 8, ph - 8);

			const mk = (x, y, txt, size, col, origin = [0.5, 0]) =>
				this.add.text(x, y, txt, {
					fontFamily: 'Courier New', fontSize: size + 'px', color: col
				}).setOrigin(...origin).setDepth(402);

			mk(W / 2, py + 28, 'GAME OVER', 28, '#ef4444');
			mk(W / 2, py + 72, 'SCORE', 10, hexCss(pal.ui)).setLetterSpacing(4);
			mk(W / 2, py + 86, this.score.toLocaleString(), 40, '#0f172a');
			mk(W / 2, py + 142, 'BEST   ' + Math.max(this.score, this.hiScore).toLocaleString(), 12, hexCss(pal.ui));
			mk(W / 2, py + 166, 'LEVEL REACHED: ' + this.level, 11, hexCss(pal.ui));

			const restartBtn = this.add.text(W / 2, py + ph - 40, '[ PLAY AGAIN ]', {
				fontFamily: 'Courier New', fontSize: '16px',
				color: '#475569', backgroundColor: hexCss(pal.colorA),
				padding: { x: 20, y: 10 }
			}).setOrigin(0.5).setDepth(403).setInteractive({ useHandCursor: true });

			restartBtn.on('pointerover', () => restartBtn.setStyle({ color: hexCss(pal.colorA), backgroundColor: '#f8fafc' }));
			restartBtn.on('pointerout',  () => restartBtn.setStyle({ color: '#475569', backgroundColor: hexCss(pal.colorA) }));
			restartBtn.on('pointerdown', () => { this.scene.restart(); });

			this.tweens.add({ targets: [panel, restartBtn], alpha: { from: 0, to: 1 }, duration: 300 });
		});
	}

	// Resize
	_onResize(gameSize) {
		const W = gameSize.width, H = gameSize.height;
		if (this.hudLevel)      this.hudLevel.setPosition(W / 2, 32);
		if (this.hudLevelLabel) this.hudLevelLabel.setPosition(W / 2, 20);
		if (this.hudLivesLabel) this.hudLivesLabel.setPosition(W - 24, 20);
		if (this.hudPauseBtn)   this.hudPauseBtn.setPosition(W - 24, H - 22);
		if (this.hudLegendA)    this.hudLegendA.setPosition(W / 2 - 60, H - 22);
		if (this.hudLegendB)    this.hudLegendB.setPosition(W / 2 + 60, H - 22);
		if (this.hudLegendL)    this.hudLegendL.setPosition(W / 2, H - 24);
	}

	// Update loop
	update(time, delta) {
		delta = Math.min(delta || 16.6, 33.3);
		if (this.isPaused) return;

		const dt = delta / 1000;

		// Shield rotation
		if (!this.isGameOver) {
			const left  = this._isLeft();
			const right = this._isRight();

			if (left && !right) {
				this.shieldVelocity = lerp(this.shieldVelocity, -ROTATION_SPEED, 0.18);
			} else if (right && !left) {
				this.shieldVelocity = lerp(this.shieldVelocity, ROTATION_SPEED, 0.18);
			} else {
				this.shieldVelocity = lerp(this.shieldVelocity, 0, 0.22);
			}

			this.shieldAngle += this.shieldVelocity * dt;
		}

		// Spawn laser
		if (!this.isGameOver && time > this.nextSpawn) {
			this._spawnLaser(time);
			this.nextSpawn = time + this.spawnInterval + Phaser.Math.FloatBetween(-100, 100);
		}

		// Camera shake
		if (this.shakeAmt > 0) {
			this.cameras.main.setScroll(
				(Math.random() - 0.5) * this.shakeAmt,
				(Math.random() - 0.5) * this.shakeAmt
			);
			this.shakeAmt *= 0.78;
			if (this.shakeAmt < 0.5) {
				this.shakeAmt = 0;
				this.cameras.main.setScroll(0, 0);
			}
		}

		// Draw everything
		this._drawBackground(time);
		this._drawShield(dt);
		this._updateLasers(dt, time);
		this._drawUI(time);
	}
}

// Phaser config and game init 
const config = {
	type: Phaser.AUTO,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: '100%',
		height: '100%',
	},
	backgroundColor: '#f8fafc',
	physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
	scene: [BootScene, PlayScene],
	render: {
		antialias: true,
		powerPreference: 'high-performance',
		roundPixels: false,
	},
	fps: { target: 60, forceSetTimeOut: false }
};

const game = new Phaser.Game(config);
