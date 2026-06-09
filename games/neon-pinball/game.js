// ============================================================
//  NEON PINBALL
// ============================================================

/* FreshPlay stub (replaced by host when embedded) */
window.FreshPlay = window.FreshPlay || {
	levelComplete: (cb) => { console.log('[FreshPlay] levelComplete'); setTimeout(cb, 800); },
	gameOver: (score) => console.log('[FreshPlay] gameOver', score),
	getCurrentPalette: () => ({
		background: '#c4e2f5',
		playerCore: '#00234f',
		interface: '#daedf8',
		fxAccent: '#ff00aa',
	}),
};

/* Palette helper */
function hexToNum(hex) {
	return parseInt(hex.replace('#', ''), 16);
}

/* AudioContext synth helpers — lazily created on first gesture (required on mobile) */
let AC = null;
function getAC() {
	if (!AC && typeof AudioContext !== 'undefined') {
		AC = new AudioContext();
	}
	if (AC && AC.state === 'suspended') {
		AC.resume();
	}
	return AC;
}

function playFlipperThud() {
	const AC = getAC();
	if (!AC) return;
	const o = AC.createOscillator();
	const g = AC.createGain();
	o.connect(g); g.connect(AC.destination);
	o.type = 'sine';
	o.frequency.setValueAtTime(80, AC.currentTime);
	o.frequency.exponentialRampToValueAtTime(30, AC.currentTime + 0.12);
	g.gain.setValueAtTime(0.6, AC.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.18);
	o.start(); o.stop(AC.currentTime + 0.2);
}

function playBumperChime(pitch) {
	const AC = getAC();
	if (!AC) return;
	const freq = 400 + pitch * 120;
	const o = AC.createOscillator();
	const o2 = AC.createOscillator();
	const g = AC.createGain();
	o.connect(g); o2.connect(g); g.connect(AC.destination);
	o.type = 'triangle'; o2.type = 'sine';
	o.frequency.value = freq;
	o2.frequency.value = freq * 2.01;
	g.gain.setValueAtTime(0.4, AC.currentTime);
	g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.35);
	o.start(); o2.start();
	o.stop(AC.currentTime + 0.4); o2.stop(AC.currentTime + 0.4);
}

function playMultiBallFanfare() {
	const AC = getAC();
	if (!AC) return;
	[0, 200, 450].forEach((delay) => {
		setTimeout(() => {
			const o = AC.createOscillator();
			const g = AC.createGain();
			o.connect(g); g.connect(AC.destination);
			o.type = 'sawtooth';
			o.frequency.value = 660 + delay;
			g.gain.setValueAtTime(0.3, AC.currentTime);
			g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.4);
			o.start(); o.stop(AC.currentTime + 0.45);
		}, delay);
	});
}

/* ══════════════════════════════════════════════════════════
	 PHASER SCENES
══════════════════════════════════════════════════════════ */

/* Preload */
class BootScene extends Phaser.Scene {
	constructor() { super('Boot'); }

	create() {
		// Generate all textures procedurally — no external assets needed
		this.createBallTexture();
		this.createFlipperTexture();
		this.createBumperTexture();
		this.createGlowTexture();
		this.scene.start('Game');
	}

	createBallTexture() {
		const g = this.make.graphics({ add: false });
		const r = 12;
		g.fillStyle(0x00234f, 1);
		g.fillCircle(r, r, r);
		// inner glow
		g.fillStyle(0xaaffff, 0.6);
		g.fillCircle(r, r, r * 0.55);
		g.fillStyle(0x00234f, 1);
		g.fillCircle(r - 2, r - 2, 3);
		g.generateTexture('ball', r * 2, r * 2);
		g.destroy();
	}

	createFlipperTexture() {
		// flipper: 120×18 pill shape, pointing right (mirrored in scene)
		const g = this.make.graphics({ add: false });
		const W = 120, H = 18;
		g.fillStyle(0x00234f, 1);
		g.fillRoundedRect(0, 0, W, H, H / 2);
		g.generateTexture('flipper', W, H);
		g.destroy();
	}

	createBumperTexture() {
		const g = this.make.graphics({ add: false });
		const r = 22;
		// outer ring
		g.fillStyle(0x00234f, 1);
		g.fillCircle(r, r, r);
		g.fillStyle(0x000000, 1);
		g.fillCircle(r, r, r - 4);
		g.fillStyle(0x00234f, 0.85);
		g.fillCircle(r, r, r - 8);
		g.generateTexture('bumper', r * 2, r * 2);
		g.destroy();
	}

	createGlowTexture() {
		const g = this.make.graphics({ add: false });
		const r = 48;
		for (let i = r; i > 0; i -= 4) {
			const alpha = 0.04 + (r - i) / r * 0.12;
			g.fillStyle(0x00234f, alpha);
			g.fillCircle(r, r, i);
		}
		g.generateTexture('glow', r * 2, r * 2);
		g.destroy();
	}
}

/* Main Game */
class GameScene extends Phaser.Scene {
	constructor() { super('Game'); }

	/* init */
	init() {
		this.palette = window.FreshPlay.getCurrentPalette();
		this.score = 0;
		this.level = 1;
		this.balls = [];           // active ball objects
		this.ballCount = 3;           // balls remaining (lives)
		this.bumperPitchIndex = 0;
		this.targetHits = {};
		this.multiballActive = false;
		this.gravityBase = 600;
		this.levelThreshold = 200;       // points per level
		this.transitioning = false;
		this.bumperData = [];
		this.wallStuckTimer = {};   // tracks per-ball time stuck against a side wall
	}

	/* create */
	create() {
		const W = this.scale.width;
		const H = this.scale.height;

		this.W = W; this.H = H;

		this.physics.world.gravity.y = this.gravityBase;

		// Confine ball to inner play-field so it can NEVER tunnel through side walls.
		// Decorative walls are 14px thick at x=52 → inner edge ~59; same on right.
		// Bottom is open (drain); top is blocked.
		this.physics.world.setBounds(59, 0, W - 118, H + 100);
		this.physics.world.setBoundsCollision(true, true, true, false);

		/* Background */
		this.buildBackground();

		/* Table walls */
		this.buildWalls();

		/* Bumpers */
		this.buildBumpers();

		/* Targets */
		this.buildTargets();

		/* Flippers */
		this.buildFlippers();

		/* Launch ball */
		this.launchBall();

		/* HUD */
		this.buildHUD();

		/* Input */
		this.setupInput();

		/* Collision callbacks */
		this.setupCollisions();

		/* Particle emitters */
		this.setupParticles();
	}

	/* Background */
	buildBackground() {
		const W = this.W, H = this.H;
		const bg = hexToNum(this.palette.background);
		const accent = hexToNum(this.palette.fxAccent);
		const core = hexToNum(this.palette.playerCore);

		// Deep background
		this.add.rectangle(W / 2, H / 2, W, H, bg);

		// Subtle lane lines
		const g = this.add.graphics();
		g.lineStyle(1, hexToNum(this.palette.interface), 0.07);
		for (let x = 60; x < W - 60; x += 40) {
			g.lineBetween(x, 80, x, H - 80);
		}

		// Corner accent triangles
		g.fillStyle(hexToNum(this.palette.fxAccent), 0.06);
		g.fillTriangle(60, H - 80, 200, H - 80, 60, H - 200);
		g.fillTriangle(W - 60, H - 80, W - 200, H - 80, W - 60, H - 200);
	}

	/* Walls */
	buildWalls() {
		const W = this.W, H = this.H;
		const wallColor = hexToNum(this.palette.interface);
		const wallThick = 14;

		const walls = this.physics.add.staticGroup();

		const makeWall = (x, y, w, h, angle = 0) => {
			const r = this.add.rectangle(x, y, w, h, wallColor, 0.9);
			this.physics.add.existing(r, true);
			r.body.setSize(w, h);
			walls.add(r);
			// Glow strip
			const glow = this.add.rectangle(x, y, w, h, wallColor, 0.25);
			glow.setBlendMode(Phaser.BlendModes.ADD);
			return r;
		};

		// Left wall
		makeWall(52, H / 2, wallThick, H);
		// Right wall
		makeWall(W - 52, H / 2, wallThick, H);
		// Top wall
		makeWall(W / 2, 60, W - 100, wallThick);

		// Angled gutters — sit just outside flipper pivot points
		const gutterLen = 140;

		const gLeft = this.add.rectangle(110, H - 145, wallThick, gutterLen, wallColor, 0.9);
		gLeft.setAngle(-38);
		this.physics.add.existing(gLeft, true);
		gLeft.body.setSize(wallThick, gutterLen);
		gLeft.body.reset(110, H - 145);

		const gRight = this.add.rectangle(W - 110, H - 145, wallThick, gutterLen, wallColor, 0.9);
		gRight.setAngle(38);
		this.physics.add.existing(gRight, true);
		gRight.body.setSize(wallThick, gutterLen);
		gRight.body.reset(W - 110, H - 145);

		this.walls = walls;
		this.gutterLeft = gLeft;
		this.gutterRight = gRight;
	}

	/* Bumpers */
	buildBumpers() {
		const W = this.W;
		const fxColor = hexToNum(this.palette.fxAccent);

		const positions = [
			{ x: W * 0.28, y: 200 },
			{ x: W * 0.72, y: 200 },
			{ x: W * 0.50, y: 160 },
			{ x: W * 0.28, y: 310 },
			{ x: W * 0.72, y: 310 },
			{ x: W * 0.50, y: 270 },
		];

		this.bumpers = this.physics.add.staticGroup();
		this.bumperGlows = [];
		this.bumperSprites = [];

		positions.forEach((pos, i) => {
			const sprite = this.add.image(pos.x, pos.y, 'bumper');
			sprite.setTint(hexToNum(this.palette.playerCore));
			sprite.setScale(1.1);
			this.physics.add.existing(sprite, true);
			sprite.body.setCircle(22, 0, 0);
			this.bumpers.add(sprite);
			this.bumperSprites.push(sprite);

			// Glow halo
			const glow = this.add.image(pos.x, pos.y, 'glow');
			glow.setTint(fxColor);
			glow.setAlpha(0.35);
			glow.setBlendMode(Phaser.BlendModes.ADD);
			glow.setScale(1.3);
			this.bumperGlows.push(glow);

			this.bumperData.push({ sprite, glow, hits: 0, flashTimer: 0 });
		});
	}

	/* Targets */
	buildTargets() {
		const W = this.W;
		const targetColor = hexToNum(this.palette.fxAccent);

		this.targets = this.physics.add.staticGroup();
		this.targetObjects = [];

		const positions = [
			{ x: W * 0.20, y: 400 },
			{ x: W * 0.50, y: 380 },
			{ x: W * 0.80, y: 400 },
		];

		positions.forEach((pos, i) => {
			const rect = this.add.rectangle(pos.x, pos.y, 40, 12, targetColor, 1);
			rect.setStrokeStyle(2, 0x00234f, 0.5);
			this.physics.add.existing(rect, true);
			rect.body.setSize(40, 12);
			this.targets.add(rect);
			this.targetObjects.push({ rect, hits: 0, maxHits: 3, index: i });
			this.targetHits[i] = 0;
		});
	}

	/* Flippers */
	buildFlippers() {
		const W = this.W, H = this.H;
		const coreColor = hexToNum(this.palette.playerCore);

		const flipperY = H - 105;
		const FLIP_W = 120, FLIP_H = 18;

		// Pivots: left flipper rotates from its LEFT end, right from its RIGHT end.
		// They are spaced symmetrically; tips meet near center at rest.
		// Center of table = W/2 = 250. Each flipper is 120px wide.
		// At rest angle of 28° they naturally droop. Pivot spacing = 260px apart.
		const pivotL = W / 2 - 130;   // ~120
		const pivotR = W / 2 + 130;   // ~380

		// Left flipper — pivot at left end (origin 0, 0.5), extends RIGHT
		this.leftFlipper = this.add.image(pivotL, flipperY, 'flipper');
		this.leftFlipper.setOrigin(0, 0.5);
		this.leftFlipper.setTint(coreColor);
		this.leftFlipper.angle = 28;   // rest: tip droops down-right

		// Right flipper — pivot at right end (origin 1, 0.5), extends LEFT
		this.rightFlipper = this.add.image(pivotR, flipperY, 'flipper');
		this.rightFlipper.setOrigin(1, 0.5);
		this.rightFlipper.setFlipX(true);
		this.rightFlipper.setTint(coreColor);
		this.rightFlipper.angle = -28;  // rest: tip droops down-left

		// Glow overlays — exact same transforms
		this.leftFlipperGlow = this.add.image(pivotL, flipperY, 'flipper');
		this.leftFlipperGlow.setOrigin(0, 0.5);
		this.leftFlipperGlow.setTint(coreColor);
		this.leftFlipperGlow.setAlpha(0.45);
		this.leftFlipperGlow.setBlendMode(Phaser.BlendModes.ADD);
		this.leftFlipperGlow.angle = 28;

		this.rightFlipperGlow = this.add.image(pivotR, flipperY, 'flipper');
		this.rightFlipperGlow.setOrigin(1, 0.5);
		this.rightFlipperGlow.setFlipX(true);
		this.rightFlipperGlow.setTint(coreColor);
		this.rightFlipperGlow.setAlpha(0.45);
		this.rightFlipperGlow.setBlendMode(Phaser.BlendModes.ADD);
		this.rightFlipperGlow.angle = -28;

		this.leftFlipperUp = false;
		this.rightFlipperUp = false;

		// Physics bodies — same origins so collision matches visual exactly
		this.leftFlipperBody = this.physics.add.staticImage(pivotL, flipperY, 'flipper');
		this.leftFlipperBody.setOrigin(0, 0.5);
		this.leftFlipperBody.setVisible(false);
		this.leftFlipperBody.body.setSize(FLIP_W, FLIP_H);

		this.rightFlipperBody = this.physics.add.staticImage(pivotR, flipperY, 'flipper');
		this.rightFlipperBody.setOrigin(1, 0.5);
		this.rightFlipperBody.setVisible(false);
		this.rightFlipperBody.body.setSize(FLIP_W, FLIP_H);

		this.FLIPPER_Y = flipperY;
		this.FLIPPER_PL = pivotL;
		this.FLIPPER_PR = pivotR;
	}

	/* Launch ball */
	launchBall(extraX, extraY) {
		const W = this.W, H = this.H;
		const x = extraX || W / 2 + Phaser.Math.Between(-30, 30);
		const y = extraY || H / 2 - 60;

		const ball = this.physics.add.image(x, y, 'ball');
		ball.setTint(hexToNum(this.palette.playerCore));
		ball.body.setCircle(12);
		ball.setBounce(0.72);
		ball.setCollideWorldBounds(true);   // hard backstop — ball can never tunnel past edge
		ball.setMaxVelocity(900, 900);
		ball.body.setDragX(30);

		// Glow follower
		const ballGlow = this.add.image(x, y, 'glow');
		ballGlow.setTint(hexToNum(this.palette.playerCore));
		ballGlow.setAlpha(0.5);
		ballGlow.setBlendMode(Phaser.BlendModes.ADD);
		ball._glow = ballGlow;

		// Trail graphics
		ball._trail = [];
		ball._trailGraphics = this.add.graphics();
		ball._trailGraphics.setBlendMode(Phaser.BlendModes.ADD);

		// Initial impulse
		ball.setVelocity(Phaser.Math.Between(-120, 120), -350);

		this.balls.push(ball);
		ball._id = Date.now() + Math.random(); // unique key for wall-stuck tracking

		// Re-register colliders for new ball
		this.addBallColliders(ball);
		return ball;
	}

	/* Colliders */
	addBallColliders(ball) {
		this.physics.add.collider(ball, this.walls);
		this.physics.add.collider(ball, this.leftFlipperBody, () => this.onFlipperHit(ball, 'left'));
		this.physics.add.collider(ball, this.rightFlipperBody, () => this.onFlipperHit(ball, 'right'));
		this.physics.add.collider(ball, this.gutterLeft);
		this.physics.add.collider(ball, this.gutterRight);
	}

	setupCollisions() {
		// Bumper overlap (handled in update via manual check for all balls)
	}

	setupParticles() {
		this.particles = this.add.particles(0, 0, 'glow', {
			speed: { min: 60, max: 180 },
			scale: { start: 0.4, end: 0 },
			alpha: { start: 0.7, end: 0 },
			lifespan: 320,
			blendMode: 'ADD',
			emitting: false,
			quantity: 6,
			tint: hexToNum(this.palette.fxAccent),
		});
	}

	/* HUD */
	buildHUD() {
		const W = this.W;
		const ifaceColor = hexToNum(this.palette.interface);

		const style = (size, alpha = 1) => ({
			fontFamily: 'Courier New, Courier, monospace',
			fontSize: `${size}px`,
			color: this.palette.interface,
			alpha,
		});

		// Score
		this.add.text(W / 2, 22, 'SCORE', { ...style(11), alpha: 0.55 }).setOrigin(0.5, 0);
		this.scoreTxt = this.add.text(W / 2, 34, '000000', { ...style(28) }).setOrigin(0.5, 0);
		this.scoreTxt.setStroke(this.palette.playerCore, 4);
		this.scoreTxt.setShadow(0, 0, this.palette.playerCore, 12, true, true);

		// Level
		this.add.text(70, 22, 'LVL', { ...style(10), alpha: 0.5 });
		this.levelTxt = this.add.text(70, 32, '01', { ...style(20) });

		// Balls / Lives
		this.add.text(W - 70, 22, 'BALLS', { ...style(10), alpha: 0.5 }).setOrigin(1, 0);
		this.ballsTxt = this.add.text(W - 70, 32, '●●●', { ...style(18) }).setOrigin(1, 0);
		this.ballsTxt.setColor(this.palette.fxAccent);

		// Multi-ball banner (hidden)
		this.multiBallBanner = this.add.text(W / 2, this.H / 2, '⬡ MULTI-BALL ⬡', {
			...style(30),
			color: this.palette.fxAccent,
		}).setOrigin(0.5).setAlpha(0).setStroke(this.palette.fxAccent, 6);

		// Controls hint — show touch hint on touch devices, keyboard hint otherwise
		const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
		const hintText = isTouchDevice
			? 'TAP LEFT ◀  FLIPPER  ▶ TAP RIGHT'
			: '← LEFT   FLIPPER   RIGHT →';
		this.add.text(W / 2, this.H - 30, hintText, {
			...style(10), alpha: 0.3,
		}).setOrigin(0.5);
	}

	/* Input */
	setupInput() {
		this.cursors = this.input.keyboard.createCursorKeys();
		this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
		this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

		// Track active touch IDs per side
		this._leftPointers = new Set();
		this._rightPointers = new Set();

		// Use native touch events directly on the canvas.
		// Phaser's pointer.x on a FIT-scaled canvas does NOT equal game coords on mobile —
		// it reflects the CSS pixel position inside the scaled canvas element, which is
		// correct, but only if the canvas is flush left. When Phaser centers it with
		// autoCenter the offset isn't always applied consistently across browsers.
		// Reading clientX vs canvas.getBoundingClientRect() is always exact.
		const canvas = this.sys.game.canvas;

		const getTouchSide = (clientX) => {
			const rect = canvas.getBoundingClientRect();
			return (clientX - rect.left) < rect.width / 2 ? 'left' : 'right';
		};

		canvas.addEventListener('touchstart', (e) => {
			e.preventDefault();
			for (const t of e.changedTouches) {
				const side = getTouchSide(t.clientX);
				if (side === 'left') {
					this._leftPointers.add(t.identifier);
					this.activateFlipper('left');
				} else {
					this._rightPointers.add(t.identifier);
					this.activateFlipper('right');
				}
			}
		}, { passive: false });

		const handleTouchEnd = (e) => {
			e.preventDefault();
			for (const t of e.changedTouches) {
				this._leftPointers.delete(t.identifier);
				this._rightPointers.delete(t.identifier);
			}
			if (this._leftPointers.size === 0) this.deactivateFlipper('left');
			if (this._rightPointers.size === 0) this.deactivateFlipper('right');
		};

		canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
		canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

		// Mouse / desktop fallback via Phaser (fine for non-touch)
		this.input.on('pointerdown', (p) => {
			if (p.x < this.W / 2) this.activateFlipper('left');
			else this.activateFlipper('right');
		});
		this.input.on('pointerup', () => {
			this.deactivateFlipper('left');
			this.deactivateFlipper('right');
		});
	}

	activateFlipper(side) {
		if (side === 'left' && !this.leftFlipperUp) { this.leftFlipperUp = true; playFlipperThud(); }
		if (side === 'right' && !this.rightFlipperUp) { this.rightFlipperUp = true; playFlipperThud(); }
	}
	deactivateFlipper(side) {
		if (side === 'left') this.leftFlipperUp = false;
		if (side === 'right') this.rightFlipperUp = false;
	}

	/* Flipper hit physics */
	onFlipperHit(ball, side) {
		const speed = Math.abs(ball.body.velocity.x) + Math.abs(ball.body.velocity.y);
		if (speed > 500) this.cameras.main.shake(80, 0.007);

		if (side === 'left' && this.leftFlipperUp) {
			// Left flipper flings up and to the right
			ball.setVelocity(
				Math.abs(ball.body.velocity.x) * 0.5 + 160,
				-580 - this.gravityBase * 0.18,
			);
		}
		if (side === 'right' && this.rightFlipperUp) {
			// Right flipper flings up and to the left
			ball.setVelocity(
				-(Math.abs(ball.body.velocity.x) * 0.5 + 160),
				-580 - this.gravityBase * 0.18,
			);
		}
	}

	/* Bumper logic */
	hitBumper(ball, bumperData, idx) {
		// Direction from bumper center to ball
		const dx = ball.x - bumperData.sprite.x;
		const dy = ball.y - bumperData.sprite.y;
		const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
		const force = 520 + this.level * 15;
		ball.setVelocity((dx / dist) * force, (dy / dist) * force);

		this.cameras.main.shake(40, 0.004);
		this.particles.emitParticleAt(bumperData.sprite.x, bumperData.sprite.y);

		bumperData.hits++;
		bumperData.flashTimer = 12;

		this.addScore(20);
		this.bumperPitchIndex = (this.bumperPitchIndex + 1) % 8;
		playBumperChime(this.bumperPitchIndex);

		// Target progression check
		if (bumperData.hits % 3 === 0) {
			this.advanceTarget(idx % this.targetObjects.length);
		}
	}

	advanceTarget(idx) {
		const t = this.targetObjects[idx];
		if (!t || t.hits >= t.maxHits) return;
		t.hits++;
		const pct = t.hits / t.maxHits;
		const color = Phaser.Display.Color.Interpolate.ColorWithColor(
			Phaser.Display.Color.ValueToColor(hexToNum(this.palette.fxAccent)),
			Phaser.Display.Color.ValueToColor(0x00234f),
			1, pct,
		);
		t.rect.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));

		if (t.hits >= t.maxHits) this.checkMultiBall();
	}

	checkMultiBall() {
		const allHit = this.targetObjects.every(t => t.hits >= t.maxHits);
		if (allHit && !this.multiballActive) {
			this.triggerMultiBall();
		}
	}

	triggerMultiBall() {
		this.multiballActive = true;
		playMultiBallFanfare();
		this.cameras.main.shake(200, 0.015);
		this.cameras.main.flash(300, 255, 0, 170);

		// Spawn 2 extra balls
		const ball1 = this.launchBall(this.W * 0.35, this.H * 0.4);
		const ball2 = this.launchBall(this.W * 0.65, this.H * 0.4);
		ball1.setVelocity(-200, -480);
		ball2.setVelocity(200, -480);

		// Flash banner
		this.tweens.add({
			targets: this.multiBallBanner,
			alpha: { from: 0, to: 1 },
			yoyo: true,
			repeat: 3,
			duration: 280,
			onComplete: () => this.multiBallBanner.setAlpha(0),
		});

		// Reset targets after delay
		this.time.delayedCall(8000, () => {
			this.multiballActive = false;
			this.targetObjects.forEach(t => {
				t.hits = 0;
				t.rect.setFillStyle(hexToNum(this.palette.fxAccent));
			});
		});
	}

	/* Scoring & level */
	addScore(pts) {
		this.score += pts;
		this.scoreTxt.setText(String(this.score).padStart(6, '0'));

		if (this.score >= this.level * this.levelThreshold && !this.transitioning) {
			this.transitioning = true;
			window.FreshPlay.levelComplete(() => {
				this.level++;
				this.levelTxt.setText(String(this.level).padStart(2, '0'));
				this.gravityBase = Math.min(1100, 600 + (this.level - 1) * 40);
				this.physics.world.gravity.y = this.gravityBase;

				// Refresh palette every 5 levels
				if (this.level % 5 === 0) {
					this.palette = window.FreshPlay.getCurrentPalette();
					this.applyPaletteUpdate();
				}

				this.cameras.main.flash(400, 0, 200, 255);
				this.transitioning = false;
			});
		}
	}

	applyPaletteUpdate() {
		const core = hexToNum(this.palette.playerCore);
		const accent = hexToNum(this.palette.fxAccent);

		this.balls.forEach(b => b.setTint(core));
		this.bumperSprites.forEach(s => s.setTint(core));
		this.bumperGlows.forEach(g => g.setTint(accent));
		this.leftFlipper.setTint(core);
		this.rightFlipper.setTint(core);
		this.particles.setParticleTint(accent);
		this.targetObjects.forEach(t => t.rect.setFillStyle(accent));
		this.multiBallBanner.setColor(this.palette.fxAccent);
	}

	/* Ball lost */
	ballLost(ball) {
		const idx = this.balls.indexOf(ball);
		if (idx === -1) return;

		delete this.wallStuckTimer[ball._id];
		ball._glow.destroy();
		ball._trailGraphics.destroy();
		ball.destroy();
		this.balls.splice(idx, 1);

		// If this was the last ball on screen (not multiball extras)
		if (this.balls.length === 0) {
			this.ballCount--;
			const dots = '●'.repeat(Math.max(0, this.ballCount)) + '○'.repeat(Math.max(0, 3 - this.ballCount));
			this.ballsTxt.setText(dots);

			if (this.ballCount <= 0) {
				this.time.delayedCall(500, () => {
					window.FreshPlay.gameOver(this.score);
					this.showGameOverPopup();
				});
			} else {
				this.time.delayedCall(700, () => {
					this.multiballActive = false;
					this.launchBall();
				});
			}
		}
	}

	/* Game Over Popup */
	showGameOverPopup() {
		const W = this.W, H = this.H;

		// Persist high score across restarts
		const prev = this.registry.get('highScore') || 0;
		const highScore = Math.max(this.score, prev);
		if (this.score > prev) this.registry.set('highScore', this.score);

		const mono = (size, color = '#00234f', bold = false) => ({
			fontFamily: 'Courier New, Courier, monospace',
			fontSize: `${size}px`,
			color,
			fontStyle: bold ? 'bold' : 'normal',
			letterSpacing: 2,
		});

		// Dark full-screen overlay
		const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82).setDepth(20);
		overlay.setAlpha(0);
		this.tweens.add({ targets: overlay, alpha: 1, duration: 300 });

		// Panel dimensions
		const panelW = 310, panelH = 320;
		const px = W / 2, py = H / 2;

		// Dark panel background
		const panel = this.add.rectangle(px, py, panelW, panelH, 0x00234f, 1).setDepth(21);

		// Red border (4 sides as thin rects to match the image exactly)
		const bT = 3; // border thickness
		const RED = 0xdd0000;
		[
			[px, py - panelH / 2, panelW + bT * 2, bT],   // top
			[px, py + panelH / 2, panelW + bT * 2, bT],   // bottom
			[px - panelW / 2, py, bT, panelH],            // left
			[px + panelW / 2, py, bT, panelH],            // right
		].forEach(([x, y, w, h]) =>
			this.add.rectangle(x, y, w, h, RED, 1).setDepth(22)
		);

		// Subtle grid texture inside panel (matches reference background)
		const gridG = this.add.graphics().setDepth(21);
		gridG.lineStyle(1, 0x1a1a2e, 0.6);
		for (let gx = px - panelW / 2; gx <= px + panelW / 2; gx += 28)
			gridG.lineBetween(gx, py - panelH / 2, gx, py + panelH / 2);
		for (let gy = py - panelH / 2; gy <= py + panelH / 2; gy += 28)
			gridG.lineBetween(px - panelW / 2, gy, px + panelW / 2, gy);

		// GAME OVER title
		const title = this.add.text(px, py - 118, 'GAME  OVER', mono(28, '#dd0000', true))
			.setOrigin(0.5).setDepth(23)
			.setStroke('#880000', 4)
			.setShadow(2, 2, '#ff0000', 8, true, false);

		// SCORE label + value
		this.add.text(px, py - 66, 'SCORE', mono(11, '#aaaaaa'))
			.setOrigin(0.5).setDepth(23).setAlpha(0.8);

		const scoreTxt = this.add.text(px, py - 48, String(this.score), mono(42, '#00234f', true))
			.setOrigin(0.5).setDepth(23);

		// Score count-up
		let shown = 0;
		const finalScore = this.score;
		const inc = Math.max(1, Math.ceil(finalScore / 35));
		this.time.addEvent({
			delay: 28, repeat: 35,
			callback: () => {
				shown = Math.min(shown + inc, finalScore);
				scoreTxt.setText(String(shown));
			},
		});

		// BEST
		this.add.text(px, py + 10,
			`BEST    ${highScore}`,
			mono(13, '#00234f'))
			.setOrigin(0.5).setDepth(23);

		// LEVEL REACHED
		this.add.text(px, py + 36,
			`LEVEL REACHED: ${this.level}`,
			mono(13, '#00234f'))
			.setOrigin(0.5).setDepth(23);

		// [ PLAY AGAIN ] button
		const btnY = py + 108;
		const btnW = 210, btnH = 44;
		const GREEN = 0x00dd00;
		const GREEN_HOV = 0x00ff00;

		const btnBg = this.add.rectangle(px, btnY, btnW, btnH, GREEN, 1)
			.setDepth(23).setInteractive({ useHandCursor: true });

		const btnTxt = this.add.text(px, btnY, '[ PLAY AGAIN ]', mono(15, '#000000', true))
			.setOrigin(0.5).setDepth(24);

		btnBg.on('pointerover', () => {
			btnBg.setFillStyle(GREEN_HOV);
			this.tweens.add({ targets: [btnBg, btnTxt], scaleX: 1.04, scaleY: 1.04, duration: 80 });
		});
		btnBg.on('pointerout', () => {
			btnBg.setFillStyle(GREEN);
			this.tweens.add({ targets: [btnBg, btnTxt], scaleX: 1, scaleY: 1, duration: 80 });
		});
		btnBg.on('pointerdown', () => {
			this.cameras.main.flash(180, 255, 255, 255, false);
			this.time.delayedCall(200, () => this.scene.restart());
		});

		// Animate everything in
		const allItems = [panel, title, scoreTxt, btnBg, btnTxt];
		allItems.forEach(o => { o.setAlpha(0); });
		this.tweens.add({ targets: allItems, alpha: 1, duration: 350, delay: 150, ease: 'Power2' });
	}

	/* UPDATE */
	update(time, delta) {
		// Flipper key input — only let keyboard DEACTIVATE flippers when no touch is holding them.
		// Previously this ran unconditionally every frame, wiping out touch state immediately.
		const leftDown = this.cursors.left.isDown || this.keyA.isDown;
		const rightDown = this.cursors.right.isDown || this.keyD.isDown;
		if (leftDown) {
			this.activateFlipper('left');
		} else if (!this._leftPointers || this._leftPointers.size === 0) {
			this.deactivateFlipper('left');
		}
		if (rightDown) {
			this.activateFlipper('right');
		} else if (!this._rightPointers || this._rightPointers.size === 0) {
			this.deactivateFlipper('right');
		}

		// Animate flippers — up = tips raise, down = tips droop
		// Left: rest=+28 (tip down-right), up=-28 (tip up-right)
		// Right: rest=-28 (tip down-left), up=+28 (tip up-left)
		const targetLeft = this.leftFlipperUp ? -28 : 28;
		const targetRight = this.rightFlipperUp ? 28 : -28;

		this.leftFlipper.angle = Phaser.Math.Linear(this.leftFlipper.angle, targetLeft, 0.28);
		this.rightFlipper.angle = Phaser.Math.Linear(this.rightFlipper.angle, targetRight, 0.28);
		this.leftFlipperGlow.angle = this.leftFlipper.angle;
		this.rightFlipperGlow.angle = this.rightFlipper.angle;

		// Sync static flipper bodies
		this.leftFlipperBody.angle = this.leftFlipper.angle;
		this.leftFlipperBody.body.reset(this.FLIPPER_PL, this.FLIPPER_Y);

		this.rightFlipperBody.angle = this.rightFlipper.angle;
		this.rightFlipperBody.body.reset(this.FLIPPER_PR, this.FLIPPER_Y);

		// Ball updates
		this.balls.forEach(ball => {
			if (!ball.active) return;

			// Follow glow
			ball._glow.setPosition(ball.x, ball.y);

			// Trail
			this.updateTrail(ball);

			// Clamp extreme velocity
			const v = ball.body.velocity;
			const spd = Math.sqrt(v.x * v.x + v.y * v.y);
			if (spd > 900) {
				ball.setVelocity(v.x / spd * 900, v.y / spd * 900);
			}

			// Drain detection
			if (ball.y > this.H + 30) {
				this.ballLost(ball);
				return;
			}

			// Stuck-on-wall detection
			// If ball is pressed against a side world-bound with near-zero vx
			// for more than 2 seconds, treat it as a lost ball (game over trigger)
			const nearLeftWall = ball.x < 75 && Math.abs(ball.body.velocity.x) < 15;
			const nearRightWall = ball.x > this.W - 75 && Math.abs(ball.body.velocity.x) < 15;
			if (nearLeftWall || nearRightWall) {
				if (!this.wallStuckTimer[ball._id]) this.wallStuckTimer[ball._id] = time;
				if (time - this.wallStuckTimer[ball._id] > 2000) {
					// Give it a hard shove first; if still stuck 1s later, kill the ball
					ball.setVelocity(nearLeftWall ? 400 : -400, -300);
					this.wallStuckTimer[ball._id] = time + 1000; // reset with grace
					this.cameras.main.shake(150, 0.01);
				}
			} else {
				delete this.wallStuckTimer[ball._id];
			}

			// Bumper overlap
			this.bumperData.forEach((bd, i) => {
				const dx = ball.x - bd.sprite.x;
				const dy = ball.y - bd.sprite.y;
				if (Math.sqrt(dx * dx + dy * dy) < 34) {
					// Throttle: only once per 200ms per bumper
					const now = time;
					if (!bd.lastHit || now - bd.lastHit > 180) {
						bd.lastHit = now;
						this.hitBumper(ball, bd, i);
					}
				}
			});
		});

		// Bumper flash update
		this.bumperData.forEach((bd, i) => {
			if (bd.flashTimer > 0) {
				bd.flashTimer--;
				const t = bd.flashTimer / 12;
				bd.sprite.setTint(
					Phaser.Display.Color.GetColor(
						Math.round(255 * (1 - t) + Phaser.Display.Color.ValueToColor(hexToNum(this.palette.playerCore)).r * t),
						Math.round(255 * (1 - t)),
						Math.round(255 * t),
					),
				);
				bd.glow.setAlpha(0.6 + (1 - t) * 0.4);
				bd.glow.setScale(1.3 + (1 - t) * 0.5);
			} else {
				bd.sprite.setTint(hexToNum(this.palette.playerCore));
				bd.glow.setAlpha(0.3);
				bd.glow.setScale(1.3);
			}

			// Pulse glow gently
			bd.glow.setAlpha(bd.flashTimer > 0
				? 0.7
				: 0.25 + 0.1 * Math.sin(time / 600 + i * 1.3),
			);
		});
	}

	updateTrail(ball) {
		ball._trail.push({ x: ball.x, y: ball.y });
		if (ball._trail.length > 10) ball._trail.shift();

		ball._trailGraphics.clear();
		for (let i = 1; i < ball._trail.length; i++) {
			const alpha = (i / ball._trail.length) * 0.35;
			const size = (i / ball._trail.length) * 5;
			ball._trailGraphics.fillStyle(hexToNum(this.palette.playerCore), alpha);
			ball._trailGraphics.fillCircle(ball._trail[i].x, ball._trail[i].y, size);
		}
	}
}

/* ══════════════════════════════════════════════════════════
	 PHASER CONFIG & BOOT
══════════════════════════════════════════════════════════ */
const config = {
	type: Phaser.AUTO,
	width: 500,
	height: 750,
	backgroundColor: 0xc4e2f5,
	input: {
		activePointers: 3,
	},
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 600 },
			debug: false,
			fps: 120,         // double substep rate — prevents tunnelling at high speeds
		},
	},
	scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);
