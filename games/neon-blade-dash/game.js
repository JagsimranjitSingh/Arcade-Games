class PlayScene extends Phaser.Scene {
	constructor() {
		super('PlayScene');
	}

	create() {
		this.events.on('hidden', () => { this.scene.resume(); }, this);
		this.game.events.off('hidden');
		this.game.events.off('blur');

		// Pure black void background
		this.cameras.main.setBackgroundColor(0x000000);

		this.neonColors = [0x00e5ff, 0xff00ff, 0x00ff00, 0xffff00, 0x00ffff];
		this.cyanColor = 0x00ccff; // Luminous cyan from sketch

		this.score = 0;
		this.levelScore = 0;
		this.lives = 3;
		this.isGameOver = false;

		// --- GLOBAL Audio Synth (Fixed restart bug) ---
		if (!window.retroAudioCtx) {
			window.retroAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
		}
		this.audioCtx = window.retroAudioCtx;
		this.musicStep = 0;

		if (this.audioCtx.state === 'running') {
			this.startContinuousBGM();
		} else {
			this.input.once('pointerdown', () => {
				if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
				this.startContinuousBGM();
			});
		}

		this.bgGraphics = this.add.graphics().setDepth(0);

		// Background speed streaks configuration
		this.streaks = [];
		for (let i = 0; i < 40; i++) {
			this.streaks.push({
				angleOff: Phaser.Math.FloatBetween(0.3, 1.0) * (Math.random() < 0.5 ? 1 : -1),
				progress: Phaser.Math.FloatBetween(0, 1),
				speed: Phaser.Math.FloatBetween(0.005, 0.015),
				length: Phaser.Math.FloatBetween(0.05, 0.15)
			});
		}

		this.popups = [];

		// --- Premium UI Setup ---
		this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
			fontFamily: 'Courier', fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
		}).setDepth(100);

		this.levelText = this.add.text(this.scale.width - 20, 20, 'LEVEL 1', {
			fontFamily: 'Courier', fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
		}).setOrigin(1, 0).setDepth(100);

		this.livesText = this.add.text(this.scale.width / 2, 20, this.getLivesString(), {
			fontFamily: 'Courier', fontSize: '24px', color: '#ff0044'
		}).setOrigin(0.5, 0).setDepth(100);

		// Fullscreen Toggle
		this.fsButton = this.add.text(20, this.scale.height - 20, '', {
			fontFamily: 'Courier', fontSize: '14px', fontStyle: 'bold'
		}).setOrigin(0, 1).setDepth(100).setInteractive({ useHandCursor: true });

		if (this.scale.isFullscreen) {
			this.fsButton.setText('[✖ EXIT FULL SCREEN]').setColor('#ff0044');
		} else {
			this.fsButton.setText('[⛶ FULLSCREEN]').setColor('#00ff00');
		}

		const toggleFullscreen = () => {
			if (this.scale.isFullscreen) this.scale.stopFullscreen();
			else this.scale.startFullscreen();
		};

		this.fsButton.on('pointerdown', toggleFullscreen);
		this.input.keyboard.off('keydown-F');
		this.input.keyboard.on('keydown-F', toggleFullscreen);

		this.scale.on('enterfullscreen', () => {
			this.fsButton.setText('[✖ EXIT FULL SCREEN]');
			this.fsButton.setColor('#ff0044');
		});

		this.scale.on('leavefullscreen', () => {
			this.fsButton.setText('[⛶ FULLSCREEN]');
			this.fsButton.setColor('#00ff00');
		});

		// Entity Groups
		this.targets = this.add.group();
		this.hostiles = this.add.group();

		this.nextSpawnTime = 0;
		this.currentSpawnRate = 1000;

		this.bladeCore = this.add.graphics().setDepth(51);
		this.bladeGlow = this.add.graphics().setDepth(50);
		this.trail = [];

		this.input.mouse.disableContextMenu();
		this.input.on('pointermove', this.handleSwipe, this);
	}

	getLivesString() {
		let str = '';
		for (let i = 0; i < 3; i++) {
			str += (i < this.lives) ? '◆ ' : '◇ ';
		}
		return str.trim();
	}

	startContinuousBGM() {
		if (this.bgmTimer) return;

		const notes = [261.63, 311.13, 392.00, 523.25];

		this.bgmTimer = this.time.addEvent({
			delay: 200,
			callback: () => {
				if (this.isGameOver) return;
				const osc = this.audioCtx.createOscillator();
				const gain = this.audioCtx.createGain();
				osc.connect(gain);
				gain.connect(this.audioCtx.destination);

				osc.type = 'sine';
				this.musicStep = (this.musicStep + 1) % notes.length;

				osc.frequency.setValueAtTime(notes[this.musicStep], this.audioCtx.currentTime);
				gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
				gain.gain.exponentialRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
				gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.18);

				osc.start();
				osc.stop(this.audioCtx.currentTime + 0.2);
			},
			loop: true
		});
	}

	playRetroSound(type) {
		if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
		const osc = this.audioCtx.createOscillator();
		const gain = this.audioCtx.createGain();
		osc.connect(gain);
		gain.connect(this.audioCtx.destination);

		if (type === 'slice') {
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1);
			gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
			osc.start(); osc.stop(this.audioCtx.currentTime + 0.1);
		} else if (type === 'error') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.3);
			gain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
			osc.start(); osc.stop(this.audioCtx.currentTime + 0.3);
		}
	}

	spawnPopup(text, x, y, color) {
		const popup = this.add.text(x, y, text, {
			fontFamily: 'Courier', fontSize: '24px', fontStyle: 'bold', color: color
		}).setOrigin(0.5).setDepth(150);

		this.popups.push({ textObj: popup, life: 1.0 });
	}

	spawnEntity() {
		if (this.isGameOver) return;

		const isHostile = Phaser.Math.Between(0, 100) > 75;
		const w = this.scale.width;
		const horizonY = 0;
		const centerX = w / 2;

		// Strict lane confinement on the cyan road
		const laneX = Phaser.Math.FloatBetween(-0.35, 0.35);
		const currentLevel = window.FreshPlay ? window.FreshPlay.currentLevel : 1;
		let entity;

		if (isHostile) {
			entity = this.add.star(centerX, horizonY, 6, 15, 30, 0xff0000).setDepth(10);
			if (entity.preFX) entity.preFX.addGlow(0xff0000, 8, 1, false);
			this.hostiles.add(entity);
		} else {
			let shapeTypes = ['circle'];
			if (currentLevel >= 3) shapeTypes.push('triangle');
			if (currentLevel >= 5) shapeTypes.push('diamond');
			if (currentLevel >= 7) shapeTypes.push('hexagon');

			const selectedShape = Phaser.Utils.Array.GetRandom(shapeTypes);
			const shapeColor = Phaser.Utils.Array.GetRandom(this.neonColors);

			if (selectedShape === 'circle') {
				entity = this.add.circle(centerX, horizonY, 25, shapeColor);
			} else if (selectedShape === 'triangle') {
				entity = this.add.triangle(centerX, horizonY, 0, 50, 25, 0, 50, 50, shapeColor);
			} else if (selectedShape === 'diamond') {
				entity = this.add.rectangle(centerX, horizonY, 35, 35, shapeColor);
				entity.rotation = Math.PI / 4;
			} else if (selectedShape === 'hexagon') {
				entity = this.add.polygon(centerX, horizonY, [20, 0, 40, 10, 40, 30, 20, 40, 0, 30, 0, 10], shapeColor);
			}
			entity.setDepth(10);
			entity.setData('color', shapeColor);
			if (entity.preFX) entity.preFX.addGlow(shapeColor, 4, 1, false);
			this.targets.add(entity);
		}

		// Custom properties for 3D fanning math
		entity.setData('lane', laneX);
		entity.setData('fallSpeed', 120);
		entity.setScale(0.01);
	}

	handleSwipe(pointer) {
		if (!pointer.isDown || this.isGameOver) {
			this.trail = [];
			this.bladeCore.clear();
			this.bladeGlow.clear();
			return;
		}

		const lastPoint = this.trail.length > 0 ? this.trail[this.trail.length - 1] : null;
		if (!lastPoint || lastPoint.x !== pointer.x || lastPoint.y !== pointer.y) {
			this.trail.push(new Phaser.Math.Vector2(pointer.x, pointer.y));
		}

		if (this.trail.length > 6) this.trail.shift();

		this.bladeCore.clear();
		this.bladeGlow.clear();

		this.bladeCore.lineStyle(2, 0xffffff, 1);
		this.bladeGlow.lineStyle(8, 0x00ffff, 0.6);

		this.bladeCore.beginPath();
		this.bladeGlow.beginPath();

		for (let i = 0; i < this.trail.length; i++) {
			if (i === 0) {
				this.bladeCore.moveTo(this.trail[i].x, this.trail[i].y);
				this.bladeGlow.moveTo(this.trail[i].x, this.trail[i].y);
			} else {
				this.bladeCore.lineTo(this.trail[i].x, this.trail[i].y);
				this.bladeGlow.lineTo(this.trail[i].x, this.trail[i].y);
			}
		}

		this.bladeCore.strokePath();
		this.bladeGlow.strokePath();

		this.checkSlices();
	}

	checkSlices() {
		if (this.trail.length < 2) return;

		const currentPoint = this.trail[this.trail.length - 1];
		const prevPoint = this.trail[this.trail.length - 2];
		const bladeLine = new Phaser.Geom.Line(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y);

		this.targets.getChildren().forEach(target => {
			if (target.active) {
				const targetCircle = new Phaser.Geom.Circle(target.x, target.y, 40 * target.scaleX);
				if (Phaser.Geom.Intersects.LineToCircle(bladeLine, targetCircle)) {
					this.playRetroSound('slice');
					this.createPremiumParticles(target.x, target.y, target.getData('color'));

					const points = 10 * (window.FreshPlay ? window.FreshPlay.currentLevel : 1);
					this.updateScore(points);
					this.spawnPopup(`+${points}`, target.x, target.y, '#00ff00');

					target.destroy();
				}
			}
		});

		this.hostiles.getChildren().forEach(hostile => {
			if (hostile.active) {
				const size = 50 * hostile.scaleX;
				const hostileRect = new Phaser.Geom.Rectangle(hostile.x - size / 2, hostile.y - size / 2, size, size);
				if (Phaser.Geom.Intersects.LineToRectangle(bladeLine, hostileRect)) {
					this.playRetroSound('error');
					this.createPremiumParticles(hostile.x, hostile.y, 0xff0000);

					this.lives--;
					this.livesText.setText(this.getLivesString());
					this.updateScore(-50);
					this.spawnPopup('-50', hostile.x, hostile.y, '#ff0000');

					this.cameras.main.shake(300, 0.02);
					const flash = this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0xff0000).setAlpha(0.3).setDepth(90);
					this.time.delayedCall(150, () => flash.destroy());

					hostile.destroy();

					if (this.lives <= 0) {
						this.triggerGameOver();
					}
				}
			}
		});
	}

	createPremiumParticles(x, y, color) {
		const particles = this.add.particles(x, y, 'flares', {
			speed: { min: -400, max: 400 },
			angle: { min: 0, max: 360 },
			scale: { start: 0.8, end: 0 },
			alpha: { start: 1, end: 0 },
			lifespan: 500,
			quantity: 20,
			tint: color,
			blendMode: 'ADD'
		});

		if (!this.textures.exists('particle')) {
			let gfx = this.make.graphics({ x: 0, y: 0, add: false });
			gfx.fillStyle(0xffffff, 1);
			gfx.fillCircle(4, 4, 4);
			gfx.generateTexture('particle', 8, 8);
		}
		particles.setTexture('particle');
		this.time.delayedCall(500, () => particles.destroy());
	}

	updateScore(points) {
		this.score = Math.max(0, this.score + points);
		this.levelScore += points;
		this.scoreText.setText('SCORE: ' + this.score);

		if (this.levelScore >= 100) {
			this.levelScore = 0;
			if (window.FreshPlay) {
				window.FreshPlay.levelComplete(() => {
					this.levelText.setText('LEVEL ' + window.FreshPlay.currentLevel);
					this.currentSpawnRate = Math.max(350, this.currentSpawnRate - 100);
				});
			}
		}
	}

	triggerGameOver() {
		if (this.isGameOver) return;
		this.isGameOver = true;
		if (this.bgmTimer) this.bgmTimer.remove();

		this.bladeCore.clear();
		this.bladeGlow.clear();

		this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0xff0000).setAlpha(0.2).setDepth(90);

		this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
			fontFamily: 'Courier', fontSize: '54px', fontStyle: 'bold', color: '#ff0066'
		}).setOrigin(0.5).setDepth(100);

		this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, `FINAL SCORE: ${this.score}`, {
			fontFamily: 'Courier', fontSize: '24px', fontStyle: 'bold', color: '#00ffcc'
		}).setOrigin(0.5).setDepth(100);

		this.time.delayedCall(2500, () => {
			if (window.FreshPlay) window.FreshPlay.gameOver(this.score);
			this.scene.restart();
		});
	}

	drawRoad() {
		this.bgGraphics.clear();
		const w = this.scale.width;
		const h = this.scale.height;

		const topW = w * 0.15;
		const botW = w * 2.0;

		const topL = (w / 2) - (topW / 2);
		const topR = (w / 2) + (topW / 2);
		const botL = (w / 2) - (botW / 2);
		const botR = (w / 2) + (botW / 2);

		// Solid Cyan Platform
		this.bgGraphics.fillStyle(this.cyanColor, 1);
		this.bgGraphics.beginPath();
		this.bgGraphics.moveTo(topL, 0);
		this.bgGraphics.lineTo(topR, 0);
		this.bgGraphics.lineTo(botR, h);
		this.bgGraphics.lineTo(botL, h);
		this.bgGraphics.closePath();
		this.bgGraphics.fillPath();

		// Speed Streaks (Batched for peak performance)
		this.bgGraphics.lineStyle(2, this.cyanColor, 0.8);
		this.bgGraphics.beginPath();
		for (let streak of this.streaks) {
			streak.progress += streak.speed;
			if (streak.progress > 1) {
				streak.progress = 0;
				streak.angleOff = Phaser.Math.FloatBetween(0.3, 1.0) * (Math.random() < 0.5 ? 1 : -1);
			}

			let p1 = streak.progress;
			let p2 = Math.min(1, streak.progress + streak.length);

			let y1 = p1 * h;
			let y2 = p2 * h;

			let curW1 = topW + (botW - topW) * p1;
			let curW2 = topW + (botW - topW) * p2;

			let x1 = (w / 2) + (streak.angleOff * curW1);
			let x2 = (w / 2) + (streak.angleOff * curW2);

			this.bgGraphics.moveTo(x1, y1);
			this.bgGraphics.lineTo(x2, y2);
		}
		this.bgGraphics.strokePath();
	}

	update(time, delta) {
		if (!this.isGameOver) {
			// Precise entity spawning loop
			if (time > this.nextSpawnTime) {
				this.spawnEntity();
				this.nextSpawnTime = time + this.currentSpawnRate;
			}
		}

		this.drawRoad();

		const w = this.scale.width;
		const h = this.scale.height;
		const topW = w * 0.15;
		const botW = w * 2.0;

		const updateDepth = (obj) => {
			if (!obj || !obj.active) return;

			// Decoupled from Physics Engine: Flawless delta-time gravity
			let currentSpeed = obj.getData('fallSpeed');
			currentSpeed += 2.0 * (delta / 16); // Smooth acceleration
			obj.setData('fallSpeed', currentSpeed);

			obj.y += currentSpeed * (delta / 1000);

			let progress = obj.y / h;
			if (progress < 0) progress = 0;

			obj.setScale(0.05 + (progress * 1.5));

			let currentWidth = topW + (botW - topW) * progress;
			let lane = obj.getData('lane');

			obj.x = (w / 2) + (lane * currentWidth);

			if (obj.texture.key !== '__DEFAULT') {
				obj.rotation += 0.05 * (delta / 16);
			}

			// Memory leak fixed: Ensure clean destruction when out of bounds
			if (obj.y > h + 150) {
				obj.destroy();
			}
		};

		this.targets.getChildren().forEach(updateDepth);
		this.hostiles.getChildren().forEach(updateDepth);

		// Update Popups
		for (let i = this.popups.length - 1; i >= 0; i--) {
			let p = this.popups[i];
			p.life -= (delta / 1000) * 1.5;
			p.textObj.y -= (delta / 1000) * 50;
			p.textObj.setAlpha(Math.max(0, p.life));

			if (p.life <= 0) {
				p.textObj.destroy();
				this.popups.splice(i, 1);
			}
		}

		if (!this.input.activePointer.isDown && this.trail.length > 0) {
			this.trail = [];
			this.bladeCore.clear();
			this.bladeGlow.clear();
		}

		this.levelText.setPosition(this.scale.width - 20, 20);
		this.livesText.setPosition(this.scale.width / 2, 20);
		this.fsButton.setPosition(20, this.scale.height - 20);
	}
}

const config = {
	type: Phaser.AUTO,
	scale: {
		mode: Phaser.Scale.RESIZE,
		width: '100%',
		height: '100%'
	},
	physics: {
		default: 'arcade',
		arcade: { gravity: { y: 0 } }
	},
	scene: [PlayScene],
	backgroundColor: '#000000'
};

const game = new Phaser.Game(config);