// ============================================================
//  CANNON BASKETBALL 
// ============================================================

/* global Phaser, window */

// Polyfill: stub FreshPlay if not injected by host
if (!window.FreshPlay) {
	let _level = 0;
	const PALETTES = [
		{ background: '#0a0a12', playerCore: '#00e5ff', fxAccent: '#ffe600', hostile: '#ff2255', interface: '#b0b8d8' },
		{ background: '#070d10', playerCore: '#39ff14', fxAccent: '#ff6b00', hostile: '#e600ff', interface: '#c8d8b0' },
		{ background: '#0d0a14', playerCore: '#ff00aa', fxAccent: '#00ffd5', hostile: '#ff4400', interface: '#d0c8e0' },
		{ background: '#080c08', playerCore: '#ffea00', fxAccent: '#00cfff', hostile: '#ff1155', interface: '#d4e8c8' },
	];
	window.FreshPlay = {
		levelComplete(cb) { _level++; setTimeout(cb, 0); },
		getCurrentPalette() { return PALETTES[Math.floor(_level / 5) % PALETTES.length]; },
		getLevel() { return _level; },
	};
}

// Audio helpers (Web Audio API)
const AC = (() => {
	let ctx = null;
	const get = () => {
		if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
		return ctx;
	};
	return {
		resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
		fire() {
			const c = get(); const t = c.currentTime;
			const o = c.createOscillator(); const g = c.createGain();
			o.connect(g); g.connect(c.destination);
			o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t);
			o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
			g.gain.setValueAtTime(0.55, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
			o.start(t); o.stop(t + 0.22);
		},
		bounce() {
			const c = get(); const t = c.currentTime;
			const o = c.createOscillator(); const g = c.createGain();
			o.connect(g); g.connect(c.destination);
			o.type = 'sine'; o.frequency.setValueAtTime(520, t);
			o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
			g.gain.setValueAtTime(0.35, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
			o.start(t); o.stop(t + 0.17);
		},
		swish() {
			const c = get(); const t = c.currentTime;
			[440, 660, 880, 1100].forEach((freq, i) => {
				const o = c.createOscillator(); const g = c.createGain();
				o.connect(g); g.connect(c.destination);
				o.type = 'sine'; o.frequency.value = freq;
				const d = t + i * 0.055;
				g.gain.setValueAtTime(0, d);
				g.gain.linearRampToValueAtTime(0.3, d + 0.04);
				g.gain.exponentialRampToValueAtTime(0.001, d + 0.22);
				o.start(d); o.stop(d + 0.25);
			});
		},
		buzz() {
			const c = get(); const t = c.currentTime;
			const o = c.createOscillator(); const g = c.createGain();
			o.connect(g); g.connect(c.destination);
			o.type = 'square'; o.frequency.setValueAtTime(80, t);
			g.gain.setValueAtTime(0.4, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
			o.start(t); o.stop(t + 0.38);
		},
	};
})();

// Colour utility
function hexToNum(hex) { return parseInt(hex.replace('#', ''), 16); }
function hexToRgb(hex) {
	const n = hexToNum(hex);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function lerpColor(a, b, t) {
	const ca = hexToRgb(a), cb = hexToRgb(b);
	const r = Math.round(ca.r + (cb.r - ca.r) * t);
	const g = Math.round(ca.g + (cb.g - ca.g) * t);
	const bl = Math.round(ca.b + (cb.b - ca.b) * t);
	return (r << 16) | (g << 8) | bl;
}

// Level generation
function generateLevel(levelIndex, W, H) {
	const difficulty = Math.min(levelIndex, 20);
	const wallCount = 2 + Math.floor(difficulty / 3);
	const obstCount = Math.min(1 + Math.floor(difficulty / 4), 4);

	// Cannon always bottom-left area
	const cannon = {
		x: Phaser.Math.Between(60, 160),
		y: Phaser.Math.Between(H - 120, H - 60),
	};

	// Hoop always in upper-right two-thirds (avoid cannon corner)
	const hoop = {
		x: Phaser.Math.Between(Math.floor(W * 0.45), W - 70),
		y: Phaser.Math.Between(70, Math.floor(H * 0.55)),
		radius: 26,
	};

	// Static walls
	const walls = [];
	for (let i = 0; i < wallCount; i++) {
		const vert = Math.random() > 0.5;
		walls.push({
			x: Phaser.Math.Between(120, W - 120),
			y: Phaser.Math.Between(80, H - 80),
			w: vert ? Phaser.Math.Between(10, 20) : Phaser.Math.Between(80, 200),
			h: vert ? Phaser.Math.Between(80, 200) : Phaser.Math.Between(10, 20),
		});
	}

	// Moving obstacles
	const obstacles = [];
	for (let i = 0; i < obstCount; i++) {
		const horiz = Math.random() > 0.5;
		obstacles.push({
			x: Phaser.Math.Between(W * 0.2, W * 0.8),
			y: Phaser.Math.Between(H * 0.15, H * 0.75),
			w: horiz ? Phaser.Math.Between(50, 100) : Phaser.Math.Between(14, 22),
			h: horiz ? Phaser.Math.Between(14, 22) : Phaser.Math.Between(50, 100),
			speed: Phaser.Math.FloatBetween(60, 130 + difficulty * 4),
			axis: horiz ? 'x' : 'y',
			range: Phaser.Math.Between(60, 140),
		});
	}

	return { cannon, hoop, walls, obstacles };
}


// PRELOAD
class PreloadScene extends Phaser.Scene {
	constructor() { super('PreloadScene'); }

	create() {
		// Generate all textures programmatically
		this._makeBall();
		this._makeCannon();
		this._makeParticle();
		this.scene.start('GameScene');
	}

	_makeBall() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		const R = 18;
		// glow
		for (let i = 5; i >= 1; i--) {
			g.fillStyle(0x00e5ff, 0.07 * i);
			g.fillCircle(R, R, R + i * 2.5);
		}
		g.fillStyle(0x00e5ff, 1);
		g.fillCircle(R, R, R);
		// seam
		g.lineStyle(2, 0x003344, 0.7);
		g.strokeCircle(R, R, R * 0.55);
		g.lineStyle(1.5, 0x003344, 0.5);
		g.beginPath(); g.moveTo(R, R - R); g.lineTo(R, R + R); g.strokePath();
		g.generateTexture('ball', R * 2, R * 2);
		g.destroy();
	}

	_makeCannon() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		// barrel
		g.fillStyle(0x00e5ff, 1);
		g.fillRoundedRect(0, 6, 54, 16, 5);
		// base
		g.fillStyle(0x007799, 1);
		g.fillCircle(8, 14, 16);
		// highlight
		g.lineStyle(2, 0xffffff, 0.5);
		g.strokeRoundedRect(0, 6, 54, 16, 5);
		g.generateTexture('cannon', 56, 30);
		g.destroy();
	}

	_makeParticle() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		g.fillStyle(0xffffff, 1);
		g.fillCircle(4, 4, 4);
		g.generateTexture('particle', 8, 8);
		g.destroy();
	}
}

// GAME SCENE
class GameScene extends Phaser.Scene {
	constructor() { super('GameScene'); }

	init() {
		this.levelIndex = (window.FreshPlay.getLevel ? window.FreshPlay.getLevel() : 0);
		this.palette = window.FreshPlay.getCurrentPalette();
		this.ballInFlight = false;
		this.scored = false;
		this.dragging = false;
		this.dragStart = null;
		this.obstacleObjs = [];
		this.wallObjs = [];
		this.trailPoints = [];
		this.shotCount = 0;
	}

	create() {
		const { width: W, height: H } = this.scale;
		this.W = W; this.H = H;

		this._buildLevel();
		this._setupInput();
		this._buildHUD();

		// Collision – registered once here, NOT inside _buildLevel
		this.matter.world.on('collisionstart', this._onCollision, this);

		// Particle emitter for scoring
		this.particles = this.add.particles(0, 0, 'particle', {
			speed: { min: 80, max: 260 },
			scale: { start: 1.4, end: 0 },
			lifespan: 700,
			quantity: 0,
			tint: [hexToNum(this.palette.fxAccent), hexToNum(this.palette.playerCore)],
			blendMode: 'ADD',
		});

		// Trail graphics
		this.trailGfx = this.add.graphics();
		this.trailGfx.setDepth(3);
	}

	// Level builder
	_buildLevel() {
		const { W, H } = this;
		const pal = this.palette;

		// Clear previous – wallObjs/obstacleObjs are plain {body, gfx, data} objects
		this.wallObjs.forEach(o => { if (o.body) this.matter.world.remove(o.body); if (o.gfx) o.gfx.destroy(); });
		this.obstacleObjs.forEach(o => { if (o.body) this.matter.world.remove(o.body); if (o.gfx) o.gfx.destroy(); });
		this.wallObjs = []; this.obstacleObjs = [];

		// Background
		this.cameras.main.setBackgroundColor(pal.background);
		this._drawBackground();

		// Generate layout
		const layout = generateLevel(this.levelIndex, W, H);
		this.cannonPos = layout.cannon;
		this.hoopData = layout.hoop;

		// Physics world
		this.matter.world.setBounds(0, 0, W, H, 40, true, true, false, true);

		// Static walls
		layout.walls.forEach(wd => {
			const wall = this.matter.add.rectangle(wd.x, wd.y, wd.w, wd.h, {
				isStatic: true, label: 'wall',
				restitution: 0.75, friction: 0.05,
			});
			// Visual
			const gfx = this.add.graphics().setDepth(4);
			this._drawWall(gfx, wd.x, wd.y, wd.w, wd.h, pal.interface);
			wall._gfx = gfx;
			this.wallObjs.push({ body: wall, gfx, data: wd });
		});

		// Moving obstacles
		layout.obstacles.forEach(od => {
			const rect = this.matter.add.rectangle(od.x, od.y, od.w, od.h, {
				isStatic: true, label: 'hostile',
				restitution: 0.3, friction: 0.1,
			});
			const gfx = this.add.graphics().setDepth(5);
			this._drawObstacle(gfx, od.x, od.y, od.w, od.h, pal.hostile);
			const obj = {
				body: rect, gfx, data: od,
				originX: od.x, originY: od.y, t: Math.random() * Math.PI * 2,
			};
			this.obstacleObjs.push(obj);
		});

		// Hoop
		this._buildHoop();

		// Cannon sprite
		if (this.cannonSprite) this.cannonSprite.destroy();
		this.cannonSprite = this.add.image(this.cannonPos.x, this.cannonPos.y, 'cannon')
			.setOrigin(0.15, 0.5).setDepth(7).setTint(hexToNum(pal.playerCore));

		// Trajectory graphics
		if (this.trajGfx) this.trajGfx.destroy();
		this.trajGfx = this.add.graphics().setDepth(6);
	}

	_buildHoop() {
		const { hoopData: h, palette: pal } = this;
		if (this.hoopGfx) this.hoopGfx.destroy();
		this.hoopGfx = this.add.graphics().setDepth(6);
		this._drawHoop(this.hoopGfx, h.x, h.y, h.radius, pal.fxAccent);

		// Sensor for scoring
		if (this.hoopSensor) this.matter.world.remove(this.hoopSensor);
		this.hoopSensor = this.matter.add.circle(h.x, h.y, h.radius * 0.7, {
			isStatic: true, isSensor: true, label: 'hoop',
		});

		// Rim physics (two small static circles)
		if (this.rimL) { this.matter.world.remove(this.rimL); this.matter.world.remove(this.rimR); }
		this.rimL = this.matter.add.circle(h.x - h.radius, h.y, 5, { isStatic: true, label: 'wall', restitution: 0.6 });
		this.rimR = this.matter.add.circle(h.x + h.radius, h.y, 5, { isStatic: true, label: 'wall', restitution: 0.6 });
	}

	_drawBackground() {
		const { W, H, palette: pal } = this;
		if (this.bgGfx) this.bgGfx.destroy();
		this.bgGfx = this.add.graphics().setDepth(0);
		// grid lines
		this.bgGfx.lineStyle(1, hexToNum(pal.interface), 0.05);
		for (let x = 0; x < W; x += 48) { this.bgGfx.moveTo(x, 0); this.bgGfx.lineTo(x, H); }
		for (let y = 0; y < H; y += 48) { this.bgGfx.moveTo(0, y); this.bgGfx.lineTo(W, y); }
		this.bgGfx.strokePath();
		// corner accent
		this.bgGfx.lineStyle(2, hexToNum(pal.fxAccent), 0.2);
		this.bgGfx.strokeRect(12, 12, W - 24, H - 24);
	}

	_drawWall(gfx, x, y, w, h, color) {
		const c = hexToNum(color);
		gfx.clear();
		// glow
		gfx.lineStyle(6, c, 0.15); gfx.strokeRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6);
		gfx.lineStyle(3, c, 0.35); gfx.strokeRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
		// fill + outline
		gfx.fillStyle(c, 0.15); gfx.fillRect(x - w / 2, y - h / 2, w, h);
		gfx.lineStyle(2, c, 0.9); gfx.strokeRect(x - w / 2, y - h / 2, w, h);
	}

	_drawObstacle(gfx, x, y, w, h, color) {
		const c = hexToNum(color);
		gfx.clear();
		// glitch effect: offset fill
		gfx.fillStyle(c, 0.12); gfx.fillRect(x - w / 2 + 3, y - h / 2 + 2, w, h);
		gfx.fillStyle(c, 0.25); gfx.fillRect(x - w / 2, y - h / 2, w, h);
		gfx.lineStyle(2.5, c, 1); gfx.strokeRect(x - w / 2, y - h / 2, w, h);
		// diagonal stripes
		gfx.lineStyle(1, c, 0.4);
		for (let i = -w; i < w + h; i += 12) {
			const x1 = x - w / 2 + i, y1 = y - h / 2;
			const x2 = x1 - h, y2 = y + h / 2;
			gfx.moveTo(Math.max(x - w / 2, Math.min(x + w / 2, x1)), y1);
			gfx.lineTo(Math.max(x - w / 2, Math.min(x + w / 2, x2)), y2);
		}
		gfx.strokePath();
	}

	_drawHoop(gfx, x, y, r, color) {
		const c = hexToNum(color);
		gfx.clear();
		// outer glow rings
		for (let i = 4; i >= 1; i--) {
			gfx.lineStyle(i * 3, c, 0.08 * i);
			gfx.strokeCircle(x, y, r + i * 3);
		}
		// rim
		gfx.lineStyle(3, c, 1); gfx.strokeCircle(x, y, r);
		// net lines
		gfx.lineStyle(1.5, c, 0.5);
		const netH = r * 1.1;
		const steps = 6;
		for (let i = 0; i <= steps; i++) {
			const nx = x - r + (2 * r / steps) * i;
			gfx.moveTo(nx, y);
			gfx.lineTo(x + (nx - x) * 0.4, y + netH);
		}
		for (let row = 1; row <= 3; row++) {
			const py = y + (netH / 3) * row;
			const rx = r * (1 - row * 0.2);
			gfx.moveTo(x - rx, py); gfx.lineTo(x + rx, py);
		}
		gfx.strokePath();
		// center dot
		gfx.fillStyle(c, 0.3); gfx.fillCircle(x, y, 4);
	}

	// HUD
	_buildHUD() {
		const pal = this.palette;
		const iColor = pal.interface;

		if (this.hudGfx) this.hudGfx.destroy();
		this.hudGfx = this.add.graphics().setDepth(20);
		// top bar
		this.hudGfx.fillStyle(hexToNum(pal.background), 0.85);
		this.hudGfx.fillRect(0, 0, this.W, 44);
		this.hudGfx.lineStyle(1, hexToNum(iColor), 0.3);
		this.hudGfx.lineBetween(0, 44, this.W, 44);

		const fontStyle = { fontFamily: '"Courier New", monospace', fontSize: '15px', fill: iColor };

		if (this.hudLevelTxt) this.hudLevelTxt.destroy();
		this.hudLevelTxt = this.add.text(16, 14, `LVL ${this.levelIndex + 1}`, fontStyle).setDepth(21);

		if (this.hudShotsTxt) this.hudShotsTxt.destroy();
		this.hudShotsTxt = this.add.text(this.W - 16, 14, `SHOTS: ${this.shotCount}`, fontStyle)
			.setOrigin(1, 0).setDepth(21);

		if (this.hudTipTxt) this.hudTipTxt.destroy();
		this.hudTipTxt = this.add.text(this.W / 2, 14, 'DRAG & RELEASE', {
			fontFamily: '"Courier New", monospace', fontSize: '11px',
			fill: hexToNum(pal.fxAccent).toString(16).padStart(6, '0').replace(/^/, '#'),
			alpha: 0.7,
		}).setOrigin(0.5, 0).setDepth(21);
	}

	_refreshHUD() {
		if (this.hudLevelTxt) this.hudLevelTxt.setText(`LVL ${this.levelIndex + 1}`);
		if (this.hudShotsTxt) this.hudShotsTxt.setText(`SHOTS: ${this.shotCount}`);
	}

	// Input
	_setupInput() {
		this.input.on('pointerdown', this._onDown, this);
		this.input.on('pointermove', this._onMove, this);
		this.input.on('pointerup', this._onUp, this);
	}

	_onDown(ptr) {
		if (this.ballInFlight || this.scored) return;
		AC.resume();
		this.dragging = true;
		this.dragStart = { x: ptr.x, y: ptr.y };
	}

	_onMove(ptr) {
		if (!this.dragging || this.ballInFlight || this.scored) return;
		this._drawTrajectory(ptr);
	}

	_onUp(ptr) {
		if (!this.dragging || this.ballInFlight || this.scored) return;
		this.dragging = false;
		this.trajGfx.clear();

		const dx = this.dragStart.x - ptr.x;
		const dy = this.dragStart.y - ptr.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 15) return; // too short – ignore

		this._fire(dx, dy, dist);
	}

	_drawTrajectory(ptr) {
		const pal = this.palette;
		this.trajGfx.clear();

		const ox = this.cannonPos.x, oy = this.cannonPos.y;
		const dx = this.dragStart.x - ptr.x;
		const dy = this.dragStart.y - ptr.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 5) return;

		const power = Math.min(dist, 320);
		// Must mirror _fire() velocity so preview matches real ball path
		const mag = power * 0.0875;
		let pvx = (dx / dist) * mag;
		let pvy = (dy / dist) * mag;
		const grav = 1.1; // matches Matter gravity.y

		const accentC = hexToNum(pal.fxAccent);
		let px = ox, py = oy;

		for (let i = 0; i < 90; i++) {
			pvx *= 0.996; pvy += grav;
			px += pvx; py += pvy;
			if (i % 2 === 0) {
				const alpha = 0.75 * (1 - i / 90);
				this.trajGfx.fillStyle(accentC, alpha);
				this.trajGfx.fillCircle(px, py, 3.5 * (1 - i / 96));
			}
			if (py > this.H + 40) break;
		}

		// Aim angle for cannon
		const angle = Math.atan2(dy, dx);
		this.cannonSprite.setRotation(angle);
	}

	// Fire
	_fire(dx, dy, dist) {
		const pal = this.palette;
		const power = Math.min(dist, 320);
		// Scale to ~28 px/frame max — enough to fight gravity=1.1 across the canvas
		const vx = (dx / dist) * power * 0.0875;
		const vy = (dy / dist) * power * 0.0875;

		this.shotCount++;
		this._refreshHUD();
		AC.fire();

		// Muzzle flash
		const flash = this.add.graphics().setDepth(8);
		flash.fillStyle(hexToNum(pal.playerCore), 0.9);
		flash.fillCircle(this.cannonPos.x, this.cannonPos.y, 22);
		this.time.delayedCall(80, () => flash.destroy());

		// Ball
		if (this.ball) { this.matter.world.remove(this.ball.body); this.ball.destroy(); }
		this.ball = this.matter.add.image(this.cannonPos.x, this.cannonPos.y, 'ball', null, {
			restitution: 0.72, friction: 0.05, frictionAir: 0.004,
			density: 0.003, label: 'ball',
		});
		this.ball.setDepth(9).setTint(hexToNum(pal.playerCore));
		this.matter.body.setVelocity(this.ball.body, { x: vx, y: vy });
		this.ballInFlight = true;
		this.trailPoints = [];
	}

	// Collision
	_onCollision(event) {
		if (!this.ball) return; // ball already destroyed, ignore stale events
		event.pairs.forEach(pair => {
			const { bodyA, bodyB } = pair;
			const labels = [bodyA.label, bodyB.label];

			if (labels.includes('ball') && labels.includes('hoop') && !this.scored) {
				this._onScore();
			} else if (labels.includes('ball') && labels.includes('hostile') && !this.scored) {
				this._onHit();
			} else if (labels.includes('ball') && labels.includes('wall')) {
				AC.bounce();
				this._spawnBounceParticles();
			}
		});
	}

	_spawnBounceParticles() {
		if (!this.ball) return;
		this.particles.setPosition(this.ball.x, this.ball.y);
		this.particles.emitParticleAt(this.ball.x, this.ball.y, 6);
	}

	// Score
	_onScore() {
		if (this.scored) return;
		this.scored = true;
		this.ballInFlight = false;
		AC.swish();

		// Destroy ball immediately so it stops triggering collisions
		if (this.ball) {
			this.matter.world.remove(this.ball.body);
			this.ball.destroy();
			this.ball = null;
		}

		// Burst (Phaser 3.60: setParticleTint replaces setTint)
		if (typeof this.particles.setParticleTint === 'function') {
			this.particles.setParticleTint([hexToNum(this.palette.fxAccent), hexToNum(this.palette.playerCore)]);
		}
		this.particles.emitParticleAt(this.hoopData.x, this.hoopData.y, 50);

		// Hoop pulse
		this.tweens.add({
			targets: this.hoopGfx, alpha: 0,
			duration: 180, yoyo: true, repeat: 3,
			onComplete: () => this.hoopGfx && this.hoopGfx.setAlpha(1),
		});

		// Banner → next level
		this._showBanner('SWISH!', this.palette.fxAccent, () => {
			// EXPLICIT AD TRIGGER
			if ((this.levelIndex + 1) % 5 === 0) {
				try {
					['showAd','showVideoAd','playAd','displayAd'].forEach(fn => {
						if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
					});
				} catch(_){}
			}

			window.FreshPlay.levelComplete(() => {
				this.levelIndex = (window.FreshPlay.getLevel ? window.FreshPlay.getLevel() : this.levelIndex + 1);
				this.palette = window.FreshPlay.getCurrentPalette();
				this.scored = false;
				this.ballInFlight = false;
				this.dragging = false;
				this.trailPoints = [];
				if (this.ball) { this.matter.world.remove(this.ball.body); this.ball.destroy(); this.ball = null; }
				this._buildLevel();
				this._buildHUD();
			});
		});

		// Safety net: if the banner/callback chain stalls, unlock after 3 s
		this.time.delayedCall(3000, () => {
			if (this.scored) {
				this.scored = false;
				this.ballInFlight = false;
				this.dragging = false;
			}
		});
	}

	// Hit (hostile)
	_onHit() {
		if (!this.ballInFlight || this.scored) return;
		AC.buzz();
		this.ballInFlight = false;

		// Red flash
		const flash = this.add.graphics().setDepth(30);
		flash.fillStyle(hexToNum(this.palette.hostile), 0.25);
		flash.fillRect(0, 0, this.W, this.H);
		this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

		this._showBanner('GLITCH!', this.palette.hostile, () => {
			this.ballInFlight = false;
			if (this.ball) { this.matter.world.remove(this.ball.body); this.ball.destroy(); this.ball = null; }
			this.cannonSprite.setRotation(0);
		});
	}

	// Banner
	_showBanner(text, color, onDone) {
		const bx = this.W / 2, by = this.H / 2;
		const bg = this.add.graphics().setDepth(40);
		bg.fillStyle(0x000000, 0.7); bg.fillRoundedRect(bx - 140, by - 32, 280, 64, 10);
		bg.lineStyle(2, hexToNum(color), 0.9); bg.strokeRoundedRect(bx - 140, by - 32, 280, 64, 10);

		const txt = this.add.text(bx, by, text, {
			fontFamily: '"Courier New", monospace',
			fontSize: '32px', fill: color,
			stroke: '#000000', strokeThickness: 3,
		}).setOrigin(0.5).setDepth(41).setAlpha(0);

		this.tweens.add({
			targets: [txt], alpha: 1, scaleX: { from: 0.6, to: 1 }, scaleY: { from: 0.6, to: 1 },
			duration: 220, ease: 'Back.out',
			onComplete: () => {
				this.time.delayedCall(700, () => {
					this.tweens.add({
						targets: [bg, txt], alpha: 0, duration: 250,
						onComplete: () => { bg.destroy(); txt.destroy(); onDone?.(); },
					});
				});
			},
		});
	}

	// Reset after miss
	_resetBall(label) {
		this.ballInFlight = false;
		AC.buzz();
		if (this.ball) {
			this.matter.world.remove(this.ball.body);
			this.ball.destroy(); this.ball = null;
		}
		this.trailGfx.clear();
		this._showBanner(label, this.palette.hostile, () => {
			this.cannonSprite.setRotation(0);
		});
	}

	// Update loop
	update(time, delta) {
		const dt = delta / 1000;

		// Move obstacles
		this.obstacleObjs.forEach(obj => {
			obj.t += dt * (obj.data.speed / 100);
			const offset = Math.sin(obj.t) * obj.data.range;
			const nx = obj.data.axis === 'x' ? obj.originX + offset : obj.originX;
			const ny = obj.data.axis === 'y' ? obj.originY + offset : obj.originY;
			Phaser.Physics.Matter.Matter.Body.setPosition(obj.body, { x: nx, y: ny });
			this._drawObstacle(obj.gfx, nx, ny, obj.data.w, obj.data.h, this.palette.hostile);
		});

		// Hoop glow pulse
		if (this.hoopGfx) {
			const pulse = 0.75 + 0.25 * Math.sin(time * 0.004);
			this.hoopGfx.setAlpha(pulse);
		}

		// Ball trail
		if (this.ballInFlight && this.ball) {
			this.trailPoints.unshift({ x: this.ball.x, y: this.ball.y });
			if (this.trailPoints.length > 18) this.trailPoints.pop();
			this.trailGfx.clear();
			const c = hexToNum(this.palette.playerCore);
			this.trailPoints.forEach((pt, i) => {
				const alpha = (1 - i / this.trailPoints.length) * 0.45;
				const size = (1 - i / this.trailPoints.length) * 7;
				this.trailGfx.fillStyle(c, alpha);
				this.trailGfx.fillCircle(pt.x, pt.y, size);
			});

			// Out-of-bounds check (fell below canvas)
			if (this.ball.y > this.H + 60 && !this.scored) {
				this._resetBall('OUT!');
				return;
			}

			// Stopped-ball check – ball came to rest without scoring (short miss)
			// ballInFlight would stay true forever, locking the cannon
			const vel = this.ball.body.velocity;
			const spd = vel.x * vel.x + vel.y * vel.y;
			if (spd < 0.3 && !this.scored) {
				this._resetBall('MISS!');
			}
		} else {
			this.trailGfx.clear();
		}
	}
}


new Phaser.Game({
	type: Phaser.AUTO,
	width: Math.min(window.innerWidth, 540),
	height: Math.min(window.innerHeight, 800),
	backgroundColor: '#0a0a12',
	parent: document.body,
	physics: {
		default: 'matter',
		matter: { gravity: { y: 1.1 }, debug: false },
	},
	scene: [PreloadScene, GameScene],
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
});
