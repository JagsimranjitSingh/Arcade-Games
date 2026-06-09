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
		return '#00234f';
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
		levelComplete(cb) {
			try { window.FreshPlay.levelComplete(cb); } catch { if (cb) cb(); }
		},
		gameOver(score) {
			try { window.FreshPlay.gameOver(score); } catch { }
		},
	};

	/* ================================================================
		 AD PAUSE SYSTEM
		 ================================================================ */
	const AdSystem = (() => {
		let _pause = null;
		let _resume = null;

		function register(pauseFn, resumeFn) { _pause = pauseFn; _resume = resumeFn; }
		function unregister() { _pause = null; _resume = null; }
		function doPause() { if (_pause) _pause(); }
		function doResume() { if (_resume) _resume(); }

		const fp = window.FreshPlay;
		['showAd', 'showVideoAd', 'playAd', 'displayAd'].forEach(fn => {
			if (typeof fp[fn] !== 'function') return;
			const orig = fp[fn].bind(fp);
			fp[fn] = function (cb) {
				doPause();
				orig(function () { doResume(); if (typeof cb === 'function') cb(); });
			};
		});

		if (typeof fp.levelComplete === 'function') {
			const origLC = fp.levelComplete.bind(fp);
			fp.levelComplete = function (cb) {
				doPause();
				origLC(function () { doResume(); if (typeof cb === 'function') cb(); });
			};
		}

		const AD_START = ['adstart', 'ad_start', 'adshow', 'ad_show', 'adopen', 'ad_open', 'ad_play', 'adplay'];
		const AD_END = ['adend', 'ad_end', 'adclose', 'ad_close', 'adfinish', 'ad_finish', 'adcomplete', 'ad_complete'];

		window.addEventListener('message', (e) => {
			if (!e.data || typeof e.data !== 'object') return;
			const t = (e.data.type || e.data.event || '').toString().toLowerCase();
			if (AD_START.some(k => t.includes(k))) doPause();
			if (AD_END.some(k => t.includes(k))) doResume();
		});

		document.addEventListener('visibilitychange', () => {
			if (document.hidden) doPause(); else doResume();
		});

		return { register, unregister };
	})();

	/* Session best score */
	let sessionBest = 0;

	/* ================================================================
		 WEB-AUDIO SYNTHWAVE ENGINE
		 ================================================================ */
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

	/* ================================================================
		 CONSTANTS
		 ================================================================ */
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

	/* Touch device detection */
	const isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

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

		/* ── AD PAUSE ─────────────────────────────────────────────── */
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
				setTimeout(() => {
					if (!this.adPaused) { this.scene.resume(); Synth.start(); }
				}, 250);
			};

			AdSystem.register(pauseGame, resumeGame);

			this._onBlur = () => { if (this.alive) pauseGame(); };
			this._onFocus = () => { if (!document.hidden) resumeGame(); };
			window.addEventListener('blur', this._onBlur);
			window.addEventListener('focus', this._onFocus);

			this.events.once('shutdown', () => {
				AdSystem.unregister();
				window.removeEventListener('blur', this._onBlur);
				window.removeEventListener('focus', this._onFocus);
			});
		}

		/* ── BACKGROUND ───────────────────────────────────────────── */
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
				fontSize: sz, color: col, align,
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

			const hint = isTouchDevice()
				? 'JUMP BTN  ▶◀  SLIDE BTN'
				: '↑  JUMP       ↓  SLIDE';

			this.hintTxt = this.add.text(W / 2, H - 26, hint, sf('12px', '#00234f'))
				.setOrigin(0.5).setDepth(100).setAlpha(0.45);
			this.tweens.add({ targets: this.hintTxt, alpha: 0, delay: 4200, duration: 1400 });

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

		/* ── CONTROLS ─────────────────────────────────────────────── */
		_buildControls() {
			// Keyboard
			this.keys = this.input.keyboard.createCursorKeys();

			// Touch / mouse swipe + tap
			let tyStart = null;
			this.input.on('pointerdown', p => { Synth.resume(); tyStart = p.y; });
			this.input.on('pointerup', p => {
				if (tyStart === null) return;
				const dy = p.y - tyStart;
				tyStart = null;
				if (dy < -30) this._jump();
				else if (dy > 30) this._slide();
				else this._jump(); // tap = jump
			});

			// On-screen buttons for touch devices
			if (isTouchDevice()) this._createMobileButtons();
		}

		_createMobileButtons() {
			const container = document.getElementById('game-container');
			if (!container) return;

			// Remove stale buttons if scene restarted
			const old = document.getElementById('fp-touch-ctrl');
			if (old) old.remove();

			const wrap = document.createElement('div');
			wrap.id = 'fp-touch-ctrl';
			Object.assign(wrap.style, {
				position: 'absolute',
				bottom: '20px',
				left: '0',
				right: '0',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'flex-end',
				padding: '0 24px',
				pointerEvents: 'none',
				zIndex: '200',
			});

			const makeBtn = (icon, label, color) => {
				const btn = document.createElement('button');
				Object.assign(btn.style, {
					pointerEvents: 'all',
					width: '74px',
					height: '74px',
					borderRadius: '50%',
					background: 'rgba(6,6,15,0.55)',
					border: `2px solid ${color}88`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					flexDirection: 'column',
					gap: '2px',
					fontFamily: '"Share Tech Mono",monospace',
					fontSize: '10px',
					letterSpacing: '2px',
					color: color,
					textTransform: 'uppercase',
					WebkitTapHighlightColor: 'transparent',
					userSelect: 'none',
					touchAction: 'manipulation',
					boxShadow: `0 0 16px ${color}22, inset 0 0 16px rgba(0,0,0,0.5)`,
					backdropFilter: 'blur(6px)',
					cursor: 'pointer',
					outline: 'none',
					transition: 'background 0.08s, box-shadow 0.08s, transform 0.08s',
				});
				btn.innerHTML = `<span style="font-size:26px;line-height:1">${icon}</span><span>${label}</span>`;
				btn.addEventListener('touchstart', (e) => {
					e.preventDefault();
					btn.style.background = `${color}33`;
					btn.style.boxShadow = `0 0 28px ${color}88, inset 0 0 16px rgba(0,0,0,0.4)`;
					btn.style.transform = 'scale(0.93)';
				}, { passive: false });
				btn.addEventListener('touchend', (e) => {
					e.preventDefault();
					btn.style.background = 'rgba(6,6,15,0.55)';
					btn.style.boxShadow = `0 0 16px ${color}22, inset 0 0 16px rgba(0,0,0,0.5)`;
					btn.style.transform = 'scale(1)';
				}, { passive: false });
				return btn;
			};

			const jumpBtn = makeBtn('↑', 'JUMP', '#00ffe7');
			const slideBtn = makeBtn('↓', 'SLIDE', '#7c00ff');

			jumpBtn.addEventListener('touchstart', (e) => {
				e.preventDefault();
				Synth.resume(); this._jump();
			}, { passive: false });

			slideBtn.addEventListener('touchstart', (e) => {
				e.preventDefault();
				Synth.resume(); this._slide();
			}, { passive: false });

			wrap.appendChild(jumpBtn);
			wrap.appendChild(slideBtn);
			container.appendChild(wrap);

			// Clean up on scene shutdown
			this.events.once('shutdown', () => {
				if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
			});
		}

		/* ── JUMP / SLIDE ─────────────────────────────────────────── */
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

		/* ── OBSTACLE SPAWNING ────────────────────────────────────── */
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

		/* ── UPDATE ───────────────────────────────────────────────── */
		update(time, delta) {
			if (!this.alive) return;

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

		/* ── COLLISION ────────────────────────────────────────────── */
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

			if (!this.revived) {
				this.revived = true;
				// Show Revive UI
				const cx = W / 2, cy = H / 2;
				const bg = this.add.rectangle(cx, cy, 320, 160, 0x000000, 0.85).setDepth(200);
				bg.setStrokeStyle(2, s2col(this.pal.pl));
				const txt = this.add.text(cx, cy - 35, 'SECOND CHANCE?', { fontFamily: '"Share Tech Mono", monospace', fontSize: '24px', color: this.pal.pl }).setOrigin(0.5).setDepth(201);
				
				const btnRevive = this.add.rectangle(cx - 75, cy + 30, 130, 46, s2col(this.pal.pl)).setDepth(201).setInteractive({useHandCursor: true});
				const txtRevive = this.add.text(cx - 75, cy + 30, 'WATCH AD\nTO REVIVE', { fontFamily: '"Share Tech Mono", monospace', fontSize: '13px', color: '#000', align: 'center' }).setOrigin(0.5).setDepth(202);
				
				const btnSkip = this.add.rectangle(cx + 75, cy + 30, 130, 46, 0x444444).setDepth(201).setInteractive({useHandCursor: true});
				const txtSkip = this.add.text(cx + 75, cy + 30, 'SKIP', { fontFamily: '"Share Tech Mono", monospace', fontSize: '16px', color: '#00234f' }).setOrigin(0.5).setDepth(202);

				const proceedToOver = () => {
					bg.destroy(); txt.destroy(); btnRevive.destroy(); txtRevive.destroy(); btnSkip.destroy(); txtSkip.destroy();
					const score = ~~this.dTotal;
					sessionBest = Math.max(sessionBest, score);
					FP.gameOver(score);
					this.time.delayedCall(500, () => {
						this.scene.start('Over', { score, level: this.level, pal: this.pal });
					});
				};

				btnSkip.on('pointerdown', proceedToOver);
				btnRevive.on('pointerdown', () => {
					const doRevive = () => {
						bg.destroy(); txt.destroy(); btnRevive.destroy(); txtRevive.destroy(); btnSkip.destroy(); txtSkip.destroy();
						this.alive = true;
						this.obs = []; // clear obstacles
						this.speed = Math.max(V0, this.speed - 200); // slow down a bit
						Synth.resume();
					};

					if (window.FreshPlay && typeof window.FreshPlay.showVideoAd === 'function') {
						window.FreshPlay.showVideoAd(doRevive);
					} else {
						doRevive();
					}
				});

				return;
			}

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

			const lbl = this.add.text(W / 2, H / 2,
				`LEVEL  ${String(this.level).padStart(2, '0')}`, {
				fontFamily: '"Share Tech Mono","Courier New",monospace',
				fontSize: '46px', color: this.pal.ui,
				stroke: '#000000', strokeThickness: 3,
			}).setOrigin(0.5).setScale(0.4).setDepth(150);

			this.tweens.add({
				targets: lbl, scaleX: 1, scaleY: 1, alpha: { from: 0, to: 1 },
				duration: 380, ease: 'Back.Out', yoyo: true, hold: 720,
				onComplete: () => {
					lbl.destroy();
					this.lvlTxt.setText('LVL  ' + String(this.level).padStart(2, '0'));
					this.busy = false;
				},
			});
		}

		/* ── DUST PARTICLES ───────────────────────────────────────── */
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

		/* ── DRAW STARS ───────────────────────────────────────────── */
		_drawStars(time) {
			const g = this.starGfx; g.clear();
			const t = time * 0.001;
			this.stars.forEach(s => {
				const a = 0.28 + Math.sin(t * s.fr + s.ph) * 0.36;
				g.fillStyle(0x00234f, Math.max(0, a));
				g.fillCircle(s.x, s.y, s.r);
			});
		}

		/* ── DRAW SPEED TRAIL ─────────────────────────────────────── */
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

		/* ================================================================
			 REALISTIC PLAYER DRAWING
			 ================================================================ */
		_drawPlayer(time) {
			const g = this.playerGfx; g.clear();
			const pC = s2col(this.pal.pl);
			const uC = s2col(this.pal.ui);
			const t = time * 0.015;

			if (this.slide) {
				this._drawPlayerSlide(g, pC, uC, t);
			} else {
				this._drawPlayerRun(g, pC, uC, t);
			}
		}

		/* ── RUNNING CHARACTER (human cyberpunk runner) ──────────── */
		_drawPlayerRun(g, pC, uC, t) {
			const cx = PX + 5;
			const sy = this.py;
			const speedFactor = Math.min(1, (this.speed - V0) / 200);

			const cycle = this.onGnd ? t * 2.2 : 1.1;

			/* Human skin / clothing colours */
			const SKIN   = 0xd4956a;   // warm tan skin
			const HAIR   = 0x1a0a00;   // near-black hair
			const JACKET = 0x12122a;   // dark navy jacket
			const PANTS  = 0x0e0e20;   // dark trousers
			const SHOE   = 0x0a0a18;   // dark trainers

			/* ── Key Y levels ─────────────── */
			const headTopY  = sy;
			const shoulderY = sy + 17;
			const waistY    = sy + 36;
			const footY     = sy + 60;

			/* ── Trig leg swing ───────────── */
			const thighLen = 13, shinLen = 13;
			const fSwing = Math.sin(cycle) * 0.44;
			const bSwing = -fSwing;

			const fKneeX = cx + Math.sin(fSwing) * thighLen;
			const fKneeY = waistY + Math.cos(Math.abs(fSwing) * 0.5) * thighLen;
			const fShin  = fSwing * 0.45 - 0.12;
			const fFootX = fKneeX + Math.sin(fShin) * shinLen;
			const fFootY = fKneeY + Math.max(8, Math.cos(Math.abs(fShin)) * shinLen);

			const bKneeX = cx + Math.sin(bSwing) * thighLen;
			const bKneeY = waistY + Math.cos(Math.abs(bSwing) * 0.5) * thighLen;
			const bShin  = bSwing * 0.45 + 0.12;
			const bFootX = bKneeX + Math.sin(bShin) * shinLen;
			const bFootY = bKneeY + Math.max(8, Math.cos(Math.abs(bShin)) * shinLen);

			/* ── Trig arm swing ───────────── */
			const upperArmLen = 10, foreArmLen = 9;
			const fArmSwing = -fSwing * 0.75;
			const bArmSwing =  fSwing * 0.75;

			const fElbowX = cx + Math.sin(fArmSwing) * upperArmLen;
			const fElbowY = shoulderY + 7 + Math.cos(Math.abs(fArmSwing)) * upperArmLen * 0.55;
			const fHandX  = fElbowX + Math.sin(fArmSwing * 0.4) * foreArmLen;
			const fHandY  = fElbowY + foreArmLen * 0.85;

			const bElbowX = cx + Math.sin(bArmSwing) * upperArmLen;
			const bElbowY = shoulderY + 7 + Math.cos(Math.abs(bArmSwing)) * upperArmLen * 0.55;
			const bHandX  = bElbowX + Math.sin(bArmSwing * 0.4) * foreArmLen;
			const bHandY  = bElbowY + foreArmLen * 0.85;

			/* ── Ground shadow ────────────── */
			g.fillStyle(0x000000, 0.20 + speedFactor * 0.1);
			g.fillEllipse(cx, footY + 2, 32 + speedFactor * 6, 5);

			/* ── BACK ARM — jacket sleeve ─── */
			g.lineStyle(5, 0x0e0e22, 1);
			g.beginPath(); g.moveTo(cx, shoulderY + 4); g.lineTo(bElbowX, bElbowY); g.strokePath();
			// forearm skin
			g.lineStyle(4, SKIN, 1);
			g.beginPath(); g.moveTo(bElbowX, bElbowY); g.lineTo(bHandX, bHandY); g.strokePath();

			/* ── BACK LEG — trousers ───────── */
			g.lineStyle(7, 0x0c0c1c, 1);
			g.beginPath(); g.moveTo(cx, waistY); g.lineTo(bKneeX, bKneeY); g.strokePath();
			g.lineStyle(6, 0x0c0c1c, 1);
			g.beginPath(); g.moveTo(bKneeX, bKneeY); g.lineTo(bFootX, bFootY); g.strokePath();

			/* ── TORSO — jacket ────────────── */
			g.fillStyle(JACKET, 1);
			g.fillRoundedRect(cx - 7, shoulderY, 14, waistY - shoulderY + 2, 3);

			// Jacket front zip / open panel
			g.fillStyle(0x1a1a38, 1);
			g.fillRect(cx - 2, shoulderY + 2, 4, waistY - shoulderY - 2);

			// Jacket collar
			g.fillStyle(0x1e1e3a, 1);
			g.fillTriangle(cx - 4, shoulderY, cx, shoulderY + 7, cx + 4, shoulderY);

			// Cyan trim stripe on jacket sides
			g.lineStyle(1, pC, 0.45);
			g.beginPath(); g.moveTo(cx - 7, shoulderY + 4); g.lineTo(cx - 7, waistY); g.strokePath();
			g.beginPath(); g.moveTo(cx + 7, shoulderY + 4); g.lineTo(cx + 7, waistY); g.strokePath();

			// Jacket pocket detail
			g.fillStyle(0x1a1a35, 1);
			g.fillRoundedRect(cx + 1, shoulderY + 14, 5, 6, 1);

			// Belt / waistband
			g.fillStyle(0x222240, 1);
			g.fillRect(cx - 7, waistY - 3, 14, 4);
			// Belt buckle
			g.fillStyle(uC, 0.6);
			g.fillRect(cx - 2, waistY - 3, 4, 4);

			/* ── FRONT ARM — jacket sleeve + skin forearm ── */
			g.lineStyle(5, JACKET, 1);
			g.beginPath(); g.moveTo(cx, shoulderY + 4); g.lineTo(fElbowX, fElbowY); g.strokePath();
			// Cyan sleeve stripe
			g.lineStyle(1, pC, 0.5);
			g.beginPath(); g.moveTo(cx, shoulderY + 4); g.lineTo(fElbowX, fElbowY); g.strokePath();
			// Forearm skin
			g.lineStyle(4, SKIN, 1);
			g.beginPath(); g.moveTo(fElbowX, fElbowY); g.lineTo(fHandX, fHandY); g.strokePath();
			// Hand
			g.fillStyle(SKIN, 1);
			g.fillCircle(fHandX, fHandY, 3);

			/* ── FRONT LEG — trousers ──────── */
			g.lineStyle(8, PANTS, 1);
			g.beginPath(); g.moveTo(cx, waistY); g.lineTo(fKneeX, fKneeY); g.strokePath();
			// Knee patch detail
			g.fillStyle(0x1a1a32, 1);
			g.fillCircle(fKneeX, fKneeY, 4);
			g.lineStyle(1, pC, 0.25);
			g.strokeCircle(fKneeX, fKneeY, 4);

			g.lineStyle(7, PANTS, 1);
			g.beginPath(); g.moveTo(fKneeX, fKneeY); g.lineTo(fFootX, fFootY); g.strokePath();

			/* ── SHOES ─────────────────────── */
			// Back shoe
			g.fillStyle(SHOE, 1);
			g.fillRoundedRect(bFootX - 7, bFootY - 4, 14, 6, 3);
			// Sole line
			g.lineStyle(1, 0x333355, 1);
			g.beginPath(); g.moveTo(bFootX - 7, bFootY + 1); g.lineTo(bFootX + 7, bFootY + 1); g.strokePath();

			// Front shoe
			g.fillStyle(SHOE, 1);
			g.fillRoundedRect(fFootX - 7, fFootY - 4, 16, 6, 3);
			// Tongue / lace highlight
			g.fillStyle(0x1e1e3a, 1);
			g.fillRoundedRect(fFootX - 3, fFootY - 4, 7, 3, 1);
			// Cyan sole accent
			g.lineStyle(1.5, pC, 0.65);
			g.beginPath(); g.moveTo(fFootX - 7, fFootY + 1); g.lineTo(fFootX + 9, fFootY + 1); g.strokePath();

			/* ── HEAD — human with face ────── */
			const hW = 13, hH = 14;
			const hX = cx - hW / 2;
			const headMidY = headTopY + hH / 2;

			// Neck
			g.fillStyle(SKIN, 1);
			g.fillRect(cx - 3, headTopY + hH - 1, 6, 5);

			// Head shape (skin)
			g.fillStyle(SKIN, 1);
			g.fillRoundedRect(hX, headTopY, hW, hH, 5);

			// Hair — short messy top
			g.fillStyle(HAIR, 1);
			g.fillRoundedRect(hX - 1, headTopY - 1, hW + 2, 7, 4);
			// Hair spikes / texture
			g.fillTriangle(cx - 3, headTopY - 1, cx - 1, headTopY - 5, cx + 1, headTopY - 1);
			g.fillTriangle(cx + 1, headTopY - 1, cx + 3, headTopY - 4, cx + 5, headTopY - 1);

			// Eyes — white with dark pupil
			g.fillStyle(0x00234f, 0.9);
			g.fillEllipse(cx - 3, headMidY - 1, 4, 3);
			g.fillEllipse(cx + 3, headMidY - 1, 4, 3);
			g.fillStyle(0x111122, 1);
			g.fillCircle(cx - 2, headMidY - 1, 1.2);
			g.fillCircle(cx + 4, headMidY - 1, 1.2);
			// Eye shine
			g.fillStyle(0x00234f, 0.7);
			g.fillCircle(cx - 1.5, headMidY - 1.5, 0.5);
			g.fillCircle(cx + 4.5, headMidY - 1.5, 0.5);

			// Nose — tiny bump
			g.fillStyle(0xb87050, 0.7);
			g.fillTriangle(cx + 2, headMidY + 1, cx + 4, headMidY + 4, cx, headMidY + 4);

			// Mouth — determined thin line
			g.lineStyle(1.2, 0x7a3c28, 0.85);
			g.beginPath(); g.moveTo(cx, headMidY + 6); g.lineTo(cx + 5, headMidY + 6); g.strokePath();

			// Ear
			g.fillStyle(SKIN, 1);
			g.fillEllipse(hX - 1, headMidY, 3, 5);

			// Cyberpunk goggles pushed up on forehead
			g.fillStyle(0x111130, 0.9);
			g.fillRoundedRect(hX, headTopY + 2, hW, 5, 2);
			g.lineStyle(1, pC, 0.7);
			g.strokeRoundedRect(hX, headTopY + 2, hW, 5, 2);
			// Goggle lenses
			g.fillStyle(pC, 0.35);
			g.fillRoundedRect(hX + 1, headTopY + 3, 4, 3, 1);
			g.fillRoundedRect(hX + 7, headTopY + 3, 4, 3, 1);
			// Lens shine
			g.fillStyle(0x00234f, 0.4);
			g.fillRect(hX + 2, headTopY + 3, 1, 1);
			g.fillRect(hX + 8, headTopY + 3, 1, 1);

			/* ── SPEED AURA ───────────────── */
			if (speedFactor > 0.15) {
				g.fillStyle(pC, speedFactor * 0.06);
				g.fillRoundedRect(cx - 11, headTopY - 2, 22, fFootY - headTopY + 6, 4);
			}
		}

		/* ── SLIDE CHARACTER (human, low duck) ───────────────────── */
		_drawPlayerSlide(g, pC, uC, t) {
			const cx = PX + 5;
			const sy = this.py;

			const SKIN   = 0xd4956a;
			const HAIR   = 0x1a0a00;
			const JACKET = 0x12122a;
			const PANTS  = 0x0e0e20;
			const SHOE   = 0x0a0a18;

			/* ── Ground shadow ────────────── */
			g.fillStyle(0x000000, 0.25);
			g.fillEllipse(cx - 4, sy + 26, 52, 5);

			/* ── BACK LEG — extended straight back ── */
			g.lineStyle(7, PANTS, 1);
			g.beginPath(); g.moveTo(cx - 2, sy + 13); g.lineTo(cx - 18, sy + 21); g.strokePath();
			g.lineStyle(6, PANTS, 1);
			g.beginPath(); g.moveTo(cx - 18, sy + 21); g.lineTo(cx - 34, sy + 22); g.strokePath();
			// Back shoe
			g.fillStyle(SHOE, 1);
			g.fillRoundedRect(cx - 43, sy + 19, 13, 6, 3);
			g.lineStyle(1, 0x333355, 1);
			g.beginPath(); g.moveTo(cx - 43, sy + 24); g.lineTo(cx - 30, sy + 24); g.strokePath();

			/* ── FRONT LEG — bent and planted ── */
			g.lineStyle(8, PANTS, 1);
			g.beginPath(); g.moveTo(cx + 4, sy + 13); g.lineTo(cx + 17, sy + 21); g.strokePath();
			// Knee
			g.fillStyle(0x1a1a32, 1);
			g.fillCircle(cx + 17, sy + 21, 4);
			g.lineStyle(6, PANTS, 1);
			g.beginPath(); g.moveTo(cx + 17, sy + 21); g.lineTo(cx + 8, sy + 22); g.strokePath();

			// Front shoe
			g.fillStyle(SHOE, 1);
			g.fillRoundedRect(cx + 1, sy + 19, 14, 6, 3);
			// Lace area
			g.fillStyle(0x1e1e3a, 1);
			g.fillRoundedRect(cx + 3, sy + 19, 7, 3, 1);
			// Cyan sole
			g.lineStyle(1.5, pC, 0.65);
			g.beginPath(); g.moveTo(cx + 1, sy + 24); g.lineTo(cx + 15, sy + 24); g.strokePath();

			/* ── TORSO — jacket, leaning forward ── */
			g.fillStyle(JACKET, 1);
			g.fillRoundedRect(cx - 11, sy + 2, 22, 13, 3);

			// Zip / open-front panel
			g.fillStyle(0x1a1a38, 1);
			g.fillRect(cx - 2, sy + 3, 4, 10);

			// Cyan jacket trim
			g.lineStyle(1, pC, 0.45);
			g.beginPath(); g.moveTo(cx - 11, sy + 4); g.lineTo(cx - 11, sy + 14); g.strokePath();
			g.beginPath(); g.moveTo(cx + 11, sy + 4); g.lineTo(cx + 11, sy + 14); g.strokePath();

			// Back arm — sleeve only
			g.lineStyle(5, 0x0e0e22, 1);
			g.beginPath(); g.moveTo(cx - 9, sy + 5); g.lineTo(cx - 20, sy + 9); g.strokePath();
			g.lineStyle(4, SKIN, 1);
			g.beginPath(); g.moveTo(cx - 20, sy + 9); g.lineTo(cx - 28, sy + 11); g.strokePath();

			/* ── FRONT ARM — extended forward for balance ── */
			g.lineStyle(5, JACKET, 1);
			g.beginPath(); g.moveTo(cx + 9, sy + 5); g.lineTo(cx + 20, sy + 8); g.strokePath();
			g.lineStyle(1, pC, 0.5);
			g.beginPath(); g.moveTo(cx + 9, sy + 5); g.lineTo(cx + 20, sy + 8); g.strokePath();
			// Forearm skin
			g.lineStyle(4, SKIN, 1);
			g.beginPath(); g.moveTo(cx + 20, sy + 8); g.lineTo(cx + 29, sy + 9); g.strokePath();
			// Hand
			g.fillStyle(SKIN, 1);
			g.fillCircle(cx + 29, sy + 9, 3);

			/* ── HEAD — tucked human head ─── */
			const hW = 12, hH = 12;
			const hX = cx + 6;
			const headMidY = sy + hH / 2;

			// Neck
			g.fillStyle(SKIN, 1);
			g.fillRect(hX, sy + hH - 1, 5, 4);

			// Head skin
			g.fillStyle(SKIN, 1);
			g.fillRoundedRect(hX, sy - 1, hW, hH, 5);

			// Hair
			g.fillStyle(HAIR, 1);
			g.fillRoundedRect(hX - 1, sy - 2, hW + 2, 6, 4);
			// Hair spike
			g.fillTriangle(hX + 2, sy - 2, hX + 4, sy - 6, hX + 6, sy - 2);

			// Eyes — intense forward stare while ducking
			g.fillStyle(0x00234f, 0.9);
			g.fillEllipse(hX + 2, headMidY, 4, 3);
			g.fillEllipse(hX + 7, headMidY, 4, 3);
			g.fillStyle(0x111122, 1);
			g.fillCircle(hX + 3, headMidY, 1.2);
			g.fillCircle(hX + 8, headMidY, 1.2);
			// Eye shine
			g.fillStyle(0x00234f, 0.7);
			g.fillCircle(hX + 3.5, headMidY - 0.5, 0.5);
			g.fillCircle(hX + 8.5, headMidY - 0.5, 0.5);

			// Brow — furrowed with effort
			g.lineStyle(1.5, HAIR, 0.9);
			g.beginPath(); g.moveTo(hX + 1, headMidY - 2); g.lineTo(hX + 5, headMidY - 3); g.strokePath();
			g.beginPath(); g.moveTo(hX + 6, headMidY - 3); g.lineTo(hX + 10, headMidY - 2); g.strokePath();

			// Gritted mouth
			g.lineStyle(1.2, 0x7a3c28, 0.85);
			g.beginPath(); g.moveTo(hX + 2, headMidY + 5); g.lineTo(hX + 9, headMidY + 5); g.strokePath();

			// Cyberpunk goggles pushed to forehead
			g.fillStyle(0x111130, 0.9);
			g.fillRoundedRect(hX, sy, hW, 4, 2);
			g.lineStyle(1, pC, 0.7);
			g.strokeRoundedRect(hX, sy, hW, 4, 2);
			g.fillStyle(pC, 0.3);
			g.fillRoundedRect(hX + 1, sy + 1, 4, 2, 1);
			g.fillRoundedRect(hX + 6, sy + 1, 4, 2, 1);
		}

		/* ── DRAW OBSTACLES ───────────────────────────────────────── */
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
					g.fillStyle(0x00234f, 0.16);
					for (let sy2 = y + 17; sy2 < y + h - 4; sy2 += 10)
						g.fillRect(x + 2, sy2, w - 4, 4);
					g.fillStyle(hC, pulse); g.fillCircle(x + w / 2, y - 5, 5.5);
					g.fillStyle(0x00234f, 0.65); g.fillCircle(x + w / 2, y - 5, 2);
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

		/* ── DRAW DUST ────────────────────────────────────────────── */
		_drawDust() {
			const g = this.dustGfx; g.clear();
			this.dust.forEach(p => {
				g.fillStyle(p.col, p.life * 0.5);
				g.fillCircle(p.x, p.y, p.life * 4.5);
			});
		}

		/* ── MOTION BLUR ──────────────────────────────────────────── */
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
				[[W / 2 - 214, ly - 3], [W / 2 + 208, ly - 3]].forEach(([cx2, cy2]) => {
					deco.fillStyle(uiC, 1); deco.fillRect(cx2, cy2, 6, 6);
				});
			});

			this.scanGfx = this.add.graphics().setDepth(10);
			this.scanY = 0;

			const sf = (sz, col) => ({
				fontFamily: '"Share Tech Mono","Courier New",monospace',
				fontSize: sz, color: col, align: 'center',
			});

			this.add.text(W / 2, H / 2 - 116, 'S Y S T E M', sf('13px', ho)).setOrigin(0.5);

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
				this.score.toLocaleString() + ' m', sf('32px', pl)).setOrigin(0.5);

			this.add.text(W / 2, H / 2 + 36,
				'LEVEL  ' + String(this.level).padStart(2, '0') + '  REACHED',
				sf('13px', ui)).setOrigin(0.5);

			if (sessionBest > this.score) {
				this.add.text(W / 2, H / 2 + 58,
					'BEST  ' + sessionBest.toLocaleString() + ' m', sf('11px', '#00234f'))
					.setOrigin(0.5).setAlpha(0.45);
			} else if (sessionBest === this.score && this.score > 0) {
				this.add.text(W / 2, H / 2 + 58, '★  NEW BEST  ★', sf('11px', pl))
					.setOrigin(0.5).setAlpha(0.8);
			}

			// RUN AGAIN button
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

			const lbl = this.add.text(W / 2, H / 2 + 128, 'RUN  AGAIN', sf('16px', '#00234f'))
				.setOrigin(0.5).setInteractive({ useHandCursor: true });
			lbl.on('pointerover', () => drawBtn(true));
			lbl.on('pointerout', () => drawBtn(false));
			lbl.on('pointerdown', () => { Synth.start(); this.scene.start('Game'); });

			// Keyboard or anywhere-tap to restart
			this.input.keyboard.once('keydown', () => { Synth.start(); this.scene.start('Game'); });
			this.input.once('pointerdown', () => { Synth.start(); this.scene.start('Game'); });

			// Corner accents
			const acc = this.add.graphics();
			acc.lineStyle(1, uiC, 0.35);
			const corners = [
				[[16, 16], [40, 16]], [[16, 16], [16, 40]],
				[[W - 16, 16], [W - 40, 16]], [[W - 16, 16], [W - 16, 40]],
				[[16, H - 16], [40, H - 16]], [[16, H - 16], [16, H - 40]],
				[[W - 16, H - 16], [W - 40, H - 16]], [[W - 16, H - 16], [W - 16, H - 40]],
			];
			corners.forEach(([a, b]) => {
				acc.beginPath(); acc.moveTo(a[0], a[1]); acc.lineTo(b[0], b[1]); acc.strokePath();
			});

			// Mobile hint
			if (isTouchDevice()) {
				this.add.text(W / 2, H / 2 + 164,
					'TAP ANYWHERE TO RESTART', sf('11px', '#00234f'))
					.setOrigin(0.5).setAlpha(0.3);
			}
		}

		update() {
			this.scanGfx.clear();
			this.scanY = (this.scanY + 1.3) % H;
			this.scanGfx.fillStyle(0x00234f, 0.022);
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
		backgroundColor: 0xc4e2f5,
		parent: 'game-container',
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		// Prevent right-click context menu on canvas
		disableContextMenu: true,
		scene: [GameScene, OverScene],
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => new Phaser.Game(config));
	} else {
		new Phaser.Game(config);
	}

})();
