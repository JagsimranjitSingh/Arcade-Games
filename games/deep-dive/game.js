// ============================================================
//  DEEP DIVE 
// ============================================================

// ---------------------------------------------------------------------------
// Safe FreshPlay shim – works whether the host injects the real object or not
// ---------------------------------------------------------------------------
window.FreshPlay = window.FreshPlay || {
	getCurrentPalette: () => ({
		background: '#020c18',
		playerCore: '#00e5ff',
		fxAccent: '#39ff14',
		hostile: '#ff3c3c',
		interface: '#e0f7ff',
	}),
	levelComplete: (cb) => { console.log('[FreshPlay] levelComplete'); if (cb) cb(); },
	gameOver: (score) => { console.log('[FreshPlay] gameOver', score); },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEPTH_PER_LEVEL = 1000;   // metres per level
const BASE_SCROLL_SPEED = 160;    // px / s
const SPEED_INCREMENT = 30;     // extra px/s per level
const BASE_O2_DRAIN = 8;      // units / s
const O2_DRAIN_INC = 1.5;    // extra units/s per level
const MAX_O2 = 100;
const BASE_SPAWN_RATE = 1800;   // ms between monster spawns
const SPAWN_RATE_DEC = 120;    // ms fewer per level

// ---------------------------------------------------------------------------
// Utility: darken / lighten hex
// ---------------------------------------------------------------------------
function hexLighten(hex, amount) {
	const n = parseInt(hex.replace('#', ''), 16);
	const r = Math.min(255, (n >> 16) + amount);
	const g = Math.min(255, ((n >> 8) & 0xff) + amount);
	const b = Math.min(255, (n & 0xff) + amount);
	return (r << 16 | g << 8 | b) | 0;
}

// ---------------------------------------------------------------------------
// Procedural texture generators (all drawn onto offscreen canvases)
// ---------------------------------------------------------------------------
function generateTextures(scene, pal) {
	//  Submarine
	const subC = scene.textures.createCanvas('submarine', 80, 40);
	const sc = subC.getContext();
	const subCol = pal.playerCore;

	// hull
	sc.fillStyle = subCol;
	sc.beginPath();
	sc.ellipse(40, 20, 72, 26, 0, 0, Math.PI * 2);
	sc.fill();

	// conning tower
	sc.fillStyle = subCol;
	sc.fillRect(28, 4, 18, 12);
	sc.beginPath();
	sc.arc(37, 4, 9, Math.PI, 0);
	sc.fill();

	// periscope
	sc.strokeStyle = subCol;
	sc.lineWidth = 2;
	sc.beginPath();
	sc.moveTo(44, 4);
	sc.lineTo(44, -2);
	sc.lineTo(50, -2);
	sc.stroke();

	// porthole
	sc.strokeStyle = '#fff';
	sc.lineWidth = 2;
	sc.beginPath();
	sc.arc(50, 20, 7, 0, Math.PI * 2);
	sc.stroke();
	sc.fillStyle = 'rgba(150,240,255,0.4)';
	sc.fill();

	// propeller blades
	sc.fillStyle = hexLighten(subCol, 40).toString(16).padStart(6, '0');
	sc.fillStyle = subCol;
	for (let i = 0; i < 3; i++) {
		sc.save();
		sc.translate(8, 20);
		sc.rotate((Math.PI * 2 / 3) * i);
		sc.fillStyle = 'rgba(0,229,255,0.7)';
		sc.beginPath();
		sc.ellipse(0, -8, 3, 8, 0, 0, Math.PI * 2);
		sc.fill();
		sc.restore();
	}

	// glow overlay
	const glowSub = sc.createRadialGradient(40, 20, 2, 40, 20, 36);
	glowSub.addColorStop(0, 'rgba(0,229,255,0.18)');
	glowSub.addColorStop(1, 'rgba(0,229,255,0)');
	sc.fillStyle = glowSub;
	sc.fillRect(0, 0, 80, 40);
	subC.refresh();

	//  Oxygen Bubble
	const bubC = scene.textures.createCanvas('bubble', 36, 36);
	const bc = bubC.getContext();
	const bg = bc.createRadialGradient(14, 14, 2, 18, 18, 16);
	bg.addColorStop(0, 'rgba(255,255,255,0.9)');
	bg.addColorStop(0.3, pal.fxAccent + 'cc');
	bg.addColorStop(1, pal.fxAccent + '00');
	bc.fillStyle = bg;
	bc.beginPath();
	bc.arc(18, 18, 16, 0, Math.PI * 2);
	bc.fill();
	// shimmer
	bc.fillStyle = 'rgba(255,255,255,0.5)';
	bc.beginPath();
	bc.ellipse(13, 12, 4, 6, -0.5, 0, Math.PI * 2);
	bc.fill();
	bubC.refresh();

	//  Rock Formation
	const rockC = scene.textures.createCanvas('rock', 100, 120);
	const rc = rockC.getContext();
	rc.fillStyle = '#1a2a3a';
	rc.beginPath();
	rc.moveTo(50, 0);
	rc.lineTo(95, 60);
	rc.lineTo(100, 120);
	rc.lineTo(0, 120);
	rc.lineTo(5, 60);
	rc.closePath();
	rc.fill();
	// edge glow
	rc.strokeStyle = 'rgba(0,100,160,0.5)';
	rc.lineWidth = 3;
	rc.stroke();
	// mossy highlight
	rc.fillStyle = 'rgba(0,80,120,0.3)';
	rc.beginPath();
	rc.moveTo(50, 5);
	rc.lineTo(80, 55);
	rc.lineTo(20, 55);
	rc.closePath();
	rc.fill();
	rockC.refresh();

	//  Sea Monster
	const monC = scene.textures.createCanvas('monster', 130, 90);
	const mc = monC.getContext();
	// body
	const mg = mc.createRadialGradient(65, 45, 5, 65, 45, 50);
	mg.addColorStop(0, pal.hostile + 'ee');
	mg.addColorStop(0.6, pal.hostile + '99');
	mg.addColorStop(1, pal.hostile + '00');
	mc.fillStyle = mg;
	mc.beginPath();
	mc.ellipse(65, 45, 60, 38, 0, 0, Math.PI * 2);
	mc.fill();
	// tentacles
	mc.strokeStyle = pal.hostile + 'bb';
	mc.lineWidth = 4;
	mc.lineCap = 'round';
	const tentacleOffsets = [-40, -25, -10, 10, 25, 40];
	tentacleOffsets.forEach((ox, i) => {
		mc.beginPath();
		mc.moveTo(65 + ox, 75);
		mc.bezierCurveTo(
			65 + ox + (i % 2 === 0 ? -12 : 12), 88,
			65 + ox + (i % 2 === 0 ? 10 : -10), 95,
			65 + ox + (i % 2 === 0 ? -6 : 6), 105
		);
		mc.stroke();
	});
	// eye
	mc.fillStyle = '#fff';
	mc.beginPath();
	mc.arc(80, 38, 10, 0, Math.PI * 2);
	mc.fill();
	mc.fillStyle = '#000';
	mc.beginPath();
	mc.arc(82, 38, 6, 0, Math.PI * 2);
	mc.fill();
	mc.fillStyle = 'rgba(255,60,60,0.8)';
	mc.beginPath();
	mc.arc(83, 37, 3, 0, Math.PI * 2);
	mc.fill();
	// bioluminescent spots
	['rgba(255,100,100,0.7)', 'rgba(255,60,60,0.5)', 'rgba(255,150,80,0.4)'].forEach((col, i) => {
		mc.fillStyle = col;
		mc.beginPath();
		mc.arc(40 + i * 14, 50 + (i % 2) * 8, 4 - i, 0, Math.PI * 2);
		mc.fill();
	});
	monC.refresh();

	//  Particle (bubble pop, thruster)
	const ptC = scene.textures.createCanvas('particle', 12, 12);
	const pc = ptC.getContext();
	const pg = pc.createRadialGradient(6, 6, 0, 6, 6, 6);
	pg.addColorStop(0, '#ffffff');
	pg.addColorStop(1, 'rgba(255,255,255,0)');
	pc.fillStyle = pg;
	pc.beginPath();
	pc.arc(6, 6, 6, 0, Math.PI * 2);
	pc.fill();
	ptC.refresh();

	//  Background layer tiles
	// Deep water gradient tile (256×256, tiling vertically)
	const bgC = scene.textures.createCanvas('bg_tile', 256, 256);
	const bgCtx = bgC.getContext();
	const bgGrad = bgCtx.createLinearGradient(0, 0, 0, 256);
	bgGrad.addColorStop(0, pal.background);
	bgGrad.addColorStop(1, '#000d18');
	bgCtx.fillStyle = bgGrad;
	bgCtx.fillRect(0, 0, 256, 256);
	// subtle caustic lines
	bgCtx.strokeStyle = 'rgba(0,80,140,0.07)';
	bgCtx.lineWidth = 1;
	for (let y = 0; y < 256; y += 18) {
		bgCtx.beginPath();
		bgCtx.moveTo(0, y);
		for (let x = 0; x <= 256; x += 8) {
			bgCtx.lineTo(x, y + Math.sin(x * 0.08) * 5);
		}
		bgCtx.stroke();
	}
	bgC.refresh();
}

// ---------------------------------------------------------------------------
// Audio engine – procedural Web Audio (no external files needed)
// ---------------------------------------------------------------------------
class AudioEngine {
	constructor() {
		try {
			this.ctx = new (window.AudioContext || window.webkitAudioContext)();
			this.master = this.ctx.createGain();
			this.master.gain.value = 0.35;
			this.master.connect(this.ctx.destination);
			this.ready = true;
		} catch (e) {
			this.ready = false;
		}
		this._ambientNode = null;
	}

	resume() { if (this.ready && this.ctx.state === 'suspended') this.ctx.resume(); }

	// Deep ambient hum
	startAmbient() {
		if (!this.ready || this._ambientNode) return;
		const osc1 = this.ctx.createOscillator();
		const osc2 = this.ctx.createOscillator();
		const lfo = this.ctx.createOscillator();
		const lfoG = this.ctx.createGain();
		const filt = this.ctx.createBiquadFilter();
		const gain = this.ctx.createGain();

		osc1.type = 'sine'; osc1.frequency.value = 55;
		osc2.type = 'sine'; osc2.frequency.value = 82.4;
		lfo.type = 'sine'; lfo.frequency.value = 0.08;
		lfoG.gain.value = 6;
		filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 2;
		gain.gain.value = 0.18;

		lfo.connect(lfoG);
		lfoG.connect(osc1.frequency);
		osc1.connect(filt);
		osc2.connect(filt);
		filt.connect(gain);
		gain.connect(this.master);

		osc1.start(); osc2.start(); lfo.start();
		this._ambientNode = { osc1, osc2, lfo, gain };
	}

	stopAmbient() {
		if (!this._ambientNode) return;
		const { osc1, osc2, lfo, gain } = this._ambientNode;
		gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
		setTimeout(() => { try { osc1.stop(); osc2.stop(); lfo.stop(); } catch (e) { } }, 1000);
		this._ambientNode = null;
	}

	// Radar ping
	playPing() {
		if (!this.ready) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const filt = this.ctx.createBiquadFilter();
		osc.type = 'sine'; osc.frequency.setValueAtTime(880, this.ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.8);
		gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);
		filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 8;
		osc.connect(filt); filt.connect(gain); gain.connect(this.master);
		osc.start(); osc.stop(this.ctx.currentTime + 0.95);
	}

	// Bubble pop (O2 collect)
	playBubblePop() {
		if (!this.ready) return;
		const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
		}
		const src = this.ctx.createBufferSource();
		const filt = this.ctx.createBiquadFilter();
		const gain = this.ctx.createGain();
		filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 3;
		gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
		src.buffer = buf;
		src.connect(filt); filt.connect(gain); gain.connect(this.master);
		src.start();
	}

	// Collision boom
	playExplosion() {
		if (!this.ready) return;
		const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.6, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5) * 0.8;
		}
		const src = this.ctx.createBufferSource();
		const filt = this.ctx.createBiquadFilter();
		const gain = this.ctx.createGain();
		filt.type = 'lowpass'; filt.frequency.value = 300;
		gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);
		src.buffer = buf;
		src.connect(filt); filt.connect(gain); gain.connect(this.master);
		src.start();
	}

	// Level-up chime
	playLevelUp() {
		if (!this.ready) return;
		[523, 659, 784, 1047].forEach((freq, i) => {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			const t = this.ctx.currentTime + i * 0.12;
			osc.type = 'sine'; osc.frequency.value = freq;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
			osc.connect(gain); gain.connect(this.master);
			osc.start(t); osc.stop(t + 0.55);
		});
	}

	// Low O2 warning pulse
	playWarning() {
		if (!this.ready) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth'; osc.frequency.value = 220;
		gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
		osc.connect(gain); gain.connect(this.master);
		osc.start(); osc.stop(this.ctx.currentTime + 0.35);
	}
}

// ===========================================================================
// BOOT SCENE
// ===========================================================================
class BootScene extends Phaser.Scene {
	constructor() { super({ key: 'BootScene' }); }

	create() {
		const pal = window.FreshPlay.getCurrentPalette();
		generateTextures(this, pal);
		this.scene.start('MenuScene');
	}
}

// ===========================================================================
// MENU SCENE
// ===========================================================================
class MenuScene extends Phaser.Scene {
	constructor() { super({ key: 'MenuScene' }); }

	create() {
		const W = this.scale.width, H = this.scale.height;
		const pal = window.FreshPlay.getCurrentPalette();

		// Background
		this.add.image(W / 2, H / 2, 'bg_tile').setDisplaySize(W, H);

		// Animated caustic layer
		this._causticTime = 0;
		const causticGfx = this.add.graphics();
		this._causticGfx = causticGfx;

		// Floating particles
		this._menuParticles = [];
		for (let i = 0; i < 30; i++) {
			const p = this.add.image(
				Phaser.Math.Between(0, W),
				Phaser.Math.Between(0, H),
				'bubble'
			).setScale(Phaser.Math.FloatBetween(0.1, 0.4))
				.setAlpha(Phaser.Math.FloatBetween(0.1, 0.5));
			this._menuParticles.push({ img: p, speed: Phaser.Math.FloatBetween(20, 60) });
		}

		// Title
		const title = this.add.text(W / 2, H * 0.28, 'DEEP DIVE', {
			fontFamily: 'Courier New, monospace',
			fontSize: Math.floor(W * 0.11) + 'px',
			color: pal.interface,
			stroke: pal.playerCore,
			strokeThickness: 2,
			shadow: { offsetX: 0, offsetY: 0, color: pal.playerCore, blur: 30, fill: true },
		}).setOrigin(0.5);

		this.add.text(W / 2, H * 0.42, 'SURVIVE THE ABYSS', {
			fontFamily: 'Courier New, monospace',
			fontSize: Math.floor(W * 0.032) + 'px',
			color: pal.playerCore,
			alpha: 0.7,
			letterSpacing: 6,
		}).setOrigin(0.5);

		// Controls hint
		this.add.text(W / 2, H * 0.52, '← →  STEER    COLLECT O₂    DODGE MONSTERS', {
			fontFamily: 'Courier New, monospace',
			fontSize: Math.floor(W * 0.022) + 'px',
			color: pal.interface,
			alpha: 0.45,
		}).setOrigin(0.5);

		// Start button
		const btnBg = this.add.graphics();
		btnBg.fillStyle(0x003040, 0.85);
		btnBg.fillRoundedRect(W / 2 - 120, H * 0.64 - 28, 240, 56, 12);
		btnBg.lineStyle(1.5, parseInt(pal.playerCore.replace('#', ''), 16), 0.9);
		btnBg.strokeRoundedRect(W / 2 - 120, H * 0.64 - 28, 240, 56, 12);

		const startBtn = this.add.text(W / 2, H * 0.64, 'DESCEND', {
			fontFamily: 'Courier New, monospace',
			fontSize: Math.floor(W * 0.038) + 'px',
			color: pal.playerCore,
		}).setOrigin(0.5).setInteractive({ useHandCursor: true });

		this.tweens.add({ targets: startBtn, alpha: 0.4, yoyo: true, repeat: -1, duration: 900 });

		startBtn.on('pointerdown', () => this.scene.start('GameScene'));
		this.input.keyboard.once('keydown', () => this.scene.start('GameScene'));
	}

	update(_, delta) {
		const W = this.scale.width, H = this.scale.height;
		this._causticTime += delta;
		this._menuParticles.forEach(p => {
			p.img.y -= p.speed * (delta / 1000);
			if (p.img.y < -20) p.img.y = H + 20;
		});
	}
}

// ===========================================================================
// GAME SCENE
// ===========================================================================
class GameScene extends Phaser.Scene {
	constructor() { super({ key: 'GameScene' }); }

	// -------------------------------------------------------------------------
	create() {
		const W = this.scale.width, H = this.scale.height;
		this.W = W; this.H = H;
		this.pal = window.FreshPlay.getCurrentPalette();

		// Audio
		this.audio = new AudioEngine();
		this.audio.resume();
		this.audio.startAmbient();
		this.audio.playPing();

		// State
		this.level = 1;
		this.depth = 0;           // metres descended
		this.o2 = MAX_O2;
		this.scrollSpeed = BASE_SCROLL_SPEED;
		this.o2DrainRate = BASE_O2_DRAIN;
		this.spawnInterval = BASE_SPAWN_RATE;
		this.isDead = false;
		this.isPaused = false;
		this.isLevelingUp = false;
		this.warningPlayed = 0;

		// Background scrolling 
		this._bg1 = this.add.tileSprite(W / 2, H / 2, W, H, 'bg_tile');

		// Ambient particle emitter (rising bubbles)
		this._ambientBubbles = [];
		this._spawnAmbientBubble();

		// Groups 
		this.rocksGroup = this.add.group();
		this.monstersGroup = this.add.group();
		this.bubblesGroup = this.add.group();

		// Submarine 
		this.sub = this.add.image(W / 2, H * 0.42, 'submarine').setDepth(10);
		this._subTilt = 0;  // current tilt angle
		this._propAngle = 0;

		// thruster particles
		this._thrusterParticles = [];

		// Input 
		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({ left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D });

		// Touch / pointer drag
		this._touchX = null;
		this.input.on('pointermove', (ptr) => { if (ptr.isDown) this._touchX = ptr.x; });
		this.input.on('pointerdown', (ptr) => { this._touchX = ptr.x; this.audio.resume(); });
		this.input.on('pointerup', () => { this._touchX = null; });

		// Spawn timers 
		this._monsterTimer = this.time.addEvent({ delay: this.spawnInterval, callback: this._spawnMonster, callbackScope: this, loop: true });
		this._rockTimer = this.time.addEvent({ delay: 1400, callback: this._spawnRock, callbackScope: this, loop: true });
		this._bubbleTimer = this.time.addEvent({ delay: 1200, callback: this._spawnO2Bubble, callbackScope: this, loop: true });
		this._pingTimer = this.time.addEvent({ delay: 3500, callback: () => this.audio.playPing(), callbackScope: this, loop: true });

		// Distortion overlay 
		this._warpTime = 0;
		this._redFlash = this.add.graphics().setDepth(55).setAlpha(0);

		// HUD 
		this._buildHUD();

		// Depth milestone ping 
		this._lastPingDepth = 0;

		// Scanline overlay 
		const slGfx = this.add.graphics().setDepth(60).setAlpha(0.02);
		for (let y = 0; y < H; y += 3) {
			slGfx.lineStyle(1, 0x000000, 1);
			slGfx.lineBetween(0, y, W, y);
		}
	}

	// HUD construction 
	_buildHUD() {
		const W = this.W, H = this.H;
		const pal = this.pal;
		const iCol = parseInt(pal.interface.replace('#', ''), 16);
		const pCol = parseInt(pal.playerCore.replace('#', ''), 16);
		const fCol = parseInt(pal.fxAccent.replace('#', ''), 16);

		// HUD panel BG (left side)
		const hudBg = this.add.graphics().setDepth(40);
		hudBg.fillStyle(0x0d2840, 0.92);
		hudBg.fillRoundedRect(10, 10, 170, 110, 10);
		hudBg.lineStyle(1.5, pCol, 0.95);
		hudBg.strokeRoundedRect(10, 10, 170, 110, 10);

		// Depth label
		this._depthLabel = this.add.text(18, 18, 'DEPTH', {
			fontFamily: 'Courier New, monospace',
			fontSize: '10px',
			color: pal.playerCore,
		}).setDepth(41);

		this._depthText = this.add.text(18, 30, '0 m', {
			fontFamily: 'Courier New, monospace',
			fontSize: '24px',
			color: '#e8f8ff',
		}).setDepth(41);

		// Level
		this._levelText = this.add.text(100, 18, 'LVL 1', {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: pal.playerCore,
		}).setDepth(41);

		// O2 label
		this.add.text(18, 58, 'O₂  OXYGEN', {
			fontFamily: 'Courier New, monospace',
			fontSize: '9px',
			color: pal.fxAccent,
		}).setDepth(41);

		// O2 bar background
		const barX = 18, barY = 70, barW = 144, barH = 10;
		const barBg = this.add.graphics().setDepth(41);
		barBg.fillStyle(0x0d3050, 0.95);
		barBg.fillRoundedRect(barX, barY, barW, barH, 5);
		barBg.lineStyle(1, fCol, 0.7);
		barBg.strokeRoundedRect(barX, barY, barW, barH, 5);

		this._o2BarGfx = this.add.graphics().setDepth(42);
		this._o2BarMeta = { x: barX, y: barY, w: barW, h: barH };

		// O2 percentage text
		this._o2Text = this.add.text(18, 84, '100%', {
			fontFamily: 'Courier New, monospace',
			fontSize: '10px',
			color: pal.fxAccent,
		}).setDepth(42);

		// Score (top right)
		this._scoreHudBg = this.add.graphics().setDepth(40);
		this._scoreHudBg.fillStyle(0x0d2840, 0.92);
		this._scoreHudBg.fillRoundedRect(W - 140, 10, 130, 50, 10);
		this._scoreHudBg.lineStyle(1.5, pCol, 0.95);
		this._scoreHudBg.strokeRoundedRect(W - 140, 10, 130, 50, 10);

		this.add.text(W - 130, 18, 'SCORE', {
			fontFamily: 'Courier New, monospace',
			fontSize: '10px',
			color: pal.playerCore,
		}).setDepth(41);

		this._scoreText = this.add.text(W - 130, 32, '0', {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#e8f8ff',
		}).setDepth(41);

		this._updateO2Bar();
	}

	_updateO2Bar() {
		const { x, y, w, h } = this._o2BarMeta;
		const pct = Math.max(0, this.o2 / MAX_O2);
		const fCol = this.o2 < 25 ? 0xff3c3c : parseInt(this.pal.fxAccent.replace('#', ''), 16);
		this._o2BarGfx.clear();
		this._o2BarGfx.fillStyle(fCol, 0.85);
		this._o2BarGfx.fillRoundedRect(x, y, w * pct, h, 5);
		// glow pulse when low
		if (this.o2 < 25) {
			const glow = 0.3 + 0.3 * Math.sin(Date.now() / 200);
			this._o2BarGfx.fillStyle(fCol, glow);
			this._o2BarGfx.fillRoundedRect(x, y, w * pct, h, 5);
		}
		this._o2Text.setText(Math.ceil(this.o2) + '%');
		if (this.o2 < 25) this._o2Text.setColor('#ff3c3c');
		else this._o2Text.setColor(this.pal.fxAccent);
	}

	// Spawners 
	_spawnMonster() {
		if (this.isLevelingUp || this.isDead) return;
		const W = this.W, H = this.H;
		const fromLeft = Math.random() < 0.5;
		const mon = this.add.image(
			fromLeft ? -80 : W + 80,
			Phaser.Math.Between(H * 0.15, H * 0.85),
			'monster'
		).setDepth(8).setScale(Phaser.Math.FloatBetween(0.6, 1.1));

		if (!fromLeft) mon.setFlipX(true);

		const speed = (this.scrollSpeed * 0.55 + Phaser.Math.Between(20, 50)) * (fromLeft ? 1 : -1);
		mon._vx = speed;
		mon._vy = Phaser.Math.FloatBetween(-40, 40);
		// glow tween
		this.tweens.add({ targets: mon, alpha: 0.6, yoyo: true, repeat: -1, duration: Phaser.Math.Between(400, 900) });
		this.monstersGroup.add(mon);
	}

	_spawnRock() {
		if (this.isLevelingUp || this.isDead) return;
		const W = this.W, H = this.H;
		const side = Math.random() < 0.5;
		const rock = this.add.image(
			side ? Phaser.Math.Between(20, W * 0.3) : Phaser.Math.Between(W * 0.7, W - 20),
			H + 80,
			'rock'
		).setDepth(7).setScale(Phaser.Math.FloatBetween(0.5, 1.3));

		// Capture current speed so rocks don't speed-jump mid-flight
		rock._speed = this.scrollSpeed;
		this.rocksGroup.add(rock);
	}

	_spawnO2Bubble() {
		if (this.isLevelingUp || this.isDead) return;
		const W = this.W, H = this.H;
		const bub = this.add.image(
			Phaser.Math.Between(W * 0.1, W * 0.9),
			H + 30,
			'bubble'
		).setDepth(9).setScale(Phaser.Math.FloatBetween(0.55, 1.05));

		// Lock speed at spawn time; float slightly slower than scroll for a natural look
		bub._speed = this.scrollSpeed * Phaser.Math.FloatBetween(0.75, 1.05);
		const baseScale = bub.scaleX;
		this.tweens.add({ targets: bub, scaleX: baseScale * 1.15, scaleY: baseScale * 1.15, yoyo: true, repeat: -1, duration: 700 + Math.random() * 400 });
		this.bubblesGroup.add(bub);
	}

	_spawnAmbientBubble() {
		const W = this.W, H = this.H;
		for (let i = 0; i < 12; i++) {
			const b = this.add.image(
				Phaser.Math.Between(0, W),
				Phaser.Math.Between(0, H),
				'particle'
			).setScale(Phaser.Math.FloatBetween(0.2, 0.8))
				.setAlpha(Phaser.Math.FloatBetween(0.05, 0.2))
				.setDepth(3);
			this._ambientBubbles.push({ img: b, vy: -Phaser.Math.FloatBetween(15, 50) });
		}
	}

	// Collision helpers 
	_overlaps(a, b, radiusMult = 0.85) {
		// Use average of width and height for non-circular sprites
		const ar = ((a.displayWidth + a.displayHeight) / 4) * radiusMult;
		const br = ((b.displayWidth + b.displayHeight) / 4) * radiusMult;
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy) < ar + br;
	}

	// Level-up sequence 
	_triggerLevelUp() {
		this.isLevelingUp = true;
		this._monsterTimer.paused = true;
		this._rockTimer.paused = true;
		this.audio.playLevelUp();

		const W = this.W, H = this.H;
		const overlay = this.add.graphics().setDepth(60).setAlpha(0);
		overlay.fillStyle(0x00e5ff, 0.12);
		overlay.fillRect(0, 0, W, H);
		this.tweens.add({ targets: overlay, alpha: 1, yoyo: true, duration: 500, onComplete: () => overlay.destroy() });

		const txt = this.add.text(W / 2, H / 2, `DEPTH ${this.level * DEPTH_PER_LEVEL} m\nLEVEL ${this.level + 1}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: Math.floor(W * 0.065) + 'px',
			color: this.pal.playerCore,
			align: 'center',
			stroke: '#000',
			strokeThickness: 2,
		}).setOrigin(0.5).setDepth(70).setAlpha(0);

		this.tweens.add({
			targets: txt, alpha: 1, duration: 400,
			onComplete: () => {
				window.FreshPlay.levelComplete(() => {
					this.tweens.add({
						targets: txt, alpha: 0, duration: 400, delay: 800,
						onComplete: () => {
							txt.destroy();
							this.level++;
							this.scrollSpeed += SPEED_INCREMENT;
							this.o2DrainRate += O2_DRAIN_INC;
							this.spawnInterval = Math.max(600, this.spawnInterval - SPAWN_RATE_DEC);
							this._monsterTimer.reset({ delay: this.spawnInterval, callback: this._spawnMonster, callbackScope: this, loop: true });
							// Rock timer also tightens slightly each level
							const newRockDelay = Math.max(700, 1400 - (this.level - 1) * 80);
							this._rockTimer.reset({ delay: newRockDelay, callback: this._spawnRock, callbackScope: this, loop: true });
							this._monsterTimer.paused = false;
							this._rockTimer.paused = false;
							this.isLevelingUp = false;
							this._levelText.setText('LVL ' + this.level);
						}
					});
				});
			}
		});
	}

	// Game Over
	_triggerGameOver(reason) {
		if (this.isDead) return;
		this.isDead = true;
		this._gameOverReported = false;

		this.audio.stopAmbient();
		this.audio.playExplosion();

		this._monsterTimer.remove();
		this._rockTimer.remove();
		this._bubbleTimer.remove();
		this._pingTimer.remove();

		// flash
		this._redFlash.clear();
		this._redFlash.fillStyle(0xff0000, 0.6);
		this._redFlash.fillRect(0, 0, this.W, this.H);
		this.tweens.add({ targets: this._redFlash, alpha: 0, duration: 800 });

		const score = Math.floor(this.depth);
		const W = this.W, H = this.H;

		const panel = this.add.graphics().setDepth(80);
		panel.fillStyle(0x000d18, 0.92);
		panel.fillRoundedRect(W / 2 - 160, H / 2 - 110, 320, 220, 16);
		panel.lineStyle(1.5, parseInt(this.pal.hostile.replace('#', ''), 16), 0.9);
		panel.strokeRoundedRect(W / 2 - 160, H / 2 - 110, 320, 220, 16);

		this.add.text(W / 2, H / 2 - 80, 'CRUSHED BY THE DEEP', {
			fontFamily: 'Courier New, monospace', fontSize: '14px', color: this.pal.hostile, align: 'center',
		}).setOrigin(0.5).setDepth(81);

		this.add.text(W / 2, H / 2 - 42, `DEPTH REACHED`, {
			fontFamily: 'Courier New, monospace', fontSize: '11px', color: this.pal.playerCore, alpha: 0.6, align: 'center',
		}).setOrigin(0.5).setDepth(81);

		this.add.text(W / 2, H / 2 - 12, `${score} m`, {
			fontFamily: 'Courier New, monospace', fontSize: '38px', color: this.pal.interface, align: 'center',
		}).setOrigin(0.5).setDepth(81);

		this.add.text(W / 2, H / 2 + 38, `LEVEL ${this.level}`, {
			fontFamily: 'Courier New, monospace', fontSize: '14px', color: this.pal.playerCore, align: 'center',
		}).setOrigin(0.5).setDepth(81);

		const restartBtn = this.add.text(W / 2, H / 2 + 80, '[ DIVE AGAIN ]', {
			fontFamily: 'Courier New, monospace', fontSize: '18px', color: this.pal.playerCore, align: 'center',
		}).setOrigin(0.5).setDepth(81).setInteractive({ useHandCursor: true });

		this.tweens.add({ targets: restartBtn, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

		const _doGameOver = () => {
			if (!this._gameOverReported) { this._gameOverReported = true; window.FreshPlay.gameOver(score); }
			this.scene.start('GameScene');
		};

		restartBtn.on('pointerdown', _doGameOver);

		// Also allow keyboard
		this.input.keyboard.once('keydown', _doGameOver);

		// Report after short delay so the splash can show (guarded)
		this.time.delayedCall(1200, () => {
			if (!this._gameOverReported) { this._gameOverReported = true; window.FreshPlay.gameOver(score); }
		});
	}

	// Thruster particles 
	_emitThruster() {
		const sub = this.sub;
		for (let i = 0; i < 2; i++) {
			const p = this.add.image(
				sub.x - 30 + Phaser.Math.Between(-4, 4),
				sub.y + Phaser.Math.Between(-4, 4),
				'particle'
			).setScale(0.4).setAlpha(0.7).setDepth(9);
			this._thrusterParticles.push({ img: p, life: 400, vx: -Phaser.Math.FloatBetween(30, 80), vy: Phaser.Math.FloatBetween(-15, 15) });
		}
	}

	// Main Update 
	update(_, delta) {
		if (this.isDead || this.isLevelingUp) return;
		const dt = delta / 1000;
		const W = this.W, H = this.H;
		this._warpTime += delta;

		// Background scroll
		this._bg1.tilePositionY -= this.scrollSpeed * dt * 0.18;

		// Ambient bubbles
		this._ambientBubbles.forEach(b => {
			b.img.y += b.vy * dt;
			if (b.img.y < -10) {
				b.img.y = H + 10;
				b.img.x = Phaser.Math.Between(0, W);
			}
		});

		// Submarine steering 
		const leftDown = this.cursors.left.isDown || this.wasd.left.isDown;
		const rightDown = this.cursors.right.isDown || this.wasd.right.isDown;
		let moveX = 0;

		if (leftDown) moveX = -1;
		if (rightDown) moveX = 1;
		if (this._touchX !== null) {
			moveX = this._touchX < this.sub.x ? -1 : 1;
			if (Math.abs(this._touchX - this.sub.x) < 8) moveX = 0;
		}

		const subSpeed = 280 + this.level * 15;
		this.sub.x = Phaser.Math.Clamp(this.sub.x + moveX * subSpeed * dt, 36, W - 36);

		// tilt
		const targetTilt = moveX * 0.22;
		this._subTilt += (targetTilt - this._subTilt) * 6 * dt;
		this.sub.rotation = this._subTilt;

		// Thruster
		this._propAngle += delta * 0.02;
		if (Math.random() < 0.4) this._emitThruster();

		// Update thruster particles
		for (let i = this._thrusterParticles.length - 1; i >= 0; i--) {
			const p = this._thrusterParticles[i];
			p.life -= delta;
			p.img.x += p.vx * dt;
			p.img.y += p.vy * dt;
			p.img.setAlpha(Math.max(0, p.life / 400));
			p.img.setScale(0.4 * (p.life / 400));
			if (p.life <= 0) { p.img.destroy(); this._thrusterParticles.splice(i, 1); }
		}

		// Depth & scoring 
		this.depth += this.scrollSpeed * dt * 0.25;
		this._depthText.setText(Math.floor(this.depth) + ' m');
		this._scoreText.setText(Math.floor(this.depth + this.level * 500));

		// Depth ping feedback
		if (Math.floor(this.depth / 100) > this._lastPingDepth) {
			this._lastPingDepth = Math.floor(this.depth / 100);
			if (this._lastPingDepth % 2 === 0) this.audio.playPing();
		}

		// Level threshold
		if (this.depth >= this.level * DEPTH_PER_LEVEL) {
			this._triggerLevelUp();
			return;
		}

		// O2 depletion 
		this.o2 -= this.o2DrainRate * dt;
		this.o2 = Math.max(0, this.o2);
		this._updateO2Bar();

		// Low O2 warning
		if (this.o2 < 25 && this.o2 > 0) {
			const warnTick = Math.floor(this.o2 / 8);
			if (warnTick !== this.warningPlayed) { this.warningPlayed = warnTick; this.audio.playWarning(); }
		}
		if (this.o2 <= 0) { this._triggerGameOver('oxygen'); return; }

		// Move obstacles 
		this.rocksGroup.getChildren().forEach(rock => {
			rock.y -= rock._speed * dt;
			if (rock.y < -120) { rock.destroy(); this.rocksGroup.remove(rock, false, false); }
			if (this._overlaps(this.sub, rock, 0.65)) { this._triggerGameOver('rock'); }
		});

		this.monstersGroup.getChildren().forEach(mon => {
			mon.x += mon._vx * dt;
			mon.y += mon._vy * dt;
			// slight upward drift
			mon.y -= this.scrollSpeed * dt * 0.15;
			if (mon.x < -160 || mon.x > W + 160 || mon.y < -120) {
				mon.destroy(); this.monstersGroup.remove(mon, false, false);
			}
			if (!this.isDead && this._overlaps(this.sub, mon, 0.55)) { this._triggerGameOver('monster'); }
		});

		this.bubblesGroup.getChildren().forEach(bub => {
			bub.y -= bub._speed * dt;
			if (bub.y < -40) { bub.destroy(); this.bubblesGroup.remove(bub, false, false); }
			if (this._overlaps(this.sub, bub, 0.8)) {
				this.audio.playBubblePop();
				this._popBubble(bub.x, bub.y);
				this.o2 = Math.min(MAX_O2, this.o2 + 18);
				bub.destroy();
				this.bubblesGroup.remove(bub, false, false);
			}
		});

		// Warp / depth distortion 
		// subtle screen-edge color flicker at high depth
		if (this.level > 2) {
			const flicker = Math.sin(this._warpTime * 0.003) * 0.04;
			this._bg1.setAlpha(0.92 + flicker);
		}
	}

	// Bubble pop VFX
	_popBubble(x, y) {
		for (let i = 0; i < 8; i++) {
			const angle = (Math.PI * 2 / 8) * i;
			const p = this.add.image(x, y, 'particle')
				.setScale(0.5).setAlpha(0.9).setDepth(12)
				.setTint(parseInt(this.pal.fxAccent.replace('#', ''), 16));
			const spd = Phaser.Math.FloatBetween(60, 130);
			this.tweens.add({
				targets: p,
				x: x + Math.cos(angle) * spd,
				y: y + Math.sin(angle) * spd,
				alpha: 0,
				scaleX: 0,
				scaleY: 0,
				duration: 450,
				ease: 'Quad.Out',
				onComplete: () => p.destroy(),
			});
		}
	}

	// Scene shutdown cleanup
	shutdown() {
		if (this.audio) {
			this.audio.stopAmbient();
			// Close the AudioContext so it doesn't leak across scene restarts
			try { if (this.audio.ctx) this.audio.ctx.close(); } catch (e) { }
		}
	}
}

// ===========================================================================
// Phaser Game config
// ===========================================================================
const config = {
	type: Phaser.AUTO,
	width: window.innerWidth,
	height: window.innerHeight,
	backgroundColor: '#020c18',
	parent: document.body,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	scene: [BootScene, MenuScene, GameScene],
};

// Export for host or run standalone
if (typeof module !== 'undefined' && module.exports) {
	module.exports = config;
} else {
	window.__DeepDiveConfig = config;
	window.addEventListener('DOMContentLoaded', () => {
		new Phaser.Game(config);
	});
}