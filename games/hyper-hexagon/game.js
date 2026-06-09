// ============================================================
//  HYPER HEXAGON — FreshPlay Arcade
//  Phaser 3.80 • Production v1.0
// ============================================================

/* Utilities */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
const hexToRgb = h => ({ r: (h >> 16) & 0xff, g: (h >> 8) & 0xff, b: h & 0xff });
const rgbToHex = ({ r, g, b }) => (r << 16) | (g << 8) | b;
const lerpCol = (c1, c2, t) => {
	const a = hexToRgb(c1), b = hexToRgb(c2);
	return rgbToHex({ r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) });
};
const css = h => '#' + h.toString(16).padStart(6, '0');

/* Constants */
const HEX_N = 6;       // Sides of a hexagon
const ORBIT_R = 50;      // Player orbit radius (px from center)
const CORE_R = 32;      // Central core radius
const PLAYER_SZ = 10;      // Triangle half-length
const WALL_W = 4;       // Wall stroke thickness
const COLL_TOL = 11;      // Collision tolerance (px)
const ROT_SPEED = 3.5;     // Player max rotation speed (rad/s)
const ROT_EASE = 0.18;    // Velocity lerp factor
const WALLS_PER_LV = 8;       // Walls cleared to advance one level
const SHRINK_BASE = 150;     // Initial wall shrink speed (px/s)
const SPAWN_BASE = 1380;    // Initial spawn interval (ms)
const MIN_SHRINK = 430;     // Max shrink speed cap
const MIN_SPAWN = 480;     // Min spawn interval cap

/* ─────────────────────────────────────────────────────────
	 BOOT SCENE — procedurally generate textures
	 ───────────────────────────────────────────────────────── */
class BootScene extends Phaser.Scene {
	constructor() { super('BootScene'); }

	preload() {
		this._tex('glow_blob', 64, g => {
			for (let i = 10; i >= 1; i--) {
				g.fillStyle(0xffffff, i / 10 * 0.85);
				g.fillCircle(32, 32, i * 3.2);
			}
		});
		this._tex('hex_shard', 12, g => {
			g.fillStyle(0xffffff, 1);
			g.fillTriangle(6, 0, 12, 10, 0, 10);
		});
	}

	_tex(key, size, fn) {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		fn(g);
		g.generateTexture(key, size, size);
		g.destroy();
	}

	create() { this.scene.start('PlayScene'); }
}

/* ─────────────────────────────────────────────────────────
	 PLAY SCENE — main game
	 ───────────────────────────────────────────────────────── */
class PlayScene extends Phaser.Scene {
	constructor() { super('PlayScene'); }

	/* State init */
	init() {
		this.score = 0;
		this.lives = 3;
		this.level = 1;
		this.wallsCleared = 0;
		this.isGameOver = false;
		this.isPaused = false;
		this.isInvincible = false;
		this.invTimer = 0;
		this.isLeveling = false;

		// Player
		this.playerAngle = -Math.PI / 2;   // start at top
		this.playerVel = 0;
		this.playerTrail = [];

		// World rotation — all walls share this angle (creates dizzying effect)
		this.worldAngle = 0;
		this.worldRotSpd = 0.38;   // rad/s, climbs with level
		this.worldDir = 1;      // ±1 flip every 3 levels

		// Walls
		this.walls = [];
		this.shrinkSpeed = SHRINK_BASE;
		this.spawnInterval = SPAWN_BASE;
		this.nextSpawn = 0;

		// FX
		this.shakeAmt = 0;
		this.shakeDecay = 0.82;
		this.screenFlash = 0;
		this.flashCol = 0xffffff;
		this.pulseT = 0;
		this.popups = [];

		// Hi-score
		this.hiScore = this._loadHi();

		// Palette (pulled from SDK, falls back to defaults)
		this.palette = this._getPalette();

		// Audio
		this.audioCtx = null;
		this.masterGain = null;
	}

	/* Scene creation */
	create() {
		const { width: W, height: H } = this.scale;

		this._initAudio();

		// Depth-layered graphics canvases
		this.bgGfx = this.add.graphics().setDepth(0);
		this.wallGfx = this.add.graphics().setDepth(5);
		this.coreGfx = this.add.graphics().setDepth(9);
		this.shipGfx = this.add.graphics().setDepth(12);
		this.fxGfx = this.add.graphics().setDepth(18);
		this.uiGfx = this.add.graphics().setDepth(98);

		// Full-screen flash rectangle
		this.flashRect = this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0xffffff, 0).setDepth(92);

		// HUD and input
		this._buildHUD();
		this._initInput();

		// Resize handler
		this.scale.on('resize', this._onResize, this);

		// Initial spawn delay (let entrance animation finish)
		this.nextSpawn = 1300;

		// Sync level with SDK
		if (window.FreshPlay) window.FreshPlay.currentLevel = 1;

		this._entrance();
	}

	/* Palette */
	_getPalette() {
		try {
			if (window.FreshPlay?.getCurrentPalette) {
				const p = window.FreshPlay.getCurrentPalette();
				return {
					bg: p.background ?? 0x050510,
					core: p.playerCore ?? 0x00e5ff,
					wall: p.hostile ?? 0xff0044,
					ui: p.interface ?? 0xffffff,
					fx: p.fxAccent ?? 0xff6600,
				};
			}
		} catch { }
		return { bg: 0x050510, core: 0x00e5ff, wall: 0xff0044, ui: 0xffffff, fx: 0xff6600 };
	}

	/* Audio */
	_initAudio() {
		try {
			if (!window._hhAudio) {
				window._hhAudio = new (window.AudioContext || window.webkitAudioContext)();
				window._hhMaster = window._hhAudio.createDynamicsCompressor();
				window._hhMaster.connect(window._hhAudio.destination);
			}
			this.audioCtx = window._hhAudio;
			this.masterGain = window._hhMaster;
		} catch { }
		this.input.once('pointerdown', () => this.audioCtx?.resume());
	}

	_sound(type) {
		if (!this.audioCtx || this.audioCtx.state !== 'running') return;
		const ctx = this.audioCtx, now = ctx.currentTime;
		const tone = (waveType, freq, gain, dur, freqEnd) => {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.connect(g); g.connect(this.masterGain);
			o.type = waveType;
			o.frequency.setValueAtTime(freq, now);
			if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
			g.gain.setValueAtTime(gain, now);
			g.gain.exponentialRampToValueAtTime(0.001, now + dur);
			o.start(now); o.stop(now + dur + 0.01);
		};
		switch (type) {
			case 'pass': tone('sine', 500, 0.14, 0.10, 900); break;
			case 'hit': tone('sawtooth', 160, 0.40, 0.45, 35); break;
			case 'levelup':
				[0, 0.09, 0.18, 0.27].forEach((d, i) => {
					const o2 = ctx.createOscillator(), g2 = ctx.createGain();
					o2.connect(g2); g2.connect(this.masterGain);
					o2.type = 'square';
					o2.frequency.setValueAtTime([523, 659, 784, 1047][i], now + d);
					g2.gain.setValueAtTime(0.11, now + d);
					g2.gain.exponentialRampToValueAtTime(0.001, now + d + 0.15);
					o2.start(now + d); o2.stop(now + d + 0.18);
				}); return;
			case 'gameover': tone('sawtooth', 220, 0.30, 1.30, 28); break;
		}
	}

	/* HUD */
	_buildHUD() {
		const { width: W, height: H } = this.scale;
		const pal = this.palette;
		const MONO = 'Courier New, Courier, monospace';
		const mk = (x, y, txt, sz, col, origin = [0, 0]) =>
			this.add.text(x, y, txt, {
				fontFamily: MONO, fontStyle: 'bold', fontSize: sz + 'px', color: css(col)
			}).setOrigin(...origin).setDepth(100);

		this.hudScoreLabel = mk(22, 20, 'SCORE', 9, pal.ui).setLetterSpacing(4);
		this.hudScore = mk(22, 32, '0', 34, pal.ui);
		this.hudHi = mk(22, 70, 'HI  ' + this.hiScore, 10, pal.ui).setLetterSpacing(2);

		this.hudLvLabel = mk(W / 2, 20, 'LEVEL', 9, pal.ui, [0.5, 0]).setLetterSpacing(4);
		this.hudLv = mk(W / 2, 32, '1', 34, pal.ui, [0.5, 0]);

		this.hudLivLabel = mk(W - 22, 20, 'LIVES', 9, pal.ui, [1, 0]).setLetterSpacing(4);
		// Lives drawn as hex shapes inside _drawUI

		this.hudPause = this.add.text(W - 22, H - 22, '[ II ]', {
			fontFamily: MONO, fontStyle: 'bold', fontSize: '11px', color: css(pal.ui)
		}).setOrigin(1, 1).setDepth(100).setInteractive({ useHandCursor: true });
		this.hudPause.on('pointerdown', () => this._togglePause());
		this.hudPause.on('pointerover', () => this.hudPause.setAlpha(0.5));
		this.hudPause.on('pointerout', () => this.hudPause.setAlpha(1.0));
	}

	_refreshHUDColors() {
		const pal = this.palette;
		[this.hudScoreLabel, this.hudScore, this.hudHi,
		this.hudLvLabel, this.hudLv, this.hudLivLabel, this.hudPause]
			.forEach(t => t?.setColor(css(pal.ui)));
	}

	/* Input */
	_initInput() {
		const kb = this.input.keyboard;
		this._kLeft = [kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT), kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)];
		this._kRight = [kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT), kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)];
		kb.on('keydown-ESC', () => this._togglePause());
		kb.on('keydown-P', () => this._togglePause());

		this.touchLeft = this.touchRight = false;
		this.input.on('pointerdown', p => { p.x < this.scale.width / 2 ? this.touchLeft = true : this.touchRight = true; });
		this.input.on('pointerup', () => { this.touchLeft = false; this.touchRight = false; });
		this.input.on('pointermove', p => {
			if (!p.isDown) return;
			this.touchLeft = p.x < this.scale.width / 2;
			this.touchRight = p.x >= this.scale.width / 2;
		});
	}
	_left() { return this._kLeft.some(k => k.isDown) || this.touchLeft; }
	_right() { return this._kRight.some(k => k.isDown) || this.touchRight; }

	/* Wall System */
	_spawnWall() {
		// Number of gaps grows slightly on high levels to keep the game fair at high speed
		let numGaps = 1;
		if (this.level >= 6) numGaps = Phaser.Math.Between(1, 2);
		if (this.level >= 14) numGaps = Phaser.Math.Between(1, 3);

		const gaps = [false, false, false, false, false, false];
		const shuffled = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 4, 5]);
		for (let i = 0; i < numGaps; i++) gaps[shuffled[i]] = true;

		const maxDim = Math.max(this.scale.width, this.scale.height);
		this.walls.push({
			radius: maxDim * 0.75,
			shrinkSpeed: this.shrinkSpeed + Phaser.Math.FloatBetween(-18, 18),
			gaps,
			alpha: 0,
			scored: false,
		});
	}

	_updateWalls(dt) {
		for (let i = this.walls.length - 1; i >= 0; i--) {
			const w = this.walls[i];
			w.radius -= w.shrinkSpeed * dt;
			w.alpha = Math.min(1, w.alpha + dt * 2.8);

			// Mark scored once the wall passes the inner collision zone
			if (!w.scored && w.radius < ORBIT_R - COLL_TOL - 6) {
				w.scored = true;
				this.wallsCleared++;
				const pts = 12 * this.level;
				this.score += pts;
				this._sound('pass');
				this._spawnPopup('+' + pts);
				this.hudScore.setText(this.score.toLocaleString());
				this.tweens.add({ targets: this.hudScore, scaleX: 1.3, scaleY: 1.3, duration: 60, yoyo: true });

				// Level up every WALLS_PER_LV cleared
				if (this.wallsCleared % WALLS_PER_LV === 0 && !this.isLeveling) {
					this._levelUp();
				}
			}

			// Cull off-screen walls
			if (w.radius < -90) this.walls.splice(i, 1);
		}
	}

	/* Collision */
	_checkCollision() {
		for (const w of this.walls) {
			if (w.scored) continue;

			// Only test while wall overlaps the orbit ring
			if (Math.abs(w.radius - ORBIT_R) > COLL_TOL + WALL_W) continue;

			// Player's angular sector in the wall's frame (world-space)
			const rel = ((this.playerAngle - this.worldAngle) % TAU + TAU) % TAU;
			const sector = Math.floor(rel / (Math.PI / 3)) % HEX_N;

			if (!w.gaps[sector]) {
				this._onHit();
				return;
			}
		}
	}

	_onHit() {
		if (this.isInvincible || this.isGameOver) return;
		this.lives--;
		this.isInvincible = true;
		this.invTimer = 1.6;

		this._sound('hit');
		this._shake(0.024, 450);

		// Screen flash red
		this.screenFlash = 0.55;
		this.flashCol = this.palette.wall;

		// Burst at player position
		const { cx, cy } = this._center();
		const px = cx + ORBIT_R * Math.cos(this.playerAngle);
		const py = cy + ORBIT_R * Math.sin(this.playerAngle);
		this._burst(px, py, this.palette.wall, 22);

		if (this.lives <= 0) this._gameOver();
	}

	/* Player Update */
	_updatePlayer(dt) {
		const target = this._left() ? -ROT_SPEED : (this._right() ? ROT_SPEED : 0);
		this.playerVel = lerp(this.playerVel, target, ROT_EASE);
		this.playerAngle += this.playerVel * dt;

		// Build motion trail
		const { cx, cy } = this._center();
		this.playerTrail.push({
			x: cx + ORBIT_R * Math.cos(this.playerAngle),
			y: cy + ORBIT_R * Math.sin(this.playerAngle),
			life: 1.0,
		});
		if (this.playerTrail.length > 14) this.playerTrail.shift();
		for (const pt of this.playerTrail) pt.life -= dt * 5;
		this.playerTrail = this.playerTrail.filter(p => p.life > 0);
	}

	/* Level Up */
	_levelUp() {
		this.isLeveling = true;
		this.level++;

		// Ramp difficulty
		this.shrinkSpeed = Math.min(MIN_SHRINK, SHRINK_BASE + this.level * 20);
		this.spawnInterval = Math.max(MIN_SPAWN, SPAWN_BASE - this.level * 58);
		this.worldRotSpd = Math.min(2.1, 0.38 + this.level * 0.07);

		// Flip world spin direction every 3 levels
		if (this.level % 3 === 0) this.worldDir *= -1;

		// Sync SDK level then fetch new palette
		if (window.FreshPlay) window.FreshPlay.currentLevel = this.level;
		this.palette = this._getPalette();
		this._refreshHUDColors();

		this._sound('levelup');
		this._shake(0.012, 220);
		this.screenFlash = 0.75;
		this.flashCol = this.palette.core;

		// Level-up overlay text
		const { cx, cy } = this._center();
		const pop = this.add.text(cx, cy, 'LEVEL ' + this.level, {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '38px',
			color: css(this.palette.ui), stroke: '#000000', strokeThickness: 6
		}).setOrigin(0.5).setDepth(200).setAlpha(0);
		this.tweens.add({ targets: pop, alpha: 1, scaleX: 1.25, scaleY: 1.25, duration: 200, yoyo: true });
		this.time.delayedCall(750, () => {
			this.tweens.add({ targets: pop, alpha: 0, y: cy - 70, duration: 350, onComplete: () => pop.destroy() });
			this.isLeveling = false;
		});

		// Notify FreshPlay portal (ad break every 5 levels handled by portal)
		if (window.FreshPlay) window.FreshPlay.levelComplete(() => { });
	}

	/* Game Over */
	_gameOver() {
		if (this.isGameOver) return;
		this.isGameOver = true;

		if (!this.revived) {
			this.revived = true;
			const { cx, cy } = this._center();
			const pal = this.palette;

			const rBg = this.add.graphics().setDepth(300);
			rBg.fillStyle(0x000000, 0.9);
			rBg.fillRect(cx - 160, cy - 80, 320, 160);
			rBg.lineStyle(2, pal.core, 1);
			rBg.strokeRect(cx - 160, cy - 80, 320, 160);

			const rTxt = this.add.text(cx, cy - 40, 'SECOND CHANCE?', {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '24px', color: css(pal.core)
			}).setOrigin(0.5).setDepth(301);

			const btnRevive = this.add.text(cx - 75, cy + 30, 'WATCH AD\nTO REVIVE', {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '14px', color: '#000',
				backgroundColor: css(pal.core), padding: {x: 10, y: 10}, align: 'center'
			}).setOrigin(0.5).setDepth(301).setInteractive({useHandCursor: true});

			const btnSkip = this.add.text(cx + 75, cy + 30, 'SKIP', {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '16px', color: '#fff',
				backgroundColor: '#c4e2f5', padding: {x: 20, y: 15}
			}).setOrigin(0.5).setDepth(301).setInteractive({useHandCursor: true});

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
					this.walls = []; // clear walls
					this.isInvincible = true;
					this.invTimer = 2.0; // invincibility
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

		const { cx, cy } = this._center();
		const { width: W, height: H } = this.scale;
		const pal = this.palette;

		const overlay = this.add.rectangle(cx, cy, W * 2, H * 2, 0x00234f, 0).setDepth(300);
		this.tweens.add({ targets: overlay, alpha: 0.82, duration: 650 });

		this.time.delayedCall(380, () => {
			const pw = 330, ph = 290;
			const pan = this.add.graphics().setDepth(301);
			pan.fillStyle(0x000000, 0.96);
			pan.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
			pan.lineStyle(2, pal.wall, 0.9);
			pan.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph);
			pan.lineStyle(1, pal.core, 0.28);
			pan.strokeRect(cx - pw / 2 + 4, cy - ph / 2 + 4, pw - 8, ph - 8);

			const mk = (dy, txt, sz, col) => this.add.text(cx, cy + dy, txt, {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: sz + 'px',
				color: col, stroke: '#000', strokeThickness: 3
			}).setOrigin(0.5).setDepth(302).setAlpha(0);

			const els = [
				mk(-110, 'GAME OVER', 27, css(pal.wall)),
				mk(-62, 'SCORE', 9, css(pal.ui)),
				mk(-47, this.score.toLocaleString(), 42, '#ffffff'),
				mk(8, 'BEST   ' + Math.max(this.score, this.hiScore).toLocaleString(), 13, css(pal.ui)),
				mk(32, 'LEVEL REACHED: ' + this.level, 11, css(pal.ui)),
			];

			const btn = this.add.text(cx, cy + 92, '[ PLAY AGAIN ]', {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '16px',
				color: '#000000', backgroundColor: css(pal.core), padding: { x: 20, y: 10 }
			}).setOrigin(0.5).setDepth(303).setAlpha(0).setInteractive({ useHandCursor: true });
			btn.on('pointerover', () => btn.setStyle({ color: css(pal.core), backgroundColor: '#c4e2f5' }));
			btn.on('pointerout', () => btn.setStyle({ color: '#000000', backgroundColor: css(pal.core) }));
			btn.on('pointerdown', () => this.scene.restart());

			[...els, btn].forEach(el => this.tweens.add({ targets: el, alpha: 1, duration: 280 }));
		});
	}

	/* Draw: Background */
	_drawBackground(time) {
		const { cx, cy } = this._center();
		const { width: W, height: H } = this.scale;
		const pal = this.palette;
		const pulse = 0.5 + 0.5 * Math.sin(time * 0.0022);

		this.bgGfx.clear();

		// Solid fill
		this.bgGfx.fillStyle(pal.bg, 1);
		this.bgGfx.fillRect(0, 0, W, H);

		// Concentric hexagonal rings — rotate with world, pulse with beat
		const maxR = Math.max(W, H) * 0.88;
		for (let r = 55; r < maxR; r += 58) {
			const fade = 1 - r / maxR;
			const ringAlp = (0.028 + 0.018 * pulse) * fade;
			this._drawHexOutline(this.bgGfx, cx, cy, r, this.worldAngle, pal.core, ringAlp, 1);
		}

		// Six spoke lines radiating from center
		this.bgGfx.lineStyle(1, pal.core, 0.05 + 0.03 * pulse);
		for (let i = 0; i < HEX_N; i++) {
			const a = this.worldAngle + i * (Math.PI / 3);
			this.bgGfx.beginPath();
			this.bgGfx.moveTo(cx, cy);
			this.bgGfx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
			this.bgGfx.strokePath();
		}

		// Vignette: dark radial from edges
		// (approximated with a large semi-transparent rectangle overlay)
		const vigRad = Math.max(W, H) * 0.55;
		this.bgGfx.fillStyle(pal.bg, 0.35);
		this.bgGfx.fillCircle(cx, cy, vigRad * 0.4);

		// Screen flash decay
		if (this.screenFlash > 0) {
			this.flashRect.setFillStyle(this.flashCol, this.screenFlash * 0.22);
			this.screenFlash = Math.max(0, this.screenFlash - 0.055);
		} else {
			this.flashRect.setAlpha(0);
		}
	}

	/* Draw: Walls */
	_drawWalls() {
		const { cx, cy } = this._center();
		this.wallGfx.clear();

		for (const w of this.walls) {
			if (w.alpha <= 0) continue;

			// Fade out as wall shrinks past orbit (scored walls vanish gracefully)
			const innerFade = w.scored
				? clamp(1 - (ORBIT_R - COLL_TOL - 6 - w.radius) / 70, 0, 1)
				: 1;
			const alpha = Math.min(1, w.alpha) * innerFade;
			if (alpha <= 0.02) continue;

			const col = this.palette.wall;
			const verts = this._hexVerts(cx, cy, w.radius, this.worldAngle);

			// Multi-pass glow (outer → inner)
			const passes = [
				{ w: WALL_W * 6, a: 0.04 },
				{ w: WALL_W * 3, a: 0.14 },
				{ w: WALL_W * 1.4, a: 0.38 },
				{ w: WALL_W, a: 1.00 },
			];

			for (const pass of passes) {
				this.wallGfx.lineStyle(pass.w, col, pass.a * alpha);
				for (let s = 0; s < HEX_N; s++) {
					if (w.gaps[s]) continue;
					const v1 = verts[s], v2 = verts[(s + 1) % HEX_N];
					this.wallGfx.beginPath();
					this.wallGfx.moveTo(v1.x, v1.y);
					this.wallGfx.lineTo(v2.x, v2.y);
					this.wallGfx.strokePath();
				}
			}

			// Subtle gap hint — very faint glow where the opening is
			this.wallGfx.lineStyle(2, this.palette.core, 0.10 * alpha);
			for (let s = 0; s < HEX_N; s++) {
				if (!w.gaps[s]) continue;
				const v1 = verts[s], v2 = verts[(s + 1) % HEX_N];
				this.wallGfx.beginPath();
				this.wallGfx.moveTo(v1.x, v1.y);
				this.wallGfx.lineTo(v2.x, v2.y);
				this.wallGfx.strokePath();
			}
		}
	}

	/* Draw: Core */
	_drawCore(time) {
		const { cx, cy } = this._center();
		const pal = this.palette;
		const pulse = 0.8 + 0.2 * Math.sin(time * 0.0035);

		this.coreGfx.clear();

		// Outer halo rings (decreasing opacity)
		for (let i = 7; i >= 1; i--) {
			const r = CORE_R + i * 9;
			const a = 0.032 * ((8 - i) / 7) * pulse;
			this._drawHexOutline(this.coreGfx, cx, cy, r, this.worldAngle, pal.core, a, i * 2.2);
		}

		// Core black fill
		this.coreGfx.fillStyle(0x000000, 1);
		this._fillHex(this.coreGfx, cx, cy, CORE_R, this.worldAngle);

		// Core border — layered glow
		const borders = [
			{ w: 8, a: 0.20 * pulse },
			{ w: 4, a: 0.55 * pulse },
			{ w: 1.8, a: 1.00 },
		];
		for (const b of borders) {
			this._drawHexOutline(this.coreGfx, cx, cy, CORE_R, this.worldAngle, pal.core, b.a, b.w);
		}

		// Counter-rotating inner ornament hex
		this._drawHexOutline(this.coreGfx, cx, cy, CORE_R * 0.52, -this.worldAngle * 1.6, pal.core, 0.38 * pulse, 1.5);

		// Tiny pulsing center dot
		const dotR = 2.5 + 1.5 * pulse;
		this.coreGfx.fillStyle(pal.core, 0.95);
		this.coreGfx.fillCircle(cx, cy, dotR);
	}

	/* Draw: Player Ship */
	_drawPlayer(time) {
		const { cx, cy } = this._center();
		const pal = this.palette;
		this.shipGfx.clear();

		// Motion trail (fading dots)
		for (const pt of this.playerTrail) {
			const a = pt.life * 0.45;
			const r = 4 * pt.life;
			this.shipGfx.fillStyle(pal.core, a);
			this.shipGfx.fillCircle(pt.x, pt.y, r);
		}

		// Invincibility flicker
		if (this.isInvincible && Math.floor(time / 75) % 2 === 0) return;

		const px = cx + ORBIT_R * Math.cos(this.playerAngle);
		const py = cy + ORBIT_R * Math.sin(this.playerAngle);
		const fwd = this.playerAngle;

		// Triangle pointing radially outward
		const tip = { x: px + PLAYER_SZ * 1.6 * Math.cos(fwd), y: py + PLAYER_SZ * 1.6 * Math.sin(fwd) };
		const left = { x: px + PLAYER_SZ * Math.cos(fwd + 2.35), y: py + PLAYER_SZ * Math.sin(fwd + 2.35) };
		const right = { x: px + PLAYER_SZ * Math.cos(fwd - 2.35), y: py + PLAYER_SZ * Math.sin(fwd - 2.35) };

		// Glow layers
		const glows = [
			{ w: 14, a: 0.06 }, { w: 7, a: 0.18 }, { w: 3.5, a: 0.48 }, { w: 1.8, a: 1.00 }
		];
		for (const g of glows) {
			this.shipGfx.lineStyle(g.w, pal.core, g.a);
			this.shipGfx.beginPath();
			this.shipGfx.moveTo(tip.x, tip.y);
			this.shipGfx.lineTo(left.x, left.y);
			this.shipGfx.lineTo(right.x, right.y);
			this.shipGfx.closePath();
			this.shipGfx.strokePath();
		}

		// Solid fill
		this.shipGfx.fillStyle(pal.core, 0.92);
		this.shipGfx.beginPath();
		this.shipGfx.moveTo(tip.x, tip.y);
		this.shipGfx.lineTo(left.x, left.y);
		this.shipGfx.lineTo(right.x, right.y);
		this.shipGfx.closePath();
		this.shipGfx.fillPath();

		// Bright core highlight
		this.shipGfx.fillStyle(0xffffff, 0.6);
		this.shipGfx.fillCircle(
			(tip.x + left.x + right.x) / 3,
			(tip.y + left.y + right.y) / 3,
			2
		);
	}

	/* Draw: UI overlay */
	_drawUI() {
		const { width: W, height: H } = this.scale;
		const pal = this.palette;
		this.uiGfx.clear();

		// Lives — small hexagons, top-right
		for (let i = 0; i < 3; i++) {
			const alive = i < this.lives;
			const rx = W - 22 - i * 28;
			const ry = 43;
			const r = 10;
			const col = alive ? pal.core : lerpCol(pal.bg, pal.ui, 0.12);
			this.uiGfx.fillStyle(col, 1);
			this._fillHex(this.uiGfx, rx, ry, r, Math.PI / 6);
			if (alive) {
				this.uiGfx.lineStyle(1, 0xffffff, 0.35);
				this._drawHexOutline(this.uiGfx, rx, ry, r, Math.PI / 6, 0xffffff, 0.35, 1);
			}
		}

		// Level progress bar — bottom center
		const barW = W * 0.36;
		const barX = W / 2 - barW / 2;
		const barY = H - 36;
		const pct = clamp((this.wallsCleared % WALLS_PER_LV) / WALLS_PER_LV, 0, 1);
		this.uiGfx.fillStyle(lerpCol(pal.bg, pal.ui, 0.1), 1);
		this.uiGfx.fillRect(barX, barY, barW, 3);
		if (pct > 0) {
			this.uiGfx.fillStyle(pal.core, 1);
			this.uiGfx.fillRect(barX, barY, barW * pct, 3);
			// Leading edge glow
			this.uiGfx.lineStyle(5, pal.core, 0.35);
			this.uiGfx.beginPath();
			this.uiGfx.moveTo(barX + barW * pct, barY - 1);
			this.uiGfx.lineTo(barX + barW * pct, barY + 4);
			this.uiGfx.strokePath();
		}

		// Progress label
		// (drawn as text in HUD — skip to avoid per-frame text objects)
	}

	/* FX: Burst */
	_burst(x, y, color, count) {
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * TAU + Phaser.Math.FloatBetween(-0.4, 0.4);
			const spd = Phaser.Math.FloatBetween(50, 210);
			const scale = Phaser.Math.FloatBetween(0.2, 0.75);
			const p = this.add.image(x, y, 'glow_blob')
				.setDepth(55).setTint(color).setScale(scale).setAlpha(1);
			this.tweens.add({
				targets: p,
				x: x + Math.cos(angle) * spd,
				y: y + Math.sin(angle) * spd,
				alpha: 0, scale: 0,
				duration: 280 + Math.random() * 220,
				ease: 'Power2',
				onComplete: () => p.destroy()
			});
		}
		// Ring pulse
		const ring = this.add.image(x, y, 'glow_blob').setDepth(54).setTint(color).setScale(0.6).setAlpha(0.8);
		this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, ease: 'Power2', onComplete: () => ring.destroy() });
	}

	/* FX: Score popup */
	_spawnPopup(txt) {
		const { cx, cy } = this._center();
		const pop = this.add.text(cx, cy - 88, txt, {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '20px',
			color: css(this.palette.core), stroke: '#000000', strokeThickness: 3
		}).setOrigin(0.5).setDepth(150);
		this.tweens.add({
			targets: pop, y: cy - 140, alpha: 0,
			duration: 720, ease: 'Power2',
			onComplete: () => pop.destroy()
		});
	}

	/* Camera shake */
	_shake(intensity, duration) {
		this.shakeAmt = Math.max(this.shakeAmt, intensity);
		this.time.delayedCall(duration, () => {
			this.shakeAmt = 0;
			this.cameras.main.setScroll(0, 0);
		});
	}

	_updateShake() {
		if (this.shakeAmt <= 0) return;
		const W = this.scale.width, H = this.scale.height;
		this.cameras.main.setScroll(
			(Math.random() - 0.5) * this.shakeAmt * W,
			(Math.random() - 0.5) * this.shakeAmt * H
		);
		this.shakeAmt *= this.shakeDecay;
		if (this.shakeAmt < 0.001) {
			this.shakeAmt = 0;
			this.cameras.main.setScroll(0, 0);
		}
	}

	/* Pause */
	_togglePause() {
		if (this.isGameOver) return;
		this.isPaused = !this.isPaused;
		if (this.isPaused) {
			const { cx, cy } = this._center();
			const { width: W, height: H } = this.scale;
			this._pauseOv = this.add.rectangle(cx, cy, W * 2, H * 2, 0x000000, 0.72).setDepth(400);
			this._pauseTx = this.add.text(cx, cy, 'PAUSED\n\n[ P / ESC  to resume ]', {
				fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '26px',
				color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 3
			}).setOrigin(0.5).setDepth(401);
		} else {
			this._pauseOv?.destroy(); this._pauseOv = null;
			this._pauseTx?.destroy(); this._pauseTx = null;
		}
	}

	/* Helpers */
	_center() { return { cx: this.scale.width / 2, cy: this.scale.height / 2 }; }

	_hexVerts(cx, cy, r, angle) {
		const v = [];
		for (let i = 0; i < HEX_N; i++) {
			const a = angle + i * (Math.PI / 3);
			v.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
		}
		return v;
	}

	_drawHexOutline(gfx, cx, cy, r, angle, color, alpha, lineW) {
		const v = this._hexVerts(cx, cy, r, angle);
		gfx.lineStyle(lineW, color, alpha);
		gfx.beginPath();
		v.forEach((pt, i) => i === 0 ? gfx.moveTo(pt.x, pt.y) : gfx.lineTo(pt.x, pt.y));
		gfx.closePath();
		gfx.strokePath();
	}

	_fillHex(gfx, cx, cy, r, angle) {
		const v = this._hexVerts(cx, cy, r, angle);
		gfx.beginPath();
		v.forEach((pt, i) => i === 0 ? gfx.moveTo(pt.x, pt.y) : gfx.lineTo(pt.x, pt.y));
		gfx.closePath();
		gfx.fillPath();
	}

	/* Hi-score */
	_loadHi() { try { return parseInt(localStorage.getItem('fp_hh_hi') || '0'); } catch { return 0; } }
	_saveHi(score) { try { if (score > this._loadHi()) localStorage.setItem('fp_hh_hi', score); } catch { } }

	/* Entrance animation */
	_entrance() {
		const { cx, cy } = this._center();
		const { width: W, height: H } = this.scale;
		const flash = this.add.rectangle(cx, cy, W * 3, H * 3, 0xffffff, 1).setDepth(500);
		this.tweens.add({ targets: flash, alpha: 0, duration: 700, ease: 'Power3', onComplete: () => flash.destroy() });

		const title = this.add.text(cx, cy - 20, 'HYPER HEXAGON', {
			fontFamily: 'Courier New', fontStyle: 'bold', fontSize: '28px',
			color: '#ffffff', stroke: '#000000', strokeThickness: 4
		}).setOrigin(0.5).setDepth(510).setAlpha(0);
		this.tweens.add({ targets: title, alpha: 1, y: cy - 44, duration: 420, ease: 'Back.Out' });
		this.time.delayedCall(1200, () => {
			this.tweens.add({ targets: title, alpha: 0, y: cy - 95, duration: 380, onComplete: () => title.destroy() });
		});
	}

	/* Resize handler */
	_onResize(gs) {
		const W = gs.width, H = gs.height;
		this.hudLvLabel?.setPosition(W / 2, 20);
		this.hudLv?.setPosition(W / 2, 32);
		this.hudLivLabel?.setPosition(W - 22, 20);
		this.hudPause?.setPosition(W - 22, H - 22);
		this.flashRect?.setPosition(W / 2, H / 2).setSize(W * 3, H * 3);
	}

	/* Main Update Loop */
	update(time, delta) {
		if (this.isPaused) return;
		const dt = delta / 1000;

		// Continuous time-based score
		if (!this.isGameOver) {
			const pts = Math.ceil(dt * this.level * 2.5);
			this.score += pts;
			this.hudScore.setText(this.score.toLocaleString());
		}

		// Rotate the world frame
		if (!this.isGameOver) {
			this.worldAngle += this.worldRotSpd * this.worldDir * dt;
		}

		// Update player
		if (!this.isGameOver) this._updatePlayer(dt);

		// Spawn walls
		if (!this.isGameOver && !this.isLeveling && time > this.nextSpawn) {
			this._spawnWall();
			this.nextSpawn = time + this.spawnInterval + Phaser.Math.FloatBetween(-90, 90);
		}

		// Update walls (shrink + scoring)
		this._updateWalls(dt);

		// Collision check
		if (!this.isGameOver && !this.isInvincible) this._checkCollision();

		// Invincibility timer
		if (this.isInvincible) {
			this.invTimer -= dt;
			if (this.invTimer <= 0) this.isInvincible = false;
		}

		// Draw order (back → front)
		this._drawBackground(time);
		this._drawWalls();
		this._drawCore(time);
		this._drawPlayer(time);
		this._drawUI();
		this._updateShake();

		// Hi-score flash when beaten
		const hi = this._loadHi();
		if (this.score > hi && hi > 0) {
			this.hudHi.setColor(Math.sin(time * 0.009) > 0 ? '#ffff00' : '#ffffff');
			this.hudHi.setText('★ HI ' + hi.toLocaleString());
		}
	}
}

/* Phaser Configuration */
const config = {
	type: Phaser.AUTO,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: '100%',
		height: '100%',
	},
	backgroundColor: '#c4e2f5',
	physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
	scene: [BootScene, PlayScene],
	render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
	fps: { target: 60, forceSetTimeOut: false },
};

const game = new Phaser.Game(config);
