/**
 * GLITCH JUMPER
 */

/* ─────────────────────────────────────────────
	FreshPlay shim — safe fallback when SDK absent
───────────────────────────────────────────── */
if (!window.FreshPlay) {
	window.FreshPlay = {
		currentLevel: 1,
		getCurrentPalette: () => ({
			background: '#0a0e1a',
			playerCore: '#00e5ff',
			fxAccent: '#7b2fff',
			hostile: '#ff2d78',
		}),
		levelComplete: (cb) => {
			window.FreshPlay.currentLevel++;
			setTimeout(cb, 1800);
		},
		showAd: () => { console.log('[FreshPlay] Ad shown'); }
	};
}

/* ─────────────────────────────────────────────
	CONSTANTS (Adjusted for Thinner & More Tiles)
───────────────────────────────────────────── */
const GRAVITY = 800;
const JUMP_VEL = -600;
const MOVE_SPEED = 380;

const PLAT_HEIGHT = 8;
const PLAT_MIN_GAP_Y = 65;
const PLAT_MAX_GAP_Y = 100;
const PLATFORM_COUNT = 24;

const HEIGHT_PER_LEVEL = 1800;
const BASE_GLITCH_PERIOD = 2200;
const MIN_GLITCH_PERIOD = 500;

/* ─────────────────────────────────────────────
	PALETTE (live from FreshPlay) & ROBUST PARSER
───────────────────────────────────────────── */
let PAL = window.FreshPlay.getCurrentPalette();

// FIX: Safely parse both Strings ('#05050f') and Numbers (0x05050f) so the SDK doesn't crash the game
function hexToNum(hex) {
	if (typeof hex === 'number') return hex;
	if (typeof hex === 'string') return parseInt(hex.replace('#', ''), 16);
	return 0x000000;
}

/* ─────────────────────────────────────────────
	GAME SCENE
───────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────────
//  BOOT SCENE & LANDSCAPE PROMPT
// ─────────────────────────────────────────────────────────────
class Boot extends Phaser.Scene {
  constructor() { super({key:'Boot'}); }
  create() {
		this.scene.start('GameScene');
	}
}


class GameScene extends Phaser.Scene {
	constructor() { super({ key: 'GameScene' }); }

	preload() { }

	create() {
		// --- Scene Cleanup on Restart ---
		this.events.once('shutdown', () => {
			if (this.bgmTimer) this.bgmTimer.remove();
		});

		PAL = window.FreshPlay.getCurrentPalette();

		this.gameRunning = false;
		this.gameOver = false;
		this.score = 0;
		this.combo = 1;
		this.bestCombo = 1;

		// Map game level dynamically to portal level if available
		this.level = window.FreshPlay.currentLevel || 1;

		this.totalHeight = 0;
		this.levelHeight = 0;
		this.glitchPeriod = BASE_GLITCH_PERIOD;
		this.glitchPhase = 0;
		this.inLevelUp = false;
		this.lastPlatform = null;

		this.physics.world.gravity.y = GRAVITY;

		/* Audio Engine Setup */
		if (!window.retroAudioCtx) {
			window.retroAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
		}
		this.audioCtx = window.retroAudioCtx;

		/* Environment & Entities */
		this._buildBackground();

		this.platforms = this.physics.add.staticGroup();
		this._spawnInitialPlatforms();

		this._createPlayer();
		this._setupParticles();

		this.physics.add.collider(
			this.player,
			this.platforms,
			this._onLand,
			this._canLand,
			this
		);

		/* Input */
		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({ left: 'A', right: 'D' });
		this.touchLeft = false;
		this.touchRight = false;
		this._setupTouchInput();

		this.glitchClock = 0;

		// Safe background setting using robust parser
		let bgNum = hexToNum(PAL.background);
		let bgStr = '#' + bgNum.toString(16).padStart(6, '0');
		this.cameras.main.setBackgroundColor(bgStr);

		/* UI DOM refs */
		this.scoreEl = document.getElementById('score-display');
		this.comboEl = document.getElementById('combo-value');
		this.levelEl = document.getElementById('level-value');
		this.rhythmEl = document.getElementById('rhythm-fill');

		// Set initial level HUD
		this.levelEl.textContent = String(this.level).padStart(2, '0');
	}

	/* Audio Methods */
	startContinuousBGM() {
		if (this.bgmTimer) return;
		this.bgmTimer = this.time.addEvent({
			delay: 250,
			callback: () => {
				if (this.gameOver || !this.gameRunning) return;
				const osc = this.audioCtx.createOscillator();
				const gain = this.audioCtx.createGain();
				osc.connect(gain); gain.connect(this.audioCtx.destination);
				osc.type = 'square';

				const isGlitching = (this.glitchClock % this.glitchPeriod) / this.glitchPeriod > 0.82;
				osc.frequency.setValueAtTime(isGlitching ? 55 : 65.41, this.audioCtx.currentTime);

				gain.gain.setValueAtTime(0.03, this.audioCtx.currentTime);
				gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
				osc.start(); osc.stop(this.audioCtx.currentTime + 0.2);
			}, loop: true
		});
	}

	playSound(type) {
		if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
		const osc = this.audioCtx.createOscillator();
		const gain = this.audioCtx.createGain();
		osc.connect(gain); gain.connect(this.audioCtx.destination);
		const now = this.audioCtx.currentTime;

		if (type === 'jump') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(400, now);
			osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
			gain.gain.setValueAtTime(0.15, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
			osc.start(now); osc.stop(now + 0.1);
		} else if (type === 'land') {
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(200, now);
			osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
			gain.gain.setValueAtTime(0.2, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
			osc.start(now); osc.stop(now + 0.1);
		} else if (type === 'gameover') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(150, now);
			osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
			gain.gain.setValueAtTime(0.4, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
			osc.start(now); osc.stop(now + 0.5);
		}
	}

	/* _buildBackground */
	_buildBackground() {
		const gfx = this.add.graphics();
		const w = this.scale.width;

		const bgColor = hexToNum(PAL.background);
		gfx.fillStyle(bgColor, 1);
		gfx.fillRect(0, -20000, w, 40000);

		gfx.lineStyle(1, 0x3b82f6, 0.03);
		for (let y = 0; y < 40000; y += 60) {
			gfx.strokeLineShape(new Phaser.Geom.Line(0, y - 20000, w, y - 20000));
		}
		for (let x = 0; x < w; x += 60) {
			gfx.strokeLineShape(new Phaser.Geom.Line(x, -20000, x, 20000));
		}
	}

	/* _spawnInitialPlatforms */
	_spawnInitialPlatforms() {
		const w = this.scale.width;
		const h = this.scale.height;

		// Starting platform — large & safe in the center
		this._addPlatform(w / 2, h - 80, 200, false);

		let y = h - 80;
		for (let i = 1; i < PLATFORM_COUNT; i++) {
			y -= Phaser.Math.Between(PLAT_MIN_GAP_Y, PLAT_MAX_GAP_Y);
			const platW = Phaser.Math.Between(100, 260); // Wider for easier landing
			const platX = Phaser.Math.Between(platW / 2 + 10, w - platW / 2 - 10);
			const isFake = (i > 2) && (Math.random() < 0.2);
			this._addPlatform(platX, y, platW, isFake);
		}
	}

	/* _addPlatform */
	_addPlatform(x, y, w, fake = false) {
		const platColor = fake ? hexToNum(PAL.hostile) : hexToNum(PAL.fxAccent);
		const key = `plat_${w}_${platColor}`;

		if (!this.textures.exists(key)) {
			const g = this.make.graphics({ x: 0, y: 0, add: false });

			g.fillStyle(platColor, 0.12);
			g.fillRoundedRect(0, 0, w + 12, PLAT_HEIGHT + 8, 3);

			g.fillStyle(platColor, 0.9);
			g.fillRoundedRect(6, 4, w, PLAT_HEIGHT, 2);

			g.fillStyle(0x3b82f6, 0.2);
			g.fillRect(8, 5, w - 4, 2);

			g.fillStyle(0x3b82f6, 0.15);
			for (let dx = 12; dx < w + 6; dx += 14) {
				g.fillRect(dx, PLAT_HEIGHT + 1, 6, 2);
			}

			g.generateTexture(key, w + 12, PLAT_HEIGHT + 8);
			g.destroy();
		}

		const img = this.physics.add.staticImage(x, y, key);
		img.body.setSize(w, PLAT_HEIGHT);
		img.body.setOffset(6, 4);

		img.isFake = fake;
		img.isVisible = true;
		img.glitchOffset = Math.random() * Math.PI * 2;
		img.baseY = y;
		img.platW = w;
		img.platColor = platColor;

		this.platforms.add(img);
		return img;
	}

	/* _createPlayer */
	_createPlayer() {
		const c = hexToNum(PAL.playerCore);
		const w = this.scale.width;
		const h = this.scale.height;

		const key = 'player';
		if (!this.textures.exists(key)) {
			const size = 26;
			const g = this.make.graphics({ add: false });

			g.fillStyle(c, 0.15);
			g.fillCircle(size, size, size);
			g.fillStyle(c, 0.35);
			g.fillCircle(size, size, size * 0.7);
			g.fillStyle(c, 1);
			g.fillCircle(size, size, size * 0.42);
			g.fillStyle(0x3b82f6, 0.55);
			g.fillCircle(size * 0.78, size * 0.75, size * 0.16);

			g.generateTexture(key, size * 2, size * 2);
			g.destroy();
		}

		this.player = this.physics.add.sprite(w / 2, h - 120, key);
		this.player.setCircle(10, 3, 3);
		this.player.setCollideWorldBounds(false);
		this.player.setMaxVelocity(900, 900);
		this.player.setBounceY(0.05);
		this.player.setDepth(10);

		this.trailGfx = this.add.graphics().setDepth(9);
		this.trailPoints = [];
		this.player.prevVelY = 0;
	}

	/* _setupParticles */
	_setupParticles() {
		const pKey = 'spark';
		if (!this.textures.exists(pKey)) {
			const g = this.make.graphics({ add: false });
			g.fillStyle(0x3b82f6, 1);
			g.fillCircle(4, 4, 4);
			g.generateTexture(pKey, 8, 8);
			g.destroy();
		}

		this.particles = this.add.particles(0, 0, pKey, {
			speed: { min: 20, max: 70 },
			angle: { min: 200, max: 340 },
			scale: { start: 0.6, end: 0 },
			alpha: { start: 0.9, end: 0 },
			lifespan: { min: 200, max: 500 },
			tint: [hexToNum(PAL.playerCore), hexToNum(PAL.fxAccent), 0x94a3b8],
			quantity: 0,
			frequency: -1,
			blendMode: 'ADD',
		});
		this.particles.setDepth(8);

		this.burstParticles = this.add.particles(0, 0, pKey, {
			speed: { min: 60, max: 180 },
			angle: { min: 200, max: 340 },
			scale: { start: 0.8, end: 0 },
			alpha: { start: 1, end: 0 },
			lifespan: { min: 150, max: 350 },
			tint: [hexToNum(PAL.fxAccent), hexToNum(PAL.playerCore)],
			quantity: 0,
			frequency: -1,
			blendMode: 'ADD',
		});
		this.burstParticles.setDepth(11);
	}

	/* _setupTouchInput */
	_setupTouchInput() {
		const left = document.getElementById('touch-left');
		const right = document.getElementById('touch-right');

		const setL = (v) => { this.touchLeft = v; };
		const setR = (v) => { this.touchRight = v; };

		left.addEventListener('touchstart', () => setL(true), { passive: true });
		left.addEventListener('touchend', () => setL(false), { passive: true });
		right.addEventListener('touchstart', () => setR(true), { passive: true });
		right.addEventListener('touchend', () => setR(false), { passive: true });

		left.addEventListener('mousedown', () => setL(true));
		left.addEventListener('mouseup', () => setL(false));
		right.addEventListener('mousedown', () => setR(true));
		right.addEventListener('mouseup', () => setR(false));

		window.addEventListener('deviceorientation', (e) => {
			const g = e.gamma || 0;
			this.touchLeft = g < -8;
			this.touchRight = g > 8;
		}, { passive: true });
	}

	/* _startGame */
	_startGame() {
		document.getElementById('start-screen').classList.add('hidden');
		document.getElementById('over-screen').classList.add('hidden');
		document.getElementById('hud').style.display = 'flex';
		document.getElementById('rhythm-bar-wrap').style.display = 'block';

		if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
		this.startContinuousBGM();

		this.gameRunning = true;
		this.gameOver = false;
	}

	/* ─────────────────────────────────────────
		COLLIDER CALLBACKS
	───────────────────────────────────────── */
	_canLand(player, plat) {
		return plat.isVisible && !plat.isFake && player.body.velocity.y > 0;
	}

	_onLand(player, plat) {
		this._doJump();

		// COMBO FIX: Prevent combo scaling when bouncing on the exact same platform
		if (this.lastPlatform === plat) {
			this.combo = 1;
			this._updateComboHUD();

			// Small squash for normal bounce without burst
			this.tweens.add({
				targets: player,
				scaleX: 1.3, scaleY: 0.75,
				duration: 60,
				yoyo: true,
				ease: 'Cubic.Out',
			});
			return;
		}

		// Set new last platform
		this.lastPlatform = plat;

		const phaseInCycle = this._getPlatformPhase(plat);
		const windowLeft = 1 - phaseInCycle;
		const perfectWindow = 0.25;
		let comboGain = 1;

		if (windowLeft < perfectWindow) { comboGain = 3; }
		else if (windowLeft < 0.5) { comboGain = 2; }

		this.combo = Math.min(this.combo + comboGain, 16);
		if (this.combo > this.bestCombo) this.bestCombo = this.combo;

		const points = 100 * this.combo;
		this.score += points;
		this._updateScoreHUD();

		this.burstParticles.setPosition(player.x, player.y + 12);
		this.burstParticles.emitParticleAt(player.x, player.y + 12, 12 + this.combo * 2);

		this.tweens.add({
			targets: player,
			scaleX: 1.5, scaleY: 0.65,
			duration: 60,
			yoyo: true,
			ease: 'Cubic.Out',
		});
	}

	_doJump() {
		this.playSound('jump');
		this.player.setVelocityY(JUMP_VEL - (this.combo * 6));
	}

	/* ─────────────────────────────────────────
		GLITCH LOGIC
	───────────────────────────────────────── */
	_getPlatformPhase(plat) {
		const raw = (this.glitchClock + plat.glitchOffset * this.glitchPeriod / (Math.PI * 2));
		const t = (raw % this.glitchPeriod) / this.glitchPeriod;
		return t;
	}

	_updateGlitch(delta) {
		this.glitchClock = (this.glitchClock + delta) % (this.glitchPeriod * 1000);
		const globalT = (this.glitchClock % this.glitchPeriod) / this.glitchPeriod;

		this.rhythmEl.style.width = (globalT * 100).toFixed(1) + '%';

		if (globalT > 0.85) {
			this.rhythmEl.style.boxShadow = '0 0 18px var(--neon-pink)';
			this.rhythmEl.style.background = 'linear-gradient(90deg,var(--neon-pink),#fff)';
		} else {
			this.rhythmEl.style.boxShadow = '0 0 10px var(--neon-cyan)';
			this.rhythmEl.style.background = 'linear-gradient(90deg,var(--neon-cyan),var(--neon-pink))';
		}

		this.platforms.getChildren().forEach(plat => {
			const t = this._getPlatformPhase(plat);

			if (plat.isFake) {
				const show = t > 0.5;
				plat.setVisible(show);
				plat.isVisible = false;
				plat.setAlpha(show ? 0.55 + Math.sin(this.glitchClock * 0.015) * 0.2 : 0);
			} else {
				const glitchOut = t > 0.82;
				if (glitchOut) {
					const flicker = Math.sin(this.glitchClock * 0.08) > 0;
					plat.setVisible(flicker);
					plat.isVisible = flicker;
					plat.setAlpha(flicker ? 0.6 : 0);
				} else {
					const solidRamp = Math.min(1, (t < 0.1 ? t / 0.1 : 1));
					plat.setVisible(true);
					plat.isVisible = true;
					plat.setAlpha(0.75 + solidRamp * 0.25);

					const pulse = 0.85 + Math.sin(this.glitchClock * 0.004 + plat.glitchOffset) * 0.15;
					plat.setTint(Phaser.Display.Color.ValueToColor(plat.platColor).lighten(Math.round(pulse * 10)).color);
				}
			}
		});
	}

	/* ─────────────────────────────────────────
		PLATFORM RECYCLING
	───────────────────────────────────────── */
	_recyclePlatforms() {
		const w = this.scale.width;
		const scrollY = this.cameras.main.scrollY;
		const topBound = scrollY - 100;
		const bottomBound = scrollY + this.scale.height + 200;

		let highestY = Infinity;
		this.platforms.getChildren().forEach(p => {
			if (p.y < highestY) highestY = p.y;
		});

		this.platforms.getChildren().slice().forEach(plat => {
			if (plat.y > bottomBound) {
				plat.destroy();
			}
		});

		while (highestY > topBound) {
			highestY -= Phaser.Math.Between(PLAT_MIN_GAP_Y, PLAT_MAX_GAP_Y + this.level * 5);
			const platW = Phaser.Math.Between(100, 260 - this.level * 3); // Wider for easier landing
			const platX = Phaser.Math.Between(Math.max(platW / 2 + 10, 30), Math.min(w - platW / 2 - 10, w - 30));
			const fake = Math.random() < (0.15 + this.level * 0.03);
			this._addPlatform(platX, highestY, Math.max(44, platW), fake);
		}
	}

	/* ─────────────────────────────────────────
		CAMERA / SCROLL
	───────────────────────────────────────── */
	_updateCamera() {
		// Calculate target camera Y so the player's peak reaches about 35% from the top
		const targetY = this.player.y - this.scale.height * 0.35;
		
		if (this.highestCamY === undefined) {
			this.highestCamY = this.cameras.main.scrollY;
		}

		if (targetY < this.highestCamY) {
			this.highestCamY = targetY;
		}

		const camY = this.cameras.main.scrollY;
		if (this.highestCamY < camY) {
			const newY = Phaser.Math.Linear(camY, this.highestCamY, 0.1);
			const ascent = camY - newY;
			this.totalHeight += ascent;
			this.levelHeight += ascent;
			this.score += Math.round(ascent * 0.5 * this.level);
			this._updateScoreHUD();

			this.cameras.main.scrollY = newY;
		}
	}

	/* ─────────────────────────────────────────
		LEVEL UP & AD INTEGRATION
	───────────────────────────────────────── */
	_checkLevelUp() {
		if (this.levelHeight >= HEIGHT_PER_LEVEL && !this.inLevelUp) {
			this.inLevelUp = true;
			this.levelHeight = 0;
			this.level++; // Increment Level First
			this.glitchPeriod = Math.max(MIN_GLITCH_PERIOD, BASE_GLITCH_PERIOD - (this.level - 1) * 180);
			this.combo = 1;

			this.levelEl.textContent = String(this.level).padStart(2, '0');

			const ls = document.getElementById('level-screen');
			const num = document.getElementById('level-num-display');
			const txt = String(this.level).padStart(2, '0');
			num.textContent = txt;
			num.dataset.text = txt;
			ls.classList.remove('hidden');

			// EXPLICIT AD TRIGGER (Syncs dynamically with FreshPlay SDK every 5 levels)
			if ((this.level - 1) % 5 === 0) {
				try {
					['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
						if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
					});
				} catch (_) { }
			}

			// Fire portal hook
			window.FreshPlay.levelComplete(() => {
				PAL = window.FreshPlay.getCurrentPalette();

				// Update background in real-time
				let bgNum = hexToNum(PAL.background);
				let bgStr = '#' + bgNum.toString(16).padStart(6, '0');
				this.cameras.main.setBackgroundColor(bgStr);

				ls.classList.add('hidden');
				this.inLevelUp = false;
				this._flashScreen();
			});
		}
	}

	_flashScreen() {
		const w = this.scale.width;
		const h = this.scale.height;

		// Use playerCore dynamically instead of hardcoded cyan
		const playerCoreHex = hexToNum(PAL.playerCore);

		const overlay = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, playerCoreHex, 0.3)
			.setDepth(50)
			.setScrollFactor(0);
		this.tweens.add({
			targets: overlay,
			alpha: 0,
			duration: 400,
			ease: 'Quad.Out',
			onComplete: () => overlay.destroy(),
		});
	}

	/* ─────────────────────────────────────────
		PLAYER TRAIL
	───────────────────────────────────────── */
	_updateTrail() {
		this.trailPoints.unshift({ x: this.player.x, y: this.player.y });
		if (this.trailPoints.length > 18) this.trailPoints.pop();

		this.trailGfx.clear();
		for (let i = 1; i < this.trailPoints.length; i++) {
			const alpha = 1 - i / this.trailPoints.length;
			const size = (1 - i / this.trailPoints.length) * 6;
			this.trailGfx.fillStyle(hexToNum(PAL.playerCore), alpha * 0.55);
			this.trailGfx.fillCircle(this.trailPoints[i].x, this.trailPoints[i].y, size);
		}

		if (this.player.body.velocity.y > 0 && Math.random() < 0.4) {
			this.particles.emitParticleAt(
				this.player.x + Phaser.Math.Between(-5, 5),
				this.player.y + 8,
				1
			);
		}
	}

	/* ─────────────────────────────────────────
		HUD
	───────────────────────────────────────── */
	_updateScoreHUD() {
		const el = this.scoreEl;
		el.textContent = String(Math.floor(this.score)).padStart(6, '0');
		el.classList.remove('glitch');
		void el.offsetWidth;
		el.classList.add('glitch');
	}

	_updateComboHUD() {
		const el = this.comboEl;
		el.textContent = '×' + this.combo;
		if (this.combo >= 6) {
			el.classList.add('hot');
		} else {
			el.classList.remove('hot');
		}
	}

	/* ─────────────────────────────────────────
		GAME OVER
	───────────────────────────────────────── */
	_triggerGameOver() {
		if (this.gameOver) return;
		this.gameOver = true;
		this.gameRunning = false;
		this.playSound('gameover');

		this.cameras.main.shake(350, 0.025);
		this.cameras.main.flash(300, 255, 45, 120);

		this.player.setVelocity(0, 0);
		this.player.body.allowGravity = false;

		this.tweens.add({
			targets: this.player,
			alpha: 0,
			scaleX: 3, scaleY: 3,
			duration: 400,
			ease: 'Quad.Out',
		});

		this.time.delayedCall(700, () => {
			document.getElementById('final-score').textContent = String(Math.floor(this.score)).padStart(6, '0');
			document.getElementById('final-level').textContent = this.level;
			document.getElementById('final-combo').textContent = '×' + this.bestCombo;
			document.getElementById('over-screen').classList.remove('hidden');
		});
	}

	/* ─────────────────────────────────────────
		UPDATE LOOP
	───────────────────────────────────────── */
	update(time, delta) {
		delta = Math.min(delta || 16.6, 33.3);
		if (!this.gameRunning || this.gameOver) return;

		const dt = delta / 1000;
		const w = this.scale.width;

		/* Horizontal movement */
		const goLeft = this.cursors.left.isDown || this.wasd.left.isDown || this.touchLeft;
		const goRight = this.cursors.right.isDown || this.wasd.right.isDown || this.touchRight;

		if (goLeft) this.player.setVelocityX(-MOVE_SPEED);
		else if (goRight) this.player.setVelocityX(MOVE_SPEED);
		else this.player.setVelocityX(Phaser.Math.Linear(this.player.body.velocity.x, 0, 0.2));

		/* Wrap horizontally */
		if (this.player.x < -10) this.player.setX(w + 10);
		if (this.player.x > w + 10) this.player.setX(-10);

		/* Glitch tick */
		this.glitchClock += delta;
		this._updateGlitch(delta);

		/* Camera */
		this._updateCamera();

		/* Recycle platforms */
		this._recyclePlatforms();

		/* Trail */
		this._updateTrail();

		/* Combo HUD */
		this._updateComboHUD();

		/* Level check */
		this._checkLevelUp();

		/* Death check */
		const camBottom = this.cameras.main.scrollY + this.scale.height;
		if (this.player.y > camBottom + 40) {
			this._triggerGameOver();
		}

		/* Player tilt */
		const vx = this.player.body.velocity.x;
		this.player.setRotation(vx * 0.0008);
	}
}

/* ─────────────────────────────────────────────
	PHASER CONFIG
───────────────────────────────────────────── */
const config = {
	type: Phaser.AUTO,
	scale: {
		mode: Phaser.Scale.RESIZE,
		width: '100%',
		height: '100%',
		parent: 'game-container',
	},
	backgroundColor: '#0a0e1a',
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: GRAVITY },
			debug: false,
		},
	},
	scene: [Boot, GameScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
	render: {
		pixelArt: false,
		antialias: true,
		roundPixels: false,
	},
};

/* ─────────────────────────────────────────────
	INIT GAME
───────────────────────────────────────────── */
const game = new Phaser.Game(config);

/* ─────────────────────────────────────────────
	DOM BUTTON WIRING (Audio initialization fix)
───────────────────────────────────────────── */
function restartGame() {
	document.getElementById('over-screen').classList.add('hidden');
	document.getElementById('level-screen').classList.add('hidden');
	document.getElementById('score-display').textContent = '000000';
	document.getElementById('combo-value').textContent = '×1';
	document.getElementById('level-value').textContent = '01';

	const scene = game.scene.getScene('GameScene');
	scene.scene.restart();

	// Safe timeout to ensure scene restarted before calling _startGame
	setTimeout(() => {
		if (scene) scene._startGame();
	}, 50);
}

document.getElementById('start-btn').addEventListener('click', () => {
	if (window.retroAudioCtx && window.retroAudioCtx.state === 'suspended') {
		window.retroAudioCtx.resume();
	}
	const scene = game.scene.getScene('GameScene');
	if (scene) scene._startGame();
});

document.getElementById('retry-btn').addEventListener('click', () => {
	if (window.retroAudioCtx && window.retroAudioCtx.state === 'suspended') {
		window.retroAudioCtx.resume();
	}
	restartGame();
});

/* Keyboard shortcut: Enter/Space to start */
document.addEventListener('keydown', (e) => {
	if (e.code === 'Enter' || e.code === 'Space') {
		if (window.retroAudioCtx && window.retroAudioCtx.state === 'suspended') {
			window.retroAudioCtx.resume();
		}
		const startEl = document.getElementById('start-screen');
		const overEl = document.getElementById('over-screen');
		if (!startEl.classList.contains('hidden')) {
			const scene = game.scene.getScene('GameScene');
			if (scene) scene._startGame();
		} else if (!overEl.classList.contains('hidden')) {
			restartGame();
		}
	}
});
