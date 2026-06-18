// ============================================================
//  SPACE SCAVENGER
// ============================================================

/* global Phaser */

// FreshPlay shim (safe when running standalone)
window.FreshPlay = window.FreshPlay || {
	levelComplete(cb) { console.log('[FreshPlay] levelComplete'); if (cb) cb(); },
	gameOver(score) { console.log('[FreshPlay] gameOver', score); },
	getCurrentPalette() {
		return {
			background: '#f8fafc',
			playerCore: '#7ee8fa',
			fxAccent: '#00ffd0',
			hostile: '#ff4757',
			interface: '#e2e8f0',
		};
	},
};

// Audio context (shared)
const AudioCtx = (() => {
	let _ctx = null;
	return {
		get() {
			if (!_ctx) {
				try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
				catch (e) { console.warn('Web Audio not supported'); }
			}
			return _ctx;
		},
		resume() { const c = this.get(); if (c && c.state === 'suspended') c.resume(); }
	};
})();

// Synthesised SFX 
const SFX = {
	// Continuous thruster hum (returns { stop })
	thruster() {
		const ctx = AudioCtx.get(); if (!ctx) return { stop() { } };
		const master = ctx.createGain(); master.gain.setValueAtTime(0, ctx.currentTime);
		master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.15);
		master.connect(ctx.destination);

		// noise layer
		const bufLen = ctx.sampleRate * 2;
		const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
		const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
		const noiseFilter = ctx.createBiquadFilter();
		noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 90; noiseFilter.Q.value = 1.2;
		const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.06;
		noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);
		noise.start();

		// oscillator layers
		const freqs = [55, 110, 165];
		const oscs = freqs.map(f => {
			const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
			const g = ctx.createGain(); g.gain.value = 0.04;
			const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 300;
			o.connect(flt); flt.connect(g); g.connect(master); o.start();
			return o;
		});

		// LFO wobble
		const lfo = ctx.createOscillator(); lfo.frequency.value = 4.5;
		const lfoGain = ctx.createGain(); lfoGain.gain.value = 8;
		lfo.connect(lfoGain);
		oscs.forEach(o => lfoGain.connect(o.frequency));
		lfo.start();

		return {
			stop() {
				const t = ctx.currentTime;
				master.gain.linearRampToValueAtTime(0, t + 0.2);
				setTimeout(() => { try { noise.stop(); oscs.forEach(o => o.stop()); lfo.stop(); } catch (e) { } }, 250);
			}
		};
	},

	// Scrap collection chime
	collect() {
		const ctx = AudioCtx.get(); if (!ctx) return;
		const g = ctx.createGain(); g.gain.setValueAtTime(0.55, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
		g.connect(ctx.destination);
		[880, 1320, 1760].forEach((f, i) => {
			const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
			const og = ctx.createGain(); og.gain.value = 1 / (i + 1);
			o.connect(og); og.connect(g);
			o.start(ctx.currentTime + i * 0.03);
			o.stop(ctx.currentTime + 0.45);
		});
	},

	// Shield activation ping
	shieldFull() {
		const ctx = AudioCtx.get(); if (!ctx) return;
		const g = ctx.createGain(); g.gain.setValueAtTime(0.4, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
		g.connect(ctx.destination);
		[528, 660, 792, 1056].forEach((f, i) => {
			const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
			o.connect(g); o.start(ctx.currentTime + i * 0.05); o.stop(ctx.currentTime + 0.6);
		});
	},

	// Shield absorb impact
	shieldHit() {
		const ctx = AudioCtx.get(); if (!ctx) return;
		const g = ctx.createGain(); g.gain.setValueAtTime(0.5, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
		g.connect(ctx.destination);
		const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(220, ctx.currentTime);
		o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.35);
		o.connect(g); o.start(); o.stop(ctx.currentTime + 0.35);
	},

	// Heavy bass explosion
	explosion() {
		const ctx = AudioCtx.get(); if (!ctx) return;
		// Sub boom
		const g = ctx.createGain(); g.gain.setValueAtTime(1.2, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
		const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -6;
		g.connect(comp); comp.connect(ctx.destination);

		const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(80, ctx.currentTime);
		o.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.4);
		o.connect(g); o.start(); o.stop(ctx.currentTime + 1.4);

		// Noise burst
		const bufLen = ctx.sampleRate;
		const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
		const ns = ctx.createBufferSource(); ns.buffer = buf;
		const ng = ctx.createGain(); ng.gain.value = 0.7;
		ns.connect(ng); ng.connect(comp); ns.start();
	},

	levelUp() {
		const ctx = AudioCtx.get(); if (!ctx) return;
		const g = ctx.createGain(); g.gain.setValueAtTime(0.35, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
		g.connect(ctx.destination);
		[330, 440, 550, 660, 880].forEach((f, i) => {
			const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
			const og = ctx.createGain(); og.gain.value = 0.6;
			o.connect(og); og.connect(g);
			o.start(ctx.currentTime + i * 0.07);
			o.stop(ctx.currentTime + 1.0);
		});
	}
};

// ═══════════════════════════════════════════════════════════════
//  SCENE: Boot — generate all textures programmatically
// ═══════════════════════════════════════════════════════════════
class BootScene extends Phaser.Scene {
	constructor() { super('Boot'); }

	create() {
		const P = window.FreshPlay.getCurrentPalette();
		this._generateTextures(P);
		this.scene.start('Game');
	}

	_generateTextures(P) {
		const g = this.make.graphics({ add: false });

		// Ship (engines glow, cockpit, wing accents, thruster nozzles) 
		g.clear();
		const sc = Phaser.Display.Color.HexStringToColor(P.playerCore);
		const sc2 = { r: sc.r, g: sc.g, b: sc.b };
		// engine glow
		g.fillStyle(0x004466, 0.5); g.fillEllipse(20, 38, 24, 14);
		// body
		g.fillStyle(Phaser.Display.Color.GetColor(sc2.r, sc2.g, sc2.b), 1);
		g.fillTriangle(20, 2, 4, 40, 36, 40);
		// cockpit
		g.fillStyle(0x0f172a, 0.85); g.fillEllipse(20, 20, 10, 14);
		// wing accents
		g.lineStyle(1.5, 0x0f172a, 0.4);
		g.strokeTriangle(20, 2, 4, 40, 36, 40);
		// engine nozzles
		g.fillStyle(0xff9500, 0.9); g.fillEllipse(13, 41, 6, 4); g.fillEllipse(27, 41, 6, 4);
		g.generateTexture('ship', 40, 46);

		// Scrap (collectible resource, also used for HUD icon)
		g.clear();
		const ac = Phaser.Display.Color.HexStringToColor(P.fxAccent);
		g.lineStyle(2, Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), 1);
		// diamond shape
		g.beginPath();
		g.moveTo(12, 0); g.lineTo(24, 12); g.lineTo(12, 24); g.lineTo(0, 12); g.closePath();
		g.strokePath();
		g.fillStyle(Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), 0.25); g.fillPath();
		// inner cross
		g.lineStyle(1, Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), 0.6);
		g.lineBetween(12, 4, 12, 20); g.lineBetween(4, 12, 20, 12);
		g.generateTexture('scrap', 24, 24);

		// Asteroids (3 sizes, varied shapes) 
		const hc = Phaser.Display.Color.HexStringToColor(P.hostile);
		const hCol = Phaser.Display.Color.GetColor(hc.r, hc.g, hc.b);

		[[32, 'asteroid_sm'], [52, 'asteroid_md'], [72, 'asteroid_lg']].forEach(([sz, key]) => {
			g.clear();
			const cx = sz / 2, cy = sz / 2, r = sz * 0.44;
			const verts = 9;
			const pts = [];
			for (let i = 0; i < verts; i++) {
				const ang = (i / verts) * Math.PI * 2;
				const rr = r * (0.7 + 0.3 * Math.sin(i * 2.3 + sz));
				pts.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr });
			}
			g.fillStyle(hCol, 1);
			g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
			pts.slice(1).forEach(p => g.lineTo(p.x, p.y)); g.closePath(); g.fillPath();
			// crater details
			g.fillStyle(0x000000, 0.25);
			g.fillCircle(cx - r * 0.2, cy - r * 0.15, r * 0.18);
			g.fillCircle(cx + r * 0.25, cy + r * 0.2, r * 0.12);
			g.lineStyle(1.5, 0x0f172a, 0.12); g.strokePath();
			g.generateTexture(key, sz, sz);
		});

		// Particle: thrust flame 
		g.clear();
		g.fillStyle(0xff6600, 1); g.fillCircle(4, 4, 4);
		g.generateTexture('flame', 8, 8);

		// Particle: spark 
		g.clear();
		g.fillStyle(0x0f172a, 1); g.fillRect(0, 0, 3, 3);
		g.generateTexture('spark', 3, 3);

		// Particle: shield fragment 
		g.clear();
		g.fillStyle(Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), 1);
		g.fillCircle(3, 3, 3);
		g.generateTexture('shield_frag', 6, 6);

		// Star dots (parallax layers) 
		[1, 2, 3].forEach((s, i) => {
			g.clear(); g.fillStyle(0x0f172a, 1); g.fillCircle(s, s, s);
			g.generateTexture(`star${i}`, s * 2, s * 2);
		});

		// Scrap glow 
		g.clear();
		const rad = 20;
		for (let r2 = rad; r2 > 0; r2 -= 2) {
			const alpha = (1 - r2 / rad) * 0.35;
			g.fillStyle(Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), alpha);
			g.fillCircle(rad, rad, r2);
		}
		g.generateTexture('scrap_glow', rad * 2, rad * 2);

		// Shield bubble 
		g.clear();
		g.lineStyle(3, Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), 0.9);
		g.strokeCircle(32, 32, 30);
		g.lineStyle(1, Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b), 0.35);
		g.strokeCircle(32, 32, 26);
		g.generateTexture('shield_bubble', 64, 64);

		g.destroy();
	}
}

// ═══════════════════════════════════════════════════════════════
//  SCENE: Game
// ═══════════════════════════════════════════════════════════════
class GameScene extends Phaser.Scene {
	constructor() { super('Game'); }

	// init / create 
	create() {
		AudioCtx.resume();
		this.P = window.FreshPlay.getCurrentPalette();

		// State
		this.score = 0;
		this.level = 1;
		this.scrapCount = 0;
		this.scrapPerLevel = 12;
		this.shield = 0;         // 0‥1
		this.shieldFull = false;
		this.alive = true;
		this.distanceTravelled = 0;
		this.speed = 220;       // base scroll speed px/s
		this.asteroidRate = 1400;      // ms between spawns
		this.levelingUp = false;
		this.invincible = false;
		this.invincibleTimer = 0;

		// World
		this._buildBackground();
		this._buildParallax();
		this._buildShip();
		this._buildParticles();
		this._buildPhysicsGroups();
		this._buildHUD();
		this._buildShieldBubble();

		// Input
		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
		this.pointer = { x: 0, y: 0, active: false };
		this.input.on('pointermove', p => { this.pointer.x = p.x; this.pointer.y = p.y; });
		this.input.on('pointerdown', p => { this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.active = true; AudioCtx.resume(); });
		this.input.on('pointerup', () => { this.pointer.active = false; });

		// Timers
		this.asteroidTimer = this.time.addEvent({
			delay: this.asteroidRate, callback: this._spawnAsteroid, callbackScope: this, loop: true
		});
		this.scrapTimer = this.time.addEvent({
			delay: 1200, callback: this._spawnScrap, callbackScope: this, loop: true
		});
		this.scoreTimer = this.time.addEvent({
			delay: 100, callback: () => { if (this.alive && !this.levelingUp) this.score += Math.floor(this.level * 1.5); },
			callbackScope: this, loop: true
		});

		// Thruster audio
		this._thrusterSfx = SFX.thruster();
	}

	// Background 
	_buildBackground() {
		const bgColor = Phaser.Display.Color.HexStringToColor(this.P.background);
		this.cameras.main.setBackgroundColor(
			Phaser.Display.Color.GetColor(bgColor.r, bgColor.g, bgColor.b)
		);

		// Nebula layers (graphics drawn as blurry blobs)
		const nebula = this.add.graphics();
		const W = this.scale.width, H = this.scale.height;
		const nebulaColors = [0x001a2e, 0x0a0a2e, 0x1a0020, 0x00101a];
		nebulaColors.forEach((col, i) => {
			const x = (i * 0.27 * W + 80) % W;
			const y = (i * 0.31 * H + 60) % H;
			for (let r = 140; r > 0; r -= 20) {
				nebula.fillStyle(col, 0.06);
				nebula.fillEllipse(x, y, r * 2.5, r);
			}
		});
	}

	// Parallax star layers 
	_buildParallax() {
		this.starLayers = [];
		const W = this.scale.width, H = this.scale.height;
		const configs = [
			{ key: 'star0', count: 60, speed: 0.08, alpha: 0.35 },
			{ key: 'star1', count: 40, speed: 0.25, alpha: 0.55 },
			{ key: 'star2', count: 20, speed: 0.55, alpha: 0.85 },
		];
		configs.forEach(cfg => {
			const layer = [];
			for (let i = 0; i < cfg.count; i++) {
				const s = this.add.image(
					Phaser.Math.Between(0, W),
					Phaser.Math.Between(0, H),
					cfg.key
				).setAlpha(cfg.alpha * (0.6 + Math.random() * 0.4));
				layer.push(s);
			}
			this.starLayers.push({ stars: layer, speed: cfg.speed });
		});
	}

	// Ship 
	_buildShip() {
		const W = this.scale.width, H = this.scale.height;
		this.ship = this.physics.add.image(W / 2, H * 0.75, 'ship')
			.setCollideWorldBounds(true)
			.setDrag(320, 320)
			.setMaxVelocity(380, 380);
		this.ship.body.setSize(22, 30).setOffset(9, 8);
	}

	// Particles 
	_buildParticles() {
		// Thruster flame
		this.flameEmitter = this.add.particles(0, 0, 'flame', {
			follow: this.ship,
			followOffset: { x: 0, y: 22 },
			lifespan: 220,
			speed: { min: 40, max: 90 },
			angle: { min: 80, max: 100 },
			scale: { start: 0.9, end: 0 },
			alpha: { start: 0.85, end: 0 },
			tint: [0xff8800, 0xff4400, 0xffdd00],
			frequency: 18,
			quantity: 2,
			blendMode: 'ADD',
		});

		// Collect spark
		this.collectEmitter = this.add.particles(0, 0, 'spark', {
			lifespan: 350,
			speed: { min: 80, max: 200 },
			scale: { start: 1.2, end: 0 },
			alpha: { start: 1, end: 0 },
			tint: Phaser.Display.Color.HexStringToColor(this.P.fxAccent).color,
			quantity: 10,
			blendMode: 'ADD',
			emitting: false,
		});

		// Impact spark
		this.impactEmitter = this.add.particles(0, 0, 'spark', {
			lifespan: 500,
			speed: { min: 100, max: 300 },
			scale: { start: 1.5, end: 0 },
			alpha: { start: 1, end: 0 },
			tint: [0xff4400, 0xffaa00, 0x0f172a],
			quantity: 20,
			blendMode: 'ADD',
			emitting: false,
		});

		// Shield fragment
		this.shieldEmitter = this.add.particles(0, 0, 'shield_frag', {
			lifespan: 400,
			speed: { min: 120, max: 260 },
			scale: { start: 1, end: 0 },
			alpha: { start: 0.9, end: 0 },
			tint: Phaser.Display.Color.HexStringToColor(this.P.fxAccent).color,
			quantity: 16,
			blendMode: 'ADD',
			emitting: false,
		});
	}

	// Physics groups 
	_buildPhysicsGroups() {
		this.asteroids = this.physics.add.group();
		this.scraps = this.physics.add.group();

		// Overlap: ship ↔ scrap
		this.physics.add.overlap(this.ship, this.scraps, this._collectScrap, null, this);
		// Overlap: ship ↔ asteroid
		this.physics.add.overlap(this.ship, this.asteroids, this._hitAsteroid, null, this);
	}

	// HUD 
	_buildHUD() {
		const W = this.scale.width;
		const ic = Phaser.Display.Color.HexStringToColor(this.P.interface);
		const iCol = Phaser.Display.Color.GetColor(ic.r, ic.g, ic.b);
		const ac = Phaser.Display.Color.HexStringToColor(this.P.fxAccent);
		const aCol = Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b);

		// Top row 
		// Score label
		this.scoreLabel = this.add.text(20, 18, 'SCORE', {
			fontFamily: "'Courier New', monospace",
			fontSize: '10px', color: this.P.fxAccent, letterSpacing: 4, alpha: 0.6,
		}).setDepth(10);
		this.scoreText = this.add.text(20, 30, '0', {
			fontFamily: "'Courier New', monospace",
			fontSize: '28px', color: this.P.interface, fontStyle: 'bold',
		}).setDepth(10);

		// Level
		this.levelLabel = this.add.text(W - 20, 18, 'SECTOR', {
			fontFamily: "'Courier New', monospace",
			fontSize: '10px', color: this.P.fxAccent, letterSpacing: 4, alpha: 0.6,
		}).setOrigin(1, 0).setDepth(10);
		this.levelText = this.add.text(W - 20, 30, '01', {
			fontFamily: "'Courier New', monospace",
			fontSize: '28px', color: this.P.interface, fontStyle: 'bold',
		}).setOrigin(1, 0).setDepth(10);

		// Shield bar 
		const barW = W - 40, barH = 4, barY = 72;
		// Background track
		this.shieldBg = this.add.graphics().setDepth(10);
		this.shieldBg.fillStyle(0x0f172a, 0.06);
		this.shieldBg.fillRoundedRect(20, barY, barW, barH, 2);

		// Active fill
		this.shieldBar = this.add.graphics().setDepth(10);

		// Label
		this.shieldLabel = this.add.text(20, barY - 16, 'SHIELD', {
			fontFamily: "'Courier New', monospace",
			fontSize: '9px', color: this.P.fxAccent, letterSpacing: 3, alpha: 0.55,
		}).setDepth(10);

		// Shield pips (5 segments)
		this.shieldPips = [];
		for (let i = 0; i < 5; i++) {
			const pipX = 20 + i * ((barW + 4) / 5);
			const pip = this.add.graphics().setDepth(11);
			pip.fillStyle(aCol, 0.2); pip.fillRect(pipX, barY, barW / 5 - 4, barH);
			this.shieldPips.push(pip);
		}

		this._redrawShieldBar();

		// Scrap counter 
		this.scrapLabel = this.add.text(W / 2, 20, 'SCRAP', {
			fontFamily: "'Courier New', monospace",
			fontSize: '9px', color: this.P.fxAccent, letterSpacing: 3, alpha: 0.55,
		}).setOrigin(0.5, 0).setDepth(10);
		this.scrapText = this.add.text(W / 2, 31, '00 / 12', {
			fontFamily: "'Courier New', monospace",
			fontSize: '13px', color: this.P.interface,
		}).setOrigin(0.5, 0).setDepth(10);

		// Shield ACTIVE indicator 
		this.shieldActiveText = this.add.text(W / 2, 86, '◈ SHIELD ACTIVE ◈', {
			fontFamily: "'Courier New', monospace",
			fontSize: '11px', color: this.P.fxAccent, letterSpacing: 2,
		}).setOrigin(0.5, 0).setDepth(10).setAlpha(0);

		// Corner decorations 
		this._drawCornerDecorations();
	}

	_drawCornerDecorations() {
		const W = this.scale.width, H = this.scale.height;
		const deco = this.add.graphics().setDepth(9);
		const ac = Phaser.Display.Color.HexStringToColor(this.P.fxAccent);
		const aCol = Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b);
		deco.lineStyle(1, aCol, 0.3);
		// Top-left L
		deco.beginPath(); deco.moveTo(0, 60); deco.lineTo(0, 0); deco.lineTo(W * 0.12, 0);
		deco.strokePath();
		// Top-right L
		deco.beginPath(); deco.moveTo(W, 60); deco.lineTo(W, 0); deco.lineTo(W * 0.88, 0);
		deco.strokePath();
		// Bottom corners
		deco.lineStyle(1, aCol, 0.15);
		deco.beginPath(); deco.moveTo(0, H - 40); deco.lineTo(0, H); deco.lineTo(W * 0.12, H);
		deco.strokePath();
		deco.beginPath(); deco.moveTo(W, H - 40); deco.lineTo(W, H); deco.lineTo(W * 0.88, H);
		deco.strokePath();

		// Thin horizontal separator under HUD
		deco.lineStyle(1, aCol, 0.12);
		deco.lineBetween(0, 100, W, 100);
	}

	// Shield bubble overlay 
	_buildShieldBubble() {
		this.shieldBubble = this.add.image(0, 0, 'shield_bubble')
			.setDepth(6).setAlpha(0).setBlendMode('ADD');
		this.tweens.add({
			targets: this.shieldBubble,
			alpha: { from: 0.4, to: 0.8 },
			duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
		});
	}

	// Shield bar redraw 
	_redrawShieldBar() {
		const W = this.scale.width;
		const barW = W - 40, barH = 4, barY = 72;
		const ac = Phaser.Display.Color.HexStringToColor(this.P.fxAccent);
		const aCol = Phaser.Display.Color.GetColor(ac.r, ac.g, ac.b);

		this.shieldBar.clear();
		if (this.shield > 0) {
			const fillW = barW * Math.min(this.shield, 1);
			// Glow
			this.shieldBar.fillStyle(aCol, 0.25);
			this.shieldBar.fillRoundedRect(20, barY - 2, fillW, barH + 4, 2);
			// Core
			this.shieldBar.fillStyle(aCol, this.shieldFull ? 1 : 0.75);
			this.shieldBar.fillRoundedRect(20, barY, fillW, barH, 2);
		}
		// Pips
		const pct = Math.min(this.shield, 1);
		this.shieldPips.forEach((pip, i) => {
			pip.clear();
			const threshold = (i + 1) / 5;
			const alpha = pct >= threshold ? 0.7 : 0.15;
			const pipX = 20 + i * ((barW + 4) / 5);
			pip.fillStyle(Phaser.Display.Color.HexStringToColor(this.P.fxAccent).color, alpha);
			pip.fillRect(pipX, barY, (barW / 5) - 4, barH);
		});
	}

	// Spawn asteroid 
	_spawnAsteroid() {
		if (!this.alive || this.levelingUp) return;
		const W = this.scale.width;
		const keys = ['asteroid_sm', 'asteroid_md', 'asteroid_lg'];
		// Bias toward smaller at low levels
		const roll = Math.random();
		const key = roll < 0.5 ? keys[0] : roll < 0.8 ? keys[1] : keys[2];

		const x = Phaser.Math.Between(24, W - 24);
		const ast = this.asteroids.create(x, -50, key)
			.setDepth(4);
		ast.body.setVelocityY(this.speed * (0.7 + Math.random() * 0.6));
		ast.body.setVelocityX(Phaser.Math.Between(-40, 40));
		ast.body.setAllowGravity(false);

		// Spin
		const spin = Phaser.Math.Between(-80, 80);
		this.tweens.add({ targets: ast, angle: ast.angle + spin * 10, duration: 10000, repeat: -1 });

		// Extra asteroids per level
		if (this.level >= 3) {
			const extra = Math.min(this.level - 2, 3);
			for (let e = 0; e < extra; e++) {
				this.time.delayedCall(Phaser.Math.Between(80, 280) * (e + 1), () => {
					if (!this.alive || this.levelingUp) return;
					const ast2 = this.asteroids.create(
						Phaser.Math.Between(24, W - 24), -50,
						keys[Math.floor(Math.random() * keys.length)]
					).setDepth(4);
					ast2.body.setVelocityY(this.speed * (0.8 + Math.random() * 0.5));
					ast2.body.setVelocityX(Phaser.Math.Between(-60, 60));
					ast2.body.setAllowGravity(false);
					this.tweens.add({ targets: ast2, angle: 360, duration: 5000 + Math.random() * 3000, repeat: -1 });
				});
			}
		}
	}

	// Spawn scrap 
	_spawnScrap() {
		if (!this.alive || this.levelingUp) return;
		const W = this.scale.width;
		const x = Phaser.Math.Between(24, W - 24);

		// Glow behind scrap
		const glow = this.add.image(x, -30, 'scrap_glow').setAlpha(0.6).setBlendMode('ADD').setDepth(3);
		const scrap = this.scraps.create(x, -30, 'scrap').setDepth(3);
		scrap.body.setVelocityY(this.speed * 0.65);
		scrap.body.setAllowGravity(false);
		scrap._glow = glow;

		// Float animation
		this.tweens.add({ targets: [scrap, glow], x: x + Phaser.Math.Between(-30, 30), duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
		this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.9 }, duration: 600, yoyo: true, repeat: -1 });
		this.tweens.add({ targets: scrap, angle: 360, duration: 2000 + Math.random() * 1000, repeat: -1 });
	}

	// Collect scrap 
	_collectScrap(ship, scrap) {
		this.collectEmitter.explode(10, scrap.x, scrap.y);
		if (scrap._glow) scrap._glow.destroy();
		scrap.destroy();

		SFX.collect();
		this.score += 50 * this.level;
		this.scrapCount++;
		this.shield = Math.min(this.shield + 0.2, 1);

		if (!this.shieldFull && this.shield >= 1) {
			this.shieldFull = true;
			SFX.shieldFull();
			this._flashShieldActive();
		}

		this._redrawShieldBar();
		this._updateHUD();

		// Floating +score text
		const floatTxt = this.add.text(scrap.x, scrap.y, `+${50 * this.level}`, {
			fontFamily: "'Courier New', monospace",
			fontSize: '13px', color: this.P.fxAccent,
		}).setOrigin(0.5).setDepth(15);
		this.tweens.add({ targets: floatTxt, y: scrap.y - 50, alpha: 0, duration: 700, onComplete: () => floatTxt.destroy() });

		// Level check
		if (this.scrapCount >= this.scrapPerLevel) {
			this._triggerLevelUp();
		}
	}

	_flashShieldActive() {
		this.tweens.killTweensOf(this.shieldActiveText);
		this.shieldActiveText.setAlpha(1);
		this.tweens.add({ targets: this.shieldActiveText, alpha: 0, duration: 2000, delay: 1500 });
	}

	// Hit asteroid 
	_hitAsteroid(ship, asteroid) {
		if (this.invincible || this.levelingUp) return;

		asteroid.destroy();

		if (this.shieldFull) {
			// Shield absorbs
			SFX.shieldHit();
			this.shieldEmitter.explode(16, ship.x, ship.y);
			this.shield = 0;
			this.shieldFull = false;
			this._redrawShieldBar();
			this._updateHUD();
			this.shieldActiveText.setAlpha(0);

			// Invincibility frames
			this.invincible = true;
			this.invincibleTimer = 1200;

			// Shake + flash
			this.cameras.main.shake(200, 0.012);
			this.tweens.add({ targets: this.ship, alpha: 0.3, duration: 80, yoyo: true, repeat: 5, onComplete: () => this.ship.setAlpha(1) });
		} else {
			// Game over
			this._doGameOver(ship.x, ship.y);
		}
	}

	// Game over 
	// Game over 
	_doGameOver(x, y) {
		this.alive = false;
		this.asteroidTimer.remove();
		this.scrapTimer.remove();
		this.scoreTimer.remove();
		this._thrusterSfx.stop();
		this.flameEmitter.stop();

		SFX.explosion();
		this.impactEmitter.explode(30, x, y);
		this.cameras.main.shake(600, 0.035);
		this.cameras.main.flash(400, 255, 80, 0, false);

		this.ship.setVisible(false);

		if (!this.revived) {
			this.revived = true;
			this.time.delayedCall(900, () => {
				const W = this.scale.width, H = this.scale.height;
				const cx = W / 2, cy = H / 2;
				const rBg = this.add.graphics().setDepth(200);
				rBg.fillStyle(0xf8fafc, 1);
				rBg.fillRoundedRect(cx - 150, cy - 80, 300, 160, 12);
				rBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(this.P.playerCore).color, 1);
				rBg.strokeRoundedRect(cx - 150, cy - 80, 300, 160, 12);

				const rTxt = this.add.text(cx, cy - 40, 'SECOND CHANCE?', {
					fontFamily: "'Courier New', monospace", fontSize: '20px', color: this.P.playerCore
				}).setOrigin(0.5).setDepth(201);

				const btnRevive = this.add.text(cx - 70, cy + 30, 'WATCH AD\nTO REVIVE', {
					fontFamily: "'Courier New', monospace", fontSize: '14px', color: '#000', align: 'center',
					backgroundColor: this.P.playerCore, padding: {x: 10, y: 10}
				}).setOrigin(0.5).setDepth(201).setInteractive({useHandCursor: true});

				const btnSkip = this.add.text(cx + 70, cy + 30, 'SKIP', {
					fontFamily: "'Courier New', monospace", fontSize: '16px', color: '#0f172a',
					backgroundColor: '#f8fafc', padding: {x: 20, y: 16}
				}).setOrigin(0.5).setDepth(201).setInteractive({useHandCursor: true});

				const cleanUp = () => {
					rBg.destroy(); rTxt.destroy(); btnRevive.destroy(); btnSkip.destroy();
				};

				btnSkip.on('pointerdown', () => {
					cleanUp();
					window.FreshPlay.gameOver(this.score);
					this.scene.start('GameOver', { score: this.score, level: this.level });
				});

				btnRevive.on('pointerdown', () => {
					cleanUp();
					const doRevive = () => {
						// Revive
						this.alive = true;
						this.ship.setVisible(true);
						this.asteroids.clear(true, true);
						
						this.asteroidTimer = this.time.addEvent({
							delay: this.asteroidRate, callback: this._spawnAsteroid, callbackScope: this, loop: true
						});
						this.scrapTimer = this.time.addEvent({
							delay: 1200, callback: this._spawnScrap, callbackScope: this, loop: true
						});
						this.scoreTimer = this.time.addEvent({
							delay: 100, callback: () => { if (this.alive && !this.levelingUp) this.score += Math.floor(this.level * 1.5); },
							callbackScope: this, loop: true
						});
						this.flameEmitter.start();
						this._thrusterSfx = SFX.thruster();
						
						// Invincibility
						this.isShielded = true;
						this.ship.setAlpha(0.6);
						this.time.delayedCall(2000, () => {
							this.isShielded = false;
							if (this.alive) this.ship.setAlpha(1);
						});
					};

					if (window.FreshPlay && typeof window.FreshPlay.showVideoAd === 'function') {
						window.FreshPlay.showVideoAd(doRevive);
					} else {
						doRevive();
					}
				});
			});
			return;
		}

		this.time.delayedCall(900, () => {
			window.FreshPlay.gameOver(this.score);
			this.scene.start('GameOver', { score: this.score, level: this.level });
		});
	}

	// Level up 
	_triggerLevelUp() {
		if (this.levelingUp) return;
		this.levelingUp = true;
		this.scrapCount = 0;
		this.level++;

		SFX.levelUp();
		this.cameras.main.flash(500, 0, 200, 255, false);

		// Show level banner
		const W = this.scale.width, H = this.scale.height;
		const banner = this.add.text(W / 2, H / 2, `SECTOR ${String(this.level).padStart(2, '0')}`, {
			fontFamily: "'Courier New', monospace",
			fontSize: '38px', color: this.P.fxAccent,
			fontStyle: 'bold', letterSpacing: 8,
		}).setOrigin(0.5).setDepth(30).setAlpha(0);
		const sub = this.add.text(W / 2, H / 2 + 48, 'DENSITY INCREASING', {
			fontFamily: "'Courier New', monospace",
			fontSize: '12px', color: this.P.interface,
			letterSpacing: 4, alpha: 0.7,
		}).setOrigin(0.5).setDepth(30).setAlpha(0);

		this.tweens.add({ targets: [banner, sub], alpha: 1, duration: 300 });
		this.tweens.add({ targets: [banner, sub], alpha: 0, duration: 400, delay: 1400, onComplete: () => { banner.destroy(); sub.destroy(); } });

		window.FreshPlay.levelComplete(() => {
			this.time.delayedCall(1800, () => {
				// Ramp up difficulty
				this.speed = Math.min(this.speed + 28, 650);
				this.asteroidRate = Math.max(this.asteroidRate - 80, 450);
				this.scrapPerLevel = Math.min(this.scrapPerLevel + 2, 20);

				this.asteroidTimer.delay = this.asteroidRate;
				this.levelingUp = false;
				this._updateHUD();
			});
		});
	}

	// Update HUD 
	_updateHUD() {
		this.scoreText.setText(String(this.score).padStart(6, '0'));
		this.levelText.setText(String(this.level).padStart(2, '0'));
		this.scrapText.setText(`${String(this.scrapCount).padStart(2, '0')} / ${this.scrapPerLevel}`);
	}

	// Cleanup off-screen objects 
	_cleanupOffscreen() {
		const H = this.scale.height;
		this.asteroids.getChildren().forEach(a => { if (a.y > H + 80) a.destroy(); });
		this.scraps.getChildren().forEach(s => {
			if (s.y > H + 80) {
				if (s._glow) s._glow.destroy();
				s.destroy();
			}
		});
	}

	// Update 
	update(time, delta) {
		delta = Math.min(delta || 16.6, 33.3);
		if (!this.alive) return;
		const dt = delta / 1000;

		// Invincibility countdown
		if (this.invincible) {
			this.invincibleTimer -= delta;
			if (this.invincibleTimer <= 0) this.invincible = false;
		}

		// Ship movement 
		const spd = 420;
		let vx = 0, vy = 0;

		if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -spd;
		if (this.cursors.right.isDown || this.wasd.right.isDown) vx = spd;
		if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -spd;
		if (this.cursors.down.isDown || this.wasd.down.isDown) vy = spd;

		// Touch/pointer control
		if (this.pointer.active) {
			const dx = this.pointer.x - this.ship.x;
			const dy = this.pointer.y - this.ship.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > 12) {
				const norm = Math.min(dist / 80, 1);
				vx = (dx / dist) * spd * norm;
				vy = (dy / dist) * spd * norm;
			}
		}

		this.ship.setVelocity(vx, vy);

		// Tilt ship based on horizontal movement
		const targetAngle = vx * 0.035;
		this.ship.rotation = Phaser.Math.Linear(this.ship.rotation, targetAngle, 0.12);

		// Shield bubble follows ship 
		this.shieldBubble.setPosition(this.ship.x, this.ship.y + 4);
		this.shieldBubble.setAlpha(this.shieldFull ? (this.shieldBubble.alpha) : 0);

		// Parallax scrolling 
		this.starLayers.forEach(layer => {
			layer.stars.forEach(star => {
				star.y += this.speed * layer.speed * dt;
				if (star.y > this.scale.height + 10) {
					star.y = -10;
					star.x = Phaser.Math.Between(0, this.scale.width);
				}
			});
		});

		// Scroll glow objects with asteroids 
		// (handled by physics velocities)

		// Distance score 
		this.distanceTravelled += this.speed * dt;

		// Cleanup 
		this._cleanupOffscreen();

		// Sync glow images with scraps 
		this.scraps.getChildren().forEach(s => {
			if (s._glow) s._glow.setVelocity?.(s.body.velocity.x, s.body.velocity.y);
		});

		// HUD update 
		this._updateHUD();
	}
}

// ═══════════════════════════════════════════════════════════════
//  SCENE: GameOver
// ═══════════════════════════════════════════════════════════════
class GameOverScene extends Phaser.Scene {
	constructor() { super('GameOver'); }

	init(data) {
		this.finalScore = data.score || 0;
		this.finalLevel = data.level || 1;
	}

	create() {
		const W = this.scale.width, H = this.scale.height;
		const P = window.FreshPlay.getCurrentPalette();
		const ac = P.fxAccent;
		const ic = P.interface;

		// Dim overlay
		this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(20);

		// Glowing panel
		const panel = this.add.graphics().setDepth(21);
		const panW = Math.min(W - 40, 360), panH = 260, panX = (W - panW) / 2, panY = (H - panH) / 2;
		panel.fillStyle(0x000a1a, 0.95); panel.fillRoundedRect(panX, panY, panW, panH, 12);
		panel.lineStyle(1, Phaser.Display.Color.HexStringToColor(ac).color, 0.7);
		panel.strokeRoundedRect(panX, panY, panW, panH, 12);
		// Glow border
		panel.lineStyle(6, Phaser.Display.Color.HexStringToColor(ac).color, 0.12);
		panel.strokeRoundedRect(panX - 2, panY - 2, panW + 4, panH + 4, 13);

		// Title
		this.add.text(W / 2, panY + 32, 'SHIP DESTROYED', {
			fontFamily: "'Courier New', monospace",
			fontSize: '18px', color: '#ff4757', letterSpacing: 6,
		}).setOrigin(0.5).setDepth(22);

		// Separator
		const sepG = this.add.graphics().setDepth(22);
		sepG.lineStyle(1, Phaser.Display.Color.HexStringToColor(ac).color, 0.3);
		sepG.lineBetween(panX + 20, panY + 54, panX + panW - 20, panY + 54);

		// Score
		this.add.text(W / 2, panY + 76, 'SCORE', {
			fontFamily: "'Courier New', monospace",
			fontSize: '10px', color: ac, letterSpacing: 4, alpha: 0.6,
		}).setOrigin(0.5).setDepth(22);
		this.add.text(W / 2, panY + 92, String(this.finalScore).padStart(6, '0'), {
			fontFamily: "'Courier New', monospace",
			fontSize: '36px', color: ic, fontStyle: 'bold',
		}).setOrigin(0.5).setDepth(22);

		// Level reached
		this.add.text(W / 2, panY + 144, `SECTOR ${String(this.finalLevel).padStart(2, '0')} REACHED`, {
			fontFamily: "'Courier New', monospace",
			fontSize: '11px', color: ac, letterSpacing: 3, alpha: 0.7,
		}).setOrigin(0.5).setDepth(22);

		// Restart prompt
		const restart = this.add.text(W / 2, panY + panH - 36, '[ PRESS SPACE OR TAP TO RETRY ]', {
			fontFamily: "'Courier New', monospace",
			fontSize: '10px', color: ic, letterSpacing: 2,
		}).setOrigin(0.5).setDepth(22);
		this.tweens.add({ targets: restart, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

		// Input
		this.input.keyboard.once('keydown-SPACE', () => this._restart());
		this.input.keyboard.once('keydown-ENTER', () => this._restart());
		this.input.once('pointerdown', () => this._restart());
	}

	_restart() {
		this.cameras.main.fade(300, 0, 0, 0);
		this.time.delayedCall(320, () => this.scene.start('Game'));
	}
}

// ═══════════════════════════════════════════════════════════════
//  Phaser config + launch
// ═══════════════════════════════════════════════════════════════
const config = {
	type: Phaser.AUTO,
	width: 390,
	height: 700,
	backgroundColor: '#f8fafc',
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		parent: document.body,
	},
	physics: {
		default: 'arcade',
		arcade: { gravity: { y: 0 }, debug: false },
	},
	scene: [BootScene, GameScene, GameOverScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
};

window.__spaceScavengerGame = new Phaser.Game(config);
