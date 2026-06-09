// ============================================================
//  NEON RIDER
// ============================================================

/* FreshPlay shim (active only when the real SDK is absent) */
if (!window.FreshPlay) {
	window.FreshPlay = {
		_level: 1,
		getCurrentPalette() {
			const palettes = [
				{ background: '#c4e2f5', playerCore: '#00234f', interface: '#daedf8', fxAccent: '#ff2d78' },
				{ background: '#c4e2f5', playerCore: '#39ff14', interface: '#daedf8', fxAccent: '#ff6600' },
				{ background: '#c4e2f5', playerCore: '#bf00ff', interface: '#daedf8', fxAccent: '#ffdd00' },
				{ background: '#c4e2f5', playerCore: '#00234f', interface: '#daedf8', fxAccent: '#00eaff' },
				{ background: '#c4e2f5', playerCore: '#00234f', interface: '#daedf8', fxAccent: '#a0ff00' },
			];
			return palettes[(Math.floor((this._level - 1) / 5)) % palettes.length];
		},
		levelComplete(cb) { this._level++; if (cb) cb(); },
		gameOver(score) { console.log('Game Over. Score:', score); },
	};
}

// ============================================================
//  ENHANCED AUDIO ENGINE  (Web Audio API)
// ============================================================
const AudioEngine = {
	ctx: null,
	masterGain: null,
	engineNode: null,
	beatNodes: [],
	running: false,

	init() {
		try {
			this.ctx = new (window.AudioContext || window.webkitAudioContext)();
			this.masterGain = this.ctx.createGain();
			this.masterGain.gain.value = 0.55;
			this.masterGain.connect(this.ctx.destination);
		} catch (e) { console.warn('AudioContext unavailable'); }
	},

	start() {
		if (!this.ctx || this.running) return;
		this.running = true;
		if (this.ctx.state === 'suspended') this.ctx.resume();
		this._startEngine();
		this._startBeat();
	},

	stop() {
		if (!this.running) return;
		this.running = false;
		this._stopEngine();
		this._stopBeat();
	},

	setEngineSpeed(t) {   // t 0–1
		if (!this.engineNode) return;
		const freq = 55 + t * 150;
		this.engineNode.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
	},

	playJump() {
		if (!this.ctx || !this.running) return;
		const now = this.ctx.currentTime;
		const o = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		o.type = 'square';
		o.frequency.setValueAtTime(150, now);
		o.frequency.exponentialRampToValueAtTime(600, now + 0.15);
		g.gain.setValueAtTime(0.3, now);
		g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
		o.connect(g); g.connect(this.masterGain);
		o.start(now); o.stop(now + 0.25);
	},

	playDeath() {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const o = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		o.type = 'sawtooth';
		o.frequency.setValueAtTime(440, now);
		o.frequency.exponentialRampToValueAtTime(30, now + 0.8);
		g.gain.setValueAtTime(0.6, now);
		g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
		o.connect(g); g.connect(this.masterGain);
		o.start(now); o.stop(now + 0.9);
	},

	_startEngine() {
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		osc.type = 'sawtooth'; osc.frequency.value = 55;
		g.gain.value = 0.08;
		osc.connect(g); osc.start();
		g.connect(this.masterGain);
		this.engineNode = osc;
		this._engineNodes = [osc, g];
	},

	_stopEngine() {
		(this._engineNodes || []).forEach(n => { try { n.disconnect(); if (n.stop) n.stop(); } catch (_) { } });
		this._engineNodes = [];
		this.engineNode = null;
	},

	_startBeat() {
		if (!this.ctx) return;
		const bpm = 130, interval = 60 / bpm;
		let step = 0;
		const tick = () => {
			if (!this.running) return;
			const now = this.ctx.currentTime;

			// 16th note grid
			if (step % 4 === 0) this._kick(now);

			if (step % 2 === 0 && step % 4 !== 0) this._hihat(now, 0.3);
			else this._hihat(now, 0.05);

			if (step % 16 === 4 || step % 16 === 12) this._snare(now);

			const chords = [36.71, 36.71, 27.50, 32.70]; // D1, D1, A0, C1
			const baseFreq = chords[Math.floor(step / 16) % chords.length];
			const bassFreq = (step % 2 === 0) ? baseFreq : baseFreq * 2;
			this._bass(now, bassFreq);

			if (step % 2 === 0) {
				const arpScale = [146.83, 174.61, 220.00, 293.66]; // D3, F3, A3, D4
				const note = arpScale[Math.floor(step / 2) % arpScale.length];
				this._arp(now, note);
			}

			step++;
			this._beatTimer = setTimeout(tick, (interval / 4) * 1000);
		};
		tick();
	},

	_stopBeat() { clearTimeout(this._beatTimer); },

	_kick(t) {
		const o = this.ctx.createOscillator(), g = this.ctx.createGain();
		o.frequency.setValueAtTime(150, t);
		o.frequency.exponentialRampToValueAtTime(20, t + 0.15);
		g.gain.setValueAtTime(0.8, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		o.connect(g); g.connect(this.masterGain);
		o.start(t); o.stop(t + 0.25);
	},

	_snare(t) {
		const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
		const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
		const flt = this.ctx.createBiquadFilter();
		flt.type = 'highpass'; flt.frequency.value = 1200;
		src.buffer = buf;
		g.gain.setValueAtTime(0.4, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
		src.connect(flt); flt.connect(g); g.connect(this.masterGain);
		src.start(t); src.stop(t + 0.2);
	},

	_hihat(t, vol) {
		const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
		const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
		const flt = this.ctx.createBiquadFilter();
		flt.type = 'highpass'; flt.frequency.value = 8000;
		src.buffer = buf;
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
		src.connect(flt); flt.connect(g); g.connect(this.masterGain);
		src.start(t); src.stop(t + 0.06);
	},

	_bass(t, freq) {
		const o = this.ctx.createOscillator(), g = this.ctx.createGain();
		const flt = this.ctx.createBiquadFilter();
		o.type = 'sawtooth'; o.frequency.value = freq;
		flt.type = 'lowpass';
		flt.frequency.setValueAtTime(800, t);
		flt.frequency.exponentialRampToValueAtTime(100, t + 0.1);
		g.gain.setValueAtTime(0.35, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		o.connect(flt); flt.connect(g); g.connect(this.masterGain);
		o.start(t); o.stop(t + 0.25);
	},

	_arp(t, freq) {
		const o = this.ctx.createOscillator(), g = this.ctx.createGain();
		o.type = 'square'; o.frequency.value = freq;
		g.gain.setValueAtTime(0.05, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
		o.connect(g); g.connect(this.masterGain);
		o.start(t); o.stop(t + 0.15);
	}
};

// ============================================================
//  PHASER 3 SCENE
// ============================================================
class NeonRiderScene extends Phaser.Scene {
	constructor() { super({ key: 'NeonRiderScene' }); }

	// lifecycle
	create() {
		this.W = this.scale.width;
		this.H = this.scale.height;

		this.score = 0;
		this.level = 1;
		this.alive = true;
		this.gameStarted = false;
		this.distanceToNext = 0;
		this.levelDistance = 1800;

		// Physics config 
		this.speedBase = 280;
		this.speed = this.speedBase;
		this.gravityVal = 1000;
		this.jumpForce = -520;

		this.sparks = [];

		this._loadPalette();

		// World graphics layers
		this.bgGraphics = this.add.graphics();
		this.trackGraphics = this.add.graphics();
		this.fxGraphics = this.add.graphics();
		this.trailGraphics = this.add.graphics();
		this.carGraphics = this.add.graphics();
		this.uiGraphics = this.add.graphics();

		this.matter.world.setGravity(0, this.gravityVal / 500);

		// Track segments
		this.segments = [];
		this.worldX = 0;
		this._generateInitialTrack();

		this._createPlayer();

		this.trail = [];

		this._setupInput();
		this._buildUI();
		this._showStartScreen();

		this.scale.on('resize', this._onResize, this);
	}

	update(time, delta) {
		if (!this.gameStarted || !this.alive) return;

		// Safety cap to prevent huge physics jumps
		if (delta > 100) delta = 100;
		const dt = delta / 1000;

		this.score += delta * 0.05 * (this.speed / this.speedBase);

		this.worldX += this.speed * dt;
		this.distanceToNext += this.speed * dt;

		if (this.distanceToNext >= this.levelDistance) {
			this.distanceToNext = 0;
			this._triggerLevelUp();
		}

		// Drive player forward
		const vel = this.player.velocity;
		this.matter.body.setVelocity(this.player, {
			x: this.speed / 60,
			y: vel.y,
		});

		AudioEngine.setEngineSpeed((this.speed - this.speedBase) / 400);

		this._updateTrack();
		this._updateSparks(dt);

		const px = this.W * 0.22, py = this._playerY();
		this.trail.push({ x: px, y: py, t: time });
		if (this.trail.length > 60) this.trail.shift();

		this._renderScene(time);

		if (py > this.H + 80) this._die();

		this._updateHUD();
	}

	// palette
	_loadPalette() {
		const p = window.FreshPlay.getCurrentPalette();
		this.pal = {
			bg: p.background || '#050510',
			core: p.playerCore || '#00f0ff',
			iface: p.interface || '#e0e8ff',
			accent: p.fxAccent || '#ff2d78',
		};
		this.palHex = {
			bg: Phaser.Display.Color.HexStringToColor(this.pal.bg.replace('#', '')),
			core: Phaser.Display.Color.HexStringToColor(this.pal.core.replace('#', '')),
			iface: Phaser.Display.Color.HexStringToColor(this.pal.iface.replace('#', '')),
			accent: Phaser.Display.Color.HexStringToColor(this.pal.accent.replace('#', '')),
		};
	}

	_hexN(hex) { return parseInt(hex.replace('#', ''), 16); }

	// track generation
	_generateInitialTrack() {
		this._addSegment(0, this.H * 0.72, this.W * 0.55);
		let x = this.W * 0.55 + this._gapWidth();
		while (x < this.W * 2.5) {
			const w = this._platformWidth();
			this._addSegment(x, this.H * 0.72, w);
			x += w + this._gapWidth();
		}
	}

	_gapWidth() { return 80 + Math.random() * 60 + (this.level - 1) * 8; }
	_platformWidth() { return 160 + Math.random() * 120 - (this.level - 1) * 4; }

	_addSegment(x, y, w) {
		// Ground is 40px thick to prevent tunneling, but visually drawn as 18px
		const h = 40;
		const body = this.matter.add.rectangle(x + w / 2, y + h / 2, w, h, {
			isStatic: true,
			label: 'ground',
			friction: 0.01,
			restitution: 0,
		});
		this.segments.push({ body, x, y, w, visualH: 18, screenX: x });
		return { body, x, y, w };
	}

	_updateTrack() {
		const scroll = this.worldX;
		this.segments = this.segments.filter(s => {
			s.screenX = s.x - scroll;
			if (s.screenX + s.w < -100) {
				this.matter.world.remove(s.body);
				return false;
			}
			return true;
		});

		let rightmost = -Infinity;
		this.segments.forEach(s => { if (s.x + s.w > rightmost) rightmost = s.x + s.w; });

		while (rightmost < scroll + this.W + 400) {
			const gap = this._gapWidth();
			const w = this._platformWidth();
			const x = rightmost + gap;
			this._addSegment(x, this.H * 0.72, w);
			rightmost = x + w;
		}
	}

	// player
	_createPlayer() {
		const sx = this.W * 0.22, sy = this.H * 0.55;
		this.player = this.matter.add.rectangle(sx, sy, 32, 16, {
			label: 'player',
			frictionAir: 0.015,
			friction: 0.1,    // Good friction to stick to tracks
			restitution: 0.0, // No bouncing
			density: 0.05,    // Heavy enough to resist tunneling
		});
		this.matter.body.setInertia(this.player, Infinity);
	}

	_playerY() {
		return this.player.position.y;
	}

	// input
	_setupInput() {
		// Jump on tap anywhere
		this.input.on('pointerdown', () => {
			if (!this.gameStarted) { this._startGame(); return; }
			if (!this.alive) return;
			this._doJump();
		});

		this.input.keyboard.on('keydown-SPACE', () => {
			if (!this.gameStarted) { this._startGame(); return; }
			if (this.alive) this._doJump();
		});
	}

	_doJump() {
		const vy = this.player.velocity.y;
		// Only allow jump near ground
		if (Math.abs(vy) < 4) {
			this.matter.body.setVelocity(this.player, {
				x: this.player.velocity.x,
				y: this.jumpForce / 60,
			});
			this._spawnSparks(this.W * 0.22, this._playerY(), 6, this.pal.core);
			AudioEngine.playJump();
		}
	}

	// sparks
	_spawnSparks(x, y, n, col) {
		for (let i = 0; i < n; i++) {
			const ang = Math.random() * Math.PI * 2;
			const spd = 80 + Math.random() * 200;
			this.sparks.push({
				x, y,
				vx: Math.cos(ang) * spd,
				vy: Math.sin(ang) * spd - 60,
				life: 0.4 + Math.random() * 0.4,
				maxLife: 0.4 + Math.random() * 0.4,
				col,
				size: 2 + Math.random() * 3,
			});
		}
	}

	_updateSparks(dt) {
		this.sparks = this.sparks.filter(s => {
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.vy += 400 * dt;
			s.life -= dt;
			return s.life > 0;
		});
	}

	// rendering
	_renderScene(time) {
		const W = this.W, H = this.H;
		const scroll = this.worldX;
		const core = this._hexN(this.pal.core);
		const iface = this._hexN(this.pal.iface);
		const bg = this._hexN(this.pal.bg);

		this.bgGraphics.clear();
		this.bgGraphics.fillStyle(bg, 1);
		this.bgGraphics.fillRect(0, 0, W, H);

		this.bgGraphics.lineStyle(1, iface, 0.025);
		for (let y = 0; y < H; y += 6) {
			this.bgGraphics.strokeRect(0, y, W, 0);
		}

		this.bgGraphics.lineStyle(1, core, 0.06);
		const gSize = 80;
		const offX = (scroll * 0.3) % gSize;
		for (let x = -offX; x < W + gSize; x += gSize) {
			this.bgGraphics.lineBetween(x, H * 0.5, x, H);
		}
		for (let y = H * 0.5; y <= H; y += gSize) {
			this.bgGraphics.lineBetween(0, y, W, y);
		}

		this.bgGraphics.fillGradientStyle(core, core, bg, bg, 0.0, 0.0, 0.18, 0);
		this.bgGraphics.fillRect(0, H * 0.45, W, H * 0.2);

		this.trackGraphics.clear();
		this.segments.forEach(s => {
			const sx = s.x - scroll;
			this.trackGraphics.fillStyle(iface, 0.06);
			this.trackGraphics.fillRect(sx, s.y + s.visualH, s.w, 12);
			this.trackGraphics.fillStyle(iface, 0.9);
			this.trackGraphics.fillRect(sx, s.y, s.w, s.visualH);
			this.trackGraphics.fillStyle(0x00234f, 0.5);
			this.trackGraphics.fillRect(sx, s.y, s.w, 2);
			this.trackGraphics.fillStyle(core, 0.4);
			this.trackGraphics.fillRect(sx, s.y + s.visualH - 2, s.w, 3);
		});

		this.fxGraphics.clear();
		this.sparks.forEach(s => {
			const a = s.life / s.maxLife;
			this.fxGraphics.fillStyle(this._hexN(s.col), a);
			this.fxGraphics.fillCircle(s.x, s.y, s.size * a);
		});

		this.trailGraphics.clear();
		const px = W * 0.22, py = this._playerY();
		for (let i = 1; i < this.trail.length; i++) {
			const tp = this.trail[i];
			const tpPrev = this.trail[i - 1];
			const a = (i / this.trail.length) * 0.7;
			const w = (i / this.trail.length) * 5;
			this.trailGraphics.lineStyle(w, core, a);
			this.trailGraphics.lineBetween(tpPrev.x, tpPrev.y, tp.x, tp.y);
		}

		this._drawCar(px, py, time);
	}

	// PREMIUM CAR REDESIGN
	_drawCar(cx, cy, time) {
		const g = this.carGraphics;
		g.clear();
		const core = this._hexN(this.pal.core);
		const iface = this._hexN(this.pal.iface);
		const accent = this._hexN(this.pal.accent);
		const pulse = 0.8 + 0.2 * Math.sin(time * 0.015);

		// Massive ambient glow
		g.fillStyle(core, 0.05 * pulse);
		g.fillEllipse(cx, cy, 110, 40);
		g.fillStyle(accent, 0.08 * pulse);
		g.fillEllipse(cx - 15, cy, 60, 30);

		// --- Rear Wheel (Thick Neon Core) ---
		g.fillStyle(0x000000, 1);
		g.fillCircle(cx - 15, cy + 5, 11);
		g.lineStyle(4, accent, pulse);
		g.strokeCircle(cx - 15, cy + 5, 11);
		g.fillStyle(accent, 1);
		g.fillCircle(cx - 15, cy + 5, 3); // Hub

		// --- Front Wheel (Sleek Cyan) ---
		g.fillStyle(0x000000, 1);
		g.fillCircle(cx + 17, cy + 5, 11);
		g.lineStyle(3, core, 1);
		g.strokeCircle(cx + 17, cy + 5, 11);
		g.fillStyle(core, 1);
		g.fillCircle(cx + 17, cy + 5, 3); // Hub

		// --- Chassis Main Frame ---
		g.fillStyle(0x111118, 1);
		g.beginPath();
		g.moveTo(cx - 15, cy + 5);
		g.lineTo(cx - 5, cy - 7);
		g.lineTo(cx + 12, cy - 7);
		g.lineTo(cx + 17, cy + 5);
		g.lineTo(cx + 5, cy + 9);
		g.lineTo(cx - 5, cy + 9);
		g.closePath();
		g.fillPath();

		// --- Chassis Highlights ---
		g.lineStyle(2, iface, 0.8);
		g.beginPath();
		g.moveTo(cx - 15, cy + 5);
		g.lineTo(cx - 5, cy - 7);
		g.lineTo(cx + 12, cy - 7);
		g.strokePath();

		// --- Engine Block Glow ---
		g.fillStyle(core, pulse * 0.8);
		g.fillRoundedRect(cx - 4, cy - 2, 10, 6, 2);
		g.fillStyle(0x00234f, 0.9);
		g.fillRect(cx - 1, cy - 1, 4, 4);

		// --- The Cyber-Rider ---
		// Legs
		g.lineStyle(3, 0x222222, 1);
		g.beginPath(); g.moveTo(cx - 5, cy + 5); g.lineTo(cx, cy - 2); g.lineTo(cx - 4, cy - 7); g.strokePath();
		// Body & Head
		g.lineStyle(4, 0x111118, 1);
		g.beginPath(); g.moveTo(cx - 4, cy - 7); g.lineTo(cx - 10, cy - 16); g.strokePath();

		g.fillStyle(iface, 1);
		g.fillCircle(cx - 6, cy - 18, 4); // Helmet
		// Helmet Visor
		g.fillStyle(accent, 1);
		g.fillRect(cx - 5, cy - 19, 4, 2);

		// Arm
		g.lineStyle(2, core, 0.7);
		g.beginPath(); g.moveTo(cx - 8, cy - 14); g.lineTo(cx, cy - 10); g.lineTo(cx + 8, cy - 8); g.strokePath();

		// --- Aerodynamic Light Trails (Speed Lines) ---
		for (let i = 0; i < 4; i++) {
			const ly = cy - 8 + i * 5;
			const la = 0.5 - i * 0.1;
			g.lineStyle(1.5, i % 2 === 0 ? core : accent, la * pulse);
			g.lineBetween(cx - 25 - i * 8, ly, cx - 45 - Math.random() * 20, ly);
		}
	}

	// HUD and screens
	_buildUI() {
		const W = this.W;
		const style = {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '13px',
			color: this.pal.iface,
			align: 'left',
		};

		this.scoreLabel = this.add.text(20, 16, 'SCORE', { ...style, fontSize: '10px', alpha: 0.6 }).setDepth(10);
		this.scoreTxt = this.add.text(20, 28, '000000', {
			...style,
			fontSize: '22px',
			color: this.pal.core,
			stroke: this.pal.core,
			strokeThickness: 1,
		}).setDepth(10);

		this.levelLabel = this.add.text(W - 20, 16, 'LEVEL', { ...style, fontSize: '10px', alpha: 0.6 }).setOrigin(1, 0).setDepth(10);
		this.levelTxt = this.add.text(W - 20, 28, '01', {
			...style,
			fontSize: '22px',
			color: this.pal.accent,
			stroke: this.pal.accent,
			strokeThickness: 1,
		}).setOrigin(1, 0).setDepth(10);

		this.speedTxt = this.add.text(W / 2, 16, '', {
			...style,
			fontSize: '11px',
			color: this.pal.iface,
			align: 'center',
		}).setOrigin(0.5, 0).setDepth(10);

		this.levelFlash = this.add.text(W / 2, this.H * 0.35, '', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '28px',
			color: '#00234f',
			stroke: this.pal.accent,
			strokeThickness: 3,
			alpha: 0,
		}).setOrigin(0.5).setDepth(20);

		this.hintTxt = this.add.text(W / 2, this.H * 0.58, 'TAP TO JUMP OVER GAPS', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '14px',
			color: this.pal.iface,
			alpha: 0.8,
		}).setOrigin(0.5).setDepth(10);

		this.tweens.add({
			targets: this.hintTxt,
			alpha: 0,
			duration: 3000,
			delay: 2000
		});
	}

	_updateHUD() {
		this.scoreTxt.setText(String(Math.floor(this.score)).padStart(6, '0'));
		this.levelTxt.setText(String(this.level).padStart(2, '0'));
		const kmh = Math.round(this.speed * 0.36);
		this.speedTxt.setText(`${kmh} km/h`);
	}

	// screens
	_showStartScreen() {
		const W = this.W, H = this.H;
		this.startGroup = this.add.group();

		const title = this.add.text(W / 2, H * 0.3, 'NEON RIDER', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '52px',
			color: this.pal.core,
			stroke: this.pal.core,
			strokeThickness: 2,
		}).setOrigin(0.5).setDepth(30);

		const sub = this.add.text(W / 2, H * 0.42, 'ENDLESS VELOCITY', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '14px',
			color: this.pal.iface,
			letterSpacing: 8,
		}).setOrigin(0.5).setDepth(30);

		const prompt = this.add.text(W / 2, H * 0.62, '[ TAP TO START ]', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '18px',
			color: this.pal.accent,
		}).setOrigin(0.5).setDepth(30);

		const controls = this.add.text(W / 2, H * 0.74, 'TAP TO JUMP OVER GAPS', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '12px',
			color: this.pal.iface,
			alpha: 0.55,
		}).setOrigin(0.5).setDepth(30);

		this.startGroup.addMultiple([title, sub, prompt, controls]);

		this.tweens.add({
			targets: prompt,
			alpha: 0.2,
			duration: 700,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});
	}

	_showGameOverScreen() {
		const W = this.W, H = this.H;
		this.goGroup = this.add.group();

		const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(40);

		const title = this.add.text(W / 2, H * 0.28, 'GAME OVER', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '48px',
			color: this.pal.accent,
			stroke: this.pal.accent,
			strokeThickness: 2,
		}).setOrigin(0.5).setDepth(41);

		const scoreLbl = this.add.text(W / 2, H * 0.42, 'FINAL SCORE', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '12px',
			color: this.pal.iface,
			alpha: 0.6,
		}).setOrigin(0.5).setDepth(41);

		const scoreTxt = this.add.text(W / 2, H * 0.50, String(Math.floor(this.score)).padStart(6, '0'), {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '38px',
			color: this.pal.core,
			stroke: this.pal.core,
			strokeThickness: 1,
		}).setOrigin(0.5).setDepth(41);

		const levelTxt = this.add.text(W / 2, H * 0.60, `LEVEL REACHED: ${this.level}`, {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '13px',
			color: this.pal.iface,
			alpha: 0.7,
		}).setOrigin(0.5).setDepth(41);

		const btnBg = this.add.rectangle(W / 2, H * 0.72, 200, 44, 0x000000, 0).setDepth(41);
		const btnBorder = this.add.rectangle(W / 2, H * 0.72, 200, 44, 0x000000, 0)
			.setStrokeStyle(2, this._hexN(this.pal.core), 1).setDepth(41);
		const btnTxt = this.add.text(W / 2, H * 0.72, '[ RETRY ]', {
			fontFamily: "'Courier New', Courier, monospace",
			fontSize: '18px',
			color: this.pal.core,
		}).setOrigin(0.5).setDepth(42);

		btnBg.setInteractive({ useHandCursor: true });
		btnBorder.setInteractive({ useHandCursor: true });
		btnTxt.setInteractive({ useHandCursor: true });

		const doRetry = () => {
			this.goGroup.destroy(true);
			this._restartGame();
		};

		[btnBg, btnBorder, btnTxt].forEach(b => b.on('pointerup', doRetry));
		[btnBg, btnBorder].forEach(b => b.on('pointerover', () => {
			btnBg.setFillStyle(this._hexN(this.pal.core), 0.12);
		}));
		[btnBg, btnBorder].forEach(b => b.on('pointerout', () => {
			btnBg.setFillStyle(0x000000, 0);
		}));

		this.tweens.add({
			targets: btnTxt,
			alpha: 0.4,
			duration: 600,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});

		this.goGroup.addMultiple([overlay, title, scoreLbl, scoreTxt, levelTxt, btnBg, btnBorder, btnTxt]);
	}

	// game flow
	_startGame() {
		if (this.gameStarted) return;
		this.gameStarted = true;
		if (this.startGroup) this.startGroup.destroy(true);
		if (this.hintTxt) this.hintTxt.setAlpha(0);
		AudioEngine.start();
	}

	_die() {
		if (!this.alive) return;
		this.alive = false;
		AudioEngine.playDeath();
		AudioEngine.stop();

		const px = this.W * 0.22, py = this._playerY();
		this._spawnSparks(px, py, 40, this.pal.core);
		this._spawnSparks(px, py, 20, this.pal.accent);

		try {
			['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
				if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
			});
		} catch (e) { }

		if (window.FreshPlay && typeof window.FreshPlay.gameOver === 'function') {
			window.FreshPlay.gameOver(Math.floor(this.score));
		}

		this.time.delayedCall(900, () => {
			this._showGameOverScreen();
		});
	}

	_restartGame() {
		this.matter.world.getAllBodies().forEach(b => this.matter.world.remove(b));
		this.segments = [];
		this.sparks = [];
		this.trail = [];
		this.worldX = 0;
		this.score = 0;
		this.level = 1;
		this.speed = this.speedBase;
		this.alive = true;
		this.gameStarted = true;
		this.distanceToNext = 0;

		this._loadPalette();
		this._updateUIColors();
		this._generateInitialTrack();
		this._createPlayer();

		if (this.hintTxt) {
			this.hintTxt.setAlpha(0.8);
			this.tweens.add({ targets: this.hintTxt, alpha: 0, duration: 3000, delay: 2000 });
		}

		AudioEngine.start();
	}

	_updateUIColors() {
		this.scoreTxt.setColor(this.pal.core).setStroke(this.pal.core, 1);
		this.levelTxt.setColor(this.pal.accent).setStroke(this.pal.accent, 1);
		this.scoreLabel.setColor(this.pal.iface);
		this.levelLabel.setColor(this.pal.iface);
		this.speedTxt.setColor(this.pal.iface);
	}

	_triggerLevelUp() {
		this.level++;
		this.speed = Math.min(this.speedBase + (this.level - 1) * 28, 700);

		if (window.FreshPlay && typeof window.FreshPlay.levelComplete === 'function') {
			window.FreshPlay.levelComplete(() => { });
		}

		if (this.level % 5 === 1) {
			this._loadPalette();
			this._updateUIColors();
		}

		this.levelFlash.setText(`LEVEL ${this.level}`).setColor(this.pal.accent).setAlpha(1);
		this.tweens.add({
			targets: this.levelFlash,
			alpha: 0,
			y: this.H * 0.28,
			duration: 1400,
			ease: 'Power2',
			onComplete: () => { this.levelFlash.y = this.H * 0.35; },
		});

		this.cameras.main.shake(180, 0.008);
	}

	_onResize(gameSize) {
		this.W = gameSize.width;
		this.H = gameSize.height;
	}
}

// ============================================================
//  BOOT
// ============================================================
AudioEngine.init();

const config = {
	type: Phaser.AUTO,
	width: window.innerWidth,
	height: window.innerHeight,
	backgroundColor: 0xc4e2f5,
	parent: 'game-container',
	physics: {
		default: 'matter',
		matter: {
			gravity: { y: 1.6 },
			debug: false,
		},
	},
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	scene: [NeonRiderScene],
};

window.NeonRiderGame = new Phaser.Game(config);
