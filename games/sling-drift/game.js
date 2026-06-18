// ============================================================
//  SLING DRIFT  –  Complete Phaser 3 Game
//  Production-ready, self-contained game.js
// ============================================================

/* FreshPlay shim (safe when the real SDK is present) */
window.FreshPlay = window.FreshPlay || {
	levelComplete(cb) { setTimeout(cb, 0); },
	gameOver(score) { console.log('Game Over – score:', score); },
	getCurrentPalette() {
		return {
			background: '#f0f4f8',
			playerCore: '#3b82f6',
			fxAccent: '#f0a500',
			hostile: '#ff2d55',
			interface: '#cbd5e1',
		};
	},
};

/* ══════════════════════════════════════════════════════════
	 AUDIO  –  tiny Web-Audio synthesiser
══════════════════════════════════════════════════════════ */
const SFX = (() => {
	let ctx;
	function getCtx() {
		if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
		return ctx;
	}

	function snap() {
		const c = getCtx();
		const g = c.createGain(); g.connect(c.destination);
		g.gain.setValueAtTime(0.6, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
		const o = c.createOscillator();
		o.type = 'sawtooth'; o.frequency.setValueAtTime(800, c.currentTime);
		o.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.12);
		o.connect(g); o.start(); o.stop(c.currentTime + 0.13);
	}

	function screech(active) {
		const c = getCtx();
		if (screech._node) { screech._node.stop(); screech._node = null; }
		if (!active) return;
		const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
		const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
		const fil = c.createBiquadFilter(); fil.type = 'bandpass';
		fil.frequency.value = 2400; fil.Q.value = 1.5;
		const g = c.createGain(); g.gain.value = 0.18;
		src.connect(fil); fil.connect(g); g.connect(c.destination);
		src.start(); screech._node = src;
	}

	function boom() {
		const c = getCtx();
		const buf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++)
			d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.12));
		const src = c.createBufferSource(); src.buffer = buf;
		const g = c.createGain(); g.gain.value = 0.9;
		src.connect(g); g.connect(c.destination); src.start();
	}

	function release() {
		const c = getCtx();
		const o = c.createOscillator(); const g = c.createGain();
		o.type = 'sine'; o.frequency.setValueAtTime(440, c.currentTime);
		o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.08);
		g.gain.setValueAtTime(0.4, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
		o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.26);
	}

	return { snap, screech, boom, release };
})();

/* ══════════════════════════════════════════════════════════
	 TRACK GENERATION  –  cubic Bézier segments
══════════════════════════════════════════════════════════ */
const HALF_W = 110;  // half-width of drivable lane (wider = easier)

function generateTrack(numSegments, cornerSharpness) {
	// Returns array of world-space points (centre-line) + corner metadata
	const pts = [{ x: 0, y: 0 }];
	let angle = -Math.PI / 2; // start heading upward
	let cx = 0, cy = 0;
	const corners = [];
	const straightLen = 340;
	const minRadius = 120 + (1 - cornerSharpness) * 180;

	for (let i = 0; i < numSegments; i++) {
		// straight
		const sx = cx + Math.cos(angle) * straightLen;
		const sy = cy + Math.sin(angle) * straightLen;
		pts.push({ x: sx, y: sy });

		// turn direction alternates + slight random bias
		const turn = (i % 2 === 0 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.4);
		const newAngle = angle + turn;
		const radius = minRadius + Math.random() * 60;

		// arc centre
		const perpAngle = angle + Math.PI / 2 * Math.sign(turn);
		const arcCx = sx + Math.cos(perpAngle) * radius;
		const arcCy = sy + Math.sin(perpAngle) * radius;

		// sample arc
		const steps = 18;
		const arcStart = angle - perpAngle + Math.PI;
		const arcEnd = arcStart + turn;
		for (let s = 1; s <= steps; s++) {
			const t = s / steps;
			const a = arcStart + (arcEnd - arcStart) * t;
			pts.push({ x: arcCx + Math.cos(a) * radius, y: arcCy + Math.sin(a) * radius });
		}

		// record corner pillar at arc centre
		corners.push({
			x: arcCx, y: arcCy,
			radius,
			segIndex: pts.length - Math.floor(steps / 2),
			dir: Math.sign(turn),
		});

		const last = pts[pts.length - 1];
		cx = last.x; cy = last.y;
		angle = newAngle;
	}

	return { pts, corners };
}

function buildWalls(pts) {
	// Offset left/right of centre-line
	const left = [], right = [];
	for (let i = 0; i < pts.length; i++) {
		const prev = pts[Math.max(0, i - 1)];
		const next = pts[Math.min(pts.length - 1, i + 1)];
		const dx = next.x - prev.x;
		const dy = next.y - prev.y;
		const len = Math.hypot(dx, dy) || 1;
		const nx = -dy / len, ny = dx / len; // left normal
		left.push({ x: pts[i].x + nx * HALF_W, y: pts[i].y + ny * HALF_W });
		right.push({ x: pts[i].x - nx * HALF_W, y: pts[i].y - ny * HALF_W });
	}
	return { left, right };
}

/* ══════════════════════════════════════════════════════════
	 PHASER CONFIG
══════════════════════════════════════════════════════════ */
const config = {
	type: Phaser.AUTO,
	backgroundColor: '#f8fafc',
	parent: document.body,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: window.innerWidth,
		height: window.innerHeight,
	},
	scene: [BootScene, GameScene, UIScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
};
const game = new Phaser.Game(config);

/* ══════════════════════════════════════════════════════════
	 BOOT SCENE
══════════════════════════════════════════════════════════ */
function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); }
BootScene.prototype = Object.create(Phaser.Scene.prototype);
BootScene.prototype.constructor = BootScene;
BootScene.prototype.create = function () {
	// Generate textures programmatically
	createCarTexture(this);
	createGlowTexture(this);
	this.scene.start('Game');
};

function createCarTexture(scene) {
	const g = scene.make.graphics({ x: 0, y: 0, add: false });
	g.fillStyle(0x0f172a);
	g.fillRect(-14, -8, 28, 16);   // body
	g.fillStyle(0xaaddff, 0.7);
	g.fillRect(-8, -5, 12, 10);    // windshield
	g.fillStyle(0x334455);
	g.fillRect(-14, -9, 7, 5);     // wheel fl
	g.fillRect(7, -9, 7, 5);     // wheel fr
	g.fillRect(-14, 4, 7, 5);     // wheel rl
	g.fillRect(7, 4, 7, 5);     // wheel rr
	g.generateTexture('car', 32, 20);
	g.destroy();
}

function createGlowTexture(scene) {
	const g = scene.make.graphics({ x: 0, y: 0, add: false });
	g.fillStyle(0x0f172a);
	const r = 24;
	for (let i = r; i >= 2; i -= 2) {
		g.fillCircle(r, r, i);
	}
	g.generateTexture('glow', r * 2, r * 2);
	g.destroy();
}

/* ══════════════════════════════════════════════════════════
	 GAME SCENE
══════════════════════════════════════════════════════════ */
function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function (data) {
	this.level = data.level || 1;
	this.score = data.score || 0;
	this.baseSpeed = 130 + (this.level - 1) * 10;
	this.cornerSharp = Math.min(0.6, 0.2 + (this.level - 1) * 0.05);
	this.cornersToGo = 5 + this.level;   // corners per level
	this.cornersDone = 0;
	this.palette = window.FreshPlay.getCurrentPalette();
	this.dead = false;
	this.tethered = false;
	this.pillarTarget = null;
	this.invincible = true;   // no collision for first second
};

GameScene.prototype.create = function () {
	const W = this.scale.width, H = this.scale.height;
	this.cameras.main.setBackgroundColor(this.palette.background);

	/* build track */
	const totalSegs = this.cornersToGo + 3;
	const { pts, corners } = generateTrack(totalSegs, this.cornerSharp);
	const { left, right } = buildWalls(pts);
	this.trackPts = pts;
	this.trackLeft = left;
	this.trackRight = right;
	this.corners = corners;

	/* graphics layers */
	this.gfxTrack = this.add.graphics();
	this.gfxWalls = this.add.graphics();
	this.gfxTether = this.add.graphics();
	this.gfxSparks = this.add.graphics();
	this.gfxPillar = this.add.graphics();

	this.drawTrack();

	/* car */
	this.car = this.add.image(pts[0].x, pts[0].y, 'car');
	this.car.setTint(Phaser.Display.Color.HexStringToColor(this.palette.playerCore).color);
	this.car.setDepth(10);

	// car state
	this.carPos = 0;      // parametric position along pts (float index)
	this.carSpeed = this.baseSpeed;
	this.carAngle = 0;

	// pendulum state (world-space)
	this.pendAngle = 0;
	this.pendOmega = 0;
	this.pendLength = 0;

	/* particle system (sparks) */
	this.sparks = [];

	/* camera */
	this.cameras.main.startFollow(this.car, true, 0.08, 0.08);
	this.cameras.main.setZoom(1.1);

	/* input */
	this.input.keyboard.on('keydown-SPACE', () => this.attachTether());
	this.input.keyboard.on('keyup-SPACE', () => this.releaseTether());
	this.input.on('pointerdown', () => this.attachTether());
	this.input.on('pointerup', () => this.releaseTether());

	/* boost overlay */
	this.boostFx = this.add.graphics();
	this.boostFx.setDepth(20);
	this.boostAlpha = 0;

	/* UI scene */
	this.scene.launch('UI', {
		score: this.score,
		level: this.level,
		palette: this.palette,
		gameRef: this,
	});

	/* timers */
	this._lastTime = 0;
	this.time.delayedCall(1500, () => { this.invincible = false; });
};

GameScene.prototype.drawTrack = function () {
	const p = this.palette;
	const col = Phaser.Display.Color.HexStringToColor;
	const trackCol = col(p.background).color;
	const wallCol = col(p.hostile).color;
	const laneCol = 0x0a1520;

	this.gfxTrack.clear();
	this.gfxWalls.clear();
	this.gfxPillar.clear();

	const pts = this.trackPts;
	const L = this.trackLeft, R = this.trackRight;

	// filled lane
	this.gfxTrack.fillStyle(laneCol, 1);
	this.gfxTrack.beginPath();
	this.gfxTrack.moveTo(L[0].x, L[0].y);
	for (let i = 1; i < L.length; i++) this.gfxTrack.lineTo(L[i].x, L[i].y);
	for (let i = R.length - 1; i >= 0; i--) this.gfxTrack.lineTo(R[i].x, R[i].y);
	this.gfxTrack.closePath();
	this.gfxTrack.fillPath();

	// centre dashes
	this.gfxTrack.lineStyle(2, 0x112233, 0.5);
	this.gfxTrack.beginPath();
	for (let i = 0; i < pts.length - 1; i++) {
		if (i % 4 < 2) {
			this.gfxTrack.moveTo(pts[i].x, pts[i].y);
			this.gfxTrack.lineTo(pts[i + 1].x, pts[i + 1].y);
		}
	}
	this.gfxTrack.strokePath();

	// walls (neon glow)
	const hostileHex = Phaser.Display.Color.HexStringToColor(this.palette.hostile).color;
	[L, R].forEach(wall => {
		// outer glow
		this.gfxWalls.lineStyle(6, hostileHex, 0.18);
		this.gfxWalls.beginPath();
		wall.forEach((p, i) => i === 0 ? this.gfxWalls.moveTo(p.x, p.y) : this.gfxWalls.lineTo(p.x, p.y));
		this.gfxWalls.strokePath();
		// inner crisp line
		this.gfxWalls.lineStyle(2, hostileHex, 0.9);
		this.gfxWalls.beginPath();
		wall.forEach((p, i) => i === 0 ? this.gfxWalls.moveTo(p.x, p.y) : this.gfxWalls.lineTo(p.x, p.y));
		this.gfxWalls.strokePath();
	});

	// pillars
	const accentHex = Phaser.Display.Color.HexStringToColor(this.palette.fxAccent).color;
	this.corners.forEach(c => {
		this.gfxPillar.fillStyle(accentHex, 0.15);
		this.gfxPillar.fillCircle(c.x, c.y, 22);
		this.gfxPillar.lineStyle(3, accentHex, 0.9);
		this.gfxPillar.strokeCircle(c.x, c.y, 14);
		this.gfxPillar.fillStyle(accentHex, 1);
		this.gfxPillar.fillCircle(c.x, c.y, 5);
	});
};

GameScene.prototype.attachTether = function () {
	if (this.dead || this.tethered) return;
	const pillar = this.nearestPillar();
	if (!pillar) return;
	SFX.snap();
	SFX.screech(true);
	this.tethered = true;
	this.pillarTarget = pillar;
	const cx = this.car.x, cy = this.car.y;
	this.pendLength = Math.hypot(pillar.x - cx, pillar.y - cy);
	this.pendAngle = Math.atan2(cy - pillar.y, cx - pillar.x);
	// derive angular velocity from car linear velocity
	const carVx = Math.cos(this.carAngle) * this.carSpeed;
	const carVy = Math.sin(this.carAngle) * this.carSpeed;
	// tangential component
	const tx = -Math.sin(this.pendAngle), ty = Math.cos(this.pendAngle);
	const tanV = carVx * tx + carVy * ty;
	this.pendOmega = tanV / this.pendLength;
};

GameScene.prototype.releaseTether = function () {
	if (!this.tethered) return;
	SFX.screech(false);
	SFX.release();
	this.tethered = false;

	// detect how well-aligned release is
	const pillar = this.pillarTarget;
	const carToNext = this.headingToNextStraight();
	const releaseAngle = Math.atan2(
		this.car.y - pillar.y, this.car.x - pillar.x
	);
	const diff = Math.abs(Phaser.Math.Angle.Wrap(releaseAngle - carToNext));
	if (diff < 0.25) {
		// perfect release
		this.triggerBoost();
		this.score += 100;
		this.cornersDone++;
		this.checkLevelComplete();
	} else {
		this.score += 20;
		this.cornersDone++;
		this.checkLevelComplete();
	}
	this.scene.get('UI').updateScore(this.score);
};

GameScene.prototype.headingToNextStraight = function () {
	const i = Math.floor(this.carPos);
	const ni = Math.min(i + 4, this.trackPts.length - 1);
	const dx = this.trackPts[ni].x - this.trackPts[i].x;
	const dy = this.trackPts[ni].y - this.trackPts[i].y;
	return Math.atan2(dy, dx);
};

GameScene.prototype.nearestPillar = function () {
	const cx = this.car.x, cy = this.car.y;
	let best = null, bestDist = Infinity;
	this.corners.forEach(c => {
		const d = Math.hypot(c.x - cx, c.y - cy);
		if (d < 350 && d < bestDist) { bestDist = d; best = c; }
	});
	return best;
};

GameScene.prototype.triggerBoost = function () {
	this.carSpeed += 35;
	setTimeout(() => { if (!this.dead) this.carSpeed = Math.max(this.baseSpeed, this.carSpeed - 35); }, 1200);
	this.boostAlpha = 0.7;
	// spawn sparks
	for (let i = 0; i < 22; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 80 + Math.random() * 140;
		this.sparks.push({
			x: this.car.x, y: this.car.y,
			vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
			life: 0.6 + Math.random() * 0.4,
			maxLife: 1, size: 3 + Math.random() * 4,
		});
	}
};

GameScene.prototype.checkLevelComplete = function () {
	// Endless mode – no level cap. Just increase speed gradually every 6 corners.
	if (this.cornersDone > 0 && this.cornersDone % 6 === 0) {
		this.baseSpeed = Math.min(320, this.baseSpeed + 12);
		this.carSpeed = Math.max(this.carSpeed, this.baseSpeed);
		// show a brief "KEEP GOING" style flash via UI
		const ui = this.scene.get('UI');
		if (ui && ui.showComplete) ui.showComplete();
	}
};

GameScene.prototype.die = function () {
	if (this.dead) return;
	this.dead = true;
	SFX.screech(false);
	SFX.boom();
	// explosion sparks
	for (let i = 0; i < 40; i++) {
		const a = Math.random() * Math.PI * 2;
		const s = 60 + Math.random() * 200;
		this.sparks.push({
			x: this.car.x, y: this.car.y,
			vx: Math.cos(a) * s, vy: Math.sin(a) * s,
			life: 0.8 + Math.random() * 0.8, maxLife: 1.6,
			size: 4 + Math.random() * 8, explosion: true,
		});
	}
	this.car.setVisible(false);
	if (!this.revived) {
		this.revived = true;
		this.time.delayedCall(900, () => {
			const W = this.scale.width, H = this.scale.height;
			const cam = this.cameras.main;
			const cx = cam.scrollX + W / 2, cy = cam.scrollY + H / 2;
			const p = this.palette;

			const rBg = this.add.graphics().setDepth(50);
			rBg.fillStyle(0xffffff, 0.97);
			rBg.fillRect(cx - 160, cy - 80, 320, 160);
			rBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(p.playerCore).color, 1);
			rBg.strokeRect(cx - 160, cy - 80, 320, 160);

			const rTxt = this.add.text(cx, cy - 40, 'SECOND CHANCE?', {
				fontFamily: 'monospace', fontSize: '24px', color: p.playerCore
			}).setOrigin(0.5).setDepth(51);

			const btnRevive = this.add.text(cx - 75, cy + 30, 'WATCH AD\nTO REVIVE', {
				fontFamily: 'monospace', fontSize: '14px', color: '#000',
				backgroundColor: p.playerCore, padding: {x: 10, y: 10}, align: 'center'
			}).setOrigin(0.5).setDepth(51).setInteractive({useHandCursor: true});

			const btnSkip = this.add.text(cx + 75, cy + 30, 'SKIP', {
				fontFamily: 'monospace', fontSize: '16px', color: '#0f172a',
				backgroundColor: '#f8fafc', padding: {x: 20, y: 15}
			}).setOrigin(0.5).setDepth(51).setInteractive({useHandCursor: true});

			const cleanUp = () => {
				rBg.destroy(); rTxt.destroy(); btnRevive.destroy(); btnSkip.destroy();
			};

			btnSkip.on('pointerdown', () => {
				cleanUp();
				window.FreshPlay.gameOver(this.score);
				this.scene.stop('UI');
				this.showGameOver();
			});

			btnRevive.on('pointerdown', () => {
				cleanUp();
				const doRevive = () => {
					this.dead = false;
					this.car.setVisible(true);
					this.carPos = Math.max(0, Math.floor(this.carPos) - 1);
					this.carSpeed = this.baseSpeed;
					this.tethered = false;
					this.invincible = true;
					this.time.delayedCall(1500, () => { this.invincible = false; });
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
		this.scene.stop('UI');
		this.showGameOver();
	});
};

GameScene.prototype.showGameOver = function () {
	const W = this.scale.width, H = this.scale.height;
	const cam = this.cameras.main;
	const cx = cam.scrollX + W / 2, cy = cam.scrollY + H / 2;
	const p = this.palette;

	const panel = this.add.graphics();
	panel.fillStyle(0x000000, 0.85);
	panel.fillRoundedRect(cx - 200, cy - 130, 400, 260, 18);
	panel.lineStyle(2, Phaser.Display.Color.HexStringToColor(p.hostile).color, 0.9);
	panel.strokeRoundedRect(cx - 200, cy - 130, 400, 260, 18);
	panel.setDepth(50);

	const titleStyle = { fontFamily: 'monospace', fontSize: '38px', color: p.hostile, stroke: p.hostile, strokeThickness: 1 };
	const scoreStyle = { fontFamily: 'monospace', fontSize: '22px', color: p.interface };
	const hintStyle = { fontFamily: 'monospace', fontSize: '15px', color: p.fxAccent };

	this.add.text(cx, cy - 85, 'GAME OVER', titleStyle).setOrigin(0.5).setDepth(51);
	this.add.text(cx, cy - 25, `SCORE  ${this.score}`, scoreStyle).setOrigin(0.5).setDepth(51);
	this.add.text(cx, cy + 15, `LEVEL  ${this.level}`, scoreStyle).setOrigin(0.5).setDepth(51);

	const btn = this.add.text(cx, cy + 75, '[ RETRY ]', {
		fontFamily: 'monospace', fontSize: '20px',
		color: p.playerCore, stroke: p.playerCore, strokeThickness: 1,
	}).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
	btn.on('pointerover', () => btn.setAlpha(0.6));
	btn.on('pointerout', () => btn.setAlpha(1));
	btn.on('pointerdown', () => { this.scene.start('Game', { level: 1, score: 0 }); });

	// blink
	this.tweens.add({ targets: btn, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
};

GameScene.prototype.update = function (time, delta) {
	if (this.dead && this.car.visible === false) {
		this.updateSparks(delta / 1000);
		this.drawSparks();
		return;
	}
	if (this.dead) return;

	const dt = delta / 1000;

	if (this.tethered) {
		this.updatePendulum(dt);
	} else {
		this.driveAlongTrack(dt);
	}

	this.updateSparks(dt);
	this.drawTether();
	this.drawSparks();
	this.updateBoostFx();
	if (!this.invincible && !this.tethered) this.checkWallCollision();
	this.spawnDriftSparks();
};

GameScene.prototype.driveAlongTrack = function (dt) {
	const pts = this.trackPts;
	const step = this.carSpeed * dt;
	let remaining = step;
	let i = Math.floor(this.carPos);

	while (remaining > 0 && i < pts.length - 1) {
		const seg = pts[i + 1];
		const cur = pts[i];
		const segLen = Math.hypot(seg.x - cur.x, seg.y - cur.y);
		const frac = this.carPos - i;
		const distInSeg = segLen * (1 - frac);
		if (remaining < distInSeg) {
			this.carPos += remaining / segLen;
			break;
		}
		remaining -= distInSeg;
		i++;
		this.carPos = i;
	}

	if (this.carPos >= pts.length - 1) {
		this.carPos = pts.length - 2;
	}

	// Extend track when car is within 40 points of the end
	if (this.carPos >= this.trackPts.length - 40) {
		this.extendTrack();
	}

	const ip = Math.floor(this.carPos);
	const t = this.carPos - ip;
	const a = pts[ip], b = pts[Math.min(ip + 1, pts.length - 1)];
	this.car.x = a.x + (b.x - a.x) * t;
	this.car.y = a.y + (b.y - a.y) * t;
	this.carAngle = Math.atan2(b.y - a.y, b.x - a.x);
	this.car.setRotation(this.carAngle);
};

GameScene.prototype.extendTrack = function () {
	if (this._extending) return;
	this._extending = true;

	const last = this.trackPts[this.trackPts.length - 1];
	const prev = this.trackPts[this.trackPts.length - 2];
	// figure out current heading from last two points
	const angle = Math.atan2(last.y - prev.y, last.x - prev.x);

	// generate a new chunk starting from where old track ended
	const { pts: newPts, corners: newCorners } = generateTrack(8, this.cornerSharp);

	// transform new pts to continue from last point at current angle
	const cos = Math.cos(angle + Math.PI / 2), sin = Math.sin(angle + Math.PI / 2);
	const ox = last.x, oy = last.y;
	const transformed = newPts.map(p => ({
		x: ox + p.x * Math.cos(angle) - p.y * Math.sin(angle),
		y: oy + p.x * Math.sin(angle) + p.y * Math.cos(angle),
	}));

	const { left: newL, right: newR } = buildWalls(transformed);

	// Append (skip first point to avoid duplicate)
	transformed.slice(1).forEach(p => this.trackPts.push(p));
	newL.slice(1).forEach(p => this.trackLeft.push(p));
	newR.slice(1).forEach(p => this.trackRight.push(p));

	// Append new corners (offset their indices)
	const idxOffset = this.trackPts.length - transformed.length + 1;
	newCorners.forEach(c => {
		const tc = {
			x: ox + c.x * Math.cos(angle) - c.y * Math.sin(angle),
			y: oy + c.x * Math.sin(angle) + c.y * Math.cos(angle),
			radius: c.radius,
			dir: c.dir,
			segIndex: c.segIndex + idxOffset,
		};
		this.corners.push(tc);
	});

	// Redraw the extended track
	this.drawTrack();
	this._extending = false;
};

GameScene.prototype.updatePendulum = function (dt) {
	const pillar = this.pillarTarget;
	// simple pendulum: α = -ω²·sin(θ)  (no gravity → just centripetal; use angular drag + constant spin)
	// For top-down feel we skip gravity; car swings in a circle around pillar
	// Just integrate angle by omega with slight drag
	this.pendOmega *= 0.998;
	this.pendAngle += this.pendOmega * dt;

	this.car.x = pillar.x + Math.cos(this.pendAngle) * this.pendLength;
	this.car.y = pillar.y + Math.sin(this.pendAngle) * this.pendLength;
	// car faces tangent direction
	const tx = -Math.sin(this.pendAngle) * Math.sign(this.pendOmega);
	const ty = Math.cos(this.pendAngle) * Math.sign(this.pendOmega);
	this.carAngle = Math.atan2(ty, tx);
	this.car.setRotation(this.carAngle);
	// sync carPos to nearest track point
	this.syncCarPosToNearest();
};

GameScene.prototype.syncCarPosToNearest = function () {
	const pts = this.trackPts;
	let best = this.carPos, bestD = Infinity;
	const start = Math.max(0, Math.floor(this.carPos) - 5);
	const end = Math.min(pts.length - 1, Math.floor(this.carPos) + 30);
	for (let i = start; i < end; i++) {
		const d = Math.hypot(pts[i].x - this.car.x, pts[i].y - this.car.y);
		if (d < bestD) { bestD = d; best = i; }
	}
	this.carPos = best;
};

GameScene.prototype.checkWallCollision = function () {
	const cx = this.car.x, cy = this.car.y;
	const pts = this.trackPts;
	const i = Math.min(Math.floor(this.carPos), pts.length - 2);
	const L = this.trackLeft, R = this.trackRight;

	// Build local segment direction from centre-line neighbours
	const k0 = Math.max(0, i - 1);
	const k1 = Math.min(pts.length - 1, i + 1);
	const sdx = pts[k1].x - pts[k0].x;
	const sdy = pts[k1].y - pts[k0].y;
	const sLen = Math.hypot(sdx, sdy) || 1;
	// left normal
	const nx = -sdy / sLen, ny = sdx / sLen;

	// signed offset of car from the local centre
	const midX = pts[i].x, midY = pts[i].y;
	const offset = (cx - midX) * nx + (cy - midY) * ny;

	// measure half-track-width from the wall points at this index
	const lOff = (L[i].x - midX) * nx + (L[i].y - midY) * ny;
	const rOff = (R[i].x - midX) * nx + (R[i].y - midY) * ny;
	const halfW = Math.max(Math.abs(lOff), Math.abs(rOff));

	// kill only if car is clearly outside wall (with 18 px grace buffer)
	const BUFFER = 18;
	if (Math.abs(offset) > halfW + BUFFER) {
		this.die();
	}
};

GameScene.prototype.drawTether = function () {
	this.gfxTether.clear();
	if (!this.tethered || !this.pillarTarget) return;
	const p = this.palette;
	const col = Phaser.Display.Color.HexStringToColor(p.playerCore).color;
	// animated dashes
	const t = this.time.now / 80;
	const pillar = this.pillarTarget;
	const dx = pillar.x - this.car.x, dy = pillar.y - this.car.y;
	const len = Math.hypot(dx, dy);
	const steps = Math.floor(len / 12);
	for (let i = 0; i < steps; i++) {
		const f0 = ((i + t * 0.1) % steps) / steps;
		const f1 = ((i + 1 + t * 0.1) % steps) / steps;
		if ((i + Math.floor(t)) % 2 === 0) {
			this.gfxTether.lineStyle(2, col, 0.85);
			this.gfxTether.beginPath();
			this.gfxTether.moveTo(this.car.x + dx * f0, this.car.y + dy * f0);
			this.gfxTether.lineTo(this.car.x + dx * f1, this.car.y + dy * f1);
			this.gfxTether.strokePath();
		}
	}
	// outer glow
	this.gfxTether.lineStyle(6, col, 0.18);
	this.gfxTether.beginPath();
	this.gfxTether.moveTo(this.car.x, this.car.y);
	this.gfxTether.lineTo(pillar.x, pillar.y);
	this.gfxTether.strokePath();
};

GameScene.prototype.spawnDriftSparks = function () {
	if (!this.tethered) return;
	const p = this.palette;
	for (let i = 0; i < 2; i++) {
		const a = this.carAngle + Math.PI + (Math.random() - 0.5) * 1.2;
		const spd = 40 + Math.random() * 80;
		this.sparks.push({
			x: this.car.x, y: this.car.y,
			vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
			life: 0.2 + Math.random() * 0.3, maxLife: 0.5,
			size: 2 + Math.random() * 3, drift: true,
		});
	}
};

GameScene.prototype.updateSparks = function (dt) {
	this.sparks = this.sparks.filter(s => s.life > 0);
	this.sparks.forEach(s => {
		s.x += s.vx * dt; s.y += s.vy * dt;
		s.vx *= 0.94; s.vy *= 0.94;
		s.life -= dt;
	});
};

GameScene.prototype.drawSparks = function () {
	this.gfxSparks.clear();
	const p = this.palette;
	const boostCol = Phaser.Display.Color.HexStringToColor(p.playerCore).color;
	const driftCol = Phaser.Display.Color.HexStringToColor(p.fxAccent).color;
	const explCol = Phaser.Display.Color.HexStringToColor(p.hostile).color;
	this.sparks.forEach(s => {
		const alpha = Math.max(0, s.life / (s.maxLife || 0.6));
		const col = s.explosion ? explCol : (s.drift ? driftCol : boostCol);
		this.gfxSparks.fillStyle(col, alpha);
		this.gfxSparks.fillCircle(s.x, s.y, s.size * alpha);
	});
};

GameScene.prototype.updateBoostFx = function () {
	this.boostFx.clear();
	if (this.boostAlpha <= 0) return;
	const W = this.scale.width, H = this.scale.height;
	const cam = this.cameras.main;
	const p = this.palette;
	const col = Phaser.Display.Color.HexStringToColor(p.playerCore).color;
	this.boostFx.fillStyle(col, this.boostAlpha * 0.12);
	this.boostFx.fillRect(cam.scrollX, cam.scrollY, W, H);
	// speed lines
	const cx = this.car.x, cy = this.car.y;
	for (let i = 0; i < 14; i++) {
		const a = this.carAngle + Math.PI + (i / 14) * Math.PI * 2;
		const d1 = 28 + Math.random() * 20, d2 = 90 + Math.random() * 60;
		this.boostFx.lineStyle(1.5, col, this.boostAlpha * 0.6);
		this.boostFx.beginPath();
		this.boostFx.moveTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
		this.boostFx.lineTo(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2);
		this.boostFx.strokePath();
	}
	this.boostAlpha = Math.max(0, this.boostAlpha - 0.04);
};

/* ══════════════════════════════════════════════════════════
	 UI SCENE  –  HUD overlay
══════════════════════════════════════════════════════════ */
function UIScene() { Phaser.Scene.call(this, { key: 'UI' }); }
UIScene.prototype = Object.create(Phaser.Scene.prototype);
UIScene.prototype.constructor = UIScene;

UIScene.prototype.init = function (data) {
	this.score = data.score;
	this.level = data.level;
	this.palette = data.palette;
	this.gameRef = data.gameRef;
};

UIScene.prototype.create = function () {
	const W = this.scale.width, H = this.scale.height;
	const p = this.palette;
	const col = Phaser.Display.Color.HexStringToColor;

	// Background strip top
	this.topBar = this.add.graphics();
	this.topBar.fillStyle(0x000000, 0.55);
	this.topBar.fillRect(0, 0, W, 58);
	this.topBar.lineStyle(1, col(p.playerCore).color, 0.4);
	this.topBar.lineBetween(0, 58, W, 58);

	// Score
	this.scoreTxt = this.add.text(W / 2, 18, `${this.score}`, {
		fontFamily: 'monospace',
		fontSize: '28px',
		color: p.interface,
		stroke: p.playerCore,
		strokeThickness: 1,
	}).setOrigin(0.5, 0);

	// Level badge
	this.levelBadge = this.add.graphics();
	this.drawLevelBadge(W, p, col);

	// HOLD label
	this.holdTxt = this.add.text(W / 2, H - 44, 'HOLD  [SPACE / TAP]  TO  SLING', {
		fontFamily: 'monospace',
		fontSize: '13px',
		color: p.fxAccent,
		alpha: 0.7,
	}).setOrigin(0.5);

	// corner counter
	this.cornerTxt = this.add.text(W - 20, 18, '', {
		fontFamily: 'monospace',
		fontSize: '15px',
		color: p.fxAccent,
	}).setOrigin(1, 0);

	this.updateCornerDisplay();

	// Pulsing level-complete banner (hidden)
	this.completeBanner = this.add.text(W / 2, H / 2, '', {
		fontFamily: 'monospace',
		fontSize: '42px',
		color: p.playerCore,
		stroke: p.playerCore,
		strokeThickness: 2,
	}).setOrigin(0.5).setAlpha(0).setDepth(60);
};

UIScene.prototype.drawLevelBadge = function (W, p, col) {
	this.levelBadge.clear();
	const bx = 20, by = 14, bw = 90, bh = 30;
	this.levelBadge.lineStyle(1.5, col(p.fxAccent).color, 0.8);
	this.levelBadge.strokeRect(bx, by, bw, bh);
	if (!this.levelTxt) {
		this.levelTxt = this.add.text(bx + bw / 2, by + bh / 2, `LVL  ${this.level}`, {
			fontFamily: 'monospace', fontSize: '16px', color: p.fxAccent,
		}).setOrigin(0.5);
	} else {
		this.levelTxt.setText(`LVL  ${this.level}`);
	}
};

UIScene.prototype.updateScore = function (s) {
	this.score = s;
	this.scoreTxt.setText(`${s}`);
	this.tweens.add({ targets: this.scoreTxt, scaleX: 1.25, scaleY: 1.25, duration: 80, yoyo: true });
	this.updateCornerDisplay();
};

UIScene.prototype.updateCornerDisplay = function () {
	if (!this.gameRef) return;
	const g = this.gameRef;
	this.cornerTxt.setText(`◆ ${g.cornersDone}`);
};

UIScene.prototype.showComplete = function () {
	const W = this.scale.width, H = this.scale.height;
	this.completeBanner.setText('LEVEL  CLEAR');
	this.tweens.add({
		targets: this.completeBanner, alpha: 1, scaleX: 1.15, scaleY: 1.15,
		duration: 300, yoyo: true, hold: 500,
		onComplete: () => this.completeBanner.setAlpha(0),
	});
};

UIScene.prototype.update = function () {
	if (this.gameRef) this.updateCornerDisplay();
};
