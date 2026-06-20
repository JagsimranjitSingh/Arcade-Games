/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║             CLICKER MINER  ·  game.js  v2                ║
 * ║    Fixed: clicks, mobile input, panel hit-test,          ║
 * ║           pointer coords, responsive layout              ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * NO export / import — loaded as a plain <script> tag.
 * Requires Phaser 3.60+ loaded before this file.
 */

/* global Phaser */
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PALETTE = {
  background: '#0a0e1a',
  playerCore: '#00e5ff',
  fxAccent   : '#f97316',
  interface: '#1e293b',
};

const BOT_TIERS = [
  { id:'nano',    name:'Nano Bot',    baseCost:    10, baseIncome:  0.1, color:'#00ffcc', r:3.5, orbit:0.18,  speed:6e-4   },
  { id:'micro',   name:'Micro Bot',   baseCost:    80, baseIncome:  0.5, color:'#00aaff', r:4.5, orbit:0.225, speed:5e-4   },
  { id:'macro',   name:'Macro Bot',   baseCost:   600, baseIncome:  3.0, color:'#aa44ff', r:5.5, orbit:0.27,  speed:4e-4   },
  { id:'mega',    name:'Mega Bot',    baseCost:  4000, baseIncome: 15.0, color:'#ff6b35', r:6.5, orbit:0.32,  speed:3e-4   },
  { id:'ultra',   name:'Ultra Bot',   baseCost: 28000, baseIncome: 80.0, color:'#ff0066', r:7.5, orbit:0.375, speed:2.5e-4 },
  { id:'quantum', name:'Quantum Bot', baseCost:220000, baseIncome:500.0, color:'#ffdd00', r:9,   orbit:0.43,  speed:2e-4   },
];

const MILESTONES = [
  { id:'overclock',   name:'Overclock',   cost:    500, tapMult:2, desc:'2× tap power' },
  { id:'hyperdrive',  name:'Hyperdrive',  cost:   5000, tapMult:2, desc:'2× tap power' },
  { id:'singularity', name:'Singularity', cost:  50000, tapMult:3, desc:'3× tap power' },
  { id:'godmode',     name:'God Mode',    cost:500000,  tapMult:5, desc:'5× tap power' },
];

const UNLOCK_THRESHOLD = 5;

// ─────────────────────────────────────────────────────────────────────────────
//  BOOT SCENE
// ─────────────────────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create()       { this.scene.start('Game'); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GAME SCENE
// ─────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  // ── init ───────────────────────────────────────────────────────────────────
  init() {
    this.currency      = 0;
    this.totalEarned   = 0;
    this.tapValue      = 1;
    this.tapMultiplier = 1;
    this.passiveIncome = 0;
    this.level         = 1;
    this.levelProgress = 0;
    this.levelTarget   = 1000;
    this.panelOpen     = false;
    this.panelTab      = 'bots';
    this.saveTick      = 0;

    this.botCounts = {};
    this.botAngle  = {};
    this.botGfx    = {};
    BOT_TIERS.forEach(t => {
      this.botCounts[t.id] = 0;
      this.botAngle[t.id]  = 0;
      this.botGfx[t.id]    = [];
    });

    this.milestones = {};
    MILESTONES.forEach(m => { this.milestones[m.id] = false; });

    this.audioCtx   = null;
    this.audioReady = false;
  }

  // ── create ─────────────────────────────────────────────────────────────────
  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;

    this.palette = this.fetchPalette();

    this.buildBackground();
    this.buildCore();
    this.buildUI();
    this.buildPanel();

    // Passive income tick every 100 ms
    this.time.addEvent({ delay:100, loop:true, callback:this.onPassiveTick, callbackScope:this });
    // Ambient pulse ring every 2 s
    this.time.addEvent({ delay:2000, loop:true, callback:this.emitPulseRing, callbackScope:this });

    this.scale.on('resize', this.onResize, this);

    // iOS audio: init on first touch
    this.input.once('pointerdown', this.initAudio, this);

    // ── Depth ordering ────────────────────────────────────────────────────
    this.bgRect        .setDepth(0);
    this.gridGfx       .setDepth(1);
    this.orbitGfx      .setDepth(2);
    this.botContainer  .setDepth(3);
    this.coreContainer .setDepth(4);
    this.pulseRingCont .setDepth(5);
    this.fxLayer       .setDepth(10);
    this.floatLayer    .setDepth(11);
    this.topBar        .setDepth(20);
    this.topBarEdge    .setDepth(20);
    this.currencyTxt   .setDepth(21);
    this.incomeTxt     .setDepth(21);
    this.levelTxt      .setDepth(21);
    this.tapHint       .setDepth(21);
    this.pgBg          .setDepth(20);
    this.pgFill        .setDepth(20);
    this.pgLabel       .setDepth(20);
    this.toggleBg      .setDepth(22);
    this.toggleTxt     .setDepth(22);
    this.panel         .setDepth(30);

    // ── Core click overlay ─────────────────────────────────────────────────
    // Transparent rectangle; actual circle check happens inside onTap().
    // This avoids the Phaser.Geom.Circle coordinate-system bug on mobile.
    this.coreClickRect = this.add
      .rectangle(this.CX, this.CY, this.CR * 2.6, this.CR * 2.6, 0x000000, 0)
      .setDepth(8)
      .setInteractive({ useHandCursor: true });
    this.coreClickRect.on('pointerdown', this.onTap, this);

    this.loadGame();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  fetchPalette() {
    try {
      const p = window.FreshPlay?.getCurrentPalette?.();
      if (p && p.background) return p;
    } catch (_) {}
    return { ...DEFAULT_PALETTE };
  }

  hex(h) { if (typeof h === 'number') return h; return parseInt((h || '#000000').replace('#', ''), 16); }

  fs() {
    const d = Math.min(this.W, this.H);
    return {
      topH : Math.max(52, d * 0.12),
      cur  : Math.max(14, d * 0.042),
      sub  : Math.max(9,  d * 0.026),
      btn  : Math.max(10, d * 0.029),
      sm   : Math.max(8,  d * 0.022),
    };
  }

  get CR()       { return Math.min(this.W, this.H) * 0.13; }
  get CX()       { return this.W / 2; }
  get CY()       { return this.H / 2; }
  get tapPower() { return Math.max(1, Math.round(this.tapValue * this.tapMultiplier)); }

  botCost(tier)   { return Math.floor(tier.baseCost * Math.pow(1.15, this.botCounts[tier.id])); }
  tierLocked(tier){ const i = BOT_TIERS.indexOf(tier); return i > 0 && this.botCounts[BOT_TIERS[i-1].id] < UNLOCK_THRESHOLD; }

  fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e15) return (n/1e15).toFixed(2)+'Qa';
    if (n >= 1e12) return (n/1e12).toFixed(2)+'T';
    if (n >= 1e9)  return (n/1e9) .toFixed(2)+'B';
    if (n >= 1e6)  return (n/1e6) .toFixed(2)+'M';
    if (n >= 1e3)  return (n/1e3) .toFixed(1)+'K';
    return Math.floor(n).toString();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BACKGROUND
  // ─────────────────────────────────────────────────────────────────────────

  buildBackground() {
    this.bgRect  = this.add.rectangle(0, 0, this.W, this.H, this.hex(this.palette.background)).setOrigin(0,0);
    this.gridGfx = this.add.graphics();
    this.redrawGrid();
  }

  redrawGrid() {
    const g  = this.gridGfx;
    g.clear();
    // Luxury dark ambient vignette
    g.fillGradientStyle(0x000000,0x000000,0x000000,0x000000, 0.5,0.5,0,0);
    g.fillRect(0,0,this.W,this.H*0.2);
    
    g.fillGradientStyle(0x000000,0x000000,0x000000,0x000000, 0,0,0.5,0.5);
    g.fillRect(0,this.H*0.8,this.W,this.H*0.2);
    
    g.fillGradientStyle(0x000000,0x000000,0x000000,0x000000, 0.5,0,0.5,0);
    g.fillRect(0,0,this.W*0.2,this.H);
    
    g.fillGradientStyle(0x000000,0x000000,0x000000,0x000000, 0,0.5,0,0.5);
    g.fillRect(this.W*0.8,0,this.W*0.2,this.H);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CORE
  // ─────────────────────────────────────────────────────────────────────────

  buildCore() {
    this.orbitGfx     = this.add.graphics();
    this.botContainer = this.add.container(0, 0);

    this.coreContainer = this.add.container(this.CX, this.CY);
    this.glowGfx  = this.add.graphics();
    this.coreGfx  = this.add.graphics();
    this.spineGfx = this.add.graphics();
    this.coreContainer.add([this.glowGfx, this.coreGfx, this.spineGfx]);
    this.redrawCore();

    this.pulseRingCont = this.add.container(this.CX, this.CY);
    this.pulseGfx      = this.add.graphics();
    this.pulseRingCont.add(this.pulseGfx);

    this.fxLayer    = this.add.container(0, 0);
    this.floatLayer = this.add.container(0, 0);
  }

  redrawCore() {
    const r   = this.CR;
    const col = this.hex(this.palette.playerCore);

    const gw = this.glowGfx;
    gw.clear();
    for (let i = 7; i > 0; i--) { gw.fillStyle(col, 0.022*i); gw.fillCircle(0, 0, r + i*r*0.19); }

    const cb = this.coreGfx;
    cb.clear();
    [[1.00,0.07],[0.75,0.11],[0.52,0.17],[0.32,0.26],[0.15,0.50],[0.06,0.85]]
      .forEach(([sc,al]) => { cb.fillStyle(col,al); cb.fillCircle(0,0,r*sc); });
    cb.lineStyle(1.5, col, 0.75); cb.strokeCircle(0, 0, r);
    cb.lineStyle(1,   col, 0.30); cb.strokeCircle(0, 0, r*0.68);

    const sp = this.spineGfx;
    sp.clear();
    sp.lineStyle(1, col, 0.20);
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2;
      sp.moveTo(0,0); sp.lineTo(Math.cos(a)*r*0.88, Math.sin(a)*r*0.88);
    }
    const hr = r * 0.52;
    for (let i = 0; i < 6; i++) {
      const a0=(i/6)*Math.PI*2, a1=((i+1)/6)*Math.PI*2;
      sp.moveTo(Math.cos(a0)*hr, Math.sin(a0)*hr);
      sp.lineTo(Math.cos(a1)*hr, Math.sin(a1)*hr);
    }
    sp.strokePath();
  }

  emitPulseRing() {
    const col = this.hex(this.palette.playerCore);
    this.pulseGfx.clear();
    this.pulseGfx.lineStyle(2, col, 0.6);
    this.pulseGfx.strokeCircle(0, 0, this.CR);
    this.pulseRingCont.setScale(1).setAlpha(0.7);
    this.tweens.add({
      targets:this.pulseRingCont, scaleX:2.6, scaleY:2.6, alpha:0, duration:1800, ease:'Power2',
      onComplete:() => { this.pulseGfx.clear(); this.pulseRingCont.setScale(1).setAlpha(1); },
    });
  }

  redrawOrbitRings() {
    const g = this.orbitGfx;
    g.clear();
    BOT_TIERS.forEach(tier => {
      if (this.botCounts[tier.id] < 1) return;
      g.lineStyle(1, this.hex(this.palette.fxAccent), 0.12);
      g.strokeCircle(this.CX, this.CY, Math.min(this.W,this.H)*tier.orbit);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HUD / UI
  // ─────────────────────────────────────────────────────────────────────────

  buildUI() {
    const f = this.fs();

    this.topBar     = this.add.rectangle(0,0,this.W,f.topH, 0x000000, 0.78).setOrigin(0,0);
    this.topBarEdge = this.add.rectangle(0,f.topH-1,this.W,1, this.hex(this.palette.playerCore), 0.22).setOrigin(0,0);

    this.currencyTxt = this.add.text(this.W/2, f.topH*0.30, '0 Credits', {
      fontFamily:'monospace', fontSize:`${f.cur}px`, color:this.palette.playerCore, align:'center',
    }).setOrigin(0.5, 0.5);

    this.incomeTxt = this.add.text(this.W/2, f.topH*0.72, '+0.0 / sec', {
      fontFamily:'monospace', fontSize:`${f.sub}px`, color:'#94a3b8', align:'center',
    }).setOrigin(0.5, 0.5);

    this.levelTxt = this.add.text(this.W-12, f.topH*0.5, `LVL ${this.level}`, {
      fontFamily:'monospace', fontSize:`${f.sub}px`, color:'#94a3b8',
    }).setOrigin(1, 0.5);

    this.tapHint = this.add.text(this.CX, this.CY+this.CR*1.7, `TAP  +${this.tapPower}`, {
      fontFamily:'monospace', fontSize:`${f.sm}px`, color:'#94a3b8',
    }).setOrigin(0.5, 0.5);

    this.buildToggleBtn(f);
    this.buildProgressBar(f);
  }

  buildToggleBtn(f) {
    const bw = Math.min(152, this.W*0.38);
    const bh = Math.max(36, f.topH*0.54);
    const bx = this.W - bw/2 - 14;
    const by = this.H - bh/2 - 14;

    this.toggleBg = this.add.rectangle(bx, by, bw, bh, 0x0c1220)
      .setStrokeStyle(1, this.hex(this.palette.fxAccent), 0.75)
      .setInteractive({ useHandCursor:true });
    this.toggleTxt = this.add.text(bx, by, '⚙  UPGRADES', {
      fontFamily:'monospace', fontSize:`${f.btn}px`, color:this.palette.fxAccent,
    }).setOrigin(0.5, 0.5);

    this.toggleBg
      .on('pointerdown', () => this.togglePanel())
      .on('pointerover',  () => this.toggleBg.setFillStyle(0x1e293b))
      .on('pointerout',   () => this.toggleBg.setFillStyle(0x0c1220));
  }

  buildProgressBar(f) {
    const bw=this.W*0.46, bx=this.W*0.27, by=this.H-10;
    this.pgBg    = this.add.rectangle(bx+bw/2, by, bw, 3, 0x334155).setOrigin(0.5, 0.5);
    this.pgFill  = this.add.rectangle(bx, by, 2, 3, this.hex(this.palette.playerCore)).setOrigin(0, 0.5);
    this.pgLabel = this.add.text(bx+bw/2, by-10, 'LEVEL PROGRESS', {
      fontFamily:'monospace', fontSize:`${f.sm}px`, color:'#94a3b8',
    }).setOrigin(0.5, 1);
  }

  refreshHUD() {
    this.currencyTxt.setText(`${this.fmt(Math.floor(this.currency))} Credits`);
    this.incomeTxt.setText(`+${this.fmt(this.passiveIncome)} / sec`);
    const pct = Math.min(1, this.levelProgress / this.levelTarget);
    this.pgFill.width = Math.max(2, this.W*0.46*pct);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  UPGRADE PANEL
  // ─────────────────────────────────────────────────────────────────────────

  buildPanel() {
    this.calcPanelGeometry();
    this.panel = this.add.container(this.closedX, this.closedY);

    this.panelBg = this.add.rectangle(0, 0, this.panelW, this.panelH, 0x000000, 0.78)
      .setStrokeStyle(1, this.hex(this.palette.playerCore), 0.28);
    this.panel.add(this.panelBg);

    const hH = this.panelHeaderH();
    this.panelHdrBg  = this.add.rectangle(0, -this.panelH/2+hH/2, this.panelW, hH, 0x1e293b, 1);
    this.panelHdrTxt = this.add.text(0, -this.panelH/2+hH/2, 'MINING UPGRADES', {
      fontFamily:'monospace', fontSize:`${Math.max(11,this.fs().btn)}px`, color:this.palette.playerCore,
    }).setOrigin(0.5, 0.5);
    this.panelCloseBtn = this.add.text(this.panelW/2-18, -this.panelH/2+hH/2, '✕', {
      fontFamily:'monospace', fontSize:`${Math.max(13,this.fs().btn)}px`, color:'#ff3355',
    }).setOrigin(0.5, 0.5).setInteractive({useHandCursor:true});
    this.panelCloseBtn.on('pointerdown', () => this.togglePanel());
    this.panel.add([this.panelHdrBg, this.panelHdrTxt, this.panelCloseBtn]);

    this.buildPanelTabs();

    this.panelItemsCont = this.add.container(0, 0);
    this.panel.add(this.panelItemsCont);
    this.rebuildPanelItems();
  }

  buildPanelTabs() {
    const hH   = this.panelHeaderH();
    const tabY = -this.panelH/2 + hH + 20;
    const half = (this.panelW-16)/2;
    const fSz  = `${Math.max(9,this.fs().sm)}px`;
    const aBot = this.panelTab === 'bots';

    this.tabBotBg = this.add.rectangle(-half/2-2, tabY, half, 26,
      aBot ? 0x0d2640 : 0x0c1220)
      .setStrokeStyle(1, this.hex(this.palette.playerCore), aBot ? 0.55 : 0.20)
      .setInteractive({useHandCursor:true});
    this.tabBotTxt = this.add.text(-half/2-2, tabY, '⬡  BOTS', {
      fontFamily:'monospace', fontSize:fSz, color: aBot ? this.palette.playerCore : '#94a3b8',
    }).setOrigin(0.5, 0.5);

    this.tabMsBg = this.add.rectangle(half/2+2, tabY, half, 26,
      !aBot ? 0x1a0d14 : 0x0c1220)
      .setStrokeStyle(1, this.hex(this.palette.fxAccent), !aBot ? 0.55 : 0.20)
      .setInteractive({useHandCursor:true});
    this.tabMsTxt = this.add.text(half/2+2, tabY, '★  UPGRADES', {
      fontFamily:'monospace', fontSize:fSz, color: !aBot ? this.palette.fxAccent : '#94a3b8',
    }).setOrigin(0.5, 0.5);

    this.tabBotBg
      .on('pointerdown', () => { this.panelTab='bots';       this.refreshPanelTabs(); this.rebuildPanelItems(); })
      .on('pointerover',  () => { if(this.panelTab!=='bots')       this.tabBotBg.setFillStyle(0x0d1e30); })
      .on('pointerout',   () => { if(this.panelTab!=='bots')       this.tabBotBg.setFillStyle(0xf1f5f9); });
    this.tabMsBg
      .on('pointerdown', () => { this.panelTab='milestones'; this.refreshPanelTabs(); this.rebuildPanelItems(); })
      .on('pointerover',  () => { if(this.panelTab!=='milestones') this.tabMsBg.setFillStyle(0x1e0d18); })
      .on('pointerout',   () => { if(this.panelTab!=='milestones') this.tabMsBg.setFillStyle(0xf1f5f9); });

    this.panel.add([this.tabBotBg, this.tabBotTxt, this.tabMsBg, this.tabMsTxt]);
  }

  refreshPanelTabs() {
    const fSz  = `${Math.max(9,this.fs().sm)}px`;
    const aBot = this.panelTab === 'bots';
    this.tabBotBg.setFillStyle(aBot ? 0x0d2640 : 0x0c1220)
                 .setStrokeStyle(1, this.hex(this.palette.playerCore), aBot ? 0.55 : 0.20);
    this.tabBotTxt.setColor(aBot ? this.palette.playerCore : '#2a3860').setFontSize(fSz);
    this.tabMsBg.setFillStyle(!aBot ? 0x1a0d14 : 0x0c1220)
                .setStrokeStyle(1, this.hex(this.palette.fxAccent), !aBot ? 0.55 : 0.20);
    this.tabMsTxt.setColor(!aBot ? this.palette.fxAccent : '#2a3860').setFontSize(fSz);
  }

  repositionPanelTabs() {
    const hH   = this.panelHeaderH();
    const tabY = -this.panelH/2 + hH + 20;
    const half = (this.panelW-16)/2;
    const fSz  = `${Math.max(9,this.fs().sm)}px`;
    this.tabBotBg.setPosition(-half/2-2, tabY).setSize(half, 26);
    this.tabBotTxt.setPosition(-half/2-2, tabY).setFontSize(fSz);
    this.tabMsBg.setPosition(half/2+2, tabY).setSize(half, 26);
    this.tabMsTxt.setPosition(half/2+2, tabY).setFontSize(fSz);
  }

  calcPanelGeometry() {
    const landscape = this.W > this.H;
    this.panelW  = landscape ? Math.min(296, this.W*0.4) : this.W;
    this.panelH  = landscape ? this.H : Math.min(this.H*0.58, 440);
    this.openX   = landscape ? this.W - this.panelW/2 : this.W/2;
    this.openY   = landscape ? this.H/2               : this.H - this.panelH/2;
    this.closedX = landscape ? this.W + this.panelW/2 : this.W/2;
    this.closedY = landscape ? this.H/2               : this.H + this.panelH/2;
  }

  panelHeaderH() { return Math.max(42, this.panelH*0.095); }

  rebuildPanelItems() {
    this.panelItemsCont.removeAll(true);
    const f      = this.fs();
    const hH     = this.panelHeaderH();
    const pw     = this.panelW - 14;
    const topY   = -this.panelH/2 + hH + 26 + 8;
    const avail  = (this.panelH/2 - 6) - topY;

    if (this.panelTab === 'bots') {
      const iH = Phaser.Math.Clamp((avail - 4*(BOT_TIERS.length-1)) / BOT_TIERS.length, 36, 66);
      let y = topY + iH/2;
      BOT_TIERS.forEach(tier => { this.addBotItem(tier, y, pw, iH, f); y += iH+4; });
    } else {
      const iH = Phaser.Math.Clamp((avail - 4*(MILESTONES.length-1)) / MILESTONES.length, 36, 72);
      let y = topY + iH/2;
      MILESTONES.forEach(ms => { this.addMilestoneItem(ms, y, pw, iH, f); y += iH+4; });
    }
  }

  addBotItem(tier, y, pw, iH, f) {
    const locked = this.tierLocked(tier);
    const count  = this.botCounts[tier.id];
    const cost   = this.botCost(tier);
    const canBuy = !locked && this.currency >= cost;
    const accent = this.hex(tier.color);
    const bgFill = locked ? 0x070810 : 0x0c1220;

    const bg = this.add.rectangle(0, y, pw, iH, bgFill, 0.95)
      .setStrokeStyle(1, locked ? 0x1e293b : accent, locked ? 0.12 : 0.45);
    this.panelItemsCont.add(bg);

    const fSz   = Math.max(9, f.sm);
    const leftX = -pw/2 + (count > 0 ? iH*0.7+6 : 8);

    if (count > 0) {
      const badge = this.add.circle(-pw/2+iH*0.34, y, iH*0.27, accent, 0.9);
      const bTxt  = this.add.text(-pw/2+iH*0.34, y, `${count}`, {
        fontFamily:'monospace', fontSize:`${Math.max(8,fSz-1)}px`, color:'#94a3b8',
      }).setOrigin(0.5, 0.5);
      this.panelItemsCont.add([badge, bTxt]);
    }

    const nameTxt = this.add.text(leftX, y-iH*0.2, tier.name, {
      fontFamily:'monospace', fontSize:`${fSz}px`, color: locked ? '#334155' : '#e2e8f0',
    }).setOrigin(0, 0.5);
    const sub = locked
      ? `Req: ${UNLOCK_THRESHOLD}× ${BOT_TIERS[BOT_TIERS.indexOf(tier)-1]?.name??'previous'}`
      : `+${tier.baseIncome}/s each`;
    const subTxt = this.add.text(leftX, y+iH*0.22, sub, {
      fontFamily:'monospace', fontSize:`${Math.max(8,fSz-1)}px`, color: locked ? '#1e293b' : '#94a3b8',
    }).setOrigin(0, 0.5);
    this.panelItemsCont.add([nameTxt, subTxt]);

    if (!locked) {
      const cTxt  = this.add.text(pw/2-8, y-iH*0.2, `${this.fmt(cost)}c`, {
        fontFamily:'monospace', fontSize:`${fSz}px`, color: canBuy ? '#00ffaa' : '#883322',
      }).setOrigin(1, 0.5);
      const bTxt2 = this.add.text(pw/2-8, y+iH*0.22, 'BUY', {
        fontFamily:'monospace', fontSize:`${Math.max(8,fSz-2)}px`, color:'#94a3b8',
      }).setOrigin(1, 0.5);
      this.panelItemsCont.add([cTxt, bTxt2]);
      bg.setInteractive({useHandCursor:true})
        .on('pointerdown', () => this.purchaseBot(tier))
        .on('pointerover',  () => bg.setFillStyle(0x162840, 0.98))
        .on('pointerout',   () => bg.setFillStyle(bgFill, 0.95));
    }
  }

  addMilestoneItem(ms, y, pw, iH, f) {
    const done   = this.milestones[ms.id];
    const canBuy = !done && this.currency >= ms.cost;
    const bgFill = done ? 0x071407 : 0x0c1220;
    const accent = this.hex(this.palette.fxAccent);

    const bg = this.add.rectangle(0, y, pw, iH, bgFill, 0.95)
      .setStrokeStyle(1, done ? 0x1a441a : accent, done ? 0.3 : 0.45);
    this.panelItemsCont.add(bg);

    const fSz     = Math.max(9, f.sm);
    const nameTxt = this.add.text(-pw/2+8, y-iH*0.2, ms.name, {
      fontFamily:'monospace', fontSize:`${fSz}px`, color: done ? '#44aa44' : '#e2e8f0',
    }).setOrigin(0, 0.5);
    const subTxt  = this.add.text(-pw/2+8, y+iH*0.22, done ? '✓ PURCHASED' : ms.desc, {
      fontFamily:'monospace', fontSize:`${Math.max(8,fSz-1)}px`, color: done ? '#22c55e' : '#94a3b8',
    }).setOrigin(0, 0.5);
    this.panelItemsCont.add([nameTxt, subTxt]);

    if (!done) {
      const cTxt = this.add.text(pw/2-8, y-iH*0.2, `${this.fmt(ms.cost)}c`, {
        fontFamily:'monospace', fontSize:`${fSz}px`, color: canBuy ? '#00ffaa' : '#883322',
      }).setOrigin(1, 0.5);
      const bTxt = this.add.text(pw/2-8, y+iH*0.22, 'BUY', {
        fontFamily:'monospace', fontSize:`${Math.max(8,fSz-2)}px`, color:'#94a3b8',
      }).setOrigin(1, 0.5);
      this.panelItemsCont.add([cTxt, bTxt]);
      bg.setInteractive({useHandCursor:true})
        .on('pointerdown', () => this.purchaseMilestone(ms))
        .on('pointerover',  () => bg.setFillStyle(0x162840, 0.98))
        .on('pointerout',   () => bg.setFillStyle(bgFill, 0.95));
    }
  }

  togglePanel() {
    this.panelOpen = !this.panelOpen;
    this.tweens.add({
      targets : this.panel,
      x       : this.panelOpen ? this.openX  : this.closedX,
      y       : this.panelOpen ? this.openY  : this.closedY,
      duration: 320,
      ease    : 'Power3.Out',
    });
    this.toggleTxt.setText(this.panelOpen ? '✕  CLOSE' : '⚙  UPGRADES');
    // Disable core tap rect while panel is open — prevents depth-conflict mis-taps
    this.coreClickRect.setActive(!this.panelOpen).setVisible(!this.panelOpen);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CORE TAP
  // ─────────────────────────────────────────────────────────────────────────

  onTap(ptr) {
    if (this.panelOpen) return;
    // Confirm tap lands inside the visual core circle
    const dx = ptr.x - this.CX;
    const dy = ptr.y - this.CY;
    if (Math.sqrt(dx*dx + dy*dy) > this.CR * 1.25) return;

    const power = this.tapPower;
    this.currency      += power;
    this.totalEarned   += power;
    this.levelProgress += power;

    this.checkLevelUp();
    this.refreshHUD();
    this.pulseCore();
    this.spawnParticles(ptr.x, ptr.y);
    this.spawnFloat(ptr.x, ptr.y, power);
    this.playTick();
  }

  pulseCore() {
    this.tweens.killTweensOf(this.coreContainer);
    this.tweens.add({
      targets:this.coreContainer, scaleX:0.88, scaleY:0.88,
      duration:55, yoyo:true, ease:'Power2',
    });
  }

  spawnParticles(px, py) {
    const col  = this.hex(this.palette.fxAccent);
    const col2 = this.hex(this.palette.playerCore);
    for (let i = 0; i < 10; i++) {
      const a  = (i/10)*Math.PI*2 + Phaser.Math.FloatBetween(-0.45, 0.45);
      const d  = Phaser.Math.FloatBetween(45, 135);
      const sz = Phaser.Math.FloatBetween(1.8, 5);
      const c  = i%3===0 ? col2 : col;
      const dot = this.add.circle(px, py, sz, c, 0.9);
      this.fxLayer.add(dot);
      this.tweens.add({
        targets:dot,
        x: px+Math.cos(a)*d, y: py+Math.sin(a)*d,
        alpha:0, scaleX:0.1, scaleY:0.1,
        duration: Phaser.Math.Between(360, 680), ease:'Power2',
        onComplete:() => dot.destroy(),
      });
    }
  }

  spawnFloat(px, py, val) {
    const f   = this.fs();
    const txt = this.add.text(
      px + Phaser.Math.FloatBetween(-16, 16), py - 10,
      `+${this.fmt(val)}`,
      { fontFamily:'monospace', fontSize:`${Math.max(11,f.cur*0.56)}px`,
        color:this.palette.playerCore, stroke:'#000000', strokeThickness:2 }
    ).setOrigin(0.5, 1).setDepth(12);
    this.floatLayer.add(txt);
    this.tweens.add({
      targets:txt, y: txt.y - Phaser.Math.Clamp(this.H*0.1,50,80),
      alpha:0, duration:900, ease:'Power2',
      onComplete:() => txt.destroy(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PURCHASING
  // ─────────────────────────────────────────────────────────────────────────

  purchaseBot(tier) {
    const cost = this.botCost(tier);
    if (this.currency < cost || this.tierLocked(tier)) return;
    this.currency -= cost;
    this.botCounts[tier.id]++;
    this.recalcIncome();
    this.spawnBotGraphic(tier);
    this.redrawOrbitRings();
    this.rebuildPanelItems();
    this.refreshHUD();
    this.flashBuy();
    this.saveGame();
  }

  purchaseMilestone(ms) {
    if (this.currency < ms.cost || this.milestones[ms.id]) return;
    this.currency -= ms.cost;
    this.milestones[ms.id] = true;
    this.tapMultiplier    *= ms.tapMult;
    this.tapHint.setText(`TAP  +${this.tapPower}`);
    this.rebuildPanelItems();
    this.refreshHUD();
    this.flashBuy();
    this.triggerLevelComplete(`🎯 ${ms.name.toUpperCase()} UNLOCKED`);
    this.saveGame();
  }

  recalcIncome() {
    this.passiveIncome = BOT_TIERS.reduce((s,t) => s + t.baseIncome * this.botCounts[t.id], 0);
    this.incomeTxt.setText(`+${this.fmt(this.passiveIncome)} / sec`);
  }

  flashBuy() {
    const f = this.add.rectangle(this.W/2, this.H/2, this.W, this.H, 0x00e5ff, 0.08).setDepth(50);
    this.tweens.add({ targets:f, alpha:0, duration:380, onComplete:() => f.destroy() });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BOTS
  // ─────────────────────────────────────────────────────────────────────────

  spawnBotGraphic(tier) {
    const g   = this.add.graphics();
    const col = this.hex(tier.color);
    g.fillStyle(col, 0.18); g.fillCircle(0, 0, tier.r*2.4);
    g.fillStyle(col, 0.92); g.fillCircle(0, 0, tier.r);
    g.fillStyle(0xffffff, 0.30); g.fillCircle(-tier.r*0.28, -tier.r*0.28, tier.r*0.38);
    g.lineStyle(0.8, 0x1e293b, 0.2); g.strokeCircle(0, 0, tier.r);
    g.setDepth(3);
    this.botContainer.add(g);
    this.botGfx[tier.id].push(g);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PASSIVE TICK
  // ─────────────────────────────────────────────────────────────────────────

  onPassiveTick() {
    const earn = this.passiveIncome / 10;
    if (earn > 0) {
      this.currency      += earn;
      this.totalEarned   += earn;
      this.levelProgress += earn;
      this.checkLevelUp();
      this.refreshHUD();
    }
    if (++this.saveTick >= 50) { this.saveTick = 0; this.saveGame(); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  LEVEL SYSTEM
  // ─────────────────────────────────────────────────────────────────────────

  checkLevelUp() {
    if (this.levelProgress < this.levelTarget) return;
    this.levelProgress -= this.levelTarget;
    this.levelTarget   *= 2.8;
    this.level++;
    this.tapValue += 0.5;
    this.levelTxt.setText(`LVL ${this.level}`);
    this.tapHint .setText(`TAP  +${this.tapPower}`);
    if (this.level % 5 === 0) { this.palette = this.fetchPalette(); this.applyPaletteRefresh(); }
    this.showBanner(`⬆ LEVEL ${this.level}`);
  }

  triggerLevelComplete(msg = '🎉 MILESTONE!') {
    try {
      if (window.FreshPlay?.levelComplete) {
        window.FreshPlay.levelComplete(() => { this.palette = this.fetchPalette(); this.applyPaletteRefresh(); this.showBanner(msg); });
        return;
      }
    } catch(_) {}
    this.showBanner(msg);
  }

  applyPaletteRefresh() {
    this.bgRect.setFillStyle(this.hex(this.palette.background));
    this.redrawCore(); this.redrawGrid(); this.redrawOrbitRings(); this.rebuildPanelItems();
    const corCol = this.hex(this.palette.playerCore);
    const accCol = this.hex(this.palette.fxAccent);
    this.currencyTxt.setColor(this.palette.playerCore);
    this.topBarEdge.setFillStyle(corCol, 0.22);
    this.pgFill.setFillStyle(corCol);
    this.panelBg.setStrokeStyle(1, corCol, 0.28);
    this.panelHdrTxt.setColor(this.palette.playerCore);
    this.toggleBg.setStrokeStyle(1, accCol, 0.75);
    this.toggleTxt.setColor(this.palette.fxAccent);
    this.refreshPanelTabs();
  }

  showBanner(msg) {
    const f = this.fs();
    const b = this.add.text(this.W/2, this.H/2, msg, {
      fontFamily:'monospace', fontSize:`${Math.max(18,f.cur*1.05)}px`,
      color:this.palette.fxAccent, stroke:'#000000', strokeThickness:3,
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(200);
    this.tweens.add({
      targets:b, alpha:1, scaleX:1.2, scaleY:1.2, duration:260,
      onComplete:() => this.tweens.add({
        targets:b, alpha:0, y:b.y-60, duration:1100, delay:650,
        onComplete:() => b.destroy(),
      }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SAVE / LOAD
  // ─────────────────────────────────────────────────────────────────────────

  saveGame() {
    try {
      localStorage.setItem('clickerMiner_save', JSON.stringify({
        v:1, currency:this.currency, totalEarned:this.totalEarned,
        tapValue:this.tapValue, tapMultiplier:this.tapMultiplier,
        level:this.level, levelProgress:this.levelProgress, levelTarget:this.levelTarget,
        botCounts:{...this.botCounts}, milestones:{...this.milestones}, savedAt:Date.now(),
      }));
    } catch(_) {}
  }

  loadGame() {
    try {
      const raw = localStorage.getItem('clickerMiner_save');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1) return;

      this.currency      = d.currency      ?? 0;
      this.totalEarned   = d.totalEarned   ?? 0;
      this.tapValue      = d.tapValue      ?? 1;
      this.tapMultiplier = d.tapMultiplier ?? 1;
      this.level         = d.level         ?? 1;
      this.levelProgress = d.levelProgress ?? 0;
      this.levelTarget   = d.levelTarget   ?? 1000;

      if (d.milestones)
        Object.keys(d.milestones).forEach(id => { if (id in this.milestones) this.milestones[id] = d.milestones[id]; });
      if (d.botCounts)
        Object.keys(d.botCounts).forEach(id => {
          const n    = d.botCounts[id] || 0;
          const tier = BOT_TIERS.find(t => t.id === id);
          if (!tier || n === 0) return;
          this.botCounts[id] = n;
          for (let i = 0; i < n; i++) this.spawnBotGraphic(tier);
        });

      this.recalcIncome();
      this.redrawOrbitRings();

      const offlineSec = Math.min((Date.now() - (d.savedAt ?? Date.now())) / 1000, 4*3600);
      if (offlineSec > 10 && this.passiveIncome > 0) {
        const earned = this.passiveIncome * offlineSec;
        this.currency += earned; this.totalEarned += earned; this.levelProgress += earned;
        this.checkLevelUp();
        this.time.delayedCall(800, () => {
          const mins = Math.round(offlineSec/60);
          this.showBanner(`💤 +${this.fmt(earned)} away (${mins >= 60 ? (mins/60).toFixed(1)+'h' : mins+'m'})`);
        });
      }

      this.levelTxt.setText(`LVL ${this.level}`);
      this.tapHint .setText(`TAP  +${this.tapPower}`);
      this.rebuildPanelItems();
      this.refreshHUD();
    } catch(_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  AUDIO
  // ─────────────────────────────────────────────────────────────────────────

  initAudio() {
    if (this.audioReady) return;
    try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); this.audioReady = true; } catch(_) {}
  }

  playTick() {
    if (!this.audioReady || !this.audioCtx) return;
    try {
      const ctx  = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const t    = ctx.currentTime;
      const base = 340 + Math.min(this.tapMultiplier*55, 280);
      const osc  = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base*2.1, t+0.08);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t+0.14);
      osc.start(t); osc.stop(t+0.15);
      const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(90, t);
      gain2.gain.setValueAtTime(0.035, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t+0.04);
      osc2.start(t); osc2.stop(t+0.05);
    } catch(_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  RESIZE
  // ─────────────────────────────────────────────────────────────────────────

  onResize(gameSize) {
    this.W = gameSize.width;
    this.H = gameSize.height;
    this.repositionAll();
  }

  repositionAll() {
    const f  = this.fs();
    const cx = this.CX, cy = this.CY, cr = this.CR;

    this.bgRect.setSize(this.W, this.H);
    this.redrawGrid();
    this.coreContainer.setPosition(cx, cy);
    this.pulseRingCont.setPosition(cx, cy);
    this.redrawCore();
    this.redrawOrbitRings();

    this.coreClickRect.setPosition(cx, cy).setSize(cr*2.6, cr*2.6);

    this.topBar.setSize(this.W, f.topH);
    this.topBarEdge.setPosition(0, f.topH-1).setSize(this.W, 1);
    this.currencyTxt.setPosition(this.W/2, f.topH*0.30).setFontSize(`${f.cur}px`);
    this.incomeTxt  .setPosition(this.W/2, f.topH*0.72).setFontSize(`${f.sub}px`);
    this.levelTxt   .setPosition(this.W-12, f.topH*0.5).setFontSize(`${f.sub}px`);
    this.tapHint    .setPosition(cx, cy+cr*1.7).setFontSize(`${f.sm}px`);

    const bw=Math.min(152,this.W*0.38), bh=Math.max(36,f.topH*0.54);
    const bx=this.W-bw/2-14, by=this.H-bh/2-14;
    this.toggleBg .setPosition(bx,by).setSize(bw,bh);
    this.toggleTxt.setPosition(bx,by).setFontSize(`${f.btn}px`);

    const barW=this.W*0.46, barX=this.W*0.27, barY=this.H-10;
    this.pgBg   .setPosition(barX+barW/2, barY).setSize(barW,3);
    this.pgFill .setPosition(barX, barY);
    this.pgLabel.setPosition(barX+barW/2, barY-10).setFontSize(`${f.sm}px`);

    this.calcPanelGeometry();
    this.panel.setPosition(this.panelOpen ? this.openX : this.closedX, this.panelOpen ? this.openY : this.closedY);
    this.panelBg.setSize(this.panelW, this.panelH);
    const hH = this.panelHeaderH();
    this.panelHdrBg  .setPosition(0,-this.panelH/2+hH/2).setSize(this.panelW,hH);
    this.panelHdrTxt .setPosition(0,-this.panelH/2+hH/2).setFontSize(`${Math.max(11,f.btn)}px`);
    this.panelCloseBtn.setPosition(this.panelW/2-18,-this.panelH/2+hH/2).setFontSize(`${Math.max(13,f.btn)}px`);
    this.repositionPanelTabs();
    this.rebuildPanelItems();
    this.refreshHUD();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  UPDATE LOOP
  // ─────────────────────────────────────────────────────────────────────────

  update(_, delta) {
		delta = Math.min(delta || 16.6, 33.3);
    this.spineGfx.angle += delta * 0.012;

    BOT_TIERS.forEach(tier => {
      const bots = this.botGfx[tier.id];
      if (!bots.length) return;
      this.botAngle[tier.id] += tier.speed * delta;
      const shared = this.botAngle[tier.id];
      const or     = Math.min(this.W, this.H) * tier.orbit;
      const spread = (Math.PI*2) / bots.length;
      bots.forEach((g, i) => {
        const a = shared + i*spread;
        g.x = this.CX + Math.cos(a) * or;
        g.y = this.CY + Math.sin(a) * or;
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASER CONFIG
//  CRITICAL: parent must point to the div; do NOT force canvas CSS dimensions.
//  RESIZE mode sets canvas pixel size = container size automatically.
// ─────────────────────────────────────────────────────────────────────────────

const _phaserConfig = {
  type           : Phaser.AUTO,
  backgroundColor: '#0a0e1a',
  parent         : 'game-container',
  scale          : {
    mode      : Phaser.Scale.RESIZE,
    width     : window.innerWidth,
    height    : window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 4,   // multi-touch
  },
  scene: [BootScene, GameScene],
	fps: { target: 60, forceSetTimeOut: true, smoothStep: true },
};

window._clickerMinerGame = new Phaser.Game(_phaserConfig);
