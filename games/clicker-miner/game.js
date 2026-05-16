// ============================================================
//  CLICKER MINER
// ============================================================

//  FreshPlay shim
if (!window.FreshPlay) {
	// Luxury palette rotations — each feels like a different precious material
	const PALETTES = [
		// 0: 18k Gold on Obsidian (default)
		{ background: '#080808', playerCore: '#c9a55a', fxAccent: '#e8c97a', interface: '#111114' },
		// 1: Amethyst & Rose
		{ background: '#09080f', playerCore: '#b89be8', fxAccent: '#e8a5c9', interface: '#110e1a' },
		// 2: Jade & Champagne
		{ background: '#080f0a', playerCore: '#7abfa0', fxAccent: '#c9b87a', interface: '#0d140f' },
		// 3: Rose Gold
		{ background: '#0f0808', playerCore: '#d4856a', fxAccent: '#e8d07a', interface: '#180e0c' },
		// 4: Platinum & Ice
		{ background: '#080a0f', playerCore: '#a8bfd4', fxAccent: '#d4c9e8', interface: '#0c0e14' },
	];
	let _lvl = 0;
	window.FreshPlay = {
		getCurrentPalette: () => PALETTES[Math.floor(_lvl / 5) % PALETTES.length],
		levelComplete: (cb) => { _lvl++; setTimeout(cb, 1800); },
	};
}

//  Audio helpers
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _actx = null;

function getAudioCtx() {
	if (!_actx) _actx = new AudioCtx();
	return _actx;
}

function playTick(freq = 880, type = 'sine', dur = 0.07, vol = 0.12) {
	try {
		const ctx = getAudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.type = type;
		osc.frequency.setValueAtTime(freq, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + dur);
		gain.gain.setValueAtTime(vol, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + dur);
	} catch (_) { }
}

function playLevelUp() {
	[523, 659, 784, 1047].forEach((f, i) => {
		setTimeout(() => playTick(f, 'triangle', 0.18, 0.18), i * 110);
	});
}

// Utility 
function hexToNum(hex) {
	return parseInt(hex.replace('#', ''), 16);
}

function formatNum(n) {
	if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
	if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
	if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
	if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K';
	return Math.floor(n).toString();
}

// Game constants 
const BOT_TIERS = [
	{ id: 'nano', label: 'Nano', baseCost: 15, baseRate: 0.1, mark: '◦' },
	{ id: 'micro', label: 'Micro', baseCost: 100, baseRate: 0.5, mark: '○' },
	{ id: 'mega', label: 'Mega', baseCost: 1100, baseRate: 3, mark: '◉' },
	{ id: 'giga', label: 'Giga', baseCost: 12000, baseRate: 20, mark: '●' },
	{ id: 'tera', label: 'Tera', baseCost: 130000, baseRate: 120, mark: '◈' },
	{ id: 'peta', label: 'Peta', baseCost: 1400000, baseRate: 780, mark: '◆' },
	{ id: 'exa', label: 'Exa', baseCost: 20000000, baseRate: 4500, mark: '✦' },
];

const MILESTONE_TARGETS = [100, 500, 2500, 15000, 100000, 800000, 6000000, 50000000];

// Font stacks 
const FONT_DISP = '"Cormorant Garamond", Georgia, serif';
const FONT_MONO = '"DM Mono", "Courier New", monospace';

// SCENE: Boot 
class BootScene extends Phaser.Scene {
	constructor() { super('Boot'); }

	preload() {
		this.createCoreTexture();
		this.createGlowTexture();
		this.createBotTexture();
		this.createParticleTexture();
		this.createRingTexture();
	}

	createCoreTexture() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		const size = 200;

		// Outer ambient aura — warm and diffuse
		for (let r = size; r > 0; r -= 3) {
			const alpha = Math.pow(1 - r / size, 2) * 0.055;
			g.fillStyle(0xc9a55a, alpha);
			g.fillCircle(size, size, r);
		}

		// Mid rings — subtle luminance layers
		[size * 0.82, size * 0.62, size * 0.42, size * 0.24].forEach((r, i) => {
			g.fillStyle(0xc9a55a, 0.04 + i * 0.06);
			g.fillCircle(size, size, r);
		});

		// Warm pearl center
		g.fillStyle(0xf5e8d0, 0.9);
		g.fillCircle(size, size, size * 0.16);
		g.fillStyle(0xe8c97a, 0.65);
		g.fillCircle(size, size, size * 0.34);

		// Hairline orbit rings
		g.lineStyle(0.8, 0xc9a55a, 0.35);
		g.strokeCircle(size, size, size * 0.80);
		g.lineStyle(0.5, 0xc9a55a, 0.15);
		g.strokeCircle(size, size, size * 0.90);

		g.generateTexture('core', size * 2, size * 2);
		g.destroy();
	}

	createGlowTexture() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		const r = 64;
		for (let i = r; i > 0; i -= 2) {
			g.fillStyle(0xf5e8d0, (1 - i / r) * 0.12);
			g.fillCircle(r, r, i);
		}
		g.fillStyle(0xfff5e0, 0.95);
		g.fillCircle(r, r, 5);
		g.generateTexture('glow', r * 2, r * 2);
		g.destroy();
	}

	createBotTexture() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		const s = 14;
		g.fillStyle(0xc9a55a, 0.9);
		g.fillCircle(s, s, s * 0.55);
		g.fillStyle(0xfff5e0, 0.85);
		g.fillCircle(s, s, s * 0.25);
		g.lineStyle(0.8, 0xe8c97a, 0.4);
		g.strokeCircle(s, s, s * 0.78);
		g.generateTexture('bot', s * 2, s * 2);
		g.destroy();
	}

	createParticleTexture() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		// Soft diamond shape for luxury feel
		g.fillStyle(0xe8c97a, 1);
		g.fillCircle(6, 6, 6);
		g.generateTexture('particle', 12, 12);
		g.destroy();
	}

	createRingTexture() {
		const g = this.make.graphics({ x: 0, y: 0, add: false });
		const r = 100;
		g.lineStyle(0.6, 0xc9a55a, 0.18);
		g.strokeCircle(r, r, r - 2);
		g.generateTexture('ring', r * 2, r * 2);
		g.destroy();
	}

	create() {
		this.scene.start('Game');
	}
}

// SCENE: Game 
class GameScene extends Phaser.Scene {
	constructor() { super('Game'); }

	create() {
		this.W = this.scale.width;
		this.H = this.scale.height;
		this.cx = this.W / 2;
		this.cy = this.H * 0.42;

		// State
		this.currency = 0;
		this.totalEarned = 0;
		this.clickPower = 1;
		this.passiveRate = 0;
		this.bots = {};
		BOT_TIERS.forEach(t => { this.bots[t.id] = 0; });

		this.level = 0;
		this.nextMilestoneIdx = 0;
		this.levelLocked = false;

		this.palette = window.FreshPlay.getCurrentPalette();
		this.orbitingBots = [];
		this.orbitAngleOffset = 0;

		this._buildScene();
		this._buildHUD();
		this._buildUpgradePanel();
		this._buildLevelBanner();

		this.time.addEvent({ delay: 1000, callback: this._passiveTick, callbackScope: this, loop: true });
		this.time.addEvent({ delay: 50, callback: this._orbitUpdate, callbackScope: this, loop: true });

		// Slow ambient breathe
		this.tweens.add({
			targets: this.coreSprite,
			scaleX: 1.03, scaleY: 1.03,
			duration: 2400,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});

		// Slow ring rotation
		this.time.addEvent({
			delay: 16, callback: () => {
				this.outerRing1.angle += 0.06;
				this.outerRing2.angle -= 0.04;
			}, loop: true
		});
	}

	// Scene 
	_buildScene() {
		const pal = this.palette;
		const bg = hexToNum(pal.background);
		const core = hexToNum(pal.playerCore);

		this.bgRect = this.add.rectangle(this.cx, this.cy, this.W, this.H * 1.2, bg).setDepth(-10);

		// Minimal grid — very faint, warm
		const gfx = this.add.graphics().setDepth(-9);
		gfx.lineStyle(1, core, 0.025);
		for (let x = 0; x < this.W; x += 60) gfx.strokeLineShape(new Phaser.Geom.Line(x, 0, x, this.H));
		for (let y = 0; y < this.H; y += 60) gfx.strokeLineShape(new Phaser.Geom.Line(0, y, this.W, y));

		// Radial warmth behind core
		const glow = this.add.graphics().setDepth(-1);
		for (let r = 300; r > 0; r -= 12) {
			glow.fillStyle(core, 0.008);
			glow.fillCircle(this.cx, this.cy, r);
		}

		// Decorative orbit rings
		this.outerRing1 = this.add.image(this.cx, this.cy, 'ring').setScale(3.8).setTint(core).setAlpha(0.14).setDepth(0);
		this.outerRing2 = this.add.image(this.cx, this.cy, 'ring').setScale(2.9).setTint(core).setAlpha(0.09).setDepth(0);

		// Core orb
		this.coreSprite = this.add.image(this.cx, this.cy, 'core')
			.setTint(core)
			.setScale(1)
			.setDepth(2)
			.setInteractive({ useHandCursor: true });

		this.coreSprite.on('pointerdown', this._onCoreClick, this);
		this.coreSprite.on('pointerover', () => this.coreSprite.setAlpha(0.90));
		this.coreSprite.on('pointerout', () => this.coreSprite.setAlpha(1));

		// Particles
		this.particles = this.add.particles(0, 0, 'particle', {
			speed: { min: 55, max: 200 },
			scale: { start: 0.28, end: 0 },
			alpha: { start: 0.85, end: 0 },
			lifespan: { min: 320, max: 650 },
			quantity: 0,
			tint: hexToNum(pal.fxAccent),
			emitting: false,
		}).setDepth(10);

		this.botLayer = this.add.container(this.cx, this.cy).setDepth(5);
	}

	// HUD 
	_buildHUD() {
		const pal = this.palette;
		const iface = hexToNum(pal.interface);
		const core = hexToNum(pal.playerCore);

		// Top bar — slim and elegant
		const barH = 64;
		const barBg = this.add.graphics().setDepth(20);
		barBg.fillStyle(iface, 0.88);
		barBg.fillRoundedRect(0, 0, this.W, barH, { tl: 0, tr: 0, bl: 12, br: 12 });
		// Hairline bottom border
		barBg.lineStyle(0.5, core, 0.35);
		barBg.strokeLineShape(new Phaser.Geom.Line(0, barH, this.W, barH));

		// Currency — large, display font, centered
		this.currencyText = this.add.text(this.W / 2, 26, '0', {
			fontFamily: FONT_DISP,
			fontSize: '30px',
			fontStyle: 'normal',
			color: '#' + pal.playerCore.replace('#', ''),
			resolution: 2,
		}).setOrigin(0.5, 0.5).setDepth(21);

		// Symbol accent after number (rendered separately for styling)
		this.currencySymbol = this.add.text(this.W / 2, 26, '', {
			fontFamily: FONT_MONO,
			fontSize: '11px',
			color: '#' + pal.fxAccent.replace('#', ''),
			alpha: 0.6,
		}).setOrigin(0.5, 0.5).setDepth(21);

		// Passive rate — right-aligned, mono
		this.rateText = this.add.text(this.W - 16, 48, '0 / s', {
			fontFamily: FONT_MONO,
			fontSize: '10px',
			color: '#' + pal.fxAccent.replace('#', ''),
			alpha: 0.7,
		}).setOrigin(1, 0.5).setDepth(21);

		// Level — left-aligned, small caps style
		this.levelText = this.add.text(16, 32, 'I', {
			fontFamily: FONT_DISP,
			fontSize: '18px',
			color: '#f0ebe0',
			alpha: 0.55,
		}).setOrigin(0, 0.5).setDepth(21);

		// Milestone — centered, very small
		this.milestoneText = this.add.text(this.W / 2, 52, '', {
			fontFamily: FONT_MONO,
			fontSize: '9px',
			color: '#ffffff',
			alpha: 0.3,
		}).setOrigin(0.5).setDepth(21);

		// Shop button — elegant pill
		const btnW = 100, btnH = 34;
		const btnX = this.W - btnW / 2 - 14;
		const btnY = this.H - 28;

		this.shopBtnBg = this.add.graphics().setDepth(22);
		this._drawShopBtn(btnX, btnY, btnW, btnH, false);

		const shopLabel = this.add.text(btnX, btnY, 'SHOP', {
			fontFamily: FONT_MONO,
			fontSize: '11px',
			letterSpacing: 3,
			color: '#' + pal.playerCore.replace('#', ''),
			alpha: 0.9,
		}).setOrigin(0.5).setDepth(23)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this._togglePanel())
			.on('pointerover', () => { this._drawShopBtn(btnX, btnY, btnW, btnH, true); })
			.on('pointerout', () => { this._drawShopBtn(btnX, btnY, btnW, btnH, false); });

		this._shopBtnX = btnX; this._shopBtnY = btnY;
		this._shopBtnW = btnW; this._shopBtnH = btnH;

		// Click power — bottom-left
		this.clickPowerText = this.add.text(16, this.H - 28, '+1 per tap', {
			fontFamily: FONT_MONO,
			fontSize: '10px',
			color: '#ffffff',
			alpha: 0.25,
		}).setOrigin(0, 0.5).setDepth(22);
	}

	_drawShopBtn(x, y, w, h, hover) {
		const core = hexToNum(this.palette.playerCore);
		this.shopBtnBg.clear();
		if (hover) {
			this.shopBtnBg.fillStyle(core, 0.15);
			this.shopBtnBg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 17);
		}
		this.shopBtnBg.lineStyle(0.8, core, hover ? 0.8 : 0.4);
		this.shopBtnBg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 17);
	}

	// Upgrade panel
	_buildUpgradePanel() {
		const pal = this.palette;
		const iface = hexToNum(pal.interface);
		const core = hexToNum(pal.playerCore);
		const acnt = hexToNum(pal.fxAccent);

		const panW = Math.min(300, this.W - 16);
		const panH = this.H * 0.74;
		const panX = this.W + panW;
		const panY = this.H / 2 + 28;

		this.panelContainer = this.add.container(panX, panY).setDepth(50);
		this.panelOpen = false;

		// Panel bg — dark surface with hairline border
		const panBg = this.add.graphics();
		panBg.fillStyle(hexToNum('#0c0c10'), 0.97);
		panBg.fillRoundedRect(-panW / 2, -panH / 2, panW, panH, 16);
		panBg.lineStyle(0.5, core, 0.4);
		panBg.strokeRoundedRect(-panW / 2, -panH / 2, panW, panH, 16);
		// Top accent line
		panBg.lineStyle(1, core, 0.5);
		panBg.strokeLineShape(
			new Phaser.Geom.Line(-panW / 2 + 16, -panH / 2, panW / 2 - 16, -panH / 2)
		);
		this.panelContainer.add(panBg);

		// Panel title — refined
		const title = this.add.text(0, -panH / 2 + 24, 'Mining Shop', {
			fontFamily: FONT_DISP,
			fontSize: '16px',
			color: '#' + pal.playerCore.replace('#', ''),
			fontStyle: 'normal',
		}).setOrigin(0.5);
		this.panelContainer.add(title);

		// Hairline divider
		const div = this.add.graphics();
		div.lineStyle(0.5, core, 0.2);
		div.strokeLineShape(new Phaser.Geom.Line(-panW / 2 + 20, -panH / 2 + 42, panW / 2 - 20, -panH / 2 + 42));
		this.panelContainer.add(div);

		// Rows
		const rowH = 66;
		const startY = -panH / 2 + 56;
		this.tierRows = {};
		BOT_TIERS.forEach((tier, i) => {
			const ry = startY + i * rowH;
			const row = this._buildTierRow(tier, panW, rowH - 4, ry, pal, core, acnt);
			this.tierRows[tier.id] = row;
		});

		// Close — small, muted
		const closeBtn = this.add.text(0, panH / 2 - 18, 'close', {
			fontFamily: FONT_MONO,
			fontSize: '10px',
			letterSpacing: 3,
			color: '#ffffff',
			alpha: 0.3,
		}).setOrigin(0.5)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this._togglePanel())
			.on('pointerover', function () { this.setAlpha(0.7); })
			.on('pointerout', function () { this.setAlpha(0.3); });
		this.panelContainer.add(closeBtn);
	}

	_buildTierRow(tier, panW, rowH, ry, pal, core, acnt) {
		// Row bg — very subtle
		const rowBg = this.add.graphics();
		rowBg.fillStyle(0xffffff, 0.02);
		rowBg.fillRoundedRect(-panW / 2 + 10, ry, panW - 20, rowH, 8);
		rowBg.lineStyle(0.5, core, 0.1);
		rowBg.strokeRoundedRect(-panW / 2 + 10, ry, panW - 20, rowH, 8);
		this.panelContainer.add(rowBg);

		// Mark — small, elegant
		const icon = this.add.text(-panW / 2 + 28, ry + rowH / 2, tier.mark, {
			fontFamily: FONT_MONO,
			fontSize: '14px',
			color: '#' + pal.fxAccent.replace('#', ''),
			alpha: 0.7,
		}).setOrigin(0.5);
		this.panelContainer.add(icon);

		// Name — display serif
		const nameT = this.add.text(-panW / 2 + 46, ry + 12, tier.label, {
			fontFamily: FONT_DISP,
			fontSize: '14px',
			color: '#f0ebe0',
		});
		this.panelContainer.add(nameT);

		// Rate — small mono
		const rateT = this.add.text(-panW / 2 + 46, ry + 28, `+${tier.baseRate}/s`, {
			fontFamily: FONT_MONO,
			fontSize: '9px',
			color: '#ffffff',
			alpha: 0.28,
		});
		this.panelContainer.add(rateT);

		// Count
		const countT = this.add.text(panW / 2 - 98, ry + rowH / 2, '×0', {
			fontFamily: FONT_MONO,
			fontSize: '11px',
			color: '#' + pal.fxAccent.replace('#', ''),
			alpha: 0.65,
		}).setOrigin(0, 0.5);
		this.panelContainer.add(countT);

		// Buy button — minimal pill
		const btnW = 72, btnH = 28;
		const btnX = panW / 2 - 46;
		const btnYabs = ry + rowH / 2 - btnH / 2;

		const btnGfx = this.add.graphics();
		this._drawRowBtn(btnGfx, btnX, panW, btnYabs, btnW, btnH, core, false);
		this.panelContainer.add(btnGfx);

		const costLabel = this.add.text(
			btnX - panW / 2 + 10 + btnW / 2,
			btnYabs + btnH / 2,
			formatNum(tier.baseCost),
			{
				fontFamily: FONT_MONO,
				fontSize: '10px',
				color: '#f0ebe0',
			}
		).setOrigin(0.5).setInteractive({ useHandCursor: true });
		this.panelContainer.add(costLabel);

		costLabel.on('pointerdown', () => this._buyBot(tier.id));
		costLabel.on('pointerover', () => this._drawRowBtn(btnGfx, btnX, panW, btnYabs, btnW, btnH, core, true));
		costLabel.on('pointerout', () => this._drawRowBtn(btnGfx, btnX, panW, btnYabs, btnW, btnH, core, false));

		return { countT, costLabel, btnGfx, tier, panW, btnX, btnYabs, btnW, btnH, ry, rowH, rowBg };
	}

	_drawRowBtn(gfx, btnX, panW, btnYabs, btnW, btnH, core, hover) {
		gfx.clear();
		if (hover) {
			gfx.fillStyle(core, 0.18);
			gfx.fillRoundedRect(btnX - panW / 2 + 10, btnYabs, btnW, btnH, 14);
		}
		gfx.lineStyle(0.8, core, hover ? 0.75 : 0.35);
		gfx.strokeRoundedRect(btnX - panW / 2 + 10, btnYabs, btnW, btnH, 14);
	}

	// Level banner 
	_buildLevelBanner() {
		this.levelBanner = this.add.container(this.cx, this.H / 2).setDepth(100).setAlpha(0);
		const core = hexToNum(this.palette.playerCore);

		const bg = this.add.graphics();
		bg.fillStyle(hexToNum('#0a0a0c'), 0.95);
		bg.fillRoundedRect(-170, -50, 340, 100, 14);
		bg.lineStyle(0.8, core, 0.7);
		bg.strokeRoundedRect(-170, -50, 340, 100, 14);
		// Top accent line
		bg.lineStyle(1.5, core, 0.5);
		bg.strokeLineShape(new Phaser.Geom.Line(-80, -50, 80, -50));
		this.levelBanner.add(bg);

		this.bannerTitle = this.add.text(0, -14, 'Level Complete', {
			fontFamily: FONT_DISP,
			fontSize: '24px',
			color: '#' + this.palette.playerCore.replace('#', ''),
		}).setOrigin(0.5);
		this.levelBanner.add(this.bannerTitle);

		this.bannerSub = this.add.text(0, 16, '', {
			fontFamily: FONT_MONO,
			fontSize: '11px',
			color: '#ffffff',
			alpha: 0.45,
		}).setOrigin(0.5);
		this.levelBanner.add(this.bannerSub);
	}

	// Core click
	_onCoreClick(pointer) {
		if (this.panelOpen) return;

		const earned = this.clickPower;
		this.currency += earned;
		this.totalEarned += earned;

		playTick(640 + Math.random() * 400, 'sine', 0.06, 0.10);

		this.tweens.killTweensOf(this.coreSprite);
		this.tweens.add({
			targets: this.coreSprite,
			scaleX: 0.90, scaleY: 0.90,
			duration: 65,
			yoyo: true,
			ease: 'Quad.easeOut',
			onComplete: () => {
				this.tweens.add({
					targets: this.coreSprite,
					scaleX: 1.03, scaleY: 1.03,
					duration: 2400,
					yoyo: true,
					repeat: -1,
					ease: 'Sine.easeInOut',
				});
			},
		});

		this.particles.setPosition(pointer.x, pointer.y);
		this.particles.explode(10, pointer.x, pointer.y);
		this._spawnFloatNum(pointer.x, pointer.y - 20, `+${formatNum(earned)}`);

		this._updateHUD();
		this._checkMilestone();
	}

	// Float numbers
	_spawnFloatNum(x, y, text) {
		const t = this.add.text(x, y, text, {
			fontFamily: FONT_MONO,
			fontSize: '14px',
			color: '#' + this.palette.fxAccent.replace('#', ''),
			alpha: 0.9,
		}).setOrigin(0.5).setDepth(15);

		this.tweens.add({
			targets: t,
			y: y - 60 - Math.random() * 24,
			x: x + (Math.random() - 0.5) * 48,
			alpha: 0,
			duration: 1000,
			ease: 'Quad.easeOut',
			onComplete: () => t.destroy(),
		});
	}

	// Passive income 
	_passiveTick() {
		if (this.passiveRate <= 0) return;
		const income = this.passiveRate;
		this.currency += income;
		this.totalEarned += income;

		if (income > 0 && Math.random() < 0.35) {
			const angle = Math.random() * Math.PI * 2;
			const r = 115 + Math.random() * 35;
			this._spawnFloatNum(
				this.cx + Math.cos(angle) * r,
				this.cy + Math.sin(angle) * r,
				`+${formatNum(income)}`,
			);
		}

		this._updateHUD();
		this._checkMilestone();
	}

	// Shop
	_buyBot(tierId) {
		const tier = BOT_TIERS.find(t => t.id === tierId);
		const count = this.bots[tierId];
		const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));

		if (this.currency < cost) {
			playTick(200, 'sawtooth', 0.06, 0.08);
			return;
		}

		this.currency -= cost;
		this.bots[tierId]++;
		this.passiveRate += tier.baseRate;
		playTick(820 + count * 40, 'triangle', 0.09, 0.14);
		this._addOrbitBot(tier);
		this._refreshRow(tierId);
		this._updateHUD();
	}

	_refreshRow(tierId) {
		const row = this.tierRows[tierId];
		const tier = BOT_TIERS.find(t => t.id === tierId);
		const count = this.bots[tierId];
		const cost = Math.floor(tier.baseCost * Math.pow(1.15, count));
		row.countT.setText(`×${count}`);
		row.costLabel.setText(formatNum(cost));
	}

	// Orbiting bots
	_addOrbitBot(tier) {
		const idx = this.orbitingBots.length;
		const ring = Math.floor(idx / 8);
		const pos = idx % 8;
		const orbitR = 125 + ring * 52;
		const baseAngle = (pos / 8) * Math.PI * 2;
		const speed = 0.0006 - ring * 0.00008;
		const tint = hexToNum(this.palette.fxAccent);

		const sprite = this.add.image(0, 0, 'bot')
			.setTint(tint)
			.setScale(0.7 - ring * 0.06)
			.setDepth(6);

		this.orbitingBots.push({ sprite, orbitR, baseAngle, speed });
		this.botLayer.add(sprite);
	}

	_orbitUpdate() {
		this.orbitAngleOffset += 0.001;
		this.orbitingBots.forEach(b => {
			const angle = b.baseAngle + this.orbitAngleOffset * (b.speed / 0.0006);
			b.sprite.x = Math.cos(angle) * b.orbitR;
			b.sprite.y = Math.sin(angle) * b.orbitR;
		});
	}

	// HUD update
	_updateHUD() {
		this.currencyText.setText(formatNum(this.currency));
		this.rateText.setText(formatNum(this.passiveRate) + ' / s');

		// Roman numeral–style level (just the number for now)
		this.levelText.setText(this._toRoman(this.level + 1));
		this.clickPowerText.setText(`+${formatNum(this.clickPower)} per tap`);

		if (this.nextMilestoneIdx < MILESTONE_TARGETS.length) {
			const target = MILESTONE_TARGETS[this.nextMilestoneIdx];
			const pct = Math.min(100, Math.floor((this.totalEarned / target) * 100));
			this.milestoneText.setText(`${formatNum(this.totalEarned)} / ${formatNum(target)}  ·  ${pct}%`);
		} else {
			this.milestoneText.setText('All milestones achieved');
		}

		BOT_TIERS.forEach(t => {
			const row = this.tierRows[t.id];
			const cost = Math.floor(t.baseCost * Math.pow(1.15, this.bots[t.id]));
			row.costLabel.setAlpha(this.currency >= cost ? 1 : 0.35);
		});
	}

	_toRoman(n) {
		const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
		const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
		let result = '';
		for (let i = 0; i < vals.length; i++) {
			while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
		}
		return result;
	}

	// Milestone / Level 
	_checkMilestone() {
		if (this.levelLocked) return;
		if (this.nextMilestoneIdx >= MILESTONE_TARGETS.length) return;
		const target = MILESTONE_TARGETS[this.nextMilestoneIdx];
		if (this.totalEarned >= target) {
			this.levelLocked = true;
			this.nextMilestoneIdx++;
			this._triggerLevelComplete();
		}
	}

	_triggerLevelComplete() {
		playLevelUp();
		this.bannerSub.setText(formatNum(this.totalEarned) + ' earned');

		this.tweens.add({
			targets: this.levelBanner,
			alpha: 1,
			scaleX: 1, scaleY: 1,
			duration: 450,
			ease: 'Back.easeOut',
		});

		for (let i = 0; i < 5; i++) {
			this.time.delayedCall(i * 80, () => {
				const x = this.cx + (Math.random() - 0.5) * 180;
				const y = this.cy + (Math.random() - 0.5) * 120;
				this.particles.explode(16, x, y);
			});
		}

		this.cameras.main.flash(280, 240, 200, 140, false, undefined, undefined, 0.12);

		window.FreshPlay.levelComplete(() => {
			this.level++;
			this.palette = window.FreshPlay.getCurrentPalette();
			this._applyPaletteToScene();
			this.clickPower = Math.max(1, Math.floor(Math.pow(this.level + 1, 1.4)));

			this.tweens.add({
				targets: this.levelBanner,
				alpha: 0,
				duration: 700,
				ease: 'Quad.easeIn',
			});

			this.levelLocked = false;
			this._updateHUD();
		});
	}

	// Palette swap 
	_applyPaletteToScene() {
		const pal = this.palette;
		const core = hexToNum(pal.playerCore);
		const acnt = hexToNum(pal.fxAccent);
		const bg = hexToNum(pal.background);

		this.bgRect.setFillStyle(bg);
		this.coreSprite.setTint(core);
		this.outerRing1.setTint(core);
		this.outerRing2.setTint(core);
		this.particles.setParticleTint(acnt);
		this.orbitingBots.forEach(b => b.sprite.setTint(acnt));

		this.currencyText.setStyle({ color: '#' + pal.playerCore.replace('#', '') });
		this.rateText.setStyle({ color: '#' + pal.fxAccent.replace('#', '') });
	}

	// Panel toggle 
	_togglePanel() {
		const panW = Math.min(300, this.W - 16);
		const openX = this.W - panW / 2 - 8;
		const closeX = this.W + panW;

		this.panelOpen = !this.panelOpen;
		playTick(this.panelOpen ? 1050 : 840, 'sine', 0.05, 0.10);

		this.tweens.add({
			targets: this.panelContainer,
			x: this.panelOpen ? openX : closeX,
			duration: 340,
			ease: this.panelOpen ? 'Quart.easeOut' : 'Quart.easeIn',
		});
	}
}

// Phaser config
const config = {
	type: Phaser.AUTO,
	width: window.innerWidth,
	height: window.innerHeight,
	backgroundColor: '#080808',
	parent: document.body,
	scene: [BootScene, GameScene],
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	render: {
		antialias: true,
		pixelArt: false,
	},
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
	game.scale.resize(window.innerWidth, window.innerHeight);
});

export default game;