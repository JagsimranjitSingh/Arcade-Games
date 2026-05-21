// ============================================================
//  MERGE WEAPONS  –  game.js  (Premium Visual Overhaul v2)
//  Phaser 3 · Landscape-forced · FreshPlay integrated
// ============================================================

/* ── FreshPlay shim ─────────────────────────────────────────── */
if (!window.FreshPlay) {
  window.FreshPlay = {
    levelComplete: (cb) => { console.log('[FreshPlay] levelComplete'); if (cb) cb(); },
    getCurrentPalette: () => ({
      background: '#06080f',
      playerCore:  '#00e5ff',
      hostile:     '#ff2952',
      fxAccent:    '#ffd700',
    }),
  };
}

// ── Weapon tier definitions ──────────────────────────────────
const WEAPON_TIERS = [
  { tier:0, name:'Shard',      dps:1,    baseCost:10,   glyph:'▲', color:'#00e5ff' },
  { tier:1, name:'Blade',      dps:3,    baseCost:30,   glyph:'✦', color:'#00cfff' },
  { tier:2, name:'Saber',      dps:8,    baseCost:80,   glyph:'⬡', color:'#4df0ff' },
  { tier:3, name:'Katana',     dps:20,   baseCost:200,  glyph:'✸', color:'#a0ffe0' },
  { tier:4, name:'Waraxe',     dps:50,   baseCost:500,  glyph:'✺', color:'#ffe066' },
  { tier:5, name:'Glaive',     dps:120,  baseCost:1200, glyph:'❋', color:'#ff9f00' },
  { tier:6, name:'Obsidian',   dps:300,  baseCost:3000, glyph:'★', color:'#ff6aff' },
  { tier:7, name:'Void Blade', dps:750,  baseCost:8000, glyph:'⬟', color:'#c8b0ff' },
];

const GRID_COLS = 5;
const GRID_ROWS = 4;

// ── iOS-safe Audio ───────────────────────────────────────────
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function _tone(type, freq, freqEnd, dur, vol) {
  if (!audioCtx) return;
  const t=audioCtx.currentTime, o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type=type; o.frequency.setValueAtTime(freq,t);
  if(freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.start(t); o.stop(t+dur+0.02);
}
function playShing()   { _tone('sawtooth',1800,300,0.24,0.38); }
function playHit(p=220){ _tone('square',p,p*0.4,0.10,0.14); }
function playThrow()   { _tone('triangle',600,200,0.13,0.20); }
function playKill()    { _tone('sawtooth',300,80,0.16,0.22); }
function playLevelUp() {
  [523,659,784,1047].forEach((f,i)=>{
    if(!audioCtx)return;
    const t=audioCtx.currentTime+i*0.11, o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type='triangle'; o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.start(t); o.stop(t+0.20);
  });
}

// ─────────────────────────────────────────────────────────────
//  LANDSCAPE PROMPT SCENE
// ─────────────────────────────────────────────────────────────
class LandscapePrompt extends Phaser.Scene {
  constructor() { super({ key:'LandscapePrompt' }); }
  create() {
    const W=this.scale.width, H=this.scale.height;
    this.add.rectangle(W/2,H/2,W,H,0x06080f);
    this.icon = this.add.text(W/2,H/2-28,'📱',{fontSize:'52px'}).setOrigin(0.5);
    this.add.text(W/2,H/2+34,'ROTATE TO LANDSCAPE',{
      fontFamily:'"Courier New",monospace', fontSize:'15px',
      color:'#00e5ff', fontStyle:'bold'
    }).setOrigin(0.5);
    this.tweens.add({targets:this.icon, angle:90, duration:700, ease:'Back.easeOut'});
    this.scale.on('resize',()=>{ if(this.scale.width>this.scale.height) this.scene.start('MergeWeapons'); });
  }
}

// ─────────────────────────────────────────────────────────────
//  BOOT SCENE
// ─────────────────────────────────────────────────────────────
class Boot extends Phaser.Scene {
  constructor() { super({key:'Boot'}); }
  create() {
    this.scene.start('MergeWeapons');
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCENE
// ─────────────────────────────────────────────────────────────
class MergeWeapons extends Phaser.Scene {
  constructor() { super({key:'MergeWeapons'}); }

  // ── init ─────────────────────────────────────────────────
  init() {
    this.palette      = window.FreshPlay.getCurrentPalette();
    this.gold         = 60;
    this.wave         = 1;
    this.enemyCount   = 0;
    this.totalKills   = 0;
    this.enemyHP      = 20;
    this.costScale    = 1;
    this.heroHP       = 200;
    this.heroMaxHP    = 200;
    this.spawnTimer   = 0;
    this.spawnRate    = 2000;
    this.gridWeapons  = [];
    this.enemies      = [];
    this.projectiles  = [];
    this.particles    = [];
    this.bloodSplats  = [];
    this.dragWeapon   = null;
    this.dragOffX     = 0;
    this.dragOffY     = 0;
    this.dragOrigin   = null;
    this.attackTimer  = 0;
    this.goldTimer    = 0;
    this.bossActive   = false;
    this.bgStars      = [];
    this.heroAnim     = 0;
    this.heroAttackFlash = 0;
    this.nebulaClouds = [];
  }

  // ── preload ──────────────────────────────────────────────
  preload() {}

  // ── create ───────────────────────────────────────────────
  create() {
    this.cameras.main.setBackgroundColor(this.palette.background);
    this.input.once('pointerdown', () => ensureAudio());
    this.computeLayout();
    this._buildBgStars();
    this._buildNebula();
    this._createGraphicsLayers();
    this._drawAllBg();
    this._buildHUD();
    this._createHero();
    this.updateHUD();
    this.input.on('pointerdown', p => this.onDown(p));
    this.input.on('pointermove', p => this.onMove(p));
    this.input.on('pointerup',   p => this.onUp(p));
    this.scale.on('resize', () => {
      this.computeLayout();
      this._drawAllBg();
      this._repositionAllWeapons();
      this._repositionHUD();
      this.updateHUD();
    });
  }

  // ── Layout math ──────────────────────────────────────────
  computeLayout() {
    const W = this.scale.width, H = this.scale.height;
    
    // Always split vertically: Arena Top, Arsenal Bottom
    this.arenaW = W;
    this.arenaH = Math.floor(H * 0.45);
    this.gridLeft = 0;
    this.gridTop = this.arenaH;
    const panelW = W;
    const panelH = H - this.arenaH;
    
    const PAD = 10;
    const TOP_BAR = 44;
    const BOT_BAR = 52;
    const availW = panelW - PAD * 2;
    const availH = panelH - TOP_BAR - BOT_BAR;
    this.cellSize = Math.floor(Math.min(availW / GRID_COLS, availH / GRID_ROWS));
    const gridW = this.cellSize * GRID_COLS;
    const gridH = this.cellSize * GRID_ROWS;
    
    this.gridOffsetX = PAD + Math.floor((availW - gridW) / 2);
    this.gridOffsetY = this.gridTop + TOP_BAR + Math.floor((availH - gridH) / 2);
    this.heroX = Math.floor(this.arenaW * 0.17);
    this.heroY = Math.floor(this.arenaH * 0.52);
    this.groundY = Math.floor(this.arenaH * 0.80);
    this._panelCX = W / 2;
  }

  cellCenter(gx, gy) {
    return {
      x: this.gridOffsetX + gx * this.cellSize + Math.floor(this.cellSize / 2),
      y: this.gridOffsetY + gy * this.cellSize + Math.floor(this.cellSize / 2),
    };
  }

  // ── Background generation ─────────────────────────────────
  _buildBgStars() {
    this.bgStars = [];
    for (let i = 0; i < 150; i++) {
      this.bgStars.push({
        x: Math.random() * 4000,
        y: Math.random() * 2000,
        r: 0.3 + Math.random() * 1.8,
        baseAlpha: 0.08 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  _buildNebula() {
    this.nebulaClouds = [];
    for (let i = 0; i < 6; i++) {
      this.nebulaClouds.push({
        x: Math.random() * 3000,
        y: Math.random() * 1500,
        rx: 80 + Math.random() * 160,
        ry: 40 + Math.random() * 80,
        alpha: 0.015 + Math.random() * 0.025,
        hue: Math.random() > 0.5 ? 0x00e5ff : 0xff2952,
      });
    }
  }

  // ── Graphics layers ───────────────────────────────────────
  _createGraphicsLayers() {
    this.gBg       = this.add.graphics().setDepth(-10);  // deep bg gradient
    this.gNebula   = this.add.graphics().setDepth(-9);   // nebula clouds
    this.gStars    = this.add.graphics().setDepth(-8);   // star field
    this.gGround   = this.add.graphics().setDepth(-7);   // arena ground
    this.gPanel    = this.add.graphics().setDepth(-6);   // right panel bg
    this.gGrid     = this.add.graphics().setDepth(2);    // weapon grid
    this.gDivider  = this.add.graphics().setDepth(3);    // vertical divider
    this.gBlood    = this.add.graphics().setDepth(1);    // kill splats
    this.gShadow   = this.add.graphics().setDepth(4);    // hero/enemy shadows
    this.gHeroBody = this.add.graphics().setDepth(8);    // hero
    this.gHpBar    = this.add.graphics().setDepth(22);   // hp bar
    this.gBuyBtn   = this.add.graphics().setDepth(20);   // buy button
  }

  _drawAllBg() {
    this._drawDeepBg();
    this._drawNebula();
    this._drawGroundPlane();
    this._drawPanelBg();
    this._drawGrid();
    this._drawDivider();
  }

  _drawDeepBg() {
    const W = this.scale.width, H = this.scale.height;
    const g = this.gBg;
    g.clear();
    // Radial-style dark gradient via stacked rects
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(6  + t * 4);
      const gv = Math.round(8  + t * 6);
      const b  = Math.round(15 + t * 14);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
      g.fillRect(0, (this.arenaH / steps) * i, this.arenaW, Math.ceil(this.arenaH / steps) + 1);
    }
    // Subtle vignette corners
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, this.arenaW * 0.08, this.arenaH);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(this.arenaW * 0.92, 0, this.arenaW * 0.08, this.arenaH);
  }

  _drawNebula() {
    const g = this.gNebula;
    g.clear();
    for (const n of this.nebulaClouds) {
      const x = n.x % Math.max(1, this.arenaW);
      const y = n.y % Math.max(1, this.arenaH);
      if (x > this.arenaW) continue;
      g.fillStyle(n.hue, n.alpha);
      g.fillEllipse(x, y, n.rx, n.ry);
    }
  }

  _drawGroundPlane() {
    const g = this.gGround;
    g.clear();
    const W = this.arenaW, H = this.arenaH;
    const gy = this.groundY;
    const col = this.hexColor(this.palette.playerCore);

    // Scanlines in arena for CRT feel
    for (let y = 0; y < H; y += 5) {
      g.fillStyle(col, 0.010);
      g.fillRect(0, y, W, 1);
    }
    // Ground glow strip
    for (let i = 0; i < 5; i++) {
      g.fillStyle(col, 0.025 - i * 0.004);
      g.fillRect(0, gy - i, W, 2);
    }
    g.fillStyle(col, 0.04);
    g.fillRect(0, gy, W, H - gy);
    // Perspective grid lines on floor
    for (let xi = 0; xi <= 8; xi++) {
      const t = xi / 8;
      const topX = W * t;
      const botX = W * 0.5 + (topX - W * 0.5) * 3;
      g.lineStyle(1, col, 0.07);
      g.lineBetween(topX, gy, Phaser.Math.Clamp(botX, 0, W), H);
    }
    for (let row = 0; row < 4; row++) {
      const y2 = gy + (H - gy) * Math.pow((row + 1) / 4, 0.6);
      g.lineStyle(1, col, 0.06 - row * 0.01);
      g.lineBetween(0, y2, W, y2);
    }
  }

  _drawPanelBg() {
    const W = this.scale.width, H = this.scale.height;
    const g = this.gPanel;
    g.clear();
    const col = this.hexColor(this.palette.playerCore);
    
    const panelW = W - this.gridLeft;
    const panelH = H - this.gridTop;

    // Main dark panel
    g.fillStyle(0x07091a, 0.97);
    g.fillRect(this.gridLeft, this.gridTop, panelW, panelH);
    // Header band
    g.fillStyle(0x000000, 0.5);
    g.fillRect(this.gridLeft, this.gridTop, panelW, 38);
    g.lineStyle(1, col, 0.22);
    g.lineBetween(this.gridLeft, this.gridTop+38, W, this.gridTop+38);
    // Footer band (buy area)
    g.fillStyle(0x000000, 0.4);
    g.fillRect(this.gridLeft, H-52, panelW, 52);
    g.lineStyle(1, col, 0.18);
    g.lineBetween(this.gridLeft, H-52, W, H-52);
    // Panel outer glow border
    g.lineStyle(1, col, 0.25);
    g.strokeRect(this.gridLeft + 1, this.gridTop + 1, panelW - 2, panelH - 2);
    g.lineStyle(1, col, 0.07);
    g.strokeRect(this.gridLeft + 4, this.gridTop + 4, panelW - 8, panelH - 8);
  }

  _drawGrid() {
    const g = this.gGrid;
    g.clear();
    const col = this.hexColor(this.palette.playerCore);
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const {x, y} = this.cellCenter(gx, gy);
        const s = this.cellSize * 0.90;
        const r = 5;
        // Cell bg
        g.fillStyle(col, 0.028);
        g.fillRoundedRect(x-s/2, y-s/2, s, s, r);
        // Cell border
        g.lineStyle(1, col, 0.15);
        g.strokeRoundedRect(x-s/2, y-s/2, s, s, r);
        // Corner accents (luxury detail)
        const ca = s * 0.22;
        const ax = x - s/2, ay = y - s/2, bx2 = x + s/2, by2 = y + s/2;
        g.lineStyle(1.5, col, 0.4);
        [[ax,ay,ax+ca,ay],[ax,ay,ax,ay+ca],
         [bx2,ay,bx2-ca,ay],[bx2,ay,bx2,ay+ca],
         [ax,by2,ax+ca,by2],[ax,by2,ax,by2-ca],
         [bx2,by2,bx2-ca,by2],[bx2,by2,bx2,by2-ca]
        ].forEach(([x1,y1,x2,y2])=>g.lineBetween(x1,y1,x2,y2));
      }
    }
  }

  _drawDivider() {
    const H = this.scale.height;
    const W = this.scale.width;
    const g = this.gDivider;
    g.clear();
    const col = this.hexColor(this.palette.playerCore);
    [[16,0.02],[10,0.04],[4,0.12],[1.5,0.7]].forEach(([lw,a])=>{
      g.lineStyle(lw, col, a);
      g.lineBetween(0, this.arenaH, W, this.arenaH);
    });
  }

  // ── HUD ───────────────────────────────────────────────────
  _buildHUD() {
    const W = this.scale.width, H = this.scale.height;
    const mono = { fontFamily:'"Courier New",monospace', fontStyle:'bold' };
    const c  = this.palette.playerCore;
    const fa = this.palette.fxAccent;
    const cx = this._panelCX;

    // ── Arena top bar background ──────────────────────────
    this.gHudBar = this.add.graphics().setDepth(24);
    this.gHudBar.fillStyle(0x000000, 0.45);
    this.gHudBar.fillRect(0, 0, this.arenaW, 38);
    this.gHudBar.lineStyle(1, this.hexColor(c), 0.18);
    this.gHudBar.lineBetween(0, 38, this.arenaW, 38);

    // Wave badge (left)
    this.gWaveBadge = this.add.graphics().setDepth(24);
    this._drawWaveBadge();
    this.hudWave = this.add.text(52, 19, 'WAVE 1',
      {...mono, fontSize:'14px', color:c}).setOrigin(0,0.5).setDepth(25);

    // Kills (below wave)
    this.hudKills = this.add.text(10, 42, '● 0 KILLS',
      {...mono, fontSize:'10px', color:'#556688'}).setDepth(25);

    // DPS chip (centre arena)
    this.gDpsChip = this.add.graphics().setDepth(24);
    this._drawDpsChip(0);
    this.hudDPS = this.add.text(this.arenaW/2, 19, 'DPS 0',
      {...mono, fontSize:'12px', color:'#000'}).setOrigin(0.5).setDepth(25);

    // ── Panel top bar ─────────────────────────────────────
    // Gold chip (top right of panel)
    this.gGoldChip = this.add.graphics().setDepth(24);
    this._drawGoldChip();
    this.hudGold = this.add.text(W-12, this.gridTop + 19, '◈ 60',
      {...mono, fontSize:'13px', color:'#000'}).setOrigin(1,0.5).setDepth(25);

    // Arsenal label
    this.hudPanel = this.add.text(cx, this.gridTop + 19, 'A R S E N A L',
      {...mono, fontSize:'10px', color:c, alpha:0.55}).setOrigin(0.5).setDepth(25);

    // ── HP bar label ──────────────────────────────────────
    this.hudHPLabel = this.add.text(10, this.arenaH-10, 'HP',
      {...mono, fontSize:'9px', color:c, alpha:0.5}).setDepth(25);

    // ── Buy button ────────────────────────────────────────
    this._drawBuyBtn(false);
    const cost = this.getWeaponCost(0);
    this.hudBuyText = this.add.text(cx, H-28,
      `BUY SHARD  ◈${cost}`,
      {...mono, fontSize:'12px', color:'#000'}
    ).setOrigin(0.5).setDepth(22);

    const bw = W - this.gridLeft - 16;
    this.buyZone = this.add.zone(cx, H-26, bw, 36).setInteractive().setDepth(21);
    this.buyZone.on('pointerdown', ()=>{ ensureAudio(); this.buyWeapon(); });
    this.buyZone.on('pointerover', ()=>this._drawBuyBtn(true));
    this.buyZone.on('pointerout',  ()=>this._drawBuyBtn(false));
  }

  _drawWaveBadge() {
    const g = this.gWaveBadge; g.clear();
    const col = this.hexColor(this.palette.playerCore);
    g.fillStyle(col, 0.18); g.fillRoundedRect(6, 7, 40, 24, 4);
    g.lineStyle(1.5, col, 0.7); g.strokeRoundedRect(6, 7, 40, 24, 4);
    g.fillStyle(col, 0.08); g.fillRoundedRect(7, 8, 38, 10, 3);
  }

  _drawDpsChip(dps) {
    const g = this.gDpsChip; g.clear();
    const col = this.hexColor(this.palette.playerCore);
    const cw = 80, ch = 24, cx = this.arenaW/2 - cw/2, cy = 7;
    g.fillStyle(col, dps > 0 ? 0.9 : 0.3); g.fillRoundedRect(cx, cy, cw, ch, 4);
    g.lineStyle(1, col, 0.5); g.strokeRoundedRect(cx-1, cy-1, cw+2, ch+2, 5);
    if (dps > 0) { g.fillStyle(0xffffff, 0.12); g.fillRoundedRect(cx+2, cy+2, cw-4, ch*0.4, 2); }
  }

  _drawGoldChip() {
    const g = this.gGoldChip; g.clear();
    const W = this.scale.width;
    const col = this.hexColor(this.palette.fxAccent);
    const cw = 80, ch = 24, cx = W - cw - 8, cy = this.gridTop + 7;
    g.fillStyle(col, 0.9); g.fillRoundedRect(cx, cy, cw, ch, 4);
    g.lineStyle(1, col, 0.5); g.strokeRoundedRect(cx-1, cy-1, cw+2, ch+2, 5);
    g.fillStyle(0xffffff, 0.14); g.fillRoundedRect(cx+2, cy+2, cw-4, ch*0.4, 2);
  }

  _drawBuyBtn(hover) {
    const W = this.scale.width, H = this.scale.height;
    const bw = W - this.gridLeft - 16;
    const bh = 36;
    const bx = this.gridLeft + 8;
    const by = H - 44;
    const baseCol = this.hexColor(this.palette.playerCore);
    const col = hover ? 0xffffff : baseCol;
    this.gBuyBtn.clear();
    // Outer glow halo
    if (!hover) {
      this.gBuyBtn.fillStyle(baseCol, 0.12);
      this.gBuyBtn.fillRoundedRect(bx-4, by-4, bw+8, bh+8, 8);
    }
    // Button fill
    this.gBuyBtn.fillStyle(col, hover ? 1 : 0.95);
    this.gBuyBtn.fillRoundedRect(bx, by, bw, bh, 6);
    // Top sheen
    this.gBuyBtn.fillStyle(0xffffff, hover ? 0.18 : 0.14);
    this.gBuyBtn.fillRoundedRect(bx+2, by+2, bw-4, bh*0.42, 4);
    // Border
    this.gBuyBtn.lineStyle(1.5, col, hover ? 0.6 : 0.5);
    this.gBuyBtn.strokeRoundedRect(bx, by, bw, bh, 6);
  }

  _repositionHUD() {
    const W = this.scale.width, H = this.scale.height;
    const cx = this._panelCX;
    // Redraw arena top bar
    this.gHudBar.clear();
    this.gHudBar.fillStyle(0x000000, 0.45);
    this.gHudBar.fillRect(0, 0, this.arenaW, 38);
    this.gHudBar.lineStyle(1, this.hexColor(this.palette.playerCore), 0.18);
    this.gHudBar.lineBetween(0, 38, this.arenaW, 38);
    this._drawWaveBadge();
    this.hudWave.setPosition(52, 19);
    this.hudKills.setPosition(10, 42);
    this.hudDPS.setPosition(this.arenaW/2, 19);
    this.hudGold.setPosition(W-12, this.gridTop + 19);
    this.hudHPLabel.setPosition(10, this.arenaH-10);
    this.hudPanel.setPosition(cx, this.gridTop + 19);
    this._drawBuyBtn(false);
    this._drawDpsChip(this.totalDPS());
    this._drawGoldChip();
    if (this.hudBuyText) this.hudBuyText.setPosition(cx, H-26);
    if (this.buyZone) {
      this.buyZone.setPosition(cx, H-26);
      this.buyZone.setSize(W-this.gridLeft-16, 38);
    }
  }

  updateHUD() {
    const dps = this.totalDPS();
    this.hudWave.setText(`WAVE ${this.wave}`);
    this.hudKills.setText(`● ${this.totalKills} KILLS`);
    this.hudDPS.setText(`DPS ${dps}`);
    this.hudGold.setText(`◈ ${this.gold}`);
    const cost = this.getWeaponCost(0);
    if (this.hudBuyText) this.hudBuyText.setText(`BUY SHARD  ◈${cost}`);
    this._drawDpsChip(dps);
    this._drawGoldChip();
    this._drawHPBar();
  }

  _drawHPBar() {
    const H  = this.arenaH;
    const bw = this.arenaW * 0.44;
    const bh = 7;
    const bx = 36, by = H - 20;
    const pct = Phaser.Math.Clamp(this.heroHP / this.heroMaxHP, 0, 1);
    const col = this.hexColor(this.palette.playerCore);
    this.gHpBar.clear();
    // Track
    this.gHpBar.fillStyle(0x0d1020, 0.95);
    this.gHpBar.fillRoundedRect(bx, by, bw, bh, 3);
    // Fill gradient simulation (two rects)
    if (pct > 0) {
      this.gHpBar.fillStyle(col, 0.5);
      this.gHpBar.fillRoundedRect(bx, by, bw*pct, bh, 3);
      this.gHpBar.fillStyle(col, 0.9);
      this.gHpBar.fillRoundedRect(bx, by, bw*pct, bh*0.45, 2);
    }
    // Border
    this.gHpBar.lineStyle(1, col, 0.3);
    this.gHpBar.strokeRoundedRect(bx, by, bw, bh, 3);
  }

  // ── Hero ──────────────────────────────────────────────────
  _createHero() {
    // hero drawn into gHeroBody each frame
  }

  _drawHero(t) {
    const g  = this.gHeroBody;
    const sg = this.gShadow;
    g.clear(); sg.clear();

    const bob = Math.sin(t * 0.0022) * 2.8;
    const x   = this.heroX;
    const y   = this.heroY + bob;
    const atk = this.heroAttackFlash;
    const ls  = Math.sin(t * 0.006) * 5;   // leg swing
    const as  = Math.sin(t * 0.004) * 6;   // arm idle swing
    const visorCol = 0x00e5ff;
    const armExtend = atk > 0.3 ? 18 + atk * 14 : 14 + as;

    // ── Ground shadow ──────────────────────────────────────
    sg.fillStyle(0x000000, 0.22);
    sg.fillEllipse(x, this.groundY + 5, 44 + atk*10, 10);

    // ── Attack aura (behind everything) ───────────────────
    if (atk > 0.05) {
      g.fillStyle(visorCol, atk * 0.07);
      g.fillCircle(x, y, 50);
      g.fillStyle(visorCol, atk * 0.12);
      g.fillCircle(x, y, 28);
    }

    // ── Cape (behind body) ────────────────────────────────
    const capeSwing = Math.sin(t * 0.003) * 7;
    g.fillStyle(0x6a0f1a, 0.9);
    g.fillTriangle(x-7, y-10, x-7+capeSwing, y+30, x-20+capeSwing, y+24);
    g.lineStyle(1, 0x9b1a2a, 0.7);
    g.strokeTriangle(x-7, y-10, x-7+capeSwing, y+30, x-20+capeSwing, y+24);

    // ── Boots ─────────────────────────────────────────────
    g.fillStyle(0x3d2b1a, 1);   // dark leather
    g.fillRoundedRect(x-11+ls, y+22, 10, 12, 2);
    g.fillRoundedRect(x+1-ls,  y+22, 10, 12, 2);
    g.fillStyle(0x1a0e05, 1);   // sole
    g.fillRoundedRect(x-13+ls, y+31, 14, 4, 2);
    g.fillRoundedRect(x-1-ls,  y+31, 14, 4, 2);

    // ── Trousers ──────────────────────────────────────────
    g.fillStyle(0x1c1c2e, 1);   // dark navy
    g.fillRoundedRect(x-10+ls, y+12, 9, 12, 3);
    g.fillRoundedRect(x+1-ls,  y+12, 9, 12, 3);

    // ── Belt ──────────────────────────────────────────────
    g.fillStyle(0x8b5e3c, 1);   // leather
    g.fillRoundedRect(x-13, y+10, 26, 5, 2);
    g.fillStyle(0xd4a017, 1);   // gold buckle
    g.fillRect(x-3, y+11, 6, 3);

    // ── Chest armour plate ────────────────────────────────
    g.fillStyle(0x1a2a4a, 1);   // deep navy plate
    g.fillRoundedRect(x-13, y-14, 26, 26, 4);
    g.lineStyle(2, 0x2e4a7a, 0.9);   // armour edge
    g.strokeRoundedRect(x-13, y-14, 26, 26, 4);
    // Specular sheen on armour top-left
    g.fillStyle(0x4a7ab8, 0.22);
    g.fillRoundedRect(x-11, y-12, 9, 7, 3);
    // Chest detail stripes
    g.lineStyle(1, 0x2e4a7a, 0.55);
    g.lineBetween(x-8, y-3, x+8, y-3);
    g.lineBetween(x-8, y+4, x+8, y+4);
    // Energy core – glowing cyan
    g.fillStyle(visorCol, 0.75 + atk*0.25);
    g.fillCircle(x, y-1, 4);
    g.lineStyle(1.5, visorCol, 1);
    g.strokeCircle(x, y-1, 4);
    g.fillStyle(0xffffff, 0.45 + atk*0.45);
    g.fillCircle(x, y-1, 1.8);

    // ── Shoulder pauldrons ────────────────────────────────
    g.fillStyle(0x2e4a7a, 1);
    g.fillCircle(x+13, y-8, 5);
    g.fillCircle(x-13, y-8, 5);
    g.lineStyle(1, 0x4a7ab8, 0.55);
    g.strokeCircle(x+13, y-8, 5);
    g.strokeCircle(x-13, y-8, 5);

    // ── Left arm (off-hand) ───────────────────────────────
    g.lineStyle(4.5, 0x1a2a4a, 1);
    g.lineBetween(x-13, y-8, x-17 - as*0.4, y+6);
    g.lineStyle(2, 0x2e4a7a, 0.8);
    g.lineBetween(x-13, y-8, x-17 - as*0.4, y+6);

    // ── Right arm (sword arm) ─────────────────────────────
    g.lineStyle(4.5, 0x1a2a4a, 1);
    g.lineBetween(x+13, y-8, x+armExtend, y-4 - atk*8);
    g.lineStyle(2, 0x2e4a7a, 0.8);
    g.lineBetween(x+13, y-8, x+armExtend, y-4 - atk*8);
    // Gauntlet
    g.fillStyle(0x2e4a7a, 1);
    g.fillCircle(x+armExtend, y-4-atk*8, 4);
    g.lineStyle(1, 0x4a7ab8, 0.6);
    g.strokeCircle(x+armExtend, y-4-atk*8, 4);

    // ── Weapon in hand ────────────────────────────────────
    if (this.gridWeapons.length > 0) {
      const topTier = Math.max(...this.gridWeapons.map(w=>w.tier));
      const wCol = this.hexColor(WEAPON_TIERS[topTier].color);
      const wx = x+armExtend, wy = y-4-atk*8;
      g.fillStyle(wCol, 0.18); g.fillCircle(wx+10, wy-10, 11);
      g.lineStyle(3, wCol, 0.95); g.lineBetween(wx, wy, wx+24, wy-22);
      g.lineStyle(1, 0xffffff, 0.35); g.lineBetween(wx, wy, wx+24, wy-22);
      g.lineStyle(3, wCol, 0.85); g.lineBetween(wx-5, wy+5, wx+6, wy-6);
      g.lineStyle(3, 0x8b5e3c, 0.9); g.lineBetween(wx-9, wy+9, wx-1, wy+1);
    }

    // ── Neck ──────────────────────────────────────────────
    g.fillStyle(0xf4a86a, 1);   // skin
    g.fillRect(x-4, y-16, 8, 5);

    // ── Head – skin-coloured ──────────────────────────────
    g.fillStyle(0xf4a86a, 1);
    g.fillRoundedRect(x-10, y-36, 20, 20, 5);
    // Jaw shadow
    g.fillStyle(0xd4845a, 0.4);
    g.fillRoundedRect(x-8, y-22, 16, 8, 3);

    // ── Hair ──────────────────────────────────────────────
    g.fillStyle(0x2d1a0e, 1);   // dark brown
    g.fillRoundedRect(x-10, y-37, 20, 9, 4);
    g.fillRect(x-11, y-36, 3, 7);
    g.fillRect(x+8,  y-36, 3, 7);

    // ── Tactical visor band ───────────────────────────────
    g.fillStyle(0x1a2a4a, 0.92);
    g.fillRoundedRect(x-11, y-31, 22, 8, 3);
    g.lineStyle(1, 0x2e4a7a, 0.9);
    g.strokeRoundedRect(x-11, y-31, 22, 8, 3);
    // Glowing visor slit
    g.fillStyle(visorCol, 0.88 + atk*0.12);
    g.fillRoundedRect(x-9, y-30, 18, 5, 2);
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x-8, y-29, 16, 3, 1);
    g.fillStyle(visorCol, 0.35 + atk*0.55);
    g.fillRoundedRect(x-7, y-29, 14, 2, 1);

    // ── Ear comm pieces ───────────────────────────────────
    g.fillStyle(0x2e4a7a, 1);
    g.fillRect(x-13, y-30, 3, 6);
    g.fillRect(x+10,  y-30, 3, 6);
    g.lineStyle(1, visorCol, 0.7);
    g.lineBetween(x+11, y-30, x+13, y-35);

    this.heroAttackFlash = Math.max(0, this.heroAttackFlash - 0.05);
  }

  // ── Enemies ───────────────────────────────────────────────
  spawnEnemy(isBoss = false) {
    const W = this.scale.width, H = this.arenaH;
    const hp = isBoss ? this.enemyHP * 8 : this.enemyHP;
    const sz = isBoss ? Math.max(22, H*0.065) : Math.max(10, H*0.025 + Math.random()*H*0.012);
    const yRange = this.groundY - H*0.25;
    const ey = H*0.25 + Math.random() * yRange;
    const gfx  = this.add.graphics().setDepth(7);
    const hpBg = this.add.graphics().setDepth(9);
    const hpFg = this.add.graphics().setDepth(9);
    let nameTxt = null;
    if (isBoss) {
      nameTxt = this.add.text(0, 0, '✦ BOSS ✦', {
        fontFamily:'"Courier New",monospace', fontSize:'11px',
        color: this.palette.fxAccent, fontStyle:'bold',
      }).setOrigin(0.5).setDepth(10);
    }
    const obj = {
      x: W + 80, y: ey, hp, maxHp: hp,
      gfx, hpBg, hpFg, nameTxt,
      sz, isBoss,
      speed: isBoss ? 32 : 45 + Math.random()*25,
      animT: Math.random()*200,
      hitFlash: 0,
      done: false,
    };
    this.drawEnemy(obj);
    this.enemies.push(obj);
    if (isBoss) this.bossActive = true;
    return obj;
  }

  drawEnemy(e) {
    e.animT = (e.animT||0) + 1;
    const bob = Math.sin(e.animT * 0.05) * 2.2;
    const x = e.x, y = e.y + bob;
    const flash = e.hitFlash || 0;
    const hostileCol = this.hexColor(this.palette.hostile);
    const accentCol  = this.hexColor(this.palette.fxAccent);

    e.gfx.clear();

    if (e.isBoss) {
      // ── Boss: multi-layered demon ──────────────────────
      const sz = e.sz;
      const ra = e.animT * 0.025;
      const col = accentCol;

      // Outer pulsing aura
      e.gfx.fillStyle(col, 0.04 + Math.sin(e.animT*0.04)*0.02);
      e.gfx.fillCircle(x, y, sz*2.2);
      e.gfx.fillStyle(col, 0.07);
      e.gfx.fillCircle(x, y, sz*1.55);

      // Orbiting rune dots
      for (let i=0;i<12;i++) {
        const a = ra + (i/12)*Math.PI*2;
        const or = sz * (1.25 + Math.sin(e.animT*0.03+i)*0.1);
        e.gfx.fillStyle(col, 0.55 + Math.sin(e.animT*0.04+i)*0.35);
        e.gfx.fillCircle(x+Math.cos(a)*or, y+Math.sin(a)*or, sz*0.07);
      }
      // Inner ring
      e.gfx.lineStyle(2, col, 0.55);
      e.gfx.strokeCircle(x, y, sz*1.1);

      // Body
      e.gfx.fillStyle(col, 0.22 + flash*0.35);
      e.gfx.fillCircle(x, y, sz);
      e.gfx.lineStyle(3, col, 0.9);
      e.gfx.strokeCircle(x, y, sz);

      // Face
      e.gfx.fillStyle(0x000000, 0.85);
      e.gfx.fillCircle(x-sz*0.28, y-sz*0.1, sz*0.2);
      e.gfx.fillCircle(x+sz*0.28, y-sz*0.1, sz*0.2);
      e.gfx.fillStyle(col, 1);
      e.gfx.fillCircle(x-sz*0.28, y-sz*0.1, sz*0.11);
      e.gfx.fillCircle(x+sz*0.28, y-sz*0.1, sz*0.11);
      // Teeth
      e.gfx.lineStyle(2, col, 0.7);
      for (let t=0;t<5;t++) {
        const tx = x - sz*0.32 + t*sz*0.16;
        e.gfx.lineBetween(tx, y+sz*0.28, tx, y+sz*0.48);
      }
      // Horns
      e.gfx.lineStyle(3, col, 0.8);
      e.gfx.lineBetween(x-sz*0.3, y-sz*0.8, x-sz*0.55, y-sz*1.35);
      e.gfx.lineBetween(x+sz*0.3, y-sz*0.8, x+sz*0.55, y-sz*1.35);

      if (e.nameTxt) e.nameTxt.setPosition(x, y - sz - 18);
    } else {
      // ── Regular enemy: angular demon warrior ──────────
      const sz = e.sz;
      const col = hostileCol;
      const ra = e.animT * 0.05;

      // Shadow
      e.gfx.fillStyle(0x000000, 0.18);
      e.gfx.fillEllipse(x, this.groundY+4, sz*2.5, sz*0.65);

      // Body glow
      e.gfx.fillStyle(col, 0.06 + flash*0.14);
      e.gfx.fillCircle(x, y, sz*1.7);

      // Spinning spike ring
      for (let i=0;i<6;i++) {
        const a = ra + (i/6)*Math.PI*2;
        const r1 = sz*0.88, r2 = sz*1.4;
        e.gfx.lineStyle(1.5, col, 0.5);
        e.gfx.lineBetween(x+Math.cos(a)*r1, y+Math.sin(a)*r1, x+Math.cos(a)*r2, y+Math.sin(a)*r2);
      }

      // Body
      e.gfx.fillStyle(col, 0.20 + flash*0.3);
      e.gfx.fillCircle(x, y, sz);
      e.gfx.lineStyle(2, col, 0.9);
      e.gfx.strokeCircle(x, y, sz);

      // Inner gem
      e.gfx.fillStyle(col, 0.8);
      e.gfx.fillCircle(x, y, sz*0.38);
      e.gfx.lineStyle(1, col, 1);
      e.gfx.strokeCircle(x, y, sz*0.38);

      // Eyes
      e.gfx.fillStyle(0xffffff, 0.9);
      e.gfx.fillCircle(x-sz*0.28, y-sz*0.18, sz*0.16);
      e.gfx.fillCircle(x+sz*0.28, y-sz*0.18, sz*0.16);
      e.gfx.fillStyle(0x000000, 1);
      e.gfx.fillCircle(x-sz*0.28, y-sz*0.18, sz*0.09);
      e.gfx.fillCircle(x+sz*0.28, y-sz*0.18, sz*0.09);
    }

    // HP bar (shared)
    const bw = e.sz * (e.isBoss ? 3.8 : 2.8);
    const barY = e.y - e.sz - (e.isBoss ? 32 : 14);
    e.hpBg.clear();
    e.hpBg.fillStyle(0x0d1020, 0.9);
    e.hpBg.fillRoundedRect(e.x-bw/2, barY, bw, 5, 2);
    e.hpFg.clear();
    const pct = Math.max(0, e.hp/e.maxHp);
    const hc = e.isBoss ? accentCol : hostileCol;
    e.hpFg.fillStyle(hc, 0.9);
    e.hpFg.fillRoundedRect(e.x-bw/2, barY, bw*pct, 5, 2);
    // HP bar sheen
    e.hpFg.fillStyle(0xffffff, 0.15);
    e.hpFg.fillRoundedRect(e.x-bw/2, barY, bw*pct, 2, 1);

    e.hitFlash = Math.max(0, (e.hitFlash||0) - 0.1);
  }

  // ── Weapon buy / grid ────────────────────────────────────
  buyWeapon() {
    const cost = this.getWeaponCost(0);
    if (this.gold < cost) { this.floatText(this.arenaW*0.5, this.arenaH*0.7, 'Need ◈!','#ff4466'); return; }
    const slot = this.findFreeSlot();
    if (!slot) { this.floatText(this.arenaW*0.5, this.arenaH*0.7, 'GRID FULL','#ff4466'); return; }
    this.gold -= cost;
    this.spawnGridWeapon(0, slot.gx, slot.gy);
    this.updateHUD();
    playHit(440);
  }

  getWeaponCost(tier) { return Math.ceil(WEAPON_TIERS[tier].baseCost * this.costScale); }

  findFreeSlot() {
    for (let gy=GRID_ROWS-1; gy>=0; gy--)
      for (let gx=0; gx<GRID_COLS; gx++)
        if (!this.gridWeapons.find(w=>w.gx===gx&&w.gy===gy)) return {gx,gy};
    return null;
  }

  spawnGridWeapon(tier, gx, gy) {
    const {x,y} = this.cellCenter(gx, gy);
    const def = WEAPON_TIERS[tier];
    // cap sz so icon + label always fits inside the cell
    const sz  = Math.min(this.cellSize * 0.32, 30);
    const gfx = this.add.graphics().setDepth(10);
    const txt = this.add.text(x, y, def.glyph, {
      fontFamily:'"Courier New",monospace',
      fontSize:`${Math.max(8, sz*1.25)}px`,
      color: def.color, fontStyle:'bold',
    }).setOrigin(0.5).setDepth(11);
    const nmTxt = this.add.text(x, y+sz*1.0, def.name.toUpperCase(), {
      fontFamily:'"Courier New",monospace',
      fontSize:`${Math.max(5, sz*0.36)}px`,
      color: def.color, alpha: 0.72,
    }).setOrigin(0.5).setDepth(11);
    this._drawWeaponGfx(gfx, x, y, sz, def.color, tier);
    const obj = { tier, gx, gy, x, y, sz, gfx, txt, nmTxt, dragging:false, pulseT:Math.random()*100 };
    this.gridWeapons.push(obj);
    // Entrance animation
    [gfx, txt, nmTxt].forEach(o=>o.setAlpha(0).setScale(0.5));
    this.tweens.add({ targets:[gfx,txt,nmTxt], alpha:1, scaleX:1, scaleY:1, duration:220, ease:'Back.easeOut' });
    return obj;
  }

  _drawWeaponGfx(gfx, x, y, sz, colHex, tier) {
    const c = this.hexColor(colHex);
    gfx.clear();
    // Layered glow
    [[sz*2.1, 0.04+tier*0.007],[sz*1.4, 0.08+tier*0.01]].forEach(([r,a])=>{
      gfx.fillStyle(c, a);
      gfx.fillCircle(x, y, r);
    });
    // Ring
    gfx.lineStyle(1.5, c, 0.45+tier*0.05);
    gfx.strokeCircle(x, y, sz*1.08);
    // Body
    gfx.fillStyle(c, 0.13+tier*0.04);
    gfx.fillCircle(x, y, sz*0.9);
    // Tier dots
    if (tier > 0) {
      const dotCount = Math.min(tier, 7);
      for (let i=0; i<dotCount; i++) {
        const a = (i/dotCount)*Math.PI*2 - Math.PI/2;
        gfx.fillStyle(c, 0.9);
        gfx.fillCircle(x+Math.cos(a)*sz*1.28, y+Math.sin(a)*sz*1.28, 2);
      }
    }
  }

  _repositionWeapon(w) {
    const {x,y} = this.cellCenter(w.gx, w.gy);
    w.x=x; w.y=y;
    const sz = Math.min(this.cellSize*0.32, 30);
    w.sz=sz;
    const def = WEAPON_TIERS[w.tier];
    this._drawWeaponGfx(w.gfx, x, y, sz, def.color, w.tier);
    w.txt.setPosition(x,y).setFontSize(`${Math.max(8,sz*1.25)}px`);
    w.nmTxt.setPosition(x, y+sz*1.0).setFontSize(`${Math.max(5,sz*0.36)}px`);
  }

  _repositionAllWeapons() {
    for (const w of this.gridWeapons) this._repositionWeapon(w);
  }

  totalDPS() { return this.gridWeapons.reduce((s,w)=>s+WEAPON_TIERS[w.tier].dps, 0); }

  // ── Drag & Drop ───────────────────────────────────────────
  onDown(p) {
    if (p.x < this.gridLeft) return;
    let found=null, best=9999;
    for (const w of this.gridWeapons) {
      const d = Phaser.Math.Distance.Between(p.x,p.y,w.x,w.y);
      if (d < this.cellSize*0.55 && d < best) { best=d; found=w; }
    }
    if (!found) return;
    this.dragWeapon = found;
    this.dragOffX   = found.x - p.x;
    this.dragOffY   = found.y - p.y;
    this.dragOrigin = {gx:found.gx, gy:found.gy};
    found.dragging  = true;
    found.gfx.setDepth(30); found.txt.setDepth(31); found.nmTxt.setDepth(31);
  }

  onMove(p) {
    if (!this.dragWeapon) return;
    const w  = this.dragWeapon;
    const nx = p.x + this.dragOffX;
    const ny = p.y + this.dragOffY;
    const {gx,gy} = this.worldToGrid(nx,ny);
    const cg = this.clampGrid(gx,gy);
    const sn = this.cellCenter(cg.gx, cg.gy);
    const d  = Phaser.Math.Distance.Between(nx,ny, sn.x,sn.y);
    const snap = d < this.cellSize*0.42;
    const tx = snap ? Phaser.Math.Linear(nx, sn.x, 0.4) : nx;
    const ty = snap ? Phaser.Math.Linear(ny, sn.y, 0.4) : ny;
    const def = WEAPON_TIERS[w.tier];
    this._drawWeaponGfx(w.gfx, tx, ty, w.sz, def.color, w.tier);
    w.txt.setPosition(tx, ty);
    w.nmTxt.setPosition(tx, ty+w.sz*1.08);
    w.x=tx; w.y=ty;
  }

  onUp(p) {
    if (!this.dragWeapon) return;
    const w = this.dragWeapon;
    this.dragWeapon=null; w.dragging=false;
    w.gfx.setDepth(10); w.txt.setDepth(11); w.nmTxt.setDepth(11);
    const {gx,gy} = this.worldToGrid(w.x,w.y);
    const cg = this.clampGrid(gx,gy);
    const other = this.gridWeapons.find(o=>o!==w && o.gx===cg.gx && o.gy===cg.gy && o.tier===w.tier);
    if (other && w.tier < WEAPON_TIERS.length-1) {
      this.mergeWeapons(w, other, cg.gx, cg.gy);
    } else {
      const occupied = this.gridWeapons.find(o=>o!==w && o.gx===cg.gx && o.gy===cg.gy);
      w.gx = occupied ? this.dragOrigin.gx : cg.gx;
      w.gy = occupied ? this.dragOrigin.gy : cg.gy;
      this._snapWeapon(w);
    }
    this.updateHUD();
  }

  mergeWeapons(wa, wb, gx, gy) {
    playShing();
    this._spawnMergeParticles(wb.x, wb.y, WEAPON_TIERS[wb.tier].color);
    this.destroyWeapon(wa);
    this.destroyWeapon(wb);
    const newTier = Math.min(wa.tier+1, WEAPON_TIERS.length-1);
    const nw = this.spawnGridWeapon(newTier, gx, gy);
    this.cameras.main.shake(55, 0.005);
    this.floatText(nw.x, nw.y-26, `⬆ ${WEAPON_TIERS[newTier].name}!`, this.palette.fxAccent);
    this.updateHUD();
  }

  destroyWeapon(w) {
    w.gfx.destroy(); w.txt.destroy(); w.nmTxt.destroy();
    this.gridWeapons = this.gridWeapons.filter(o=>o!==w);
  }

  _snapWeapon(w) {
    const {x,y} = this.cellCenter(w.gx, w.gy);
    const def = WEAPON_TIERS[w.tier];
    const sx=w.x, sy=w.y;
    this.tweens.add({
      targets:{t:0}, t:1, duration:130, ease:'Quad.easeOut',
      onUpdate: tw => {
        const t = tw.progress;
        const cx = Phaser.Math.Linear(sx, x, t);
        const cy = Phaser.Math.Linear(sy, y, t);
        this._drawWeaponGfx(w.gfx, cx, cy, w.sz, def.color, w.tier);
        w.txt.setPosition(cx, cy);
        w.nmTxt.setPosition(cx, cy+w.sz*1.08);
        if (t>=1) { w.x=x; w.y=y; }
      }
    });
    w.x=x; w.y=y;
  }

  worldToGrid(wx,wy) {
    return {
      gx: Math.round((wx - this.gridOffsetX - this.cellSize/2) / this.cellSize),
      gy: Math.round((wy - this.gridOffsetY - this.cellSize/2) / this.cellSize),
    };
  }
  clampGrid(gx,gy) {
    return { gx:Phaser.Math.Clamp(gx,0,GRID_COLS-1), gy:Phaser.Math.Clamp(gy,0,GRID_ROWS-1) };
  }

  // ── Projectile throw animation ────────────────────────────
  fireProjectile(targetEnemy) {
    if (this.gridWeapons.length===0) return;
    const topW = this.gridWeapons.reduce((a,b)=>a.tier>b.tier?a:b);
    const col  = this.hexColor(WEAPON_TIERS[topW.tier].color);
    const gfx  = this.add.graphics().setDepth(15);
    this.projectiles.push({
      x: this.heroX+24, y: this.heroY-10,
      enemy: targetEnemy,
      col, gfx, trail:[],
      tier: topW.tier,
      speed: 430 + topW.tier*45,
      angle: 0, done:false,
    });
    playThrow();
  }

  _updateProjectiles(dt) {
    for (let i=this.projectiles.length-1; i>=0; i--) {
      const p = this.projectiles[i];
      if (p.done) { p.gfx.destroy(); this.projectiles.splice(i,1); continue; }
      const tx = p.enemy && !p.enemy.done ? p.enemy.x : p.tx||p.x-100;
      const ty = p.enemy && !p.enemy.done ? p.enemy.y : p.ty||p.y;
      const dx=tx-p.x, dy=ty-p.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (dist<14) { p.done=true; this._spawnHitExplosion(p.x,p.y,p.col); continue; }
      const spd = p.speed*dt/1000;
      p.x += (dx/dist)*spd;
      p.y += (dy/dist)*spd;
      p.angle += 0.38;
      p.trail.push({x:p.x, y:p.y, life:1});
      if (p.trail.length>12) p.trail.shift();
      p.gfx.clear();
      // Trail
      p.trail.forEach((tr,ti)=>{ tr.life-=0.07; if(tr.life>0){ p.gfx.fillStyle(p.col,tr.life*0.45); p.gfx.fillCircle(tr.x,tr.y,3*tr.life); } });
      const sz = 5+p.tier*0.9;
      // Body glow
      p.gfx.fillStyle(p.col, 0.25);
      p.gfx.fillCircle(p.x, p.y, sz*1.7);
      p.gfx.fillStyle(p.col, 1);
      p.gfx.fillCircle(p.x, p.y, sz);
      // Spinning blades
      for (let b=0;b<4;b++) {
        const a = p.angle + (b/4)*Math.PI*2;
        p.gfx.lineStyle(2, p.col, 0.85);
        p.gfx.lineBetween(p.x+Math.cos(a)*sz*0.5, p.y+Math.sin(a)*sz*0.5, p.x+Math.cos(a)*sz*1.6, p.y+Math.sin(a)*sz*1.6);
      }
    }
  }

  _spawnHitExplosion(x,y,col) {
    // Radial burst
    for (let i=0;i<16;i++) {
      const a=Math.random()*Math.PI*2, spd=60+Math.random()*110;
      this.particles.push({x,y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-25, life:1, col, sz:2+Math.random()*3.5, gfx:this.add.graphics().setDepth(16), gravity:true, isRing:false });
    }
    // Shockwave
    this.particles.push({x,y,vx:0,vy:0,life:1,col,sz:4,maxSz:32,gfx:this.add.graphics().setDepth(16),isRing:true,gravity:false});
    this.bloodSplats.push({x,y,col,life:1.2,r:10+Math.random()*8});
    this.cameras.main.shake(30,0.005);
  }

  // ── Kill effect ───────────────────────────────────────────
  _spawnKillEffect(x,y,isBoss) {
    const col = isBoss ? this.hexColor(this.palette.fxAccent) : this.hexColor(this.palette.hostile);
    const cnt = isBoss ? 45 : 20;
    for (let i=0;i<cnt;i++) {
      const a=Math.random()*Math.PI*2, spd=(isBoss?130:85)+Math.random()*110;
      this.particles.push({
        x,y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-55,
        life:1, col, sz:(isBoss?4:2)+Math.random()*5,
        gfx:this.add.graphics().setDepth(16), gravity:true, isRing:false,
      });
    }
    // Big shockwave
    this.particles.push({x,y,vx:0,vy:0,life:1,col,sz:8,maxSz:isBoss?90:50,gfx:this.add.graphics().setDepth(16),isRing:true,gravity:false});
    // Splats
    for (let s=0;s<(isBoss?7:3);s++) {
      this.bloodSplats.push({
        x: x+(Math.random()-0.5)*35,
        y: y+Math.random()*22,
        col, life: isBoss?2.8:1.6,
        r: (isBoss?16:8)+Math.random()*10,
      });
    }
  }

  // ── Merge particles ───────────────────────────────────────
  _spawnMergeParticles(x,y,colHex) {
    const col = this.hexColor(colHex);
    const fa  = this.hexColor(this.palette.fxAccent);
    for (let i=0;i<24;i++) {
      const a=(i/24)*Math.PI*2, spd=85+Math.random()*110;
      this.particles.push({
        x,y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
        life:1, col: Math.random()>0.4?fa:col,
        sz:2.5+Math.random()*4,
        gfx:this.add.graphics().setDepth(28), gravity:false, isRing:false,
      });
    }
    this.particles.push({x,y,vx:0,vy:0,life:1,col:fa,sz:5,maxSz:55,gfx:this.add.graphics().setDepth(28),isRing:true,gravity:false});
  }

  _updateParticles(dt) {
    const g = this.gBlood;
    g.clear();
    // Splats
    for (let i=this.bloodSplats.length-1; i>=0; i--) {
      const s=this.bloodSplats[i];
      s.life -= dt/2400;
      if (s.life<=0) { this.bloodSplats.splice(i,1); continue; }
      g.fillStyle(s.col, Math.min(0.6, s.life*0.6));
      // Irregular splat: a few overlapping circles
      g.fillCircle(s.x, s.y, s.r*Math.min(1,s.life));
      g.fillCircle(s.x+s.r*0.3, s.y+s.r*0.2, s.r*0.5*Math.min(1,s.life));
      g.fillCircle(s.x-s.r*0.4, s.y+s.r*0.3, s.r*0.4*Math.min(1,s.life));
    }
    // Particles
    for (let i=this.particles.length-1; i>=0; i--) {
      const p=this.particles[i];
      p.life -= dt/540;
      p.gfx.clear();
      if (p.life<=0) { p.gfx.destroy(); this.particles.splice(i,1); continue; }
      if (p.isRing) {
        const prog = 1-p.life;
        const r = p.sz+(p.maxSz-p.sz)*prog;
        p.gfx.lineStyle(2.5*p.life, p.col, p.life*0.85);
        p.gfx.strokeCircle(p.x, p.y, r);
      } else {
        if (p.gravity) p.vy += 170*dt/1000;
        p.x += p.vx*dt/1000; p.y += p.vy*dt/1000;
        p.vx *= 0.96;
        p.gfx.fillStyle(p.col, p.life*0.9);
        p.gfx.fillCircle(p.x, p.y, p.sz*Math.max(0.1,p.life));
      }
    }
  }

  // ── Stars ────────────────────────────────────────────────
  _updateStars(time) {
    this.gStars.clear();
    const col = this.hexColor(this.palette.playerCore);
    for (const s of this.bgStars) {
      const sx = s.x % this.arenaW;
      const sy = s.y % Math.max(1, this.arenaH);
      s.phase += 0.016;
      const a = s.baseAlpha * (0.55 + 0.45 * Math.sin(s.phase));
      this.gStars.fillStyle(col, a * 0.65);
      this.gStars.fillCircle(sx, sy, s.r);
    }
  }

  // ── Float text ────────────────────────────────────────────
  floatText(x,y,msg,color='#fff') {
    const t = this.add.text(x,y,msg,{
      fontFamily:'"Courier New",monospace', fontSize:'13px', color, fontStyle:'bold',
    }).setOrigin(0.5).setDepth(38).setAlpha(1);
    this.tweens.add({ targets:t, y:y-46, alpha:0, duration:1000, ease:'Quad.easeOut', onComplete:()=>t.destroy() });
  }

  // ── Main update ───────────────────────────────────────────
  update(time, delta) {
    const dt = Math.min(delta, 50);
    this.heroAnim += dt;

    this._updateStars(time);

    // Spawn enemies
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnRate && !this.bossActive) {
      this.spawnTimer = 0;
      this.enemyCount++;
      if (this.enemyCount % 10 === 0) {
        this.spawnEnemy(true);
        this.floatText(this.arenaW*0.5, this.arenaH*0.14, '⚠ BOSS INCOMING', this.palette.fxAccent);
      } else {
        this.spawnEnemy(false);
      }
    }

    // Combat
    this.attackTimer += dt;
    const dps = this.totalDPS();
    const atkInt = 550;

    for (let i=this.enemies.length-1; i>=0; i--) {
      const e = this.enemies[i];
      if (!e||e.done) continue;
      const dx   = this.heroX - e.x;
      const dist = Math.abs(dx);
      if (dist > 55) e.x += Math.sign(dx)*e.speed*dt/1000;

      // Hero attacks
      if (this.attackTimer >= atkInt && dps > 0) {
        e.hp -= (dps*atkInt)/1000;
        e.hitFlash = 1;
        if (i === this.enemies.length-1) {
          this.heroAttackFlash = 1;
          this.fireProjectile(e);
        }
      }
      // Enemy hits hero
      if (dist < 58) {
        this.heroHP -= e.speed*0.011*dt/1000*60;
        this.heroHP = Math.max(0, this.heroHP);
        if (this.heroHP<=0) this._heroDie();
      }

      this.drawEnemy(e);

      // Kill check
      if (e.hp<=0 || e.x < -90) {
        if (e.hp<=0) {
          this.totalKills++;
          const gain = e.isBoss ? 15 : 3;
          this.gold += gain;
          this.floatText(e.x, e.y-30, `+${gain}◈`, this.palette.fxAccent);
          this._spawnKillEffect(e.x, e.y, e.isBoss);
          if (e.isBoss) this._onBossKilled();
        }
        e.done=true;
        e.gfx.destroy(); e.hpBg.destroy(); e.hpFg.destroy();
        if (e.nameTxt) e.nameTxt.destroy();
        this.enemies.splice(i,1);
        if (e.isBoss) this.bossActive=false;
      }
    }

    if (this.attackTimer >= atkInt) this.attackTimer = 0;

    // Gold trickle
    this.goldTimer += dt;
    if (this.goldTimer >= 3000) {
      this.goldTimer=0;
      this.gold += 1 + Math.floor(this.wave/3);
    }

    // Pulse weapons
    for (const w of this.gridWeapons) {
      w.pulseT = (w.pulseT||0)+dt*0.001;
      const pa = 0.82 + Math.sin(w.pulseT*2.8)*0.18;
      w.gfx.setAlpha(pa);
    }

    this._updateProjectiles(dt);
    this._updateParticles(dt);
    this.updateHUD();
    this._drawHero(this.heroAnim);
  }

  _onBossKilled() {
    playLevelUp();
    this.wave++;
    this.enemyHP   = Math.ceil(this.enemyHP*1.35);
    this.costScale = Math.ceil(this.costScale*1.18*10)/10;
    this.spawnRate = Math.max(800, this.spawnRate-80);
    this.heroHP    = Math.min(this.heroHP+50, this.heroMaxHP);
    this.cameras.main.flash(400, 255, 220, 80, true);
    this.cameras.main.shake(200, 0.010);
    this.floatText(this.arenaW/2, this.arenaH*0.38, `✦ WAVE ${this.wave} ✦`, this.palette.playerCore);
    if (this.wave%5===0) {
      this.palette = window.FreshPlay.getCurrentPalette();
      this.cameras.main.setBackgroundColor(this.palette.background);
      this._drawAllBg();
    }
    window.FreshPlay.levelComplete(()=>{ this.gold+=25; });
  }

  _heroDie() {
    this.isArenaActive = false; // pause combat

    const cx = this.arenaW / 2, cy = this.arenaH / 2;
    const rBg = this.add.graphics().setDepth(200);
    rBg.fillStyle(0x000000, 0.85);
    rBg.fillRoundedRect(cx - 150, cy - 80, 300, 160, 12);
    rBg.lineStyle(2, this.hexColor(this.palette.playerCore), 1);
    rBg.strokeRoundedRect(cx - 150, cy - 80, 300, 160, 12);

    const rTxt = this.add.text(cx, cy - 40, 'HERO DEFEATED', {
      fontFamily: 'monospace', fontSize: '20px', color: this.palette.hostile
    }).setOrigin(0.5).setDepth(201);

    const btnRevive = this.add.text(cx - 70, cy + 30, 'WATCH AD\nTO REVIVE', {
      fontFamily: 'monospace', fontSize: '14px', color: '#000', align: 'center',
      backgroundColor: this.palette.playerCore, padding: {x: 10, y: 10}
    }).setOrigin(0.5).setDepth(201).setInteractive({useHandCursor: true});

    const btnSkip = this.add.text(cx + 70, cy + 30, 'SKIP', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff',
      backgroundColor: '#444444', padding: {x: 20, y: 16}
    }).setOrigin(0.5).setDepth(201).setInteractive({useHandCursor: true});

    const cleanUp = () => {
      rBg.destroy(); rTxt.destroy(); btnRevive.destroy(); btnSkip.destroy();
    };

    btnSkip.on('pointerdown', () => {
      cleanUp();
      this.heroHP = this.heroMaxHP;
      this.wave = 1; // reset wave penalty
      this.enemies.forEach(e => e.sprite.destroy());
      this.enemies = [];
      this.isArenaActive = true;
      this.floatText(this.arenaW/2, this.arenaH*0.48, 'WAVE RESET', this.palette.hostile);
    });

    btnRevive.on('pointerdown', () => {
      cleanUp();
      const doRevive = () => {
        this.heroHP = this.heroMaxHP;
        this.isArenaActive = true;
        this.cameras.main.flash(350,255,0,0,true);
        this.cameras.main.shake(250,0.014);
        this.floatText(this.arenaW/2, this.arenaH*0.48, '✦ HERO REVIVED', this.palette.fxAccent);
      };

      if (window.FreshPlay && typeof window.FreshPlay.showVideoAd === 'function') {
        window.FreshPlay.showVideoAd(doRevive);
      } else {
        doRevive();
      }
    });
  }

  hexColor(hex) { return parseInt((hex||'#ffffff').replace('#',''),16); }
}

// ─────────────────────────────────────────────────────────────
//  PHASER CONFIG
// ─────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#06080f',
  scene: [Boot, LandscapePrompt, MergeWeapons],
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game',
    width: '100%',
    height: '100%',
  },
  render: { antialias:true, roundPixels:false },
};

const game = new Phaser.Game(config);