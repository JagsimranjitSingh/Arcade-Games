/* ================================================================
	 ROOFTOP CYBER PUNK   
	 ================================================================ */

(function () {
	'use strict';

	/* FreshPlay Local Fallback */
	if (typeof window.FreshPlay === 'undefined') {
		window.FreshPlay = {
			getCurrentPalette: () => ({}),
			gameOver: () => { },
			// Simulate a real ad: fires adstart → waits → fires adend → calls cb
			showAd(cb) {
				console.log('[FreshPlay] Ad started (simulated)');
				window.dispatchEvent(new MessageEvent('message', {
					data: { type: 'adstart' }, origin: window.location.origin
				}));
				setTimeout(() => {
					console.log('[FreshPlay] Ad finished (simulated)');
					window.dispatchEvent(new MessageEvent('message', {
						data: { type: 'adend' }, origin: window.location.origin
					}));
					if (typeof cb === 'function') cb();
				}, 3000);
			},
			levelComplete(cb) {
				// In production FreshPlay may show an ad here; simulate the same
				window.FreshPlay.showAd(cb);
			},
		};
		window.FreshPlay.showVideoAd = window.FreshPlay.showAd;
		window.FreshPlay.playAd = window.FreshPlay.showAd;
		window.FreshPlay.displayAd = window.FreshPlay.showAd;
	}

	/* Robust Color Parsers */
	const hexToStr = c => {
		if (typeof c === 'string') return c.startsWith('#') ? c : '#' + c;
		if (typeof c === 'number') return '#' + c.toString(16).padStart(6, '0');
		return '#ffffff';
	};

	const hexN = s => {
		if (typeof s === 'number') return s;
		if (typeof s === 'string') return parseInt(s.replace('#', ''), 16);
		return 0x000000;
	};

	/* FreshPlay bridge */
	const FP = {
		pal() {
			try {
				const p = window.FreshPlay.getCurrentPalette();
				return {
					bg: hexToStr(p.background || '#06060f'),
					pl: hexToStr(p.playerCore || '#00ffe7'),
					ho: hexToStr(p.hostile || '#ff1a5e'),
					ui: hexToStr(p.interface || '#7c00ff'),
				};
			} catch {
				return { bg: '#06060f', pl: '#00ffe7', ho: '#ff1a5e', ui: '#7c00ff' };
			}
		},
		// levelComplete is intentionally a passthrough here.
		// The AdSystem (below) wraps window.FreshPlay.levelComplete directly
		// so pause/resume is handled at the SDK level before this fires.
		levelComplete(cb) {
			try { window.FreshPlay.levelComplete(cb); } catch { if (cb) cb(); }
		},
		gameOver(score) {
			try { window.FreshPlay.gameOver(score); } catch { /* noop */ }
		},
	};

	/* Ad Pause System
		 Installed once at boot, before any scene starts.
		 Works in 3 layers:
			 1. SDK wrapping  – intercept showAd / levelComplete calls
			 2. postMessage   – parent-frame ad lifecycle events
			 3. visibilitychange – fullscreen ad hides the iframe doc  */
	const AdSystem = (() => {
		let _pause = null;   // injected by the active scene
		let _resume = null;

		// Allow scenes to register their pause/resume hooks
		function register(pauseFn, resumeFn) {
			_pause = pauseFn;
			_resume = resumeFn;
		}
		function unregister() { _pause = null; _resume = null; }

		function doPause() { if (_pause) _pause(); }
		function doResume() { if (_resume) _resume(); }

		// Layer 1: Wrap SDK functions
		const fp = window.FreshPlay;

		// Wrap showAd / showVideoAd / playAd / displayAd
		['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
			if (typeof fp[fn] !== 'function') return;
			const orig = fp[fn].bind(fp);
			fp[fn] = function (cb) {
				doPause();
				orig(function () {
					doResume();
					if (typeof cb === 'function') cb();
				});
			};
		});

		// Wrap levelComplete — FreshPlay shows an interstitial ad inside it
		if (typeof fp.levelComplete === 'function') {
			const origLC = fp.levelComplete.bind(fp);
			fp.levelComplete = function (cb) {
				doPause();
				origLC(function () {
					doResume();
					if (typeof cb === 'function') cb();
				});
			};
		}

		// Layer 2: postMessage from parent frame 
		const AD_START = ['adstart', 'ad_start', 'adshow', 'ad_show', 'adopen', 'ad_open', 'ad_play', 'adplay'];
		const AD_END = ['adend', 'ad_end', 'adclose', 'ad_close', 'adfinish', 'ad_finish', 'adcomplete', 'ad_complete'];

		window.addEventListener('message', (e) => {
			if (!e.data || typeof e.data !== 'object') return;
			const t = (e.data.type || e.data.event || '').toString().toLowerCase();
			if (AD_START.some(k => t.includes(k))) doPause();
			if (AD_END.some(k => t.includes(k))) doResume();
		});

		// Layer 3: Page Visibility (fullscreen ad covers iframe) 
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) doPause();
			else doResume();
		});

		return { register, unregister };
	})();

	/* Session best score */
	let sessionBest = 0;

	/* Web-Audio Synthwave Engine  */
	const Synth = (() => {
		let ctx, master, loopId;
		let stopFlag = false, nextMeasure = 0, beatN = 0;
		const BPM = 130, bL = 60 / BPM, mL = bL * 4;

		function ensure() {
			if (ctx) return true;
			try {
				ctx = new (window.AudioContext || window.webkitAudioContext)();
				master = ctx.createGain();
				master.gain.value = 0.26;
				master.connect(ctx.destination);
				return true;
			} catch { return false; }
		}

		function oscNode(type, hz, amp, dur, at = ctx.currentTime) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.type = type; o.frequency.value = hz;
			g.gain.setValueAtTime(amp, at);
			g.gain.exponentialRampToValueAtTime(1e-4, at + dur);
			o.connect(g); g.connect(master);
			o.start(at); o.stop(at + dur + 0.01);
		}

		function noiseNode(amp, dur, at = ctx.currentTime) {
			const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
			const buf = ctx.createBuffer(1, len, ctx.sampleRate);
			const d = buf.getChannelData(0);
			for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
			const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
			s.buffer = buf; f.type = 'highpass'; f.frequency.value = 2500;
			g.gain.setValueAtTime(amp, at); g.gain.exponentialRampToValueAtTime(1e-4, at + dur);
			s.connect(f); f.connect(g); g.connect(master);
			s.start(at); s.stop(at + dur + 0.01);
		}

		function kick(at = ctx.currentTime) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.setValueAtTime(148, at);
			o.frequency.exponentialRampToValueAtTime(1, at + 0.28);
			g.gain.setValueAtTime(0.82, at); g.gain.exponentialRampToValueAtTime(1e-4, at + 0.28);
			o.connect(g); g.connect(master);
			o.start(at); o.stop(at + 0.32);
		}

		/* Pentatonic scales for synthwave feel */
		const BASS = [65.41, 73.42, 82.41, 98.00, 73.42, 65.41, 98.00, 82.41];
		const LEAD = [261.63, 329.63, 392.00, 440.00, 329.63, 261.63, 392.00, 523.25];

		function measure(at) {
			kick(at); kick(at + bL * 2);
			noiseNode(0.18, 0.06, at + bL); noiseNode(0.18, 0.06, at + bL * 3);
			for (let i = 0; i < 8; i++) noiseNode(0.045, 0.025, at + (bL / 2) * i);
			const b = BASS[beatN % BASS.length];
			oscNode('sawtooth', b, 0.15, mL * 0.9, at);
			[1, 3 / 2].forEach(r => oscNode('sawtooth', b * 2 * r, 0.028, mL * 0.86, at));
			for (let i = 0; i < 8; i++) {
				const f = LEAD[(beatN * 3 + i) % LEAD.length];
				oscNode('square', f, 0.036, bL * 0.26, at + (bL / 2) * i);
			}
			oscNode('sawtooth', LEAD[beatN % 4] * 0.5, 0.06, bL * 0.18, at + bL * 2);
			beatN++;
		}

		function loop() {
			if (stopFlag) return;
			const now = ctx.currentTime;
			while (nextMeasure < now + mL * 2.5) { measure(nextMeasure); nextMeasure += mL; }
			loopId = setTimeout(loop, mL * 800);
		}

		return {
			resume() { ensure() && ctx.state === 'suspended' && ctx.resume(); },
			start() {
				if (!ensure()) return;
				stopFlag = false; beatN = 0;
				nextMeasure = ctx.currentTime + 0.05;
				loop();
			},
			stop() { stopFlag = true; clearTimeout(loopId); },

			sfxJump() {
				if (!ensure()) return;
				oscNode('square', 520, 0.09, 0.07);
				oscNode('square', 780, 0.05, 0.1, ctx.currentTime + 0.05);
			},
			sfxLand() {
				if (!ensure()) return;
				const o = ctx.createOscillator(), g = ctx.createGain();
				o.type = 'sawtooth';
				o.frequency.setValueAtTime(195, ctx.currentTime);
				o.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.11);
				g.gain.setValueAtTime(0.20, ctx.currentTime);
				g.gain.exponentialRampToValueAtTime(1e-4, ctx.currentTime + 0.11);
				o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.13);
			},
			sfxSlide() {
				if (!ensure()) return;
				oscNode('sawtooth', 175, 0.09, 0.27);
				oscNode('sawtooth', 130, 0.055, 0.31, ctx.currentTime + 0.04);
			},
			sfxDeath() {
				if (!ensure()) return;
				for (let i = 0; i < 6; i++)
					oscNode('sawtooth', 370 - i * 42, 0.1, 0.12, ctx.currentTime + i * 0.09);
				noiseNode(0.3, 0.42);
			},
			sfxLevel() {
				if (!ensure()) return;
				[523, 659, 784, 1047].forEach((f, i) =>
					oscNode('square', f, 0.072, 0.13, ctx.currentTime + i * 0.13));
			},
		};
	})();

	/*  Constants */
	const W = 800, H = 450;
	const GY = 372;
	const PX = 168;
	const PW = 26;
	const PHs = 60;
	const PHd = 24;
	const JVY = -548;
	const GRV = 1460;
	const V0 = 295;
	const dVEL = 28;
	const LDIST = 1600;
	const OMIN = 410;
	const OMAX = 760;

	/* Colour helpers */
	const n2col = n => Phaser.Display.Color.GetColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
	const s2col = s => n2col(hexN(s));
	const lerpC = (n, add) => Math.min(255, n + add);

	/* ================================================================
		 SCENE: GAME
		 ================================================================ */
	class GameScene extends Phaser.Scene {
		constructor() { super({ key: 'Game' }); }

		create() {
			this.pal = FP.pal();
			this.speed = V0;
			this.level = 1;
			this.dTotal = 0;
			this.dLevel = 0;
			this.alive = true;
			this.busy = false;

			this.py = GY - PHs;
			this.pvy = 0;
			this.onGnd = true;
			this.slide = false;
			this.slideT = 0;

			this.obs = [];
			this.dust = [];
			this.nxtObs = W + 340;

			this._buildSky();
			this._buildStars();
			this._buildCities();
			this._buildGround();
			this._buildFxLayers();
			this._buildHUD();
			this._buildControls();

			this._setupAdDetector();

			Synth.start();
		}

		/* AD PAUSE SYSTEM */
		_setupAdDetector() {
			this.adPaused = false;

			const pauseGame = () => {
				if (this.adPaused) return;
				this.adPaused = true;
				this.scene.pause();
				Synth.stop();
			};

			const resumeGame = () => {
				if (!this.adPaused) return;
				this.adPaused = false;
				// Small delay so ad dismissal animation fully clears
				setTimeout(() => {
					if (!this.adPaused) {
						this.scene.resume();
						Synth.start();
					}
				}, 250);
			};

			// Register this scene's hooks with the global AdSystem singleton.
			// AdSystem was installed at boot and has already wrapped the SDK
			// functions and global event listeners.
			AdSystem.register(pauseGame, resumeGame);

			// Also handle window blur/focus as a last-resort fallback
			// (e.g. when parent takes focus without triggering any SDK call)
			this._onBlur = () => { if (this.alive) pauseGame(); };
			this._onFocus = () => { if (!document.hidden) resumeGame(); };
			window.addEventListener('blur', this._onBlur);
			window.addEventListener('focus', this._onFocus);

			// Cleanup when scene shuts down
			this.events.once('shutdown', () => {
				AdSystem.unregister();
				window.removeEventListener('blur', this._onBlur);
				window.removeEventListener('focus', this._onFocus);
			});
		}

		_buildSky() {
			const g = this.add.graphics().setDepth(0);
			const n = hexN(this.pal.bg);
			const R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
			for (let y = 0; y < H; y++) {
				const t = y / H;
				g.fillStyle(Phaser.Display.Color.GetColor(
					lerpC(R, ~~(t * 24)),
					lerpC(G, ~~(t * 10)),
					lerpC(B, ~~(t * 46))
				));
				g.fillRect(0, y, W, 1);
			}
		}

		_buildStars() {
			this.starGfx = this.add.graphics().setDepth(10);
			this.stars = Array.from({ length: 120 }, () => ({
				x: Math.random() * W,
				y: Math.random() * GY * 0.60,
				r: Math.random() < 0.14 ? 1.5 : 0.7,
				ph: Math.random() * Math.PI * 2,
				fr: 0.4 + Math.random() * 0.95,
			}));
		}

		_buildCities() {
			this.cityLayers = [
				this._cityLayer(0.07, GY - 90, 20, 76, 0.22, 20),
				this._cityLayer(0.21, GY - 52, 36, 130, 0.46, 30),
				this._cityLayer(0.45, GY - 20, 60, 168, 0.88, 40),
			];
		}

		_cityLayer(par, baseY, minH, maxH, op, depth) {
			const tw = W + 55;
			const gA = this.add.graphics().setDepth(depth);
			const gB = this.add.graphics().setDepth(depth);
			this._drawCity(gA, tw, baseY, minH, maxH, op);
			this._drawCity(gB, tw, baseY, minH, maxH, op);
			gB.x = tw;
			return { gA, gB, xA: 0, xB: tw, tw, par };
		}

		_drawCity(gfx, tw, baseY, minH, maxH, op) {
			const n = hexN(this.pal.bg), u = hexN(this.pal.ui);
			const bR = lerpC((n >> 16) & 255, 24);
			const bG = lerpC((n >> 8) & 255, 18);
			const bB = lerpC(n & 255, 44);
			const bCol = Phaser.Display.Color.GetColor(bR, bG, bB);
			const wCol = Phaser.Display.Color.GetColor((u >> 16) & 255, (u >> 8) & 255, u & 255);

			let x = 0;
			while (x < tw) {
				const bw = Phaser.Math.Between(36, 120);
				const bh = Phaser.Math.Between(minH, maxH);
				const by = baseY - bh;
				gfx.fillStyle(bCol, op);
				gfx.fillRect(x, by, bw, bh);
				if (op > 0.3) {
					for (let wy = by + 8; wy < by + bh - 8; wy += 14)
						for (let wx = x + 5; wx < x + bw - 4; wx += 11)
							if (Math.random() > 0.44) {
								gfx.fillStyle(wCol, 0.45 + Math.random() * 0.2);
								gfx.fillRect(wx, wy, 5, 8);
							}
				}
				x += bw + Phaser.Math.Between(2, 16);
			}
		}

		_buildGround() {
			const g = this.add.graphics().setDepth(50);
			const uC = s2col(this.pal.ui);

			g.fillStyle(0x0b0b1a, 1);
			g.fillRect(0, GY, W, H - GY);

			g.lineStyle(2, uC, 0.95);
			g.beginPath(); g.moveTo(0, GY); g.lineTo(W, GY); g.strokePath();

			[0.30, 0.14, 0.06].forEach((a, i) => {
				g.lineStyle(1, uC, a);
				g.beginPath(); g.moveTo(0, GY + i + 1); g.lineTo(W, GY + i + 1); g.strokePath();
			});

			for (let i = 1; i <= 6; i++) {
				g.lineStyle(1, uC, 0.045 * (7 - i));
				g.beginPath(); g.moveTo(0, GY + i * 9); g.lineTo(W, GY + i * 9); g.strokePath();
			}

			for (let x = 0; x < W; x += 80) {
				g.lineStyle(1, 0x181830, 1);
				g.beginPath(); g.moveTo(x, GY); g.lineTo(x, GY + 24); g.strokePath();
			}

			[0, 80, 160, 240, 320, 400, 480, 560, 640, 720, 800].forEach(x => {
				g.fillStyle(uC, 0.5);
				g.fillRect(x - 1, GY - 2, 2, 4);
			});
		}

		_buildFxLayers() {
			this.trailGfx = this.add.graphics().setDepth(58);
			this.obsGfx = this.add.graphics().setDepth(68);
			this.playerGfx = this.add.graphics().setDepth(78);
			this.dustGfx = this.add.graphics().setDepth(83);
			this.blurGfx = this.add.graphics().setDepth(89);

			const scan = this.add.graphics().setDepth(92);
			for (let y = 0; y < H; y += 3) {
				scan.fillStyle(0x000000, 0.028);
				scan.fillRect(0, y, W, 1);
			}

			const ca = this.add.graphics().setDepth(94);
			ca.fillStyle(s2col(this.pal.pl), 0.012);
			ca.fillRect(0, 0, 3, H);
			ca.fillStyle(s2col(this.pal.ho), 0.012);
			ca.fillRect(W - 3, 0, 3, H);
		}

		_buildHUD() {
			const pal = this.pal;
			const sf = (sz, col, align = 'left') => ({
				fontFamily: '"Share Tech Mono","Courier New",monospace',
				fontSize: sz,
				color: col,
				align,
			});

			this.progBg = this.add.graphics().setDepth(98);
			this.progFg = this.add.graphics().setDepth(99);

			const barDeco = this.add.graphics().setDepth(99);
			barDeco.lineStyle(1, s2col(pal.ui), 0.15);
			barDeco.beginPath(); barDeco.moveTo(W / 2 - 90, 7); barDeco.lineTo(W / 2 - 90, 16); barDeco.strokePath();
			barDeco.beginPath(); barDeco.moveTo(W / 2 + 90, 7); barDeco.lineTo(W / 2 + 90, 16); barDeco.strokePath();

			this.lvlTxt = this.add.text(18, 14, 'LVL  01', sf('15px', pal.ui)).setDepth(100);
			this.spdTxt = this.add.text(18, 36, 'SPD  1.0×', sf('11px', pal.pl)).setDepth(100).setAlpha(0.7);
			this.scrTxt = this.add.text(W - 16, 14, '0 m', sf('22px', pal.ui, 'right'))
				.setOrigin(1, 0).setDepth(100);

			this.hintTxt = this.add.text(W / 2, H - 26, '↑  JUMP       ↓  SLIDE', sf('12px', '#ffffff'))
				.setOrigin(0.5).setDepth(100).setAlpha(0.4);
			this.tweens.add({ targets: this.hintTxt, alpha: 0, delay: 3800, duration: 1400 });

			this._progBar(0);
		}

		_progBar(pct) {
			const bw = 178, bh = 3, bx = W / 2 - 89, by = 9;
			const uC = s2col(this.pal.ui);
			this.progBg.clear();
			this.progBg.fillStyle(0x111122, 1); this.progBg.fillRect(bx, by, bw, bh);
			this.progBg.lineStyle(1, uC, 0.20); this.progBg.strokeRect(bx, by, bw, bh);
			this.progFg.clear();
			this.progFg.fillStyle(uC, 1);
			this.progFg.fillRect(bx, by, bw * Math.min(pct, 1), bh);
		}

		_buildControls() {
			this.keys = this.input.keyboard.createCursorKeys();
			let ty = null;
			this.input.on('pointerdown', p => { Synth.resume(); ty = p.y; });
			this.input.on('pointerup', p => {
				if (ty === null) return;
				const dy = p.y - ty;
				if (dy < -36) this._jump();
				else if (dy > 36) this._slide();
				ty = null;
			});
		}

		_jump() {
			if (!this.alive) return;
			Synth.resume();
			if (this.onGnd) {
				this.pvy = JVY;
				this.onGnd = false;
				this.slide = false;
				Synth.sfxJump();
				this._spawnDust(7, PX, GY);
			}
		}

		_slide() {
			if (!this.alive || !this.onGnd || this.slide) return;
			Synth.resume();
			this.slide = true;
			this.slideT = 700;
			Synth.sfxSlide();
		}

		_spawnObs() {
			const type = Math.random() < 0.5 ? 'sign' : 'vent';
			const x = W + 90;

			if (type === 'sign') {
				const w = Phaser.Math.Between(18, 28);
				const h = Phaser.Math.Between(68, 92);
				this.obs.push({ type, x, y: GY - h, w, h });
			} else {
				const w = Phaser.Math.Between(72, 120);
				const h = Phaser.Math.Between(112, 150);
				const yBot = GY - PHd - 6;
				this.obs.push({ type, x, y: yBot - h, w, h });
			}

			const minG = Math.max(300, OMIN - (this.level - 1) * 14);
			const maxG = Math.max(minG + 80, OMAX - (this.level - 1) * 22);
			this.nxtObs = x + Phaser.Math.Between(minG, maxG);
		}

		update(time, delta) {
			if (!this.alive) return;

			// CRITICAL FIX: Cap delta to prevent teleportation after the game resumes from an Ad pause.
			if (delta > 100) delta = 100;
			const dt = delta / 1000;

			if (Phaser.Input.Keyboard.JustDown(this.keys.up)) this._jump();
			if (this.keys.down.isDown && this.onGnd && !this.slide) this._slide();

			if (this.slide) { this.slideT -= delta; if (this.slideT <= 0) this.slide = false; }

			if (!this.onGnd) {
				this.pvy += GRV * dt;
				this.py += this.pvy * dt;
				if (this.py >= GY - PHs) {
					this.py = GY - PHs;
					if (this.pvy > 180) {
						Synth.sfxLand();
						this._spawnDust(9, PX, GY);
						this.cameras.main.shake(80, 0.004);
					}
					this.pvy = 0; this.onGnd = true;
				}
			} else {
				this.py = GY - (this.slide ? PHd : PHs);
			}

			const dx = this.speed * dt;
			this.dTotal += dx;
			this.dLevel += dx;

			this.obs.forEach(o => o.x -= dx);
			this.obs = this.obs.filter(o => o.x + o.w > -20);
			this.nxtObs -= dx;
			if (this.nxtObs < W + 80) this._spawnObs();

			this.cityLayers.forEach(L => {
				L.xA -= dx * L.par; L.xB -= dx * L.par;
				L.gA.x = L.xA; L.gB.x = L.xB;
				if (L.xA + L.tw < 0) { L.xA = L.xB + L.tw; L.gA.x = L.xA; }
				if (L.xB + L.tw < 0) { L.xB = L.xA + L.tw; L.gB.x = L.xB; }
			});

			this.dust = this.dust.filter(p => {
				p.x += p.vx * dt; p.y += p.vy * dt;
				p.vy += 330 * dt; p.life -= dt * 3;
				return p.life > 0;
			});

			this._checkCollision();

			if (this.alive && !this.busy && this.dLevel >= LDIST) this._levelUp();

			this._drawStars(time);
			this._drawTrail();
			this._drawObs(time);
			this._drawPlayer(time);
			this._drawDust();
			this._drawBlur();

			this.scrTxt.setText(Math.floor(this.dTotal) + ' m');
			this.spdTxt.setText('SPD  ' + (this.speed / V0).toFixed(1) + '×');
			this._progBar(this.dLevel / LDIST);
		}

		_checkCollision() {
			if (!this.alive) return;
			const pxL = PX - PW / 2 + 4;
			const pxR = PX + PW / 2 - 4;

			for (const o of this.obs) {
				if (pxR <= o.x || pxL >= o.x + o.w) continue;
				if (o.type === 'sign' && this.onGnd) { this._die(); return; }
				if (o.type === 'vent' && !this.slide) { this._die(); return; }
			}
		}

		_die() {
			if (!this.alive) return;
			this.alive = false;
			Synth.sfxDeath(); Synth.stop();

			const f = this.add.graphics().setDepth(200);
			f.fillStyle(s2col(this.pal.ho), 0.72); f.fillRect(0, 0, W, H);
			this.tweens.add({ targets: f, alpha: 0, duration: 360, onComplete: () => f.destroy() });
			this.cameras.main.shake(300, 0.015);

			const score = ~~this.dTotal;
			sessionBest = Math.max(sessionBest, score);
			FP.gameOver(score);

			this.time.delayedCall(1350, () => {
				this.scene.start('Over', { score, level: this.level, pal: this.pal });
			});
		}

		_levelUp() {
			this.busy = true;
			this.dLevel = 0;
			this.level++;
			this.speed += dVEL;
			Synth.sfxLevel();

			// Ad is handled inside window.FreshPlay.levelComplete (wrapped by AdSystem).

			const lbl = this.add.text(W / 2, H / 2,
				`LEVEL  ${String(this.level).padStart(2, '0')}`, {
				fontFamily: '"Share Tech Mono","Courier New",monospace',
				fontSize: '46px',
				color: this.pal.ui,
				stroke: '#000000',
				strokeThickness: 3,
			}).setOrigin(0.5).setScale(0.4).setDepth(150);

			this.tweens.add({
				targets: lbl,
				scaleX: 1, scaleY: 1, alpha: { from: 0, to: 1 },
				duration: 380, ease: 'Back.Out',
				yoyo: true, hold: 720,
				onComplete: () => {
					lbl.destroy();
					this.lvlTxt.setText('LVL  ' + String(this.level).padStart(2, '0'));
					// Call through window.FreshPlay.levelComplete directly — it is
					// already wrapped by AdSystem to pause before the ad and resume
					// (via the callback) after it finishes.
					try {
						window.FreshPlay.levelComplete(() => { this.busy = false; });
					} catch (e) {
						this.busy = false;
					}
				},
			});
		}

		_spawnDust(n, cx, cy) {
			const c = hexN(this.pal.pl);
			for (let i = 0; i < n; i++)
				this.dust.push({
					x: cx + Phaser.Math.Between(-14, 14),
					y: cy,
					vx: Phaser.Math.FloatBetween(-95, 95),
					vy: Phaser.Math.FloatBetween(-105, -22),
					life: 1, col: c,
				});
		}

		_drawStars(time) {
			const g = this.starGfx; g.clear();
			const t = time * 0.001;
			this.stars.forEach(s => {
				const a = 0.28 + Math.sin(t * s.fr + s.ph) * 0.36;
				g.fillStyle(0xffffff, Math.max(0, a));
				g.fillCircle(s.x, s.y, s.r);
			});
		}

		_drawTrail() {
			const g = this.trailGfx; g.clear();
			if (!this.alive) return;
			const c = s2col(this.pal.pl);
			const sf = Math.min(1, (this.speed - V0) / 200);

			const tailX = PX - 10;
			const length = 60 + sf * 60;
			const topY = this.py + (this.slide ? 6 : 14);
			const botY = this.py + (this.slide ? 20 : 40);

			g.fillStyle(c, 0.15 + sf * 0.1);
			g.beginPath();
			g.moveTo(tailX, topY);
			g.lineTo(tailX - length, topY + 8);
			g.lineTo(tailX - length + 15, botY - 8);
			g.lineTo(tailX, botY);
			g.fillPath();

			g.lineStyle(2, c, 0.4 + sf * 0.4);
			g.beginPath();
			g.moveTo(tailX, (topY + botY) / 2);
			g.lineTo(tailX - length - 20, (topY + botY) / 2);
			g.strokePath();

			if (Math.random() < 0.3) {
				g.fillStyle(c, 0.6);
				g.fillCircle(tailX - Math.random() * length, topY + Math.random() * (botY - topY), 1 + Math.random() * 1.5);
			}
		}

		_drawPlayer(time) {
			const g = this.playerGfx; g.clear();
			const pC = s2col(this.pal.pl);
			const uC = s2col(this.pal.ui);
			const t = time * 0.015;

			if (this.slide) {
				const sy = this.py;

				g.lineStyle(3, pC, 0.8 + Math.sin(t * 5) * 0.2);
				g.beginPath();
				g.arc(PX + 12, sy + 12, 14, -Math.PI / 2.2, Math.PI / 2.2);
				g.strokePath();

				g.fillStyle(uC, 0.7 + Math.random() * 0.3);
				g.fillCircle(PX - 18, sy + 12, 4 + Math.random() * 3);
				g.fillStyle(0xffffff, 0.9);
				g.fillCircle(PX - 18, sy + 12, 2);

				g.fillStyle(0x0c0c14, 1);
				g.fillRoundedRect(PX - 14, sy + 2, 34, 20, 8);
				g.lineStyle(1.5, pC, 0.9);
				g.strokeRoundedRect(PX - 14, sy + 2, 34, 20, 8);

				g.fillStyle(pC, 1);
				g.fillRoundedRect(PX + 8, sy + 8, 8, 8, 3);
				g.fillStyle(0xffffff, 0.8);
				g.fillRect(PX + 12, sy + 10, 3, 4);

				g.lineStyle(2, uC, 0.6);
				g.beginPath(); g.moveTo(PX - 6, sy + 12); g.lineTo(PX + 2, sy + 12); g.strokePath();

			} else {
				const sy = this.py;
				const cycle = this.onGnd ? t : Math.PI / 4;
				const legFront = Math.sin(cycle) * 16;
				const legBack = Math.sin(cycle + Math.PI) * 16;
				const armFront = Math.sin(cycle + Math.PI) * 12;
				const armBack = Math.sin(cycle) * 12;

				g.fillStyle(uC, 0.75);
				g.beginPath();
				g.moveTo(PX - 2, sy + 12);
				g.lineTo(PX - 22 + Math.sin(t * 2) * 6, sy + 16 + Math.cos(t * 1.5) * 4);
				g.lineTo(PX - 14 + Math.sin(t * 2.2) * 4, sy + 26);
				g.fillPath();

				g.lineStyle(4, 0x1a1a2e, 1);
				g.beginPath(); g.moveTo(PX, sy + 20); g.lineTo(PX + armBack, sy + 32); g.strokePath();

				g.lineStyle(5.5, 0x0c0c14, 1);
				g.beginPath();
				g.moveTo(PX - 2, sy + 36);
				g.lineTo(PX - 2 + legBack * 0.8, sy + 46);
				g.lineTo(PX - 2 + legBack + (legBack > 0 ? 5 : -5), sy + 58);
				g.strokePath();

				g.fillStyle(0x0c0c14, 1);
				g.beginPath();
				g.moveTo(PX - 6, sy + 14);
				g.lineTo(PX + 8, sy + 12);
				g.lineTo(PX + 4, sy + 38);
				g.lineTo(PX - 4, sy + 38);
				g.fillPath();

				g.lineStyle(2, pC, 0.9);
				g.beginPath(); g.moveTo(PX + 6, sy + 14); g.lineTo(PX + 2, sy + 34); g.strokePath();

				g.lineStyle(5.5, 0x1a1a2e, 1);
				g.beginPath();
				g.moveTo(PX + 2, sy + 36);
				g.lineTo(PX + 2 + legFront * 0.8, sy + 46);
				g.lineTo(PX + 2 + legFront + (legFront > 0 ? 5 : -5), sy + 58);
				g.strokePath();

				g.lineStyle(2, pC, 0.8);
				g.beginPath();
				g.moveTo(PX + 2 + legFront * 0.5, sy + 42);
				g.lineTo(PX + 2 + legFront + (legFront > 0 ? 2 : -2), sy + 52);
				g.strokePath();

				g.lineStyle(4, 0x22223a, 1);
				g.beginPath(); g.moveTo(PX + 2, sy + 20); g.lineTo(PX + 2 + armFront, sy + 32); g.strokePath();

				g.fillStyle(0x0c0c14, 1);
				g.fillRoundedRect(PX - 5, sy + 2, 14, 14, 4);

				g.fillStyle(pC, 0.15); g.fillCircle(PX + 6, sy + 8, 10);

				g.fillStyle(pC, 1);
				g.fillRoundedRect(PX + 3, sy + 6, 8, 4, 2);
				g.fillStyle(0xffffff, 0.8);
				g.fillRect(PX + 7, sy + 7, 3, 2);
			}
		}

		_drawObs(time) {
			const g = this.obsGfx; g.clear();
			const hC = s2col(this.pal.ho);
			const t = time * 0.003;

			this.obs.forEach(({ type, x, y, w, h }) => {
				if (type === 'sign') {
					const pulse = 0.62 + Math.sin(t * 3.4) * 0.38;
					g.fillStyle(hC, 0.05); g.fillRect(x - 12, y - 12, w + 24, h + 24);
					g.fillStyle(hC, 0.18); g.fillRect(x - 6, y - 6, w + 12, h + 12);
					g.fillStyle(hC, 1); g.fillRect(x, y, w, h);
					g.fillStyle(hC, 0.90); g.fillRect(x - 9, y, w + 18, 13);
					g.fillStyle(0xffffff, 0.16);
					for (let sy = y + 17; sy < y + h - 4; sy += 10)
						g.fillRect(x + 2, sy, w - 4, 4);

					g.fillStyle(hC, pulse); g.fillCircle(x + w / 2, y - 5, 5.5);
					g.fillStyle(0xffffff, 0.65); g.fillCircle(x + w / 2, y - 5, 2);
					g.fillStyle(hC, 0.25); g.fillRect(x - 2, GY - 4, w + 4, 4);
				} else {
					const pulse = 0.52 + Math.sin(t * 2.3) * 0.48;
					g.lineStyle(3, hC, 0.30);
					g.beginPath(); g.moveTo(0, y + 8); g.lineTo(x, y + 8); g.strokePath();
					g.beginPath(); g.moveTo(x + w, y + 8); g.lineTo(W, y + 8); g.strokePath();

					g.fillStyle(hC, 0.05); g.fillRect(x - 14, y - 12, w + 28, h + 22);
					g.fillStyle(hC, 0.16); g.fillRect(x - 7, y - 6, w + 14, h + 12);

					g.fillStyle(0x0c0c1d, 1); g.fillRect(x, y, w, h);

					g.lineStyle(2, hC, 0.80);
					for (let vx = x + 10; vx < x + w - 6; vx += 14) {
						g.beginPath(); g.moveTo(vx, y + 7); g.lineTo(vx, y + h - 7); g.strokePath();
					}

					g.lineStyle(2, hC, 1); g.strokeRect(x, y, w, h);

					g.fillStyle(hC, pulse);
					g.fillTriangle(x + 9, y + h, x + 17, y + h + 14, x, y + h + 14);
					g.fillTriangle(x + w - 9, y + h, x + w, y + h + 14, x + w - 17, y + h + 14);

					g.lineStyle(1, 0x00ff88, 0.22);
					g.beginPath();
					g.moveTo(x - 22, y + h + 2); g.lineTo(x + w + 22, y + h + 2);
					g.strokePath();

					g.fillStyle(hC, 0.5);
					[[x + 4, y + 4], [x + w - 8, y + 4], [x + 4, y + h - 8], [x + w - 8, y + h - 8]].forEach(([rx, ry]) => {
						g.fillCircle(rx, ry, 2.5);
					});
				}
			});
		}

		_drawDust() {
			const g = this.dustGfx; g.clear();
			this.dust.forEach(p => {
				g.fillStyle(p.col, p.life * 0.5);
				g.fillCircle(p.x, p.y, p.life * 4.5);
			});
		}

		_drawBlur() {
			const g = this.blurGfx; g.clear();
			const sf = Math.min(1, (this.speed - V0) / (V0 * 1.4));
			if (sf <= 0) return;

			for (let y = 0; y < H; y += 4) {
				g.fillStyle(0x000000, sf * 0.095);
				g.fillRect(0, y, W, 1);
			}

			const sC = s2col(this.pal.pl);
			for (let y = 28; y < GY - 28; y += 36) {
				const len = W * (0.3 + sf * 0.25);
				g.lineStyle(1, sC, sf * 0.048);
				g.beginPath(); g.moveTo(0, y); g.lineTo(len, y); g.strokePath();
			}
		}
	}

	/* ================================================================
		 SCENE: GAME OVER
		 ================================================================ */
	class OverScene extends Phaser.Scene {
		constructor() { super({ key: 'Over' }); }

		init(d) {
			this.score = d.score || 0;
			this.level = d.level || 1;
			this.pal = d.pal || FP.pal();
		}

		create() {
			const { bg, pl, ho, ui } = this.pal;
			const bgN = hexN(bg);
			const uiC = s2col(ui), plC = s2col(pl), hoC = s2col(ho);

			this.add.graphics().fillStyle(bgN, 1).fillRect(0, 0, W, H);

			const grid = this.add.graphics();
			grid.lineStyle(1, uiC, 0.055);
			for (let x = 0; x < W; x += 40) {
				grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, H); grid.strokePath();
			}
			for (let y = 0; y < H; y += 40) {
				grid.beginPath(); grid.moveTo(0, y); grid.lineTo(W, y); grid.strokePath();
			}

			const deco = this.add.graphics();
			[H / 2 - 94, H / 2 + 94].forEach(ly => {
				deco.lineStyle(1, plC, 0.18);
				deco.beginPath(); deco.moveTo(0, ly); deco.lineTo(W, ly); deco.strokePath();

				deco.lineStyle(2, uiC, 0.52);
				deco.beginPath(); deco.moveTo(W / 2 - 214, ly); deco.lineTo(W / 2 + 214, ly); deco.strokePath();

				[[W / 2 - 214, ly - 3], [W / 2 + 208, ly - 3]].forEach(([cx, cy]) => {
					deco.fillStyle(uiC, 1); deco.fillRect(cx, cy, 6, 6);
				});
			});

			this.scanGfx = this.add.graphics().setDepth(10);
			this.scanY = 0;

			const sf = (sz, col) => ({
				fontFamily: '"Share Tech Mono","Courier New",monospace',
				fontSize: sz, color: col, align: 'center',
			});

			this.add.text(W / 2, H / 2 - 116, 'S Y S T E M', sf('13px', ho))
				.setOrigin(0.5);

			const flat = this.add.text(W / 2, H / 2 - 68, 'FLATLINED',
				{ ...sf('56px', ho), stroke: '#000000', strokeThickness: 4 })
				.setOrigin(0.5).setAlpha(0);
			this.tweens.add({ targets: flat, alpha: 1, duration: 540, ease: 'Power2' });

			this.time.addEvent({
				delay: 2600, loop: true, callback: () => {
					this.tweens.add({
						targets: flat, x: W / 2 + Phaser.Math.Between(-6, 6),
						duration: 40, yoyo: true, repeat: 5,
						onComplete: () => flat.setX(W / 2),
					});
				}
			});

			this.add.text(W / 2, H / 2 - 4,
				this.score.toLocaleString() + ' m', sf('32px', pl))
				.setOrigin(0.5);

			this.add.text(W / 2, H / 2 + 36,
				'LEVEL  ' + String(this.level).padStart(2, '0') + '  REACHED',
				sf('13px', ui))
				.setOrigin(0.5);

			if (sessionBest > this.score) {
				this.add.text(W / 2, H / 2 + 58,
					'BEST  ' + sessionBest.toLocaleString() + ' m',
					sf('11px', '#ffffff'))
					.setOrigin(0.5).setAlpha(0.45);
			} else if (sessionBest === this.score && this.score > 0) {
				this.add.text(W / 2, H / 2 + 58, '★  NEW BEST  ★', sf('11px', pl))
					.setOrigin(0.5).setAlpha(0.8);
			}

			const bx = W / 2 - 98, by_ = H / 2 + 104, bw = 196, bh = 48;
			const btn = this.add.graphics();

			const drawBtn = hover => {
				btn.clear();
				btn.fillStyle(uiC, hover ? 0.30 : 0.09); btn.fillRect(bx, by_, bw, bh);
				btn.lineStyle(hover ? 2 : 1, uiC, hover ? 1 : 0.52);
				btn.strokeRect(bx, by_, bw, bh);
				if (hover) {
					btn.lineStyle(1, plC, 0.28);
					btn.strokeRect(bx + 3, by_ + 3, bw - 6, bh - 6);
				}
			};
			drawBtn(false);

			const lbl = this.add.text(W / 2, H / 2 + 128, 'RUN  AGAIN', sf('16px', '#ffffff'))
				.setOrigin(0.5).setInteractive({ useHandCursor: true });
			lbl.on('pointerover', () => drawBtn(true));
			lbl.on('pointerout', () => drawBtn(false));
			lbl.on('pointerdown', () => { Synth.start(); this.scene.start('Game'); });

			this.input.keyboard.once('keydown', () => { Synth.start(); this.scene.start('Game'); });

			const acc = this.add.graphics();
			acc.lineStyle(1, uiC, 0.35);
			acc.beginPath(); acc.moveTo(16, 16); acc.lineTo(40, 16); acc.strokePath();
			acc.beginPath(); acc.moveTo(16, 16); acc.lineTo(16, 40); acc.strokePath();
			acc.beginPath(); acc.moveTo(W - 16, 16); acc.lineTo(W - 40, 16); acc.strokePath();
			acc.beginPath(); acc.moveTo(W - 16, 16); acc.lineTo(W - 16, 40); acc.strokePath();
			acc.beginPath(); acc.moveTo(16, H - 16); acc.lineTo(40, H - 16); acc.strokePath();
			acc.beginPath(); acc.moveTo(16, H - 16); acc.lineTo(16, H - 40); acc.strokePath();
			acc.beginPath(); acc.moveTo(W - 16, H - 16); acc.lineTo(W - 40, H - 16); acc.strokePath();
			acc.beginPath(); acc.moveTo(W - 16, H - 16); acc.lineTo(W - 16, H - 40); acc.strokePath();
		}

		update() {
			this.scanGfx.clear();
			this.scanY = (this.scanY + 1.3) % H;
			this.scanGfx.fillStyle(0xffffff, 0.022);
			this.scanGfx.fillRect(0, this.scanY, W, 2);
		}
	}

	/* ================================================================
		 PHASER GAME CONFIG
		 ================================================================ */
	const config = {
		type: Phaser.AUTO,
		width: W,
		height: H,
		backgroundColor: '#06060f',
		parent: 'game-container',
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		scene: [GameScene, OverScene],
	};

	/* Boot after DOM is ready */
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => new Phaser.Game(config));
	} else {
		new Phaser.Game(config);
	}

})();