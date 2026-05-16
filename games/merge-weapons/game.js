// ===============================================================================
//  MERGE WEAPONS
// ===============================================================================
const GW = 1100, GH = 550;

// Weapon data
const WEAPONS = [
	{ tier: 1, name: 'DAGGER', color: 0xaabbff, atk: 2, gps: 1 },
	{ tier: 2, name: 'SHORTSWORD', color: 0x44ddff, atk: 6, gps: 3 },
	{ tier: 3, name: 'LONGSWORD', color: 0x00f5cc, atk: 15, gps: 8 },
	{ tier: 4, name: 'AXE', color: 0xffdd00, atk: 35, gps: 20 },
	{ tier: 5, name: 'BATTLE AXE', color: 0xff9900, atk: 80, gps: 45 },
	{ tier: 6, name: 'SPEAR', color: 0xff6600, atk: 180, gps: 100 },
	{ tier: 7, name: 'TRIDENT', color: 0xff2055, atk: 400, gps: 220 },
	{ tier: 8, name: 'WAND', color: 0xdd44ff, atk: 900, gps: 500 },
	{ tier: 9, name: 'STAFF', color: 0xaa00ff, atk: 2000, gps: 1100 },
	{ tier: 10, name: 'LEGEND', color: 0xffffff, atk: 5000, gps: 2500 },
];
const ENEMY_NAMES = ['Goblin Scout', 'Orc Warrior', 'Troll Brute', 'Dark Knight', 'Dragon Lord', 'Demon Overlord'];

// Layout
const HUD_H = 50;
const ARENA_TOP = HUD_H + 6;         // 78
const ARENA_H = 150;
const ARENA_BOT = ARENA_TOP + ARENA_H; // 300
const FLOOR_Y = ARENA_BOT - 8;     // 292

// Hero scale 2.2 → boots at +33*2.2 = 72.6 below origin
// Place origin so boots land exactly on FLOOR_Y
const HERO_S = 2.2;
const HERO_FOOT = Math.round(33 * HERO_S);   // 73
const CHAR_Y = FLOOR_Y - HERO_FOOT;        // 219

const HERO_X = 185;
const ENEMY_X = GW - 185;

const DIVIDER_Y = ARENA_BOT + 4;     // 304
const SECT_LBL = DIVIDER_Y + 14;    // 318
const CONTENT_Y = DIVIDER_Y + 38;    // 342

// Bottom three-column layout
const COLS = 4, ROWS = 4, CELL = 88;
const GRID_X = 18;
const GRID_Y = CONTENT_Y;                        // 342
const STATS_X = GRID_X + COLS * CELL + 22;        // 392
const STATS_W = 256;
const LOG_X = STATS_X + STATS_W + 22;           // 670
const LOG_W = GW - LOG_X - 18;                  // 412

const BUY_COST = 50;

class MergeScene extends Phaser.Scene {
	constructor() { super({ key: 'MergeScene' }); }

	create() {
		// State
		this.coins = 300;
		this.totalAtk = 0;
		this.gps = 1;
		this.itemCount = 0;
		this.grid = new Array(ROWS * COLS).fill(null);
		this.sprites = new Array(ROWS * COLS).fill(null);
		this.drag = null;
		this._highlights = [];

		this.enemyLv = 1;
		this.enemyMaxHp = 200;
		this.enemyHp = 200;
		this.kills = 0;
		this.heroLv = 1;
		this._enemyDead = false;
		this._auraPhase = 0;
		this._hpBarW = 190;

		// Build scene layers
		this.buildBg();
		this.buildHUD();
		this.buildArena();
		this.buildArenaCharacters();
		this.buildGrid();
		this.buildStatsPanel();
		this.buildLogPanel();
		this.buildBuyButton();
		this.setupDrag();

		// Timers
		this.time.addEvent({ delay: 1000, loop: true, callback: this.onTick, callbackScope: this });
		this.time.addEvent({ delay: 720, loop: true, callback: this.onBattle, callbackScope: this });
		this.time.addEvent({ delay: 80, loop: true, callback: this._tickAura, callbackScope: this });
	}

	// BACKGROUND
	buildBg() {
		this.add.rectangle(0, 0, GW, GH, 0x060612).setOrigin(0, 0);
		const g = this.add.graphics();
		g.fillStyle(0x1a1a4a, 0.35);
		for (let x = 16; x < GW; x += 32)
			for (let y = 16; y < GH; y += 32)
				g.fillRect(x - 0.5, y - 0.5, 1, 1);
		g.fillStyle(0x00f5cc, 0.04); g.fillCircle(0, 0, 260);
		g.fillStyle(0xff2055, 0.04); g.fillCircle(GW, GH, 240);
		g.fillStyle(0xf0c040, 0.02); g.fillCircle(GW / 2, ARENA_TOP + ARENA_H / 2, 320);
	}

	// HUD BAR
	buildHUD() {
		const g = this.add.graphics();
		g.fillStyle(0x07081e, 1); g.fillRect(0, 0, GW, HUD_H);
		g.lineStyle(2, 0xf0c040, 0.55); g.moveTo(0, 0); g.lineTo(GW, 0); g.strokePath();
		g.lineStyle(1, 0xf0c040, 0.1); g.moveTo(0, HUD_H); g.lineTo(GW, HUD_H); g.strokePath();
		// Corner ornaments
		g.lineStyle(2, 0xf0c040, 0.3);
		g.moveTo(0, 0); g.lineTo(48, 0); g.moveTo(0, 0); g.lineTo(0, 48);
		g.moveTo(GW, 0); g.lineTo(GW - 48, 0); g.moveTo(GW, 0); g.lineTo(GW, 48);
		g.strokePath();

		const PW = 188, PY = 7, PH = HUD_H - 14;
		const GAP = Math.floor((GW - 5 * PW - 16) / 4);

		const panels = [
			{ col: 0xf0c040, lbl: '◆  COINS', bigKey: 'coinTxt', subKey: 'incTxt', subDflt: '+1 /s', dflt: '300' },
			{ col: 0xff2055, lbl: 'ATK  POWER', bigKey: 'atkTxt', subKey: null, subDflt: 'DMG / HIT', dflt: '0' },
			{ col: 0x00f5cc, lbl: 'BATTLE  WAVE', bigKey: 'waveTxt', subKey: 'enemyNameTxt', subDflt: 'Goblin Scout', dflt: '1' },
			{ col: 0xcc44ff, lbl: '⚙  ARSENAL', bigKey: 'itemsTxt', subKey: null, subDflt: 'WEAPONS', dflt: '0' },
			{ col: 0xffdd00, lbl: 'TOTAL  KILLS', bigKey: 'killsHUD', subKey: null, subDflt: 'ENEMIES SLAIN', dflt: '0' },
		];

		panels.forEach(({ col, lbl, bigKey, subKey, subDflt, dflt }, i) => {
			const px = 8 + i * (PW + GAP);
			this._luxPanel(g, px, PY, PW, PH, col);
			const cx = px + PW / 2;
			this.add.text(cx, PY + 7, lbl, { ...this.sty9(col, 0.45), letterSpacing: 2 }).setOrigin(0.5, 0);
			this[bigKey] = this.add.text(cx, PY + 20, dflt, this.styBig(col)).setOrigin(0.5, 0);
			if (subKey) {
				this[subKey] = this.add.text(cx, PY + 46, subDflt, this.sty9(col, 0.35)).setOrigin(0.5, 0);
			} else {
				this.add.text(cx, PY + 46, subDflt, this.sty9(col, 0.28)).setOrigin(0.5, 0);
			}
		});
	}

	_luxPanel(g, x, y, w, h, col) {
		g.fillStyle(0x000000, 0.52); g.fillRoundedRect(x, y, w, h, 6);
		g.lineStyle(1, col, 0.26); g.strokeRoundedRect(x, y, w, h, 6);
		g.fillStyle(col, 0.04); g.fillRoundedRect(x, y, w, h / 2, 6);
	}

	// ARENA
	buildArena() {
		const g = this.add.graphics().setDepth(1);

		// Arena background
		g.fillStyle(0x04041a, 1); g.fillRect(0, ARENA_TOP, GW, ARENA_H);
		// Floor platform
		g.fillStyle(0x0b0c22, 1); g.fillRect(0, FLOOR_Y, GW, ARENA_BOT - FLOOR_Y);
		// Floor glow
		g.fillStyle(0x00f5cc, 0.055); g.fillRect(0, FLOOR_Y - 28, GW, 28);
		// Floor line
		g.lineStyle(1, 0x00f5cc, 0.3); g.moveTo(0, FLOOR_Y); g.lineTo(GW, FLOOR_Y); g.strokePath();

		// Side atmosphere tints
		g.fillStyle(0x0011bb, 0.032); g.fillRect(0, ARENA_TOP, GW * 0.4, ARENA_H);
		g.fillStyle(0xbb0011, 0.042); g.fillRect(GW * 0.6, ARENA_TOP, GW * 0.4, ARENA_H);

		// Center divider / VS
		g.lineStyle(1, 0xf0c040, 0.07);
		g.moveTo(GW / 2, ARENA_TOP + 14); g.lineTo(GW / 2, FLOOR_Y - 8); g.strokePath();
		this.add.text(GW / 2, ARENA_TOP + ARENA_H / 2 - 16, 'VS', {
			fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '40px', color: '#f0c040', alpha: 0.09
		}).setOrigin(0.5).setDepth(2);

		// Top gold border
		const bg2 = this.add.graphics().setDepth(1);
		bg2.lineStyle(1, 0xf0c040, 0.18); bg2.moveTo(0, ARENA_TOP); bg2.lineTo(GW, ARENA_TOP); bg2.strokePath();

		// HERO side UI
		this.add.text(HERO_X, ARENA_TOP + 9, 'COMMANDER', {
			fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '10px', color: '#00f5cc', letterSpacing: 3
		}).setOrigin(0.5, 0).setDepth(3);

		const HPW = this._hpBarW;
		const hBg = this.add.graphics().setDepth(3);
		hBg.fillStyle(0x001510, 1); hBg.fillRoundedRect(HERO_X - HPW / 2, ARENA_TOP + 24, HPW, 10, 5);
		hBg.lineStyle(1, 0x00f5cc, 0.28); hBg.strokeRoundedRect(HERO_X - HPW / 2, ARENA_TOP + 24, HPW, 10, 5);
		// Hero HP always full (invincible commander)
		const hFill = this.add.graphics().setDepth(4);
		hFill.fillStyle(0x00f5cc, 1); hFill.fillRoundedRect(HERO_X - HPW / 2, ARENA_TOP + 24, HPW, 10, 5);

		this.heroLvBadge = this.add.text(HERO_X, ARENA_TOP + 38, 'LVL  1', {
			fontFamily: 'Share Tech Mono', fontSize: '9px', color: '#f0c040', alpha: 0.6
		}).setOrigin(0.5, 0).setDepth(3);

		// ENEMY side UI
		this.arenaEnemyName = this.add.text(ENEMY_X, ARENA_TOP + 9, 'Goblin Scout', {
			fontFamily: 'Share Tech Mono', fontSize: '10px', color: '#ff7799'
		}).setOrigin(0.5, 0).setDepth(3);

		const eBg = this.add.graphics().setDepth(3);
		eBg.fillStyle(0x1a0010, 1); eBg.fillRoundedRect(ENEMY_X - HPW / 2, ARENA_TOP + 24, HPW, 10, 5);
		eBg.lineStyle(1, 0xff2055, 0.28); eBg.strokeRoundedRect(ENEMY_X - HPW / 2, ARENA_TOP + 24, HPW, 10, 5);
		this.enemyHpFill = this.add.graphics().setDepth(4);
		this._drawEnemyHp();

		this.enemyLvBadge = this.add.text(ENEMY_X, ARENA_TOP + 38, 'WAVE  1', {
			fontFamily: 'Share Tech Mono', fontSize: '9px', color: '#ff2055', alpha: 0.6
		}).setOrigin(0.5, 0).setDepth(3);

		// Bottom divider & section labels
		const dl = this.add.graphics().setDepth(2);
		dl.lineStyle(1, 0xf0c040, 0.16); dl.moveTo(0, DIVIDER_Y); dl.lineTo(GW, DIVIDER_Y); dl.strokePath();

		this.add.text(GRID_X + COLS * CELL / 2, SECT_LBL, 'ARSENAL  ·  DRAG IDENTICAL TO MERGE', {
			...this.sty9(0xf0c040, 0.27), letterSpacing: 2
		}).setOrigin(0.5, 0).setDepth(3);
		this.add.text(STATS_X + STATS_W / 2, SECT_LBL, 'HERO  STATUS', {
			...this.sty9(0x00f5cc, 0.27), letterSpacing: 4
		}).setOrigin(0.5, 0).setDepth(3);
		this.add.text(LOG_X + LOG_W / 2, SECT_LBL, 'COMBAT  LOG', {
			...this.sty9(0xcc44ff, 0.27), letterSpacing: 4
		}).setOrigin(0.5, 0).setDepth(3);
	}

	_drawEnemyHp() {
		const pct = Math.max(0, this.enemyHp / this.enemyMaxHp);
		this.enemyHpFill.clear();
		if (pct <= 0) return;
		const HPW = this._hpBarW;
		const col = pct > 0.5 ? 0xff2055 : pct > 0.25 ? 0xff8800 : 0xff0000;
		this.enemyHpFill.fillStyle(col, 1);
		this.enemyHpFill.fillRoundedRect(ENEMY_X - HPW / 2, ARENA_TOP + 24, HPW * pct, 10, 5);
	}

	// ARENA CHARACTERS
	buildArenaCharacters() {
		this.heroAuraG = this.add.graphics().setDepth(4);
		this.enemyAuraG = this.add.graphics().setDepth(4);

		// Shadow ellipses on the floor
		const sg = this.add.graphics().setDepth(4);
		sg.fillStyle(0x000000, 0.22);
		sg.fillEllipse(HERO_X, FLOOR_Y + 2, 100, 12);
		sg.fillEllipse(ENEMY_X, FLOOR_Y + 2, 100, 12);

		// Character containers
		this.heroContainer = this.add.container(HERO_X, CHAR_Y).setDepth(5);
		this._rebuildHero();

		this.enemyContainer = this.add.container(ENEMY_X, CHAR_Y).setDepth(5);
		this._rebuildEnemy();

		// Idle bob — hero
		this.tweens.add({
			targets: this.heroContainer, y: CHAR_Y - 8,
			duration: 1900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
		});
		// Idle bob — enemy
		this.tweens.add({
			targets: this.enemyContainer, y: CHAR_Y - 6,
			duration: 2300, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: 600
		});
	}

	_tickAura() {
		this._auraPhase += 0.05;
		const ph = this._auraPhase;

		if (this.heroAuraG && this.heroContainer) {
			const r = 52 + Math.sin(ph) * 9;
			const a = 0.07 + Math.sin(ph * 1.2) * 0.025;
			this.heroAuraG.clear();
			this.heroAuraG.fillStyle(0x00f5cc, a);
			this.heroAuraG.fillEllipse(this.heroContainer.x, this.heroContainer.y + 28, r * 2.5, r * 0.85);
			this.heroAuraG.lineStyle(1.5, 0x00f5cc, 0.1 + Math.sin(ph) * 0.04);
			this.heroAuraG.strokeEllipse(this.heroContainer.x, this.heroContainer.y + 28, r * 2.7, r * 0.95);
		}

		if (this.enemyAuraG && this.enemyContainer && !this._enemyDead) {
			const r = 46 + Math.sin(ph * 1.1 + 1) * 7;
			const a = 0.06 + Math.sin(ph * 0.9) * 0.02;
			this.enemyAuraG.clear();
			this.enemyAuraG.fillStyle(0xff2055, a);
			this.enemyAuraG.fillEllipse(this.enemyContainer.x, this.enemyContainer.y + 28, r * 2.3, r * 0.8);
		}
	}

	// HERO DRAWING
	_rebuildHero() {
		this.heroContainer.removeAll(true);
		const g = this.add.graphics();
		const s = HERO_S; // 2.2 — feet at y = +73 from origin

		// Cape
		g.fillStyle(0x002233, 0.6);
		g.fillTriangle(-12 * s, 0, -24 * s, 28 * s, -11 * s, 28 * s);

		// Body armour
		g.fillStyle(0x004455, 1); g.fillRect(-10 * s, 0, 20 * s, 18 * s);
		// Gold chest stripes
		g.fillStyle(0xb08020, 0.5); g.fillRect(-9 * s, 0, 18 * s, 2.5 * s);
		g.fillStyle(0xb08020, 0.28); g.fillRect(-9 * s, 8 * s, 18 * s, 2.5 * s);

		// Shoulder pads — gold
		g.fillStyle(0xd4a820, 1);
		g.fillRoundedRect(-16 * s, -2 * s, 9 * s, 9 * s, 2);
		g.fillRoundedRect(7 * s, -2 * s, 9 * s, 9 * s, 2);
		g.fillStyle(0xf0c040, 0.35);
		g.fillRoundedRect(-16 * s, -2 * s, 9 * s, 4.5 * s, 2);
		g.fillRoundedRect(7 * s, -2 * s, 9 * s, 4.5 * s, 2);

		// Head / helm
		g.fillStyle(0x005566, 1); g.fillRect(-8 * s, -14 * s, 16 * s, 14 * s);
		// Visor glow
		g.fillStyle(0x00f5cc, 0.92); g.fillRect(-6 * s, -11 * s, 12 * s, 5 * s);
		g.fillStyle(0x00f5cc, 0.22); g.fillRect(-8 * s, -12 * s, 16 * s, 7 * s);
		// Helmet band — gold
		g.fillStyle(0xd4a820, 1); g.fillRect(-9 * s, -16 * s, 18 * s, 4 * s);
		// Crest
		g.fillStyle(0x007788, 1); g.fillTriangle(-9 * s, -16 * s, 9 * s, -16 * s, 0, -27 * s);
		g.fillStyle(0xf0c040, 0.55); g.fillRect(-1 * s, -27 * s, 2 * s, 13 * s);
		// Crest gem
		g.fillStyle(0x00f5cc, 0.75); g.fillCircle(0, -22 * s, 2 * s);

		// Shield — ornate blue
		g.fillStyle(0x0044aa, 1); g.fillTriangle(-21 * s, 6 * s, -10 * s, 1 * s, -10 * s, 21 * s);
		g.fillStyle(0x0055cc, 1); g.fillRect(-20 * s, 4 * s, 9 * s, 15 * s);
		g.fillStyle(0xd4a820, 1); g.fillRect(-20 * s, 4 * s, 9 * s, 2 * s); // rim
		g.fillStyle(0xf0c040, 0.75); g.fillRect(-18 * s, 9 * s, 4 * s, 4 * s);
		g.fillCircle(-16 * s, 11 * s, 1.5 * s);

		// Sword — magical
		g.fillStyle(0xcce8ff, 1); g.fillRect(11 * s, -10 * s, 3.5 * s, 28 * s);
		g.fillStyle(0x4488cc, 1); g.fillRect(7 * s, 4 * s, 12 * s, 3.5 * s);   // cross-guard
		g.fillStyle(0xf0c040, 1); g.fillCircle(12.75 * s, 21 * s, 5 * s);   // pommel
		g.fillStyle(0xffffff, 0.28); g.fillRect(12 * s, -10 * s, 1.5 * s, 16 * s); // shine
		// Rune marks
		g.fillStyle(0x00f5cc, 0.42);
		for (let i = 0; i < 3; i++) g.fillRect(11.5 * s, (-8 + i * 7) * s, 2 * s, 1.5 * s);

		// Legs + boots
		g.fillStyle(0x003344, 1);
		g.fillRect(-8 * s, 18 * s, 7 * s, 13 * s); g.fillRect(1 * s, 18 * s, 7 * s, 13 * s);
		g.fillStyle(0xb08020, 0.55);
		g.fillRect(-8 * s, 22 * s, 7 * s, 3 * s); g.fillRect(1 * s, 22 * s, 7 * s, 3 * s); // knee plates
		g.fillStyle(0x002233, 1);
		g.fillRect(-9 * s, 30 * s, 9 * s, 4 * s); g.fillRect(0, 30 * s, 9 * s, 4 * s);

		this.heroContainer.add(g);
	}

	// ENEMY DRAWINGS
	_rebuildEnemy() {
		this.enemyContainer.removeAll(true);
		const g = this.add.graphics();
		const w = this.enemyLv;
		if (w <= 2) this._drawGoblin(g, 2.0);
		else if (w <= 4) this._drawOrc(g, 2.05);
		else if (w <= 6) this._drawTroll(g, 2.2);
		else if (w <= 8) this._drawDarkKnight(g, 2.1);
		else if (w <= 12) this._drawDragonLord(g, 2.2);
		else this._drawDemonOverlord(g, 2.3);
		this.enemyContainer.add(g);
	}

	// All enemy origins placed so feet are roughly at y = +HERO_FOOT from container
	_drawGoblin(g, s) {
		const oy = -(HERO_FOOT - 24 * s); // offset to align feet
		g.fillStyle(0x229922, 1);
		// Body
		g.fillRect(-6 * s, oy - 14 * s, 12 * s, 14 * s);
		// Head
		g.fillStyle(0x33bb33, 1); g.fillEllipse(0, oy - 20 * s, 14 * s, 12 * s);
		// Ears
		g.fillStyle(0x229922, 1);
		g.fillTriangle(-8 * s, oy - 24 * s, -13 * s, oy - 19 * s, -7 * s, oy - 17 * s);
		g.fillTriangle(8 * s, oy - 24 * s, 13 * s, oy - 19 * s, 7 * s, oy - 17 * s);
		// Eyes
		g.fillStyle(0xff2200, 1); g.fillCircle(-3 * s, oy - 21 * s, 2 * s); g.fillCircle(3 * s, oy - 21 * s, 2 * s);
		g.fillStyle(0xff5500, 0.4); g.fillCircle(-3 * s, oy - 21 * s, 3.5 * s); g.fillCircle(3 * s, oy - 21 * s, 3.5 * s);
		// Mouth + teeth
		g.fillStyle(0x111111, 1); g.fillRect(-3 * s, oy - 17 * s, 6 * s, 2 * s);
		g.fillStyle(0xffffaa, 1); g.fillRect(-2.5 * s, oy - 17 * s, 1.5 * s, 2 * s); g.fillRect(1 * s, oy - 17 * s, 1.5 * s, 2 * s);
		// Club
		g.fillStyle(0x664422, 1); g.fillRect(9 * s, oy - 22 * s, 3 * s, 22 * s);
		g.fillStyle(0x442200, 1); g.fillEllipse(10.5 * s, oy - 23 * s, 11 * s, 8 * s);
		// Legs
		g.fillStyle(0x229922, 1);
		g.fillRect(-5 * s, oy, 4 * s, 10 * s); g.fillRect(1 * s, oy, 4 * s, 10 * s);
		g.fillStyle(0x1a7a1a, 1);
		g.fillRect(-5 * s, oy + 9 * s, 4 * s, 2.5 * s); g.fillRect(1 * s, oy + 9 * s, 4 * s, 2.5 * s);
	}

	_drawOrc(g, s) {
		const oy = -(HERO_FOOT - 12 * s);
		g.fillStyle(0x3a6622, 1); g.fillRect(-9 * s, oy - 20 * s, 18 * s, 20 * s);
		g.fillStyle(0x2d5019, 1); g.fillRect(-9 * s, oy - 20 * s, 18 * s, 4 * s); // chest shade
		// Head
		g.fillStyle(0x4a7a2a, 1); g.fillRect(-9 * s, oy - 34 * s, 18 * s, 14 * s);
		g.fillStyle(0x2a5512, 1); g.fillRect(-9 * s, oy - 34 * s, 18 * s, 3 * s); // brow
		// Eyes
		g.fillStyle(0xff4400, 1); g.fillRect(-7 * s, oy - 31 * s, 4 * s, 3 * s); g.fillRect(3 * s, oy - 31 * s, 4 * s, 3 * s);
		// Tusks
		g.fillStyle(0xeeddbb, 1);
		g.fillTriangle(-5 * s, oy - 21 * s, -3 * s, oy - 21 * s, -4 * s, oy - 15 * s);
		g.fillTriangle(3 * s, oy - 21 * s, 5 * s, oy - 21 * s, 4 * s, oy - 15 * s);
		// Axe
		g.fillStyle(0x887755, 1); g.fillRect(12 * s, oy - 28 * s, 3 * s, 28 * s);
		g.fillStyle(0x888888, 1);
		g.fillTriangle(14 * s, oy - 28 * s, 24 * s, oy - 32 * s, 24 * s, oy - 14 * s);
		g.fillTriangle(14 * s, oy - 28 * s, 5 * s, oy - 32 * s, 5 * s, oy - 14 * s);
		// Legs
		g.fillStyle(0x3a6622, 1);
		g.fillRect(-8 * s, oy, 7 * s, 12 * s); g.fillRect(1 * s, oy, 7 * s, 12 * s);
		g.fillStyle(0x2a4a1a, 1);
		g.fillRect(-8 * s, oy + 10 * s, 7 * s, 3 * s); g.fillRect(1 * s, oy + 10 * s, 7 * s, 3 * s);
	}

	_drawTroll(g, s) {
		const oy = -(HERO_FOOT - 12 * s);
		g.fillStyle(0x6b4422, 1); g.fillRect(-12 * s, oy - 22 * s, 24 * s, 22 * s);
		g.fillStyle(0x5a3318, 1);
		g.fillRect(-12 * s, oy - 22 * s, 5 * s, 22 * s); g.fillRect(7 * s, oy - 22 * s, 5 * s, 22 * s);
		// Head
		g.fillStyle(0x7a5530, 1); g.fillRect(-11 * s, oy - 38 * s, 22 * s, 16 * s);
		// Eyes
		g.fillStyle(0xff6600, 1); g.fillCircle(-5 * s, oy - 32 * s, 3 * s); g.fillCircle(5 * s, oy - 32 * s, 3 * s);
		g.fillStyle(0xff9900, 0.4); g.fillCircle(-5 * s, oy - 32 * s, 5 * s); g.fillCircle(5 * s, oy - 32 * s, 5 * s);
		// Nostrils + teeth
		g.fillStyle(0x4a2800, 1); g.fillRect(-3 * s, oy - 28 * s, 2 * s, 2 * s); g.fillRect(1 * s, oy - 28 * s, 2 * s, 2 * s);
		g.fillStyle(0x2a1000, 1); g.fillRect(-7 * s, oy - 24 * s, 14 * s, 3 * s);
		g.fillStyle(0xeeeecc, 1); for (let i = -3; i <= 3; i += 2) g.fillRect(i * s, oy - 24 * s, 1.5 * s, 3 * s);
		// Club
		g.fillStyle(0x4a3a28, 1); g.fillRect(15 * s, oy - 36 * s, 5 * s, 36 * s);
		g.fillStyle(0x3a2a18, 1); g.fillEllipse(17.5 * s, oy - 37 * s, 16 * s, 10 * s);
		g.fillStyle(0x888888, 0.55); g.fillTriangle(10 * s, oy - 36 * s, 15 * s, oy - 34 * s, 15 * s, oy - 28 * s);
		// Legs
		g.fillStyle(0x6b4422, 1);
		g.fillRect(-10 * s, oy, 9 * s, 12 * s); g.fillRect(1 * s, oy, 9 * s, 12 * s);
		g.fillStyle(0x4a2e14, 1);
		g.fillRect(-11 * s, oy + 10 * s, 11 * s, 3 * s); g.fillRect(0, oy + 10 * s, 11 * s, 3 * s);
	}

	_drawDarkKnight(g, s) {
		const oy = -(HERO_FOOT - 14 * s);
		// Body
		g.fillStyle(0x111122, 1); g.fillRect(-10 * s, oy - 22 * s, 20 * s, 22 * s);
		g.fillStyle(0x222244, 1); g.fillRect(-10 * s, oy - 22 * s, 20 * s, 5 * s); g.fillRect(-10 * s, oy - 11 * s, 20 * s, 4 * s);
		g.lineStyle(1, 0x4444aa, 0.55); g.strokeRect(-10 * s, oy - 22 * s, 20 * s, 22 * s);
		// Shoulders
		g.fillStyle(0x1a1a3a, 1);
		g.fillRoundedRect(-18 * s, oy - 25 * s, 11 * s, 12 * s, 3);
		g.fillRoundedRect(7 * s, oy - 25 * s, 11 * s, 12 * s, 3);
		g.lineStyle(1, 0x4444aa, 0.4);
		g.strokeRoundedRect(-18 * s, oy - 25 * s, 11 * s, 12 * s, 3);
		g.strokeRoundedRect(7 * s, oy - 25 * s, 11 * s, 12 * s, 3);
		// Head
		g.fillStyle(0x0e0e22, 1); g.fillRect(-9 * s, oy - 37 * s, 18 * s, 15 * s);
		g.lineStyle(1, 0x4444aa, 0.38); g.strokeRect(-9 * s, oy - 37 * s, 18 * s, 15 * s);
		// Visor — red slit
		g.fillStyle(0xff0033, 0.9); g.fillRect(-7 * s, oy - 31 * s, 14 * s, 3 * s);
		g.fillStyle(0xff0033, 0.22); g.fillRect(-9 * s, oy - 32 * s, 18 * s, 5 * s);
		// Horns
		g.fillStyle(0x222244, 1);
		g.fillTriangle(-9 * s, oy - 37 * s, -16 * s, oy - 50 * s, -4 * s, oy - 37 * s);
		g.fillTriangle(9 * s, oy - 37 * s, 16 * s, oy - 50 * s, 4 * s, oy - 37 * s);
		// Dark blade
		g.fillStyle(0x334455, 1); g.fillRect(12 * s, oy - 36 * s, 4 * s, 36 * s);
		g.fillStyle(0x2a2a4a, 1); g.fillRect(6 * s, oy - 16 * s, 16 * s, 4 * s);
		g.fillStyle(0x5555bb, 0.55); g.fillRect(6 * s, oy - 16 * s, 16 * s, 1 * s);
		g.fillStyle(0xffffff, 0.06); g.fillRect(13 * s, oy - 36 * s, 1.5 * s, 26 * s);
		// Dark aura wisp
		g.fillStyle(0x4400aa, 0.2); g.fillCircle(-5 * s, oy - 8 * s, 9 * s); g.fillCircle(8 * s, oy - 2 * s, 7 * s);
		// Legs
		g.fillStyle(0x0e0e22, 1);
		g.fillRect(-9 * s, oy, 8 * s, 14 * s); g.fillRect(1 * s, oy, 8 * s, 14 * s);
		g.lineStyle(1, 0x4444aa, 0.32);
		g.strokeRect(-9 * s, oy, 8 * s, 14 * s); g.strokeRect(1 * s, oy, 8 * s, 14 * s);
		g.fillStyle(0x080812, 1);
		g.fillRect(-10 * s, oy + 12 * s, 10 * s, 3 * s); g.fillRect(0, oy + 12 * s, 10 * s, 3 * s);
	}

	_drawDragonLord(g, s) {
		const oy = -(HERO_FOOT - 12 * s);
		// Wings
		g.fillStyle(0x440011, 0.65);
		g.fillTriangle(-33 * s, oy, -11 * s, oy - 10 * s, -11 * s, oy + 18 * s);
		g.fillTriangle(33 * s, oy, 11 * s, oy - 10 * s, 11 * s, oy + 18 * s);
		g.lineStyle(1, 0xff2200, 0.32);
		g.strokeTriangle(-33 * s, oy, -11 * s, oy - 10 * s, -11 * s, oy + 18 * s);
		g.strokeTriangle(33 * s, oy, 11 * s, oy - 10 * s, 11 * s, oy + 18 * s);
		// Body
		g.fillStyle(0x660011, 1); g.fillRect(-10 * s, oy - 22 * s, 20 * s, 22 * s);
		g.fillStyle(0x880022, 1); g.fillRect(-10 * s, oy - 22 * s, 20 * s, 6 * s);
		// Scales
		g.fillStyle(0x550011, 1);
		g.fillRect(-9 * s, oy - 15 * s, 5 * s, 4 * s); g.fillRect(-3 * s, oy - 15 * s, 5 * s, 4 * s); g.fillRect(3 * s, oy - 15 * s, 5 * s, 4 * s);
		// Head
		g.fillStyle(0x770011, 1); g.fillRect(-9 * s, oy - 37 * s, 18 * s, 15 * s);
		// Horns
		g.fillStyle(0xaa3300, 1);
		g.fillTriangle(-9 * s, oy - 37 * s, -18 * s, oy - 51 * s, -4 * s, oy - 37 * s);
		g.fillTriangle(9 * s, oy - 37 * s, 18 * s, oy - 51 * s, 4 * s, oy - 37 * s);
		// Eyes
		g.fillStyle(0xff6600, 1); g.fillCircle(-4 * s, oy - 30 * s, 3 * s); g.fillCircle(4 * s, oy - 30 * s, 3 * s);
		g.fillStyle(0xff9900, 0.42); g.fillCircle(-4 * s, oy - 30 * s, 5.5 * s); g.fillCircle(4 * s, oy - 30 * s, 5.5 * s);
		// Fire hint
		g.fillStyle(0xff4400, 0.28); g.fillTriangle(-4 * s, oy - 24 * s, 4 * s, oy - 24 * s, 15 * s, oy - 34 * s);
		// Claw
		g.fillStyle(0xaa2200, 1); g.fillRect(12 * s, oy - 20 * s, 4 * s, 20 * s);
		g.fillStyle(0xcc4400, 1);
		for (let i = 0; i < 3; i++) g.fillTriangle(11 * s, oy + (i * 5) * s, 15 * s, oy + (i * 5) * s, 13 * s, oy + (5 + i * 5) * s);
		// Legs
		g.fillStyle(0x660011, 1);
		g.fillRect(-8 * s, oy, 7 * s, 12 * s); g.fillRect(1 * s, oy, 7 * s, 12 * s);
		g.fillStyle(0x440011, 1);
		g.fillRect(-9 * s, oy + 10 * s, 9 * s, 3 * s); g.fillRect(0, oy + 10 * s, 9 * s, 3 * s);
	}

	_drawDemonOverlord(g, s) {
		const oy = -(HERO_FOOT - 13 * s);
		// Shadow wings
		g.fillStyle(0x330066, 0.5);
		g.fillTriangle(-46 * s, oy + 4 * s, -13 * s, oy - 16 * s, -13 * s, oy + 20 * s);
		g.fillTriangle(46 * s, oy + 4 * s, 13 * s, oy - 16 * s, 13 * s, oy + 20 * s);
		g.lineStyle(1, 0xaa00ff, 0.32);
		g.strokeTriangle(-46 * s, oy + 4 * s, -13 * s, oy - 16 * s, -13 * s, oy + 20 * s);
		g.strokeTriangle(46 * s, oy + 4 * s, 13 * s, oy - 16 * s, 13 * s, oy + 20 * s);
		// Body
		g.fillStyle(0x220033, 1); g.fillRect(-12 * s, oy - 22 * s, 24 * s, 22 * s);
		g.fillStyle(0x440066, 0.42); g.fillRect(-12 * s, oy - 22 * s, 24 * s, 6 * s);
		// Rune marks
		g.fillStyle(0xaa00ff, 0.32);
		g.fillRect(-10 * s, oy - 14 * s, 4 * s, 2 * s); g.fillRect(-5 * s, oy - 8 * s, 10 * s, 2 * s); g.fillRect(6 * s, oy - 14 * s, 4 * s, 2 * s);
		// Massive shoulders
		g.fillStyle(0x330055, 1);
		g.fillRoundedRect(-22 * s, oy - 25 * s, 13 * s, 14 * s, 3);
		g.fillRoundedRect(9 * s, oy - 25 * s, 13 * s, 14 * s, 3);
		g.lineStyle(1, 0xaa00ff, 0.42);
		g.strokeRoundedRect(-22 * s, oy - 25 * s, 13 * s, 14 * s, 3);
		g.strokeRoundedRect(9 * s, oy - 25 * s, 13 * s, 14 * s, 3);
		// Head
		g.fillStyle(0x1a0022, 1); g.fillRect(-11 * s, oy - 38 * s, 22 * s, 16 * s);
		// Multiple horns
		g.fillStyle(0x440066, 1);
		g.fillTriangle(-11 * s, oy - 38 * s, -20 * s, oy - 53 * s, -5 * s, oy - 38 * s);
		g.fillTriangle(11 * s, oy - 38 * s, 20 * s, oy - 53 * s, 5 * s, oy - 38 * s);
		g.fillTriangle(-5 * s, oy - 38 * s, -8 * s, oy - 48 * s, 0, oy - 38 * s);
		g.fillTriangle(5 * s, oy - 38 * s, 8 * s, oy - 48 * s, 0, oy - 38 * s);
		// Eyes — blazing purple
		g.fillStyle(0xdd00ff, 1); g.fillCircle(-4 * s, oy - 30 * s, 3.5 * s); g.fillCircle(4 * s, oy - 30 * s, 3.5 * s);
		g.fillStyle(0xee88ff, 0.38); g.fillCircle(-4 * s, oy - 30 * s, 6.5 * s); g.fillCircle(4 * s, oy - 30 * s, 6.5 * s);
		// Staff
		g.fillStyle(0x2a0044, 1); g.fillRect(15 * s, oy - 46 * s, 4 * s, 46 * s);
		g.fillStyle(0xaa00ff, 1); g.fillCircle(17 * s, oy - 46 * s, 9 * s);
		g.fillStyle(0xffffff, 0.5); g.fillCircle(17 * s, oy - 46 * s, 4.5 * s);
		g.fillStyle(0xaa00ff, 0.16); g.fillCircle(17 * s, oy - 46 * s, 16 * s);
		// Legs
		g.fillStyle(0x220033, 1);
		g.fillRect(-10 * s, oy, 9 * s, 13 * s); g.fillRect(1 * s, oy, 9 * s, 13 * s);
		g.fillStyle(0x110022, 1);
		g.fillRect(-11 * s, oy + 11 * s, 11 * s, 3 * s); g.fillRect(0, oy + 11 * s, 11 * s, 3 * s);
	}

	// GRID
	buildGrid() {
		// Panel background
		const panH = GH - CONTENT_Y + 6;
		const panBg = this.add.graphics().setDepth(1);
		panBg.fillStyle(0x07081e, 0.88);
		panBg.fillRoundedRect(GRID_X - 4, CONTENT_Y - 14, COLS * CELL + 8, panH, 8);
		panBg.lineStyle(1, 0xf0c040, 0.14);
		panBg.strokeRoundedRect(GRID_X - 4, CONTENT_Y - 14, COLS * CELL + 8, panH, 8);

		const g = this.add.graphics().setDepth(2);
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				const x = GRID_X + c * CELL, y = GRID_Y + r * CELL;
				g.fillStyle(0x080920, 1); g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
				g.lineStyle(1, 0x1c1c40, 1); g.strokeRect(x, y, CELL, CELL);
				g.fillStyle(0x2a2a60, 0.55);
				[[4, 4], [CELL - 7, 4], [4, CELL - 7], [CELL - 7, CELL - 7]].forEach(([dx, dy]) => g.fillRect(x + dx, y + dy, 3, 3));
			}
		}
		g.lineStyle(1, 0xf0c040, 0.18); g.strokeRect(GRID_X, GRID_Y, COLS * CELL, ROWS * CELL);
	}

	// STATS PANEL
	buildStatsPanel() {
		const SX = STATS_X, SW = STATS_W, SY = CONTENT_Y;

		const panBg = this.add.graphics().setDepth(1);
		panBg.fillStyle(0x07081e, 0.88);
		panBg.fillRoundedRect(SX - 4, SY - 14, SW + 8, GH - SY + 6, 8);
		panBg.lineStyle(1, 0x00f5cc, 0.14);
		panBg.strokeRoundedRect(SX - 4, SY - 14, SW + 8, GH - SY + 6, 8);

		// Avatar box
		const avW = SW - 20, avH = 126;
		const avG = this.add.graphics().setDepth(3);
		avG.fillStyle(0x050f1a, 1); avG.fillRoundedRect(SX + 10, SY, avW, avH, 8);
		avG.lineStyle(1, 0x00f5cc, 0.2); avG.strokeRoundedRect(SX + 10, SY, avW, avH, 8);
		avG.fillStyle(0x00f5cc, 0.025); avG.fillRoundedRect(SX + 10, SY, avW, avH, 8);

		this.add.text(SX + SW / 2, SY + 7, 'COMMANDER', {
			fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '9px', color: '#00f5cc', letterSpacing: 3
		}).setOrigin(0.5, 0).setDepth(4);

		this._drawMiniHero(SX + SW / 2, SY + avH / 2 + 14);

		// Stat rows
		const statsY = SY + avH + 18;
		const rows = [
			['ATK', 0xff2055, 'heroAtkTxt'],
			['LVL', 0xf0c040, 'heroLvTxt'],
			['KILLS', 0xccd8ff, 'killsTxt'],
			['INCOME', 0xf0c040, 'incomeHero'],
		];
		const sg = this.add.graphics().setDepth(3);
		rows.forEach(([lbl, col, key], i) => {
			const ry = statsY + i * 28;
			if (i > 0) { sg.lineStyle(1, 0x0f0f28, 1); sg.moveTo(SX + 8, ry - 4); sg.lineTo(SX + SW - 8, ry - 4); sg.strokePath(); }
			this.add.text(SX + 12, ry, lbl, this.sty9(col, 0.45)).setDepth(4);
			this[key] = this.add.text(SX + 72, ry - 2, '0', {
				fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '13px',
				color: '#' + col.toString(16).padStart(6, '0')
			}).setDepth(4);
		});

		// Status badge
		const statusY = statsY + rows.length * 28 + 14;
		sg.lineStyle(1, 0x0f0f28, 1); sg.moveTo(SX + 8, statusY - 5); sg.lineTo(SX + SW - 8, statusY - 5); sg.strokePath();
		this._statBG = this.add.graphics().setDepth(4);
		this._statBX = SX + 10; this._statBY = statusY;
		this.statusLbl = this.add.text(SX + 12, statusY, 'IDLE', {
			fontFamily: 'Share Tech Mono', fontSize: '11px', color: '#f0c040'
		}).setDepth(4);
		this._setStatus('IDLE');
	}

	_drawMiniHero(cx, cy) {
		const g = this.add.graphics().setDepth(4);
		const s = 1.42;
		g.fillStyle(0x004455, 1); g.fillRect(cx - 10 * s, cy, 20 * s, 18 * s);
		g.fillStyle(0xd4a820, 1); g.fillRoundedRect(cx - 14 * s, cy - 2 * s, 8 * s, 8 * s, 2); g.fillRoundedRect(cx + 6 * s, cy - 2 * s, 8 * s, 8 * s, 2);
		g.fillStyle(0x005566, 1); g.fillRect(cx - 8 * s, cy - 14 * s, 16 * s, 14 * s);
		g.fillStyle(0x00f5cc, 0.9); g.fillRect(cx - 6 * s, cy - 11 * s, 12 * s, 5 * s);
		g.fillStyle(0xd4a820, 1); g.fillRect(cx - 9 * s, cy - 16 * s, 18 * s, 4 * s);
		g.fillStyle(0x007788, 1); g.fillTriangle(cx - 9 * s, cy - 16 * s, cx + 9 * s, cy - 16 * s, cx, cy - 25 * s);
		g.fillStyle(0xf0c040, 0.5); g.fillRect(cx - s, cy - 25 * s, 2 * s, 10 * s);
		g.fillStyle(0x0044aa, 1); g.fillTriangle(cx - 18 * s, cy + 7 * s, cx - 9 * s, cy + 2 * s, cx - 9 * s, cy + 18 * s);
		g.fillStyle(0xcce8ff, 1); g.fillRect(cx + 10 * s, cy - 8 * s, 3 * s, 24 * s);
		g.fillStyle(0x4488cc, 1); g.fillRect(cx + 6 * s, cy + 4 * s, 11 * s, 3 * s);
		g.fillStyle(0x003344, 1); g.fillRect(cx - 8 * s, cy + 18 * s, 7 * s, 12 * s); g.fillRect(cx + 1 * s, cy + 18 * s, 7 * s, 12 * s);
		g.fillStyle(0x002233, 1); g.fillRect(cx - 9 * s, cy + 29 * s, 8 * s, 4 * s); g.fillRect(cx + 1 * s, cy + 29 * s, 8 * s, 4 * s);
	}

	_setStatus(s) {
		const col = { IDLE: '#f0c040', FIGHTING: '#00f5cc', VICTORY: '#00ff88' }[s] || '#fff';
		const bgCol = { IDLE: 0x1a1200, FIGHTING: 0x001e18, VICTORY: 0x001200 }[s] || 0x111;
		const bdCol = { IDLE: 0x4a3400, FIGHTING: 0x004838, VICTORY: 0x003400 }[s] || 0x333;
		if (this._statBG) {
			this._statBG.clear();
			this._statBG.fillStyle(bgCol, 1);
			this._statBG.fillRoundedRect(this._statBX - 2, this._statBY - 2, 96, 18, 3);
			this._statBG.lineStyle(1, bdCol, 0.65);
			this._statBG.strokeRoundedRect(this._statBX - 2, this._statBY - 2, 96, 18, 3);
		}
		if (this.statusLbl) this.statusLbl.setColor(col).setText(s);
	}

	// LOG PANEL
	buildLogPanel() {
		const LX = LOG_X, LW = LOG_W, LY = CONTENT_Y;

		const panBg = this.add.graphics().setDepth(1);
		panBg.fillStyle(0x07081e, 0.88);
		panBg.fillRoundedRect(LX - 4, LY - 14, LW + 8, GH - LY + 6, 8);
		panBg.lineStyle(1, 0xcc44ff, 0.14);
		panBg.strokeRoundedRect(LX - 4, LY - 14, LW + 8, GH - LY + 6, 8);

		const hr = this.add.graphics().setDepth(3);
		hr.lineStyle(1, 0x1a1a40, 1); hr.moveTo(LX + 6, LY + 2); hr.lineTo(LX + LW - 6, LY + 2); hr.strokePath();

		this.logLines = [];
		for (let i = 0; i < 16; i++) {
			const a = Math.max(0.07, 0.9 - i * 0.056);
			this.logLines.push(
				this.add.text(LX + 10, LY + 8 + i * 20, i === 0 ? 'Awaiting weapons...' : '', {
					fontFamily: 'Share Tech Mono', fontSize: '10px', color: '#ccd8ff', alpha: a
				}).setDepth(4)
			);
		}
	}

	addLog(msg, col) {
		for (let i = this.logLines.length - 1; i > 0; i--) {
			this.logLines[i].setText(this.logLines[i - 1].text);
			this.logLines[i].setColor(this.logLines[i - 1].style.color);
			this.logLines[i].setAlpha(Math.max(0.07, this.logLines[i - 1].alpha * 0.74));
		}
		this.logLines[0].setText(msg).setColor(col || '#ccd8ff').setAlpha(0.9);
	}

	// BUY BUTTON
	buildBuyButton() {
		const gridCX = GRID_X + COLS * CELL / 2;
		const BY = GRID_Y + ROWS * CELL + 18;
		const BW = COLS * CELL - 10, BH = 42;
		this._buyX = gridCX; this._buyY = BY; this._buyW = BW; this._buyH = BH;

		const glow = this.add.graphics().setDepth(3);
		glow.fillStyle(0xf0c040, 0.03);
		glow.fillRoundedRect(gridCX - BW / 2 - 8, BY - BH / 2 - 8, BW + 16, BH + 16, 10);

		this._buyBg = this.add.graphics().setDepth(4);
		this._renderBuyBtn(false);

		this.add.graphics().setDepth(4).fillStyle(0xffffff, 0.04)
			.fillRect(gridCX - BW / 2 + 5, BY - BH / 2 + 5, BW - 10, 9);

		this.add.text(gridCX, BY - 7, 'BUY WEAPON', {
			fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '13px',
			color: '#f0c040', shadow: { blur: 12, color: '#f0c040', fill: true }
		}).setOrigin(0.5).setDepth(5);

		this.add.text(gridCX, BY + 9, `◆ ${BUY_COST}  ·  DAGGER  T1`, {
			fontFamily: 'Share Tech Mono', fontSize: '9px', color: '#f0c040', alpha: 0.38
		}).setOrigin(0.5).setDepth(5);

		const zone = this.add.zone(gridCX, BY, BW, BH).setInteractive({ cursor: 'pointer' }).setDepth(6);
		zone.on('pointerdown', () => this.buyWeapon());
		zone.on('pointerover', () => this._renderBuyBtn(true));
		zone.on('pointerout', () => this._renderBuyBtn(false));
	}

	_renderBuyBtn(hov) {
		const { _buyX: bx, _buyY: by, _buyW: bw, _buyH: bh } = this;
		this._buyBg.clear();
		this._buyBg.fillStyle(hov ? 0x2a2000 : 0x120f00, 1);
		this._buyBg.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
		this._buyBg.lineStyle(2, hov ? 0xf0c040 : 0x7a6800, hov ? 1 : 0.8);
		this._buyBg.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
	}

	// ATTACK ANIMATION
	animateAttack() {
		if (!this.totalAtk || !this.enemyContainer || this._enemyDead) return;
		const tier = this._maxTier();
		const col = tier > 0 ? WEAPONS[Math.min(tier - 1, WEAPONS.length - 1)].color : 0x00f5cc;

		// Hero lunge forward
		if (this.heroContainer) {
			this.tweens.add({
				targets: this.heroContainer, x: HERO_X + 32,
				duration: 120, ease: 'Power2', yoyo: true,
				onComplete: () => { if (this.heroContainer) this.heroContainer.x = HERO_X; }
			});
		}

		// Projectile
		const proj = this.add.graphics().setDepth(20);
		proj.fillStyle(col, 1); proj.fillCircle(0, 0, 5);
		proj.fillStyle(col, 0.2); proj.fillCircle(0, 0, 12);
		proj.setPosition(HERO_X + 36, CHAR_Y - 22);

		this.tweens.add({
			targets: proj,
			x: ENEMY_X - 32, y: CHAR_Y - 24,
			duration: 190, ease: 'Linear',
			onUpdate: () => {
				if (Math.random() < 0.38) {
					const t = this.add.graphics().setDepth(19);
					t.fillStyle(col, 0.42); t.fillCircle(0, 0, 3);
					t.setPosition(proj.x, proj.y);
					this.tweens.add({ targets: t, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 170, onComplete: () => t.destroy() });
				}
			},
			onComplete: () => { proj.destroy(); this._impactEnemy(col); }
		});
	}

	_impactEnemy(col) {
		if (!this.enemyContainer) return;
		// Burst ring
		const fx = this.add.graphics().setDepth(25);
		fx.fillStyle(col, 0.72); fx.fillCircle(ENEMY_X, CHAR_Y - 26, 15);
		this.tweens.add({ targets: fx, scaleX: 3.8, scaleY: 3.8, alpha: 0, duration: 320, ease: 'Power2', onComplete: () => fx.destroy() });
		// Sparks
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2;
			const sp = this.add.graphics().setDepth(25);
			sp.fillStyle(col, 1); sp.fillCircle(0, 0, 2.5); sp.setPosition(ENEMY_X, CHAR_Y - 26);
			this.tweens.add({ targets: sp, x: ENEMY_X + Math.cos(a) * 40, y: CHAR_Y - 26 + Math.sin(a) * 38, alpha: 0, duration: 380, ease: 'Power2', onComplete: () => sp.destroy() });
		}
		// Enemy flash
		const ec = this.enemyContainer;
		this.tweens.add({ targets: ec, alpha: 0.18, duration: 60, yoyo: true, repeat: 1, onComplete: () => { if (ec) ec.setAlpha(1); } });
		// Damage float
		const dx = ENEMY_X + Phaser.Math.Between(-28, 28);
		const dt = this.add.text(dx, CHAR_Y - 52, `-${this.fmt(this.totalAtk)}`, {
			fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '15px',
			color: '#' + col.toString(16).padStart(6, '0'),
			shadow: { blur: 10, color: '#' + col.toString(16).padStart(6, '0'), fill: true }
		}).setOrigin(0.5).setDepth(30);
		this.tweens.add({ targets: dt, y: CHAR_Y - 106, alpha: 0, duration: 880, ease: 'Power2', onComplete: () => dt.destroy() });
	}

	_maxTier() {
		let m = 0; this.grid.forEach(t => { if (t && t > m) m = t; }); return m;
	}

	// WEAPON SPRITES
	placeWeapon(i, tier) {
		if (this.sprites[i]) { this.sprites[i].destroy(); this.sprites[i] = null; }
		if (!tier) { this.grid[i] = null; return; }
		const c = i % COLS, r = Math.floor(i / COLS);
		const cx = GRID_X + c * CELL + CELL / 2, cy = GRID_Y + r * CELL + CELL / 2;
		const w = WEAPONS[tier - 1];
		const container = this.add.container(cx, cy).setDepth(2);

		const bg = this.add.graphics(); bg.fillStyle(w.color, 0.06); bg.fillCircle(0, 0, 42); container.add(bg);
		const hex = this.add.graphics(); hex.lineStyle(1.5, w.color, 0.7); this._hexPath(hex, 0, 0, 34); container.add(hex);
		const hf = this.add.graphics(); hf.fillStyle(w.color, 0.08); this._hexFill(hf, 0, 0, 32); container.add(hf);
		const ico = this.add.graphics(); this._drawWeapon(ico, tier, w.color); container.add(ico);
		const badge = this.add.graphics();
		badge.fillStyle(0x000000, 0.6); badge.fillRoundedRect(-14, 20, 28, 13, 3);
		badge.lineStyle(1, w.color, 0.45); badge.strokeRoundedRect(-14, 20, 28, 13, 3); container.add(badge);
		const tt = this.add.text(0, 26.5, `T${tier}`, { fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '8px', color: '#' + w.color.toString(16).padStart(6, '0') }).setOrigin(0.5);
		container.add(tt);

		this.sprites[i] = container; this.grid[i] = tier;
	}

	_hexPath(g, cx, cy, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * 60 - 30) * Math.PI / 180; i === 0 ? g.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); g.strokePath(); }
	_hexFill(g, cx, cy, r) { const p = []; for (let i = 0; i < 6; i++) { const a = (i * 60 - 30) * Math.PI / 180; p.push(new Phaser.Math.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))); } g.fillPoints(p, true); }

	_drawWeapon(g, tier, col) {
		g.fillStyle(col, 1); g.lineStyle(1, col, 1);
		switch (tier) {
			case 1: g.fillTriangle(-2.5, -18, 2.5, -18, 0, 2); g.fillStyle(col, 0.45); g.fillRect(-6, 2, 12, 3); g.fillStyle(col, 0.7); g.fillRect(-2, 5, 4, 8); break;
			case 2: g.fillTriangle(-3.5, -16, 3.5, -16, 0, 4); g.fillStyle(0x336699, 1); g.fillRect(-8, 3, 16, 3); g.fillStyle(col, 0.7); g.fillRect(-2, 6, 4, 9); g.fillCircle(0, 16, 3); break;
			case 3: g.fillTriangle(-4, -20, 4, -20, 0, 6); g.fillStyle(0x224488, 1); g.fillRect(-9, 5, 18, 4); g.fillStyle(col, 0.7); g.fillRect(-2, 9, 4, 10); g.fillCircle(0, 20, 4); g.fillStyle(0xffffff, 0.25); g.fillTriangle(-1, -18, 1, -18, 0, 4); break;
			case 4: g.fillTriangle(0, -18, 18, -8, 10, 6); g.fillTriangle(0, -18, -4, 6, 10, 6); g.fillStyle(0x554400, 1); g.fillRect(-2, 6, 4, 14); g.fillStyle(0x886600, 1); g.fillRect(-3, 18, 6, 3); break;
			case 5: g.fillTriangle(0, -18, 20, -6, 8, 6); g.fillTriangle(0, 18, -20, 6, -8, -6); g.fillStyle(col, 0.7); g.fillTriangle(0, -18, -20, -6, -8, 6); g.fillTriangle(0, 18, 20, 6, 8, -6); g.fillStyle(0x665500, 1); g.fillRect(-2, -8, 4, 16); break;
			case 6: g.fillTriangle(-4, -20, 4, -20, 0, -3); g.fillStyle(col, 0.35); g.fillRect(-1.5, -4, 3, 26); g.fillStyle(col, 0.7); g.fillRect(-6, -5, 12, 4); g.fillStyle(0x334444, 1); g.fillRect(-1, -1, 2, 12); break;
			case 7: g.fillTriangle(-2, -22, 2, -22, 0, -6); g.fillTriangle(-12, -18, -8, -18, -10, -6); g.fillTriangle(8, -18, 12, -18, 10, -6); g.fillStyle(col, 0.5); g.fillRect(-2, -6, 4, 26); g.fillStyle(col, 0.35); g.fillRect(-6, -8, 12, 4); break;
			case 8: g.fillStyle(col, 0.9); g.fillRect(-2, -18, 4, 30); g.fillStyle(col, 1); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.fillRect(Math.cos(a) * 9 - 2, -18 + Math.sin(a) * 9 - 2, 4, 4); } g.fillCircle(0, -18, 6); g.fillStyle(0xffffff, 0.4); g.fillCircle(0, -18, 3); break;
			case 9: g.fillStyle(col, 0.9); g.fillRect(-3, -16, 6, 34); g.fillCircle(0, -20, 9); g.fillStyle(0xffffff, 0.3); g.fillCircle(-2, -22, 4); g.fillStyle(col, 1); g.fillRect(-9, -8, 18, 4); g.fillStyle(col, 0.3); g.fillCircle(0, -20, 14); break;
			case 10: g.fillStyle(0xffffff, 1); g.fillTriangle(-5, -22, 5, -22, 0, 8); g.fillStyle(0xffdd00, 1); g.fillTriangle(-5, -22, -14, -14, -3, -2); g.fillTriangle(5, -22, 14, -14, 3, -2); g.fillStyle(0xffffff, 0.8); g.fillRect(-3, 8, 6, 10); g.fillCircle(0, 20, 5); g.fillStyle(0xffffff, 0.06); g.fillCircle(0, -8, 22); break;
		}
	}

	// DRAG
	setupDrag() {
		this.input.on('pointerdown', ptr => {
			const cell = this._ptrCell(ptr);
			if (cell >= 0 && this.grid[cell]) {
				this.drag = { from: cell, tier: this.grid[cell], ox: this.sprites[cell].x, oy: this.sprites[cell].y };
				this.sprites[cell].setDepth(25);
				this._showMergeHints(this.grid[cell]);
			}
		});
		this.input.on('pointermove', ptr => {
			if (!this.drag) return;
			this.sprites[this.drag.from].setPosition(ptr.x, ptr.y);
		});
		this.input.on('pointerup', ptr => {
			if (!this.drag) return;
			const { from, tier, ox, oy } = this.drag; this.drag = null; this._clearHints();
			const to = this._ptrCell(ptr);
			if (to >= 0 && to !== from) {
				if (this.grid[to] === tier && tier < WEAPONS.length) {
					this.sprites[from].destroy(); this.sprites[from] = null; this.grid[from] = null;
					this.placeWeapon(to, tier + 1); this._mergeVFX(to);
					this.addLog(`Merged → ${WEAPONS[tier].name} T${tier + 1}!`, '#00f5cc');
				} else if (!this.grid[to]) {
					const cp = this._cellCenter(to);
					this.sprites[from].setPosition(cp.x, cp.y).setDepth(2);
					this.grid[to] = tier; this.sprites[to] = this.sprites[from]; this.grid[from] = null; this.sprites[from] = null;
				} else { this.sprites[from].setPosition(ox, oy).setDepth(2); }
			} else { this.sprites[from].setPosition(ox, oy).setDepth(2); }
			this.recalc();
		});
	}

	_ptrCell(ptr) { const c = Math.floor((ptr.x - GRID_X) / CELL), r = Math.floor((ptr.y - GRID_Y) / CELL); if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1; return r * COLS + c; }
	_cellCenter(i) { return { x: GRID_X + (i % COLS) * CELL + CELL / 2, y: GRID_Y + Math.floor(i / COLS) * CELL + CELL / 2 }; }

	_showMergeHints(tier) {
		this._clearHints();
		const g = this.add.graphics().setDepth(3); this._highlights.push(g);
		for (let i = 0; i < ROWS * COLS; i++) {
			if (this.grid[i] === tier) {
				const c = i % COLS, r = Math.floor(i / COLS);
				g.fillStyle(0xf0c040, 0.08); g.fillRect(GRID_X + c * CELL + 1, GRID_Y + r * CELL + 1, CELL - 2, CELL - 2);
				g.lineStyle(1.5, 0xf0c040, 0.5); g.strokeRect(GRID_X + c * CELL + 1, GRID_Y + r * CELL + 1, CELL - 2, CELL - 2);
			}
		}
	}
	_clearHints() { this._highlights.forEach(h => h.destroy()); this._highlights = []; }

	_mergeVFX(cellIndex) {
		const { x, y } = this._cellCenter(cellIndex);
		const tier = this.grid[cellIndex];
		const c = WEAPONS[Math.min(tier - 1, WEAPONS.length - 1)].color;
		const ring = this.add.graphics().setDepth(30);
		ring.lineStyle(2, c, 1); ring.strokeCircle(x, y, 10);
		this.tweens.add({ targets: ring, scaleX: 5.5, scaleY: 5.5, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * Math.PI * 2, p = this.add.graphics().setDepth(30);
			p.fillStyle(c, 1); p.fillCircle(0, 0, i < 7 ? 3 : 2); p.setPosition(x, y);
			this.tweens.add({ targets: p, x: x + Math.cos(a) * (46 + i * 3), y: y + Math.sin(a) * (46 + i * 3), alpha: 0, duration: 580, ease: 'Power2', onComplete: () => p.destroy() });
		}
		const t = this.add.text(x, y - 10, `MERGE  T${tier}`, { fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '11px', color: '#' + c.toString(16).padStart(6, '0'), shadow: { blur: 10, color: '#' + c.toString(16).padStart(6, '0'), fill: true } }).setOrigin(0.5).setDepth(30);
		this.tweens.add({ targets: t, y: y - 62, alpha: 0, duration: 920, onComplete: () => t.destroy() });
	}

	// BUY
	buyWeapon() {
		if (this.coins < BUY_COST) { this.cameras.main.shake(150, 0.006); this.addLog('NOT ENOUGH COINS', '#ff2055'); return; }
		const slot = this.grid.findIndex(v => v === null);
		if (slot < 0) { this.cameras.main.shake(150, 0.006); this.addLog('ARSENAL FULL — merge first!', '#ffdd00'); return; }
		this.coins -= BUY_COST; this.placeWeapon(slot, 1); this.recalc();
		this.addLog('Purchased Dagger T1', '#aabbff');
		const { x, y } = this._cellCenter(slot);
		const fx = this.add.text(x, y - 18, `-◆${BUY_COST}`, { fontFamily: 'Share Tech Mono', fontSize: '11px', color: '#f0c040', alpha: 0.9 }).setOrigin(0.5).setDepth(30);
		this.tweens.add({ targets: fx, y: y - 60, alpha: 0, duration: 750, onComplete: () => fx.destroy() });
	}

	// RECALC
	recalc() {
		let atk = 0, gps = 0, items = 0;
		this.grid.forEach(t => { if (t) { atk += WEAPONS[t - 1].atk; gps += WEAPONS[t - 1].gps; items++; } });
		this.totalAtk = atk; this.gps = Math.max(1, gps); this.itemCount = items;
		this._refreshHUD();
		this._setStatus(atk > 0 ? 'FIGHTING' : 'IDLE');
	}

	_refreshHUD() {
		if (this.coinTxt) this.coinTxt.setText(this.fmt(this.coins));
		if (this.atkTxt) this.atkTxt.setText(this.fmt(this.totalAtk));
		if (this.itemsTxt) this.itemsTxt.setText(String(this.itemCount));
		if (this.incTxt) this.incTxt.setText(`+${this.fmt(this.gps)} /s`);
		if (this.heroAtkTxt) this.heroAtkTxt.setText(this.fmt(this.totalAtk));
		if (this.incomeHero) this.incomeHero.setText(`+${this.fmt(this.gps)}/s`);
		if (this.killsHUD) this.killsHUD.setText(String(this.kills));
		if (this.killsTxt) this.killsTxt.setText(String(this.kills));
	}

	// TICK / BATTLE
	onTick() {
		this.coins += (this.gps || 1);
		this._refreshHUD();
	}

	onBattle() {
		if (!this.totalAtk || this._enemyDead) return;
		this.animateAttack();
		this.enemyHp -= this.totalAtk;
		this._drawEnemyHp();
		this.addLog(`Hit for ${this.fmt(this.totalAtk)} dmg`, '#ff7799');

		if (this.enemyHp <= 0) {
			this._enemyDead = true;
			this.kills++;
			this.heroLv++;
			const reward = 60 + this.enemyLv * 30;
			this.coins += reward;

			this._enemyDeathAnim(() => {
				this.enemyLv++;
				this.enemyMaxHp = 200 * this.enemyLv * 1.85;
				this.enemyHp = this.enemyMaxHp;
				const name = ENEMY_NAMES[Math.min(this.enemyLv - 1, ENEMY_NAMES.length - 1)];
				if (this.arenaEnemyName) this.arenaEnemyName.setText(name);
				if (this.waveTxt) this.waveTxt.setText(String(this.enemyLv));
				if (this.enemyNameTxt) this.enemyNameTxt.setText(name);
				if (this.heroLvBadge) this.heroLvBadge.setText(`LVL  ${this.heroLv}`);
				if (this.enemyLvBadge) this.enemyLvBadge.setText(`WAVE  ${this.enemyLv}`);
				if (this.heroLvTxt) this.heroLvTxt.setText(String(this.heroLv));
				this._rebuildEnemy();
				this._enemyDead = false;
				this._drawEnemyHp();
				this._setStatus('FIGHTING');
				this.addLog(`VICTORY! +◆${reward}`, '#00ff88');
				this._refreshHUD();
				// Slide new enemy in
				if (this.enemyContainer) {
					this.enemyContainer.setAlpha(0); this.enemyContainer.x = ENEMY_X + 130;
					this.tweens.add({ targets: this.enemyContainer, x: ENEMY_X, alpha: 1, duration: 440, ease: 'Back.Out' });
				}
			});

			this._setStatus('VICTORY');
			this._refreshHUD();
		}
	}

	_enemyDeathAnim(onComplete) {
		const ec = this.enemyContainer;
		if (!ec) { onComplete && onComplete(); return; }
		this.cameras.main.shake(200, 0.01);

		// Particle burst
		for (let i = 0; i < 24; i++) {
			const a = (i / 24) * Math.PI * 2;
			const p = this.add.graphics().setDepth(28);
			const col = [0xff2055, 0xff8800, 0xffdd00, 0xff4400][i % 4];
			p.fillStyle(col, 1); p.fillCircle(0, 0, 3 + Math.random() * 4);
			p.setPosition(ENEMY_X, CHAR_Y - 20);
			this.tweens.add({ targets: p, x: ENEMY_X + Math.cos(a) * (65 + Math.random() * 50), y: CHAR_Y - 20 + Math.sin(a) * (55 + Math.random() * 35), alpha: 0, duration: 620 + Math.random() * 320, ease: 'Power2', onComplete: () => p.destroy() });
		}
		// Big burst
		const burst = this.add.graphics().setDepth(28);
		burst.fillStyle(0xff5500, 0.65); burst.fillCircle(ENEMY_X, CHAR_Y - 20, 24);
		this.tweens.add({ targets: burst, scaleX: 5.5, scaleY: 5.5, alpha: 0, duration: 560, onComplete: () => burst.destroy() });

		this.tweens.add({ targets: ec, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 430, ease: 'Power2', onComplete: () => { ec.setScale(1); onComplete && onComplete(); } });

		const vt = this.add.text(ENEMY_X, CHAR_Y - 80, 'DEFEATED!', {
			fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '24px', color: '#ffdd00',
			shadow: { blur: 18, color: '#ffdd00', fill: true }
		}).setOrigin(0.5).setDepth(35);
		this.tweens.add({ targets: vt, y: CHAR_Y - 150, alpha: 0, duration: 1400, ease: 'Power2', onComplete: () => vt.destroy() });
	}

	// HELPERS
	fmt(n) { if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(Math.floor(n)); }
	sty9(col, alpha = 1) { return { fontFamily: 'Share Tech Mono', fontSize: '9px', color: '#' + col.toString(16).padStart(6, '0'), alpha }; }
	styBig(col) { return { fontFamily: 'Orbitron', fontStyle: 'bold', fontSize: '22px', color: '#' + col.toString(16).padStart(6, '0') }; }
}

// PHASER CONFIG
const config = {
	type: Phaser.AUTO,
	backgroundColor: '#060612',
	scene: [MergeScene],
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		parent: 'game-container',
		width: GW,
		height: GH,
	},
};

window.addEventListener('load', () => { window.game = new Phaser.Game(config); });