/* FreshPlay SDK Shim */
(function () {
	let _lvl = 1;
	window.FreshPlay = {
		levelComplete(cb) {
			console.log(`[FreshPlay] Level complete — advancing to next level`);
			if (typeof cb === 'function') cb();
		},
		gameOver(score) {
			console.log(`[FreshPlay] Game over. Final score: ${score}`);
			// Show a restart banner after 2s
			setTimeout(() => {
				const banner = document.createElement('div');
				banner.style.cssText = `
          position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
          background:rgba(0,0,0,.85);border:1px solid #00e5ff;
          padding:24px 36px;text-align:center;color:#fff;
          font-family:'Orbitron',monospace;z-index:9999;border-radius:8px;
        `;
				banner.innerHTML = `
          <div style="color:#ff1744;font-size:22px;letter-spacing:4px;margin-bottom:8px">GAME OVER</div>
          <div style="font-size:14px;color:#aaa;margin-bottom:20px">SCORE &nbsp;<span style="color:#fff">${score.toLocaleString()}</span></div>
          <button onclick="location.reload()" style="
            background:#00e5ff;color:#000;border:none;padding:10px 28px;
            font-family:inherit;font-size:13px;letter-spacing:3px;cursor:pointer;
            border-radius:4px;font-weight:bold;
          ">RESTART</button>
        `;
				document.body.appendChild(banner);
			}, 1200);
		},
		getCurrentPalette() {
			const themes = [
				// Dark neon blue (levels 1-4)
				{ background: "#03050f", interface: "#e0f7ff", playerCore: "#00e5ff", fxAccent: "#7c4dff", hostile: "#ff1744" },
				// Emerald & gold (levels 5-9)
				{ background: "#020e08", interface: "#f0fff4", playerCore: "#00e676", fxAccent: "#ffd600", hostile: "#ff6d00" },
				// Crimson void (levels 10-14)
				{ background: "#0f0208", interface: "#fff0f3", playerCore: "#ff1744", fxAccent: "#e040fb", hostile: "#ff6d00" },
				// Solar (levels 15-19)
				{ background: "#100800", interface: "#fffde7", playerCore: "#ff9100", fxAccent: "#ffea00", hostile: "#e040fb" },
				// Arctic (levels 20+)
				{ background: "#00080f", interface: "#f0fbff", playerCore: "#40c4ff", fxAccent: "#b3e5fc", hostile: "#ff4081" },
			];
			const idx = Math.floor((_lvl - 1) / 5) % themes.length;
			return themes[idx];
		},
	};
	// expose level bump for testing
	window._bumpLevel = () => _lvl++;
})();

/* ============================================================
	 STACK BUILDER — Complete Phaser 3 Game
	 Production-ready | Luxury Modern UI | FreshPlay Integration
	 ============================================================ */

(function () {
	"use strict";

	const W = 520, H = 720;
	const BLOCK_HEIGHT = 28;
	const INITIAL_BLOCK_W = 240;
	const BLOCKS_PER_LEVEL = 10;
	const CAMERA_EASE = 0.07;
	const INITIAL_SWING_SPEED = 1.4;
	const SWING_SPEED_INCREMENT = 0.18;
	const SWING_AMPLITUDE = 180;
	const SLICE_TOLERANCE = 8;

	let palette = window.FreshPlay.getCurrentPalette();

	/* Audio */
	let _audioCtx = null;
	function getACtx() {
		if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		if (_audioCtx.state === 'suspended') _audioCtx.resume();
		return _audioCtx;
	}

	function playThud(pitch = 1) {
		try {
			const ctx = getACtx(), t = ctx.currentTime;
			const o1 = ctx.createOscillator(), g1 = ctx.createGain();
			o1.type = 'sine';
			o1.frequency.setValueAtTime(80 * pitch, t);
			o1.frequency.exponentialRampToValueAtTime(28 * pitch, t + 0.2);
			g1.gain.setValueAtTime(1, t);
			g1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
			o1.connect(g1); g1.connect(ctx.destination);
			o1.start(t); o1.stop(t + 0.22);

			const o2 = ctx.createOscillator(), g2 = ctx.createGain();
			o2.type = 'square';
			o2.frequency.setValueAtTime(280 * pitch, t);
			o2.frequency.exponentialRampToValueAtTime(55 * pitch, t + 0.06);
			g2.gain.setValueAtTime(0.35, t);
			g2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
			o2.connect(g2); g2.connect(ctx.destination);
			o2.start(t); o2.stop(t + 0.07);
		} catch (e) { }
	}

	function playSlice() {
		try {
			const ctx = getACtx(), t = ctx.currentTime;
			const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
			const d = buf.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
			const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
			flt.type = 'bandpass'; flt.frequency.value = 3800; flt.Q.value = 0.7;
			g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
			src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(ctx.destination);
			src.start(t);
		} catch (e) { }
	}

	function playMiss() {
		try {
			const ctx = getACtx(), t = ctx.currentTime;
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.type = 'sawtooth';
			o.frequency.setValueAtTime(220, t);
			o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
			g.gain.setValueAtTime(0.4, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
			o.connect(g); g.connect(ctx.destination);
			o.start(t); o.stop(t + 0.35);
		} catch (e) { }
	}

	/* Colour helpers */
	function hexToPhaser(hex) {
		return Phaser.Display.Color.HexStringToColor(hex).color;
	}
	function hexToRgba(hex, a = 1) {
		const c = Phaser.Display.Color.HexStringToColor(hex);
		return `rgba(${c.red},${c.green},${c.blue},${a})`;
	}

	/* ══════════════════════════════════════════════
		 BOOT SCENE
	══════════════════════════════════════════════ */
	class BootScene extends Phaser.Scene {
		constructor() { super({ key: 'BootScene' }); }
		preload() {
			if (!document.querySelector('link[href*="Orbitron"]')) {
				const l = document.createElement('link');
				l.rel = 'stylesheet';
				l.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;700&display=swap';
				document.head.appendChild(l);
			}
		}
		create() { this.time.delayedCall(250, () => this.scene.start('GameScene')); }
	}

	/* ══════════════════════════════════════════════
		 GAME SCENE
	══════════════════════════════════════════════ */
	class GameScene extends Phaser.Scene {
		constructor() { super({ key: 'GameScene' }); }

		init() {
			this.score = 0; this.level = 1;
			this.blockCount = 0; this.totalBlocks = 0;
			this.swingSpeed = INITIAL_SWING_SPEED;
			this.swingAngle = 0; this.swingDir = 1;
			this.pendingDrop = false; this.gameActive = false;
			this.isTransitioning = false;
			this.camTargetY = 0;
			this.stack = [];
			this.currentBlockW = INITIAL_BLOCK_W;
			this.pitchMult = 1;
			this._swingX = W / 2; this._swingY = 80;
		}

		preload() {
			const c = document.createElement('canvas');
			c.width = W; c.height = H * 8;
			const g = c.getContext('2d');
			const gr = g.createLinearGradient(0, 0, 0, H * 8);
			gr.addColorStop(0, '#00051a');
			gr.addColorStop(0.4, '#040010');
			gr.addColorStop(1, '#080003');
			g.fillStyle = gr; g.fillRect(0, 0, W, H * 8);
			this.textures.addCanvas('sb_bg', c);
		}

		create() {
			palette = window.FreshPlay.getCurrentPalette();
			this._buildScene();
			this.gameActive = true;
			this.input.on('pointerdown', () => this._onTap());
			if (this.input.keyboard)
				this.input.keyboard.on('keydown-SPACE', () => this._onTap());
		}

		/* Scene construction */
		_buildScene() {
			// Background
			this.bg = this.add.image(W / 2, H / 2, 'sb_bg')
				.setDisplaySize(W, H * 8).setDepth(0);

			// Scanlines
			const sl = this.add.graphics().setDepth(9).setAlpha(0.035);
			for (let y = 0; y < H * 8; y += 4) {
				sl.fillStyle(0xffffff); sl.fillRect(0, y - H * 3, W, 1);
			}

			// Grid
			const gd = this.add.graphics().setDepth(1).setAlpha(0.055);
			gd.lineStyle(1, hexToPhaser(palette.playerCore));
			for (let i = 0; i <= 6; i++) {
				const x = i * (W / 6);
				gd.beginPath(); gd.moveTo(x, -H * 6); gd.lineTo(x, H * 2); gd.strokePath();
			}
			for (let y = -H * 6; y <= H * 2; y += 80) {
				gd.beginPath(); gd.moveTo(0, y); gd.lineTo(W, y); gd.strokePath();
			}

			// Vignette overlay
			const vig = this.add.graphics().setDepth(8).setScrollFactor(0);
			const vigGrad = this.add.graphics().setDepth(8).setScrollFactor(0);
			vig.fillStyle(0x000000, 0);
			// draw vignette via canvas texture
			const vc = document.createElement('canvas');
			vc.width = W; vc.height = H;
			const vg = vc.getContext('2d');
			const vgr = vg.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
			vgr.addColorStop(0, 'rgba(0,0,0,0)');
			vgr.addColorStop(1, 'rgba(0,0,0,0.55)');
			vg.fillStyle = vgr; vg.fillRect(0, 0, W, H);
			this.textures.addCanvas('vignette', vc);
			this.add.image(W / 2, H / 2, 'vignette').setDepth(8).setScrollFactor(0);

			// Base
			const baseY = H - 60;
			this._drawStackedBlock(W / 2, baseY, INITIAL_BLOCK_W + 80, true, 0);
			this.stack.push({ x: W / 2, y: baseY, w: INITIAL_BLOCK_W + 80 });

			// Swing block
			this._swingY = this._getSwingY();
			this.swingBlock = this._makeSwingBlock();

			// HUD
			this._buildHUD();

			// Camera
			this.cameras.main.setBounds(0, -H * 6, W, H * 8);
		}

		_drawStackedBlock(x, y, w, isBase, colorIdx) {
			const col = isBase
				? hexToPhaser(palette.playerCore)
				: (colorIdx % 2 === 0 ? hexToPhaser(palette.playerCore) : hexToPhaser(palette.fxAccent));
			const gfx = this.add.graphics().setDepth(2);
			this._paintBlock(gfx, x, y, w, BLOCK_HEIGHT, col, isBase);
			return gfx;
		}

		_paintBlock(gfx, x, y, w, h, color, isBase) {
			const r = 4, hh = h / 2, hw = w / 2;
			// Ambient glow
			gfx.fillStyle(color, isBase ? 0.08 : 0.22);
			gfx.fillRoundedRect(x - hw - 8, y - hh - 8, w + 16, h + 16, r + 4);

			// Body
			gfx.fillStyle(color, isBase ? 0.2 : 0.85);
			gfx.fillRoundedRect(x - hw, y - hh, w, h, r);

			// Top sheen
			gfx.fillStyle(0xffffff, isBase ? 0.06 : 0.2);
			gfx.fillRoundedRect(x - hw + 2, y - hh + 2, w - 4, 5, 2);

			// Neon border
			gfx.lineStyle(isBase ? 1 : 2, color, isBase ? 0.35 : 1);
			gfx.strokeRoundedRect(x - hw, y - hh, w, h, r);

			// Inner gleam
			gfx.lineStyle(1, 0xffffff, 0.1);
			gfx.strokeRoundedRect(x - hw + 2, y - hh + 2, w - 4, h - 4, r - 1);
		}

		_makeSwingBlock() {
			const gfx = this.add.graphics().setDepth(3);
			const col = hexToPhaser(palette.playerCore);
			this._paintBlock(gfx, this._swingX, this._swingY, this.currentBlockW, BLOCK_HEIGHT, col, false);
			return gfx;
		}

		/* HUD */
		_buildHUD() {
			const d = 22;

			// Score
			this.scoreLbl = this.add.text(W / 2, 18, 'SCORE', {
				fontFamily: "'Orbitron',monospace", fontSize: '10px',
				color: '#4a9eff', letterSpacing: 6, alpha: 0.65,
			}).setOrigin(0.5, 0).setDepth(d).setScrollFactor(0);

			this.scoreTxt = this.add.text(W / 2, 32, '0', {
				fontFamily: "'Orbitron',monospace", fontSize: '42px', fontStyle: 'bold',
				color: '#ffffff', stroke: palette.playerCore, strokeThickness: 1,
			}).setOrigin(0.5, 0).setDepth(d).setScrollFactor(0);

			// Level
			this.levelTxt = this.add.text(W - 14, 18, `LVL 1`, {
				fontFamily: "'Orbitron',monospace", fontSize: '10px',
				color: palette.fxAccent, letterSpacing: 3,
			}).setOrigin(1, 0).setDepth(d).setScrollFactor(0);

			// Progress bar
			this.progBg = this.add.graphics().setDepth(d).setScrollFactor(0);
			this.progFg = this.add.graphics().setDepth(d).setScrollFactor(0);
			this._drawProg();

			// Perfect text
			this.perfTxt = this.add.text(W / 2, H * 0.5, '', {
				fontFamily: "'Orbitron',monospace", fontSize: '22px', fontStyle: 'bold',
				color: '#ffea00', stroke: '#000', strokeThickness: 3,
			}).setOrigin(0.5).setDepth(d).setScrollFactor(0).setAlpha(0);

			// Hint
			this.hintTxt = this.add.text(W / 2, H - 42, 'TAP  TO  DROP', {
				fontFamily: "'Orbitron',monospace", fontSize: '11px',
				color: '#ffffff', letterSpacing: 5,
			}).setOrigin(0.5).setDepth(d).setScrollFactor(0).setAlpha(0.4);

			this.tweens.add({
				targets: this.hintTxt,
				alpha: { from: 0.15, to: 0.5 },
				duration: 950, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
			});

			// Thin top separator line
			const sep = this.add.graphics().setDepth(d).setScrollFactor(0);
			sep.lineStyle(1, hexToPhaser(palette.playerCore), 0.2);
			sep.beginPath(); sep.moveTo(0, 84); sep.lineTo(W, 84); sep.strokePath();
		}

		_drawProg() {
			const bx = 14, by = 28, bw = 110, bh = 3;
			const pct = Math.min(this.blockCount / BLOCKS_PER_LEVEL, 1);
			this.progBg.clear();
			this.progBg.fillStyle(0x0a0a1e, 1);
			this.progBg.fillRoundedRect(bx, by, bw, bh, 2);
			this.progBg.lineStyle(1, hexToPhaser(palette.playerCore), 0.25);
			this.progBg.strokeRoundedRect(bx, by, bw, bh, 2);
			this.progFg.clear();
			if (pct > 0) {
				this.progFg.fillStyle(hexToPhaser(palette.playerCore), 0.9);
				this.progFg.fillRoundedRect(bx, by, bw * pct, bh, 2);
			}
			if (this.levelTxt) this.levelTxt.setText(`LVL ${this.level}`);
		}

		/* Update */
		update(t, dt) {
			if (!this.gameActive) return;
			const s = dt / 1000;

			if (!this.pendingDrop) {
				this.swingAngle += this.swingSpeed * this.swingDir * s;
				if (Math.abs(this.swingAngle) >= 1) this.swingDir *= -1;

				const nx = W / 2 + Math.sin(this.swingAngle) * SWING_AMPLITUDE;
				const ny = this._getSwingY();
				const dx = nx - this._swingX, dy = ny - this._swingY;
				this.swingBlock.x += dx; this.swingBlock.y += dy;
				this._swingX = nx; this._swingY = ny;

				// Glow breathe
				this.swingBlock.setAlpha(0.82 + 0.18 * Math.sin(t * 0.005));
			}

			// Camera pan
			const top = this.stack[this.stack.length - 1];
			if (top) {
				const ty = top.y - H * 0.52;
				this.camTargetY += (ty - this.camTargetY) * CAMERA_EASE;
				this.cameras.main.scrollY = this.camTargetY;
				// Sync bg
				this.bg.y = H / 2 + this.camTargetY;
			}
		}

		_getSwingY() {
			const top = this.stack[this.stack.length - 1];
			return top ? top.y - BLOCK_HEIGHT - 20 : 80;
		}

		/* Input */
		_onTap() {
			if (!this.gameActive || this.pendingDrop || this.isTransitioning) return;
			this.pendingDrop = true;
			this._dropBlock();
		}

		/* Drop */
		_dropBlock() {
			const dropX = this._swingX;
			const dropY = this._swingY;
			const top = this.stack[this.stack.length - 1];
			const landY = top.y - BLOCK_HEIGHT;
			const dist = Math.max(10, landY - dropY);
			const dur = Math.max(120, dist * 1.6);

			this.tweens.add({
				targets: this.swingBlock,
				y: `+=${landY - dropY}`,
				duration: dur,
				ease: 'Quad.easeIn',
				onComplete: () => this._land(dropX, landY, top),
			});
		}

		_land(dropX, landY, top) {
			const offset = dropX - top.x;
			const absOff = Math.abs(offset);
			const rawW = this.currentBlockW - absOff;

			if (rawW <= 4) { this._miss(dropX, landY); return; }

			const isPerfect = absOff <= SLICE_TOLERANCE;
			const usedW = isPerfect ? this.currentBlockW : rawW;
			const newX = isPerfect ? top.x : top.x + offset / 2;
			const colorIdx = this.stack.length % 2;

			// Destroy swinging graphic
			this.swingBlock.destroy();

			// Place new block
			this._drawStackedBlock(newX, landY, usedW, false, colorIdx);
			this.stack.push({ x: newX, y: landY, w: usedW });
			this.currentBlockW = usedW;

			// Slice residue
			if (!isPerfect) {
				this._spawnSlice(dropX, offset, landY);
				playSlice();
			} else {
				this._flashPerfect(newX, landY);
			}

			// Pitch rises with tower
			this.pitchMult = 1 + this.totalBlocks * 0.013;
			playThud(isPerfect ? this.pitchMult * 1.18 : this.pitchMult);
			this.cameras.main.shake(isPerfect ? 90 : 45, isPerfect ? 0.008 : 0.004);

			// Score
			const pts = isPerfect ? 250 : Math.max(10, Math.round(120 - absOff * 2.5));
			this.score += pts;
			this.totalBlocks++;
			this.blockCount++;
			this.scoreTxt.setText(this.score.toLocaleString());

			this._drawProg();
			this._spawnNextSwing();

			if (this.blockCount >= BLOCKS_PER_LEVEL) this._levelComplete();
		}

		_flashPerfect(x, y) {
			const words = ['PERFECT', 'FLAWLESS', 'EXACT', 'IMMACULATE', 'PRISTINE'];
			const w = words[Math.floor(Math.random() * words.length)];
			const t = this.add.text(x, y - 34, w, {
				fontFamily: "'Orbitron',monospace", fontSize: '19px', fontStyle: 'bold',
				color: '#ffea00', stroke: '#000', strokeThickness: 3,
			}).setOrigin(0.5).setDepth(15);
			this.tweens.add({
				targets: t, y: y - 90, alpha: 0, duration: 850, ease: 'Quad.easeOut',
				onComplete: () => t.destroy()
			});

			const fl = this.add.graphics().setDepth(18).setScrollFactor(0);
			fl.fillStyle(0xffea00, 0.12); fl.fillRect(0, 0, W, H);
			this.tweens.add({ targets: fl, alpha: 0, duration: 220, onComplete: () => fl.destroy() });
		}

		_spawnSlice(dropX, offset, landY) {
			const newTop = this.stack[this.stack.length - 1];
			const sliceW = Math.abs(offset);
			const dir = offset > 0 ? 1 : -1;
			const sliceX = dir > 0
				? newTop.x + newTop.w / 2 + sliceW / 2
				: newTop.x - newTop.w / 2 - sliceW / 2;

			const gfx = this.add.graphics().setDepth(2);
			const hcol = hexToPhaser(palette.hostile);
			this._paintBlock(gfx, sliceX, landY, sliceW, BLOCK_HEIGHT, hcol, false);

			const spinAmt = dir * Phaser.Math.Between(180, 340);
			this.tweens.add({
				targets: gfx,
				y: `+=${H * 1.6}`,
				x: `+=${dir * Phaser.Math.Between(50, 130)}`,
				angle: spinAmt,
				alpha: 0,
				duration: Phaser.Math.Between(650, 1050),
				ease: 'Quad.easeIn',
				onComplete: () => gfx.destroy(),
			});

			this._sparks(sliceX, landY, hcol);
		}

		_sparks(x, y, color) {
			for (let i = 0; i < 9; i++) {
				const sp = this.add.graphics().setDepth(5);
				sp.fillStyle(color, 1);
				const sz = Phaser.Math.Between(3, 8);
				sp.fillRect(-sz / 2, -sz / 2, sz, sz);
				sp.x = x + Phaser.Math.Between(-30, 30);
				sp.y = y + Phaser.Math.Between(-12, 12);
				this.tweens.add({
					targets: sp,
					x: `+=${Phaser.Math.Between(-100, 100)}`,
					y: `+=${Phaser.Math.Between(-160, 60)}`,
					alpha: 0, scale: 0.1,
					duration: Phaser.Math.Between(380, 680),
					ease: 'Quad.easeOut',
					onComplete: () => sp.destroy(),
				});
			}
		}

		_spawnNextSwing() {
			this.pendingDrop = false;
			this._swingX = W / 2;
			this._swingY = this._getSwingY();
			this.swingAngle = 0;
			this.swingBlock = this._makeSwingBlock();
		}

		/* Miss */
		_miss(dropX, dropY) {
			this.gameActive = false;
			playMiss();
			this.cameras.main.shake(320, 0.022);

			this.tweens.add({
				targets: this.swingBlock,
				y: `+=${H * 2}`,
				angle: Phaser.Math.Between(-200, 200),
				alpha: 0,
				duration: 1100, ease: 'Quad.easeIn',
				onComplete: () => this.swingBlock.destroy(),
			});

			this.time.delayedCall(900, () => this._showGameOver());
		}

		_showGameOver() {
			const ov = this.add.graphics().setDepth(25).setScrollFactor(0);
			ov.fillStyle(0x000000, 0.75); ov.fillRect(0, 0, W, H);
			ov.setAlpha(0);
			this.tweens.add({ targets: ov, alpha: 1, duration: 400 });

			this.time.delayedCall(500, () => {
				const g = this.add.text(W / 2, H * 0.38, 'GAME OVER', {
					fontFamily: "'Orbitron',monospace", fontSize: '36px', fontStyle: 'bold',
					color: '#ff1744', stroke: '#000', strokeThickness: 3,
				}).setOrigin(0.5).setDepth(26).setScrollFactor(0).setAlpha(0);

				const s = this.add.text(W / 2, H * 0.48, `SCORE  ${this.score.toLocaleString()}`, {
					fontFamily: "'Orbitron',monospace", fontSize: '20px', color: '#ffffff',
				}).setOrigin(0.5).setDepth(26).setScrollFactor(0).setAlpha(0);

				this.tweens.add({ targets: [g, s], alpha: 1, duration: 500, delay: 100 });
				this.time.delayedCall(1100, () => window.FreshPlay.gameOver(this.score));
			});
		}

		/* Level complete */
		_levelComplete() {
			this.isTransitioning = true;
			this.gameActive = false;

			const fl = this.add.graphics().setDepth(25).setScrollFactor(0);
			fl.fillStyle(hexToPhaser(palette.playerCore), 0.18);
			fl.fillRect(0, 0, W, H);
			this.tweens.add({ targets: fl, alpha: 0, duration: 700 });

			const lbl = this.add.text(W / 2, H * 0.41, `LEVEL ${this.level}`, {
				fontFamily: "'Orbitron',monospace", fontSize: '12px', letterSpacing: 8,
				color: palette.playerCore,
			}).setOrigin(0.5).setDepth(26).setScrollFactor(0).setAlpha(0);

			const clr = this.add.text(W / 2, H * 0.49, 'COMPLETE', {
				fontFamily: "'Orbitron',monospace", fontSize: '40px', fontStyle: 'bold',
				color: '#ffffff', stroke: palette.playerCore, strokeThickness: 2,
			}).setOrigin(0.5).setDepth(26).setScrollFactor(0).setAlpha(0);

			this.tweens.add({
				targets: [lbl, clr], alpha: 1, duration: 450, onComplete: () => {
					this.time.delayedCall(750, () => {
						window.FreshPlay.levelComplete(() => {
							this.tweens.add({
								targets: [lbl, clr], alpha: 0, duration: 350, onComplete: () => {
									lbl.destroy(); clr.destroy();
									this._advance();
								}
							});
						});
					});
				}
			});
		}

		_advance() {
			this.level++;
			this.blockCount = 0;
			this.swingSpeed += SWING_SPEED_INCREMENT;
			if ((this.level - 1) % 5 === 0 && this.level > 1) {
				try {
					['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
						if (typeof window.FreshPlay[fn] === 'function') window.FreshPlay[fn]();
					});
				} catch (_) { }
			}
			window._bumpLevel && window._bumpLevel();
			this._drawProg();
			this.isTransitioning = false;
			this.gameActive = true;
			this.pendingDrop = false;
			this.tweens.add({ targets: this.hintTxt, alpha: 0.4, duration: 400 });
		}
	}

	/* Launch */
	const bgHex = parseInt((palette.background || '#030510').replace('#', ''), 16);
	new Phaser.Game({
		type: Phaser.AUTO,
		width: W, height: H,
		backgroundColor: bgHex,
		parent: document.body,
		scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
		scene: [BootScene, GameScene],
	});
})();