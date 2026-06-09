// ============================================================
//  DEEP DIVE — Premium Submarine Survival
// ============================================================

// ---------------------------------------------------------------------------
// Safe FreshPlay shim
// ---------------------------------------------------------------------------
window.FreshPlay = window.FreshPlay || {
	getCurrentPalette: () => ({
		background: '#c4e2f5',
		playerCore: '#00234f',
		fxAccent: '#39ff14',
		hostile: '#ff3c3c',
		interface: '#daedf8',
	}),
	levelComplete: (cb) => { console.log('[FreshPlay] levelComplete'); if (cb) cb(); },
	gameOver: (score) => { console.log('[FreshPlay] gameOver', score); },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEPTH_PER_LEVEL = 1000;
const BASE_SCROLL_SPEED = 160;
const SPEED_INCREMENT = 30;
const BASE_O2_DRAIN = 8;
const O2_DRAIN_INC = 1.5;
const MAX_O2 = 100;
const BASE_SPAWN_RATE = 1800;
const SPAWN_RATE_DEC = 120;

// ---------------------------------------------------------------------------
// Touch Detection
// ---------------------------------------------------------------------------
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function toHexStr(c) {
	if (typeof c === 'number') return '#' + (c & 0x00234f).toString(16).padStart(6, '0');
	if (typeof c === 'string' && c.charAt(0) === '#') return c;
	return '#' + parseInt(String(c), 16).toString(16).padStart(6, '0');
}

function toHexInt(c) {
	if (typeof c === 'number') return c & 0x00234f;
	return parseInt(String(c).replace('#', ''), 16);
}

function normalizePalette(raw) {
	return {
		background: toHexStr(raw.background),
		playerCore: toHexStr(raw.playerCore),
		fxAccent:   toHexStr(raw.fxAccent),
		hostile:    toHexStr(raw.hostile),
		interface:  toHexStr(raw.interface),
	};
}

function hexLighten(hex, amount) {
	const n = toHexInt(hex);
	const r = Math.min(255, (n >> 16) + amount);
	const g = Math.min(255, ((n >> 8) & 0xff) + amount);
	const b = Math.min(255, (n & 0xff) + amount);
	return (r << 16 | g << 8 | b) | 0;
}

function hexDarken(hex, amount) {
	const n = toHexInt(hex);
	const r = Math.max(0, (n >> 16) - amount);
	const g = Math.max(0, ((n >> 8) & 0xff) - amount);
	const b = Math.max(0, (n & 0xff) - amount);
	return (r << 16 | g << 8 | b) | 0;
}

function hexToRGB(hex) {
	const n = toHexInt(hex);
	return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// ---------------------------------------------------------------------------
// Procedural texture generators
// ---------------------------------------------------------------------------
function generateTextures(scene, pal) {
	const W = scene.scale.width;
	const H = scene.scale.height;
	const scale = Math.min(W, H) / 600; // Responsive scale factor

	// ── Submarine (premium detailed) ──
	const subW = Math.round(90 * scale);
	const subH = Math.round(50 * scale);
	const subC = scene.textures.createCanvas('submarine', subW, subH);
	const sc = subC.getContext();

	// Main hull — rounded metallic body
	const hullGrad = sc.createLinearGradient(0, subH * 0.2, 0, subH * 0.85);
	hullGrad.addColorStop(0, '#40d8ff');
	hullGrad.addColorStop(0.3, '#0090b8');
	hullGrad.addColorStop(0.7, '#005878');
	hullGrad.addColorStop(1, '#003848');
	sc.fillStyle = hullGrad;
	sc.beginPath();
	sc.ellipse(subW * 0.52, subH * 0.48, subW * 0.46, subH * 0.32, 0, 0, Math.PI * 2);
	sc.fill();

	// Hull outline
	sc.strokeStyle = 'rgba(0,229,255,0.6)';
	sc.lineWidth = 1.5 * scale;
	sc.stroke();

	// Conning tower
	const towGrad = sc.createLinearGradient(subW * 0.38, subH * 0.05, subW * 0.38, subH * 0.3);
	towGrad.addColorStop(0, '#50e0ff');
	towGrad.addColorStop(1, '#0080a0');
	sc.fillStyle = towGrad;
	sc.beginPath();
	sc.roundRect(subW * 0.4, subH * 0.1, subW * 0.18, subH * 0.28, 4 * scale);
	sc.fill();
	sc.strokeStyle = 'rgba(0,229,255,0.5)';
	sc.lineWidth = 1 * scale;
	sc.stroke();

	// Periscope
	sc.strokeStyle = '#70e8ff';
	sc.lineWidth = 2 * scale;
	sc.beginPath();
	sc.moveTo(subW * 0.52, subH * 0.1);
	sc.lineTo(subW * 0.52, subH * 0.02);
	sc.lineTo(subW * 0.58, subH * 0.02);
	sc.stroke();

	// Main porthole (glass)
	sc.beginPath();
	sc.arc(subW * 0.62, subH * 0.48, subH * 0.17, 0, Math.PI * 2);
	const portholeGrad = sc.createRadialGradient(subW * 0.6, subH * 0.43, 0, subW * 0.62, subH * 0.48, subH * 0.17);
	portholeGrad.addColorStop(0, 'rgba(180,250,255,0.7)');
	portholeGrad.addColorStop(0.5, 'rgba(0,180,220,0.5)');
	portholeGrad.addColorStop(1, 'rgba(0,60,100,0.6)');
	sc.fillStyle = portholeGrad;
	sc.fill();
	sc.strokeStyle = '#a0f0ff';
	sc.lineWidth = 1.5 * scale;
	sc.stroke();

	// Light reflection on porthole
	sc.fillStyle = 'rgba(255,255,255,0.4)';
	sc.beginPath();
	sc.ellipse(subW * 0.59, subH * 0.42, subH * 0.06, subH * 0.09, -0.4, 0, Math.PI * 2);
	sc.fill();

	// Propeller housing
	sc.fillStyle = '#004060';
	sc.beginPath();
	sc.arc(subW * 0.08, subH * 0.48, subH * 0.13, 0, Math.PI * 2);
	sc.fill();
	sc.strokeStyle = 'rgba(0,229,255,0.4)';
	sc.lineWidth = 1 * scale;
	sc.stroke();

	// Propeller blades
	for (let i = 0; i < 4; i++) {
		sc.save();
		sc.translate(subW * 0.08, subH * 0.48);
		sc.rotate((Math.PI / 2) * i + 0.3);
		sc.fillStyle = 'rgba(0,200,240,0.7)';
		sc.beginPath();
		sc.ellipse(0, -subH * 0.12, subH * 0.03, subH * 0.11, 0, 0, Math.PI * 2);
		sc.fill();
		sc.restore();
	}

	// Hull rivet details
	sc.fillStyle = 'rgba(0,229,255,0.25)';
	for (let i = 0; i < 5; i++) {
		sc.beginPath();
		sc.arc(subW * (0.28 + i * 0.08), subH * 0.58, 1.5 * scale, 0, Math.PI * 2);
		sc.fill();
	}

	// Headlight glow
	const headGrad = sc.createRadialGradient(subW * 0.85, subH * 0.45, 0, subW * 0.85, subH * 0.45, subH * 0.12);
	headGrad.addColorStop(0, 'rgba(255,255,200,0.8)');
	headGrad.addColorStop(0.4, 'rgba(200,255,255,0.3)');
	headGrad.addColorStop(1, 'rgba(0,229,255,0)');
	sc.fillStyle = headGrad;
	sc.beginPath();
	sc.arc(subW * 0.85, subH * 0.45, subH * 0.12, 0, Math.PI * 2);
	sc.fill();

	// Overall glow
	const glowSub = sc.createRadialGradient(subW * 0.5, subH * 0.45, 2, subW * 0.5, subH * 0.45, subW * 0.5);
	glowSub.addColorStop(0, 'rgba(0,229,255,0.12)');
	glowSub.addColorStop(1, 'rgba(0,229,255,0)');
	sc.fillStyle = glowSub;
	sc.fillRect(0, 0, subW, subH);
	subC.refresh();

	// ── Oxygen Bubble (realistic) ──
	const bubSize = Math.round(40 * scale);
	const bubC = scene.textures.createCanvas('bubble', bubSize, bubSize);
	const bc = bubC.getContext();
	const bubR = bubSize / 2;

	// Outer shell
	const bubGrad = bc.createRadialGradient(bubR * 0.75, bubR * 0.7, bubR * 0.1, bubR, bubR, bubR);
	bubGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
	bubGrad.addColorStop(0.25, 'rgba(180,255,200,0.7)');
	bubGrad.addColorStop(0.6, 'rgba(57,255,20,0.4)');
	bubGrad.addColorStop(1, 'rgba(57,255,20,0)');
	bc.fillStyle = bubGrad;
	bc.beginPath();
	bc.arc(bubR, bubR, bubR * 0.88, 0, Math.PI * 2);
	bc.fill();

	// Glass reflection
	bc.fillStyle = 'rgba(255,255,255,0.55)';
	bc.beginPath();
	bc.ellipse(bubR * 0.7, bubR * 0.6, bubR * 0.18, bubR * 0.28, -0.5, 0, Math.PI * 2);
	bc.fill();

	// O2 text
	bc.font = `bold ${Math.round(bubR * 0.5)}px 'Share Tech Mono', monospace`;
	bc.fillStyle = 'rgba(255,255,255,0.7)';
	bc.textAlign = 'center';
	bc.textBaseline = 'middle';
	bc.fillText('O₂', bubR, bubR * 1.1);
	bubC.refresh();

	// ── Rock Formation (realistic underwater rock) ──
	const rockW = Math.round(110 * scale);
	const rockH = Math.round(130 * scale);
	const rockC = scene.textures.createCanvas('rock', rockW, rockH);
	const rc = rockC.getContext();

	// Main rock body with gradient
	const rockGrad = rc.createLinearGradient(0, 0, rockW, rockH);
	rockGrad.addColorStop(0, '#1a3040');
	rockGrad.addColorStop(0.4, '#0f2030');
	rockGrad.addColorStop(1, '#0a1520');
	rc.fillStyle = rockGrad;
	rc.beginPath();
	rc.moveTo(rockW * 0.5, 0);
	rc.lineTo(rockW * 0.85, rockH * 0.25);
	rc.lineTo(rockW * 0.95, rockH * 0.55);
	rc.lineTo(rockW * 0.88, rockH * 0.85);
	rc.lineTo(rockW, rockH);
	rc.lineTo(0, rockH);
	rc.lineTo(rockW * 0.05, rockH * 0.7);
	rc.lineTo(rockW * 0.08, rockH * 0.4);
	rc.lineTo(rockW * 0.2, rockH * 0.2);
	rc.closePath();
	rc.fill();

	// Bioluminescent edge
	rc.strokeStyle = 'rgba(0,140,180,0.5)';
	rc.lineWidth = 2.5 * scale;
	rc.stroke();

	// Coral/moss patches
	rc.fillStyle = 'rgba(0,100,140,0.25)';
	rc.beginPath();
	rc.arc(rockW * 0.4, rockH * 0.35, rockW * 0.15, 0, Math.PI * 2);
	rc.fill();
	rc.fillStyle = 'rgba(0,180,120,0.15)';
	rc.beginPath();
	rc.arc(rockW * 0.65, rockH * 0.6, rockW * 0.1, 0, Math.PI * 2);
	rc.fill();

	// Texture cracks
	rc.strokeStyle = 'rgba(0,60,100,0.3)';
	rc.lineWidth = 1 * scale;
	rc.beginPath();
	rc.moveTo(rockW * 0.45, rockH * 0.1);
	rc.lineTo(rockW * 0.55, rockH * 0.5);
	rc.lineTo(rockW * 0.4, rockH * 0.8);
	rc.stroke();
	rockC.refresh();

	// ── Sea Monster (terrifying deep-sea creature) ──
	const monW = Math.round(140 * scale);
	const monH = Math.round(100 * scale);
	const monC = scene.textures.createCanvas('monster', monW, monH);
	const mc = monC.getContext();

	// Body with menacing gradient
	const mg = mc.createRadialGradient(monW * 0.5, monH * 0.4, monH * 0.05, monW * 0.5, monH * 0.45, monH * 0.45);
	mg.addColorStop(0, '#ff4444');
	mg.addColorStop(0.3, '#cc2222');
	mg.addColorStop(0.7, '#881111');
	mg.addColorStop(1, 'rgba(136,17,17,0)');
	mc.fillStyle = mg;
	mc.beginPath();
	mc.ellipse(monW * 0.5, monH * 0.4, monW * 0.44, monH * 0.36, 0, 0, Math.PI * 2);
	mc.fill();

	// Tentacles
	mc.lineWidth = 3 * scale;
	mc.lineCap = 'round';
	const tentacleOffsets = [-0.32, -0.2, -0.08, 0.08, 0.2, 0.32];
	tentacleOffsets.forEach((ox, i) => {
		const tentGrad = mc.createLinearGradient(monW * (0.5 + ox), monH * 0.7, monW * (0.5 + ox), monH);
		tentGrad.addColorStop(0, 'rgba(255,60,60,0.8)');
		tentGrad.addColorStop(1, 'rgba(255,60,60,0.1)');
		mc.strokeStyle = tentGrad;
		mc.beginPath();
		mc.moveTo(monW * (0.5 + ox), monH * 0.7);
		mc.bezierCurveTo(
			monW * (0.5 + ox + (i % 2 === 0 ? -0.08 : 0.08)), monH * 0.82,
			monW * (0.5 + ox + (i % 2 === 0 ? 0.06 : -0.06)), monH * 0.9,
			monW * (0.5 + ox + (i % 2 === 0 ? -0.04 : 0.04)), monH * 0.98
		);
		mc.stroke();
	});

	// Main eye (large, menacing)
	mc.fillStyle = '#ffee88';
	mc.beginPath();
	mc.ellipse(monW * 0.62, monH * 0.34, monH * 0.12, monH * 0.14, 0, 0, Math.PI * 2);
	mc.fill();
	mc.strokeStyle = '#ff6644';
	mc.lineWidth = 1.5 * scale;
	mc.stroke();

	// Pupil (slit)
	mc.fillStyle = '#110000';
	mc.beginPath();
	mc.ellipse(monW * 0.63, monH * 0.34, monH * 0.03, monH * 0.11, 0, 0, Math.PI * 2);
	mc.fill();

	// Eye glow
	mc.fillStyle = 'rgba(255,200,50,0.3)';
	mc.beginPath();
	mc.arc(monW * 0.62, monH * 0.34, monH * 0.06, 0, Math.PI * 2);
	mc.fill();

	// Second eye (smaller)
	mc.fillStyle = '#ffdd77';
	mc.beginPath();
	mc.ellipse(monW * 0.4, monH * 0.36, monH * 0.08, monH * 0.1, 0, 0, Math.PI * 2);
	mc.fill();
	mc.fillStyle = '#110000';
	mc.beginPath();
	mc.ellipse(monW * 0.41, monH * 0.36, monH * 0.02, monH * 0.08, 0, 0, Math.PI * 2);
	mc.fill();

	// Bioluminescent spots
	const spotPositions = [
		[0.3, 0.3], [0.35, 0.55], [0.5, 0.25], [0.55, 0.55],
		[0.7, 0.5], [0.25, 0.45], [0.65, 0.3]
	];
	spotPositions.forEach(([px, py], i) => {
		const spotGrad = mc.createRadialGradient(monW * px, monH * py, 0, monW * px, monH * py, monH * 0.05);
		spotGrad.addColorStop(0, 'rgba(255,120,80,0.7)');
		spotGrad.addColorStop(1, 'rgba(255,80,60,0)');
		mc.fillStyle = spotGrad;
		mc.beginPath();
		mc.arc(monW * px, monH * py, monH * 0.05, 0, Math.PI * 2);
		mc.fill();
	});

	// Mouth / teeth
	mc.strokeStyle = '#ff6666';
	mc.lineWidth = 1.5 * scale;
	mc.beginPath();
	mc.moveTo(monW * 0.7, monH * 0.48);
	mc.quadraticCurveTo(monW * 0.55, monH * 0.58, monW * 0.35, monH * 0.48);
	mc.stroke();
	monC.refresh();

	// ── Particle ──
	const ptSize = Math.round(14 * scale);
	const ptC = scene.textures.createCanvas('particle', ptSize, ptSize);
	const pc = ptC.getContext();
	const ptR = ptSize / 2;
	const pg = pc.createRadialGradient(ptR, ptR, 0, ptR, ptR, ptR);
	pg.addColorStop(0, '#00234f');
	pg.addColorStop(0.4, 'rgba(200,250,255,0.5)');
	pg.addColorStop(1, 'rgba(255,255,255,0)');
	pc.fillStyle = pg;
	pc.beginPath();
	pc.arc(ptR, ptR, ptR, 0, Math.PI * 2);
	pc.fill();
	ptC.refresh();

	// ── Background tile (deep ocean) ──
	const tileSize = 256;
	const bgC = scene.textures.createCanvas('bg_tile', tileSize, tileSize);
	const bgCtx = bgC.getContext();
	const bgGrad = bgCtx.createLinearGradient(0, 0, 0, tileSize);
	bgGrad.addColorStop(0, pal.background);
	bgGrad.addColorStop(0.5, '#010c16');
	bgGrad.addColorStop(1, '#000a12');
	bgCtx.fillStyle = bgGrad;
	bgCtx.fillRect(0, 0, tileSize, tileSize);

	// Subtle caustic lines
	bgCtx.strokeStyle = 'rgba(0,100,160,0.05)';
	bgCtx.lineWidth = 0.5;
	for (let y = 0; y < tileSize; y += 14) {
		bgCtx.beginPath();
		bgCtx.moveTo(0, y);
		for (let x = 0; x <= tileSize; x += 6) {
			bgCtx.lineTo(x, y + Math.sin(x * 0.06 + y * 0.02) * 4);
		}
		bgCtx.stroke();
	}

	// Subtle vertical light shafts
	for (let i = 0; i < 3; i++) {
		const shaftX = tileSize * (0.2 + i * 0.3);
		const shaftGrad = bgCtx.createLinearGradient(shaftX, 0, shaftX, tileSize);
		shaftGrad.addColorStop(0, 'rgba(0,80,120,0.03)');
		shaftGrad.addColorStop(0.5, 'rgba(0,80,120,0.01)');
		shaftGrad.addColorStop(1, 'rgba(0,80,120,0)');
		bgCtx.fillStyle = shaftGrad;
		bgCtx.fillRect(shaftX - 15, 0, 30, tileSize);
	}
	bgC.refresh();

	// ── Headlight beam texture ──
	const beamW = Math.round(200 * scale);
	const beamH = Math.round(350 * scale);
	const beamC = scene.textures.createCanvas('headlight', beamW, beamH);
	const bCtx = beamC.getContext();
	const beamGrad = bCtx.createRadialGradient(beamW / 2, 0, beamW * 0.05, beamW / 2, beamH * 0.4, beamH * 0.6);
	beamGrad.addColorStop(0, 'rgba(180,240,255,0.12)');
	beamGrad.addColorStop(0.3, 'rgba(100,200,240,0.06)');
	beamGrad.addColorStop(1, 'rgba(0,100,150,0)');
	bCtx.fillStyle = beamGrad;
	bCtx.beginPath();
	bCtx.moveTo(beamW * 0.4, 0);
	bCtx.lineTo(0, beamH);
	bCtx.lineTo(beamW, beamH);
	bCtx.lineTo(beamW * 0.6, 0);
	bCtx.closePath();
	bCtx.fill();
	beamC.refresh();
}

// ---------------------------------------------------------------------------
// Audio engine
// ---------------------------------------------------------------------------
class AudioEngine {
	constructor() {
		try {
			this.ctx = new (window.AudioContext || window.webkitAudioContext)();
			this.master = this.ctx.createGain();
			this.master.gain.value = 0.35;
			this.master.connect(this.ctx.destination);
			this.ready = true;
		} catch (e) {
			this.ready = false;
		}
		this._ambientNode = null;
	}

	resume() { if (this.ready && this.ctx.state === 'suspended') this.ctx.resume(); }

	// Deep ambient hum
	startAmbient() {
		if (!this.ready || this._ambientNode) return;
		const osc1 = this.ctx.createOscillator();
		const osc2 = this.ctx.createOscillator();
		const lfo = this.ctx.createOscillator();
		const lfoG = this.ctx.createGain();
		const filt = this.ctx.createBiquadFilter();
		const gain = this.ctx.createGain();

		osc1.type = 'sine'; osc1.frequency.value = 55;
		osc2.type = 'sine'; osc2.frequency.value = 82.4;
		lfo.type = 'sine'; lfo.frequency.value = 0.08;
		lfoG.gain.value = 6;
		filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 2;
		gain.gain.value = 0.18;

		lfo.connect(lfoG);
		lfoG.connect(osc1.frequency);
		osc1.connect(filt);
		osc2.connect(filt);
		filt.connect(gain);
		gain.connect(this.master);

		osc1.start(); osc2.start(); lfo.start();
		this._ambientNode = { osc1, osc2, lfo, gain };
	}

	stopAmbient() {
		if (!this._ambientNode) return;
		const { osc1, osc2, lfo, gain } = this._ambientNode;
		gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
		setTimeout(() => { try { osc1.stop(); osc2.stop(); lfo.stop(); } catch (e) { } }, 1000);
		this._ambientNode = null;
	}

	playPing() {
		if (!this.ready) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const filt = this.ctx.createBiquadFilter();
		osc.type = 'sine'; osc.frequency.setValueAtTime(880, this.ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.8);
		gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);
		filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 8;
		osc.connect(filt); filt.connect(gain); gain.connect(this.master);
		osc.start(); osc.stop(this.ctx.currentTime + 0.95);
	}

	playBubblePop() {
		if (!this.ready) return;
		const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
		}
		const src = this.ctx.createBufferSource();
		const filt = this.ctx.createBiquadFilter();
		const gain = this.ctx.createGain();
		filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 3;
		gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
		src.buffer = buf;
		src.connect(filt); filt.connect(gain); gain.connect(this.master);
		src.start();
	}

	playExplosion() {
		if (!this.ready) return;
		const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.6, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5) * 0.8;
		}
		const src = this.ctx.createBufferSource();
		const filt = this.ctx.createBiquadFilter();
		const gain = this.ctx.createGain();
		filt.type = 'lowpass'; filt.frequency.value = 300;
		gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);
		src.buffer = buf;
		src.connect(filt); filt.connect(gain); gain.connect(this.master);
		src.start();
	}

	playLevelUp() {
		if (!this.ready) return;
		[523, 659, 784, 1047].forEach((freq, i) => {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			const t = this.ctx.currentTime + i * 0.12;
			osc.type = 'sine'; osc.frequency.value = freq;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
			osc.connect(gain); gain.connect(this.master);
			osc.start(t); osc.stop(t + 0.55);
		});
	}

	playWarning() {
		if (!this.ready) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth'; osc.frequency.value = 220;
		gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
		osc.connect(gain); gain.connect(this.master);
		osc.start(); osc.stop(this.ctx.currentTime + 0.35);
	}
}

// ===========================================================================
// BOOT SCENE
// ===========================================================================
class BootScene extends Phaser.Scene {
	constructor() { super({ key: 'BootScene' }); }

	create() {
		const pal = normalizePalette(window.FreshPlay.getCurrentPalette());
		generateTextures(this, pal);
		this.scene.start('MenuScene');
	}
}

// ===========================================================================
// MENU SCENE
// ===========================================================================
class MenuScene extends Phaser.Scene {
	constructor() { super({ key: 'MenuScene' }); }

	create() {
		const W = this.scale.width, H = this.scale.height;
		const pal = normalizePalette(window.FreshPlay.getCurrentPalette());
		const isSmall = W < 500;

		// Background
		this.add.image(W / 2, H / 2, 'bg_tile').setDisplaySize(W, H);

		// Animated depth particles
		this._menuParticles = [];
		for (let i = 0; i < 35; i++) {
			const p = this.add.image(
				Phaser.Math.Between(0, W),
				Phaser.Math.Between(0, H),
				'particle'
			).setScale(Phaser.Math.FloatBetween(0.15, 0.6))
				.setAlpha(Phaser.Math.FloatBetween(0.08, 0.35))
				.setTint(0x00a0cc);
			this._menuParticles.push({ img: p, speed: Phaser.Math.FloatBetween(15, 45), drift: Phaser.Math.FloatBetween(-8, 8) });
		}

		// Vignette overlay
		const vignette = this.add.graphics().setDepth(2);
		const vigGrad = vignette;
		vigGrad.fillStyle(0x000000, 0);
		vigGrad.fillRect(0, 0, W, H);
		// Top and bottom dark overlays
		vigGrad.fillGradientStyle(0x000810, 0x000810, 0x000810, 0x000810, 0.7, 0.7, 0, 0);
		vigGrad.fillRect(0, 0, W, H * 0.15);
		vigGrad.fillGradientStyle(0x000810, 0x000810, 0x000810, 0x000810, 0, 0, 0.8, 0.8);
		vigGrad.fillRect(0, H * 0.85, W, H * 0.15);

		// Submarine preview
		const subPreview = this.add.image(W / 2, H * 0.5, 'submarine').setScale(1.5).setAlpha(0.2).setDepth(1);
		this.tweens.add({ targets: subPreview, y: H * 0.5 + 8, yoyo: true, repeat: -1, duration: 2500, ease: 'Sine.InOut' });

		// Title
		const titleSize = isSmall ? Math.floor(W * 0.1) : Math.floor(W * 0.08);
		const title = this.add.text(W / 2, H * 0.22, 'DEEP DIVE', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: titleSize + 'px',
			fontStyle: 'bold',
			color: '#e8fbff',
			stroke: '#005580',
			strokeThickness: 3,
			shadow: { offsetX: 0, offsetY: 0, color: '#00e5ff', blur: 40, fill: true },
		}).setOrigin(0.5).setDepth(10);

		this.tweens.add({ targets: title, y: H * 0.22 - 4, yoyo: true, repeat: -1, duration: 3000, ease: 'Sine.InOut' });

		// Subtitle
		const subSize = isSmall ? Math.floor(W * 0.028) : Math.floor(W * 0.02);
		this.add.text(W / 2, H * 0.32, 'S U R V I V E   T H E   A B Y S S', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: subSize + 'px',
			color: '#00b8d8',
			alpha: 0.6,
		}).setOrigin(0.5).setDepth(10);

		// Controls hint
		const hintText = IS_TOUCH ? 'TOUCH & DRAG TO STEER' : 'ARROW KEYS / A-D TO STEER';
		const hintSize = isSmall ? Math.floor(W * 0.025) : Math.floor(W * 0.018);
		this.add.text(W / 2, H * 0.42, hintText, {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: hintSize + 'px',
			color: '#1a6080',
			alpha: 0.7,
		}).setOrigin(0.5).setDepth(10);

		this.add.text(W / 2, H * 0.47, 'COLLECT O₂  •  DODGE MONSTERS  •  DESCEND', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: Math.max(9, hintSize - 2) + 'px',
			color: '#0d4060',
			alpha: 0.7,
		}).setOrigin(0.5).setDepth(10);

		// Start button — glowing panel
		const btnW = isSmall ? 200 : 260;
		const btnH = isSmall ? 50 : 58;
		const btnY = H * 0.62;
		const btnBg = this.add.graphics().setDepth(10);

		// Button glow
		btnBg.fillStyle(0x003848, 0.9);
		btnBg.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 14);
		btnBg.lineStyle(2, 0x00c8e8, 0.8);
		btnBg.strokeRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 14);

		// Outer glow ring
		const glowBg = this.add.graphics().setDepth(9);
		glowBg.fillStyle(0x00a0cc, 0.08);
		glowBg.fillRoundedRect(W / 2 - btnW / 2 - 6, btnY - btnH / 2 - 6, btnW + 12, btnH + 12, 18);
		this.tweens.add({ targets: glowBg, alpha: 0.3, yoyo: true, repeat: -1, duration: 1200 });

		const startSize = isSmall ? Math.floor(W * 0.04) : Math.floor(W * 0.03);
		const startBtn = this.add.text(W / 2, btnY, '▼  DESCEND  ▼', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: startSize + 'px',
			fontStyle: 'bold',
			color: '#00e5ff',
		}).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

		this.tweens.add({ targets: startBtn, alpha: 0.5, yoyo: true, repeat: -1, duration: 1100 });

		// Depth indicator decoration
		const depthDecor = this.add.text(W / 2, H * 0.78, '── DEPTH: 0m ──', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: Math.max(9, isSmall ? 10 : 12) + 'px',
			color: '#0d3050',
		}).setOrigin(0.5).setDepth(10);

		// Animated depth counter
		let fakeDepth = 0;
		this.time.addEvent({
			delay: 50, loop: true, callback: () => {
				fakeDepth += Phaser.Math.Between(2, 8);
				if (fakeDepth > 9999) fakeDepth = 0;
				depthDecor.setText(`── DEPTH: ${fakeDepth}m ──`);
			}
		});

		// Bottom credits
		this.add.text(W / 2, H * 0.93, 'FRESHPLAY ARCADE', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: Math.max(8, isSmall ? 9 : 10) + 'px',
			color: '#0a2030',
			letterSpacing: 4,
		}).setOrigin(0.5).setDepth(10);

		// Input handlers
		const startGame = () => {
			this.scene.start('GameScene');
		};

		startBtn.on('pointerdown', startGame);
		this.input.keyboard.once('keydown', startGame);

		// Touch anywhere hint for mobile
		if (IS_TOUCH) {
			const tapHint = this.add.text(W / 2, H * 0.87, 'TAP ANYWHERE TO START', {
				fontFamily: "'Share Tech Mono', monospace",
				fontSize: Math.max(10, isSmall ? 11 : 12) + 'px',
				color: '#0d4060',
			}).setOrigin(0.5).setDepth(10);
			this.tweens.add({ targets: tapHint, alpha: 0.2, yoyo: true, repeat: -1, duration: 800 });

			this.input.once('pointerdown', startGame);
		}
	}

	update(_, delta) {
		const W = this.scale.width, H = this.scale.height;
		this._menuParticles.forEach(p => {
			p.img.y -= p.speed * (delta / 1000);
			p.img.x += p.drift * (delta / 1000);
			if (p.img.y < -20) { p.img.y = H + 20; p.img.x = Phaser.Math.Between(0, W); }
		});
	}
}

// ===========================================================================
// GAME SCENE
// ===========================================================================
class GameScene extends Phaser.Scene {
	constructor() { super({ key: 'GameScene' }); }

	create() {
		const W = this.scale.width, H = this.scale.height;
		this.W = W; this.H = H;
		this.pal = normalizePalette(window.FreshPlay.getCurrentPalette());
		this._isSmall = W < 500;
		this._scale = Math.min(W, H) / 600;

		// Audio
		this.audio = new AudioEngine();
		this.audio.resume();
		this.audio.startAmbient();
		this.audio.playPing();

		// State
		this.level = 1;
		this.depth = 0;
		this.o2 = MAX_O2;
		this.scrollSpeed = BASE_SCROLL_SPEED;
		this.o2DrainRate = BASE_O2_DRAIN;
		this.spawnInterval = BASE_SPAWN_RATE;
		this.isDead = false;
		this.isPaused = false;
		this.isLevelingUp = false;
		this.warningPlayed = 0;

		// Background scrolling
		this._bg1 = this.add.tileSprite(W / 2, H / 2, W, H, 'bg_tile');

		// Deep-water fog layers
		this._fogLayer1 = this.add.graphics().setDepth(1).setAlpha(0.04);
		this._fogLayer2 = this.add.graphics().setDepth(2).setAlpha(0.03);
		this._fogTime = 0;

		// Ambient particle emitter
		this._ambientBubbles = [];
		this._spawnAmbientBubbles();

		// Groups
		this.rocksGroup = this.add.group();
		this.monstersGroup = this.add.group();
		this.bubblesGroup = this.add.group();

		// Headlight beam (beneath sub)
		this._headlight = this.add.image(W / 2, H * 0.42 + 30, 'headlight').setDepth(8).setAlpha(0.5);

		// Submarine
		this.sub = this.add.image(W / 2, H * 0.42, 'submarine').setDepth(10);
		this._subTilt = 0;
		this._propAngle = 0;

		// Thruster particles
		this._thrusterParticles = [];

		// ── TOUCH INPUT (mobile-first) ──
		this._touchActive = false;
		this._touchTargetX = null;

		// Direct touch/pointer control — works on both mobile and desktop
		this.input.on('pointerdown', (ptr) => {
			this._touchActive = true;
			this._touchTargetX = ptr.x;
			this.audio.resume();
		});
		this.input.on('pointermove', (ptr) => {
			if (ptr.isDown || this._touchActive) {
				this._touchTargetX = ptr.x;
			}
		});
		this.input.on('pointerup', () => {
			this._touchActive = false;
			this._touchTargetX = null;
		});

		// Keyboard input
		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({
			left: Phaser.Input.Keyboard.KeyCodes.A,
			right: Phaser.Input.Keyboard.KeyCodes.D,
			up: Phaser.Input.Keyboard.KeyCodes.W,
			down: Phaser.Input.Keyboard.KeyCodes.S,
		});

		// Spawn timers
		this._monsterTimer = this.time.addEvent({ delay: this.spawnInterval, callback: this._spawnMonster, callbackScope: this, loop: true });
		this._rockTimer = this.time.addEvent({ delay: 1400, callback: this._spawnRock, callbackScope: this, loop: true });
		this._bubbleTimer = this.time.addEvent({ delay: 1200, callback: this._spawnO2Bubble, callbackScope: this, loop: true });
		this._pingTimer = this.time.addEvent({ delay: 3500, callback: () => this.audio.playPing(), callbackScope: this, loop: true });

		// Distortion overlay
		this._warpTime = 0;
		this._redFlash = this.add.graphics().setDepth(55).setAlpha(0);

		// HUD
		this._buildHUD();

		// Depth milestone ping
		this._lastPingDepth = 0;

		// Scanline overlay (subtle CRT feel)
		const slGfx = this.add.graphics().setDepth(60).setAlpha(0.015);
		for (let y = 0; y < H; y += 3) {
			slGfx.lineStyle(1, 0x000000, 1);
			slGfx.lineBetween(0, y, W, y);
		}

		// Vignette
		const vigGfx = this.add.graphics().setDepth(58);
		// Top
		vigGfx.fillGradientStyle(0x000810, 0x000810, 0x000810, 0x000810, 0.5, 0.5, 0, 0);
		vigGfx.fillRect(0, 0, W, H * 0.08);
		// Bottom
		vigGfx.fillGradientStyle(0x000810, 0x000810, 0x000810, 0x000810, 0, 0, 0.6, 0.6);
		vigGfx.fillRect(0, H * 0.88, W, H * 0.12);

		// Touch guide (shows briefly on mobile)
		if (IS_TOUCH) {
			const touchGuide = this.add.text(W / 2, H * 0.85, 'TOUCH & DRAG TO STEER', {
				fontFamily: "'Share Tech Mono', monospace",
				fontSize: Math.max(10, Math.floor(W * 0.025)) + 'px',
				color: '#1a5070',
			}).setOrigin(0.5).setDepth(61);
			this.tweens.add({ targets: touchGuide, alpha: 0, duration: 4000, delay: 2000, onComplete: () => touchGuide.destroy() });
		}
	}

	// HUD construction
	_buildHUD() {
		const W = this.W, H = this.H;
		const pal = this.pal;
		const pCol = toHexInt(pal.playerCore);
		const fCol = toHexInt(pal.fxAccent);
		const s = this._isSmall;
		const scale = this._scale;

		// HUD panel sizing (responsive)
		const hudW = s ? 140 : 180;
		const hudH = s ? 95 : 115;
		const pad = s ? 8 : 12;

		// HUD panel BG
		const hudBg = this.add.graphics().setDepth(40);
		hudBg.fillStyle(0x0a1e30, 0.88);
		hudBg.fillRoundedRect(pad, pad, hudW, hudH, 10);
		hudBg.lineStyle(1, pCol, 0.5);
		hudBg.strokeRoundedRect(pad, pad, hudW, hudH, 10);

		// Subtle inner glow
		hudBg.fillStyle(pCol, 0.03);
		hudBg.fillRoundedRect(pad + 1, pad + 1, hudW - 2, hudH - 2, 9);

		const textX = pad + 8;
		const labelSize = s ? '8px' : '10px';
		const valueSize = s ? '18px' : '24px';

		// Depth label
		this._depthLabel = this.add.text(textX, pad + 6, 'DEPTH', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: labelSize,
			color: '#00a0c0',
		}).setDepth(41);

		this._depthText = this.add.text(textX, pad + (s ? 16 : 20), '0 m', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: valueSize,
			fontStyle: 'bold',
			color: '#d0f4ff',
		}).setDepth(41);

		// Level
		this._levelText = this.add.text(pad + hudW - 8, pad + 6, 'LVL 1', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: s ? '9px' : '11px',
			fontStyle: 'bold',
			color: '#00c8e8',
		}).setOrigin(1, 0).setDepth(41);

		// O2 label
		this.add.text(textX, pad + (s ? 40 : 50), 'O₂  SUPPLY', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: s ? '7px' : '9px',
			color: pal.fxAccent,
		}).setDepth(41);

		// O2 bar
		const barX = textX;
		const barY = pad + (s ? 50 : 64);
		const barW = hudW - 22;
		const barH = s ? 8 : 10;

		const barBg = this.add.graphics().setDepth(41);
		barBg.fillStyle(0x081828, 0.95);
		barBg.fillRoundedRect(barX, barY, barW, barH, 5);
		barBg.lineStyle(1, fCol, 0.4);
		barBg.strokeRoundedRect(barX, barY, barW, barH, 5);

		this._o2BarGfx = this.add.graphics().setDepth(42);
		this._o2BarMeta = { x: barX, y: barY, w: barW, h: barH };

		// O2 percentage
		this._o2Text = this.add.text(textX, barY + barH + 3, '100%', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: s ? '8px' : '10px',
			color: pal.fxAccent,
		}).setDepth(42);

		// Score HUD (top right)
		const scoreW = s ? 110 : 140;
		const scoreH = s ? 42 : 52;
		const scoreX = W - scoreW - pad;

		const scoreHudBg = this.add.graphics().setDepth(40);
		scoreHudBg.fillStyle(0x0a1e30, 0.88);
		scoreHudBg.fillRoundedRect(scoreX, pad, scoreW, scoreH, 10);
		scoreHudBg.lineStyle(1, pCol, 0.5);
		scoreHudBg.strokeRoundedRect(scoreX, pad, scoreW, scoreH, 10);
		scoreHudBg.fillStyle(pCol, 0.03);
		scoreHudBg.fillRoundedRect(scoreX + 1, pad + 1, scoreW - 2, scoreH - 2, 9);

		this.add.text(scoreX + 8, pad + 6, 'SCORE', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: labelSize,
			color: '#00a0c0',
		}).setDepth(41);

		this._scoreText = this.add.text(scoreX + 8, pad + (s ? 18 : 22), '0', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: s ? '14px' : '18px',
			fontStyle: 'bold',
			color: '#d0f4ff',
		}).setDepth(41);

		this._updateO2Bar();
	}

	_updateO2Bar() {
		const { x, y, w, h } = this._o2BarMeta;
		const pct = Math.max(0, this.o2 / MAX_O2);
		const isLow = this.o2 < 25;
		const fCol = isLow ? 0xff3c3c : toHexInt(this.pal.fxAccent);

		this._o2BarGfx.clear();
		this._o2BarGfx.fillStyle(fCol, 0.85);
		this._o2BarGfx.fillRoundedRect(x, y, Math.max(0, w * pct), h, 5);

		// Glow when low
		if (isLow) {
			const glow = 0.3 + 0.3 * Math.sin(Date.now() / 180);
			this._o2BarGfx.fillStyle(0xff0000, glow * 0.2);
			this._o2BarGfx.fillRoundedRect(x - 2, y - 2, Math.max(0, w * pct + 4), h + 4, 6);
		}

		this._o2Text.setText(Math.ceil(this.o2) + '%');
		this._o2Text.setColor(isLow ? '#ff3c3c' : this.pal.fxAccent);
	}

	// Spawners
	_spawnMonster() {
		if (this.isLevelingUp || this.isDead) return;
		const W = this.W, H = this.H;
		const fromLeft = Math.random() < 0.5;
		const mon = this.add.image(
			fromLeft ? -80 : W + 80,
			Phaser.Math.Between(H * 0.15, H * 0.85),
			'monster'
		).setDepth(8).setScale(Phaser.Math.FloatBetween(0.6, 1.1));

		if (!fromLeft) mon.setFlipX(true);

		const speed = (this.scrollSpeed * 0.55 + Phaser.Math.Between(20, 50)) * (fromLeft ? 1 : -1);
		mon._vx = speed;
		mon._vy = Phaser.Math.FloatBetween(-40, 40);
		this.tweens.add({ targets: mon, alpha: 0.6, yoyo: true, repeat: -1, duration: Phaser.Math.Between(400, 900) });
		this.monstersGroup.add(mon);
	}

	_spawnRock() {
		if (this.isLevelingUp || this.isDead) return;
		const W = this.W, H = this.H;
		const side = Math.random() < 0.5;
		const rock = this.add.image(
			side ? Phaser.Math.Between(20, W * 0.3) : Phaser.Math.Between(W * 0.7, W - 20),
			H + 80,
			'rock'
		).setDepth(7).setScale(Phaser.Math.FloatBetween(0.5, 1.3));

		rock._speed = this.scrollSpeed;
		this.rocksGroup.add(rock);
	}

	_spawnO2Bubble() {
		if (this.isLevelingUp || this.isDead) return;
		const W = this.W, H = this.H;
		const bub = this.add.image(
			Phaser.Math.Between(W * 0.1, W * 0.9),
			H + 30,
			'bubble'
		).setDepth(9).setScale(Phaser.Math.FloatBetween(0.55, 1.05));

		bub._speed = this.scrollSpeed * Phaser.Math.FloatBetween(0.75, 1.05);
		const baseScale = bub.scaleX;
		this.tweens.add({
			targets: bub,
			scaleX: baseScale * 1.12,
			scaleY: baseScale * 1.12,
			yoyo: true,
			repeat: -1,
			duration: 700 + Math.random() * 400
		});
		this.bubblesGroup.add(bub);
	}

	_spawnAmbientBubbles() {
		const W = this.W, H = this.H;
		for (let i = 0; i < 15; i++) {
			const b = this.add.image(
				Phaser.Math.Between(0, W),
				Phaser.Math.Between(0, H),
				'particle'
			).setScale(Phaser.Math.FloatBetween(0.15, 0.7))
				.setAlpha(Phaser.Math.FloatBetween(0.04, 0.18))
				.setDepth(3)
				.setTint(0x00a8d0);
			this._ambientBubbles.push({
				img: b,
				vy: -Phaser.Math.FloatBetween(12, 45),
				vx: Phaser.Math.FloatBetween(-5, 5),
			});
		}
	}

	// Collision
	_overlaps(a, b, radiusMult = 0.85) {
		const ar = ((a.displayWidth + a.displayHeight) / 4) * radiusMult;
		const br = ((b.displayWidth + b.displayHeight) / 4) * radiusMult;
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy) < ar + br;
	}

	// Level-up
	_triggerLevelUp() {
		this.isLevelingUp = true;
		this._monsterTimer.paused = true;
		this._rockTimer.paused = true;
		this.audio.playLevelUp();

		const W = this.W, H = this.H;
		const s = this._isSmall;
		const overlay = this.add.graphics().setDepth(60).setAlpha(0);
		overlay.fillStyle(0x00e5ff, 0.1);
		overlay.fillRect(0, 0, W, H);
		this.tweens.add({ targets: overlay, alpha: 1, yoyo: true, duration: 500, onComplete: () => overlay.destroy() });

		const txtSize = s ? Math.floor(W * 0.06) : Math.floor(W * 0.05);
		const txt = this.add.text(W / 2, H / 2, `DEPTH ${this.level * DEPTH_PER_LEVEL}m\nLEVEL ${this.level + 1}`, {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: txtSize + 'px',
			fontStyle: 'bold',
			color: '#00e5ff',
			align: 'center',
			stroke: '#001020',
			strokeThickness: 3,
			shadow: { offsetX: 0, offsetY: 0, color: '#00e5ff', blur: 30, fill: true },
			lineSpacing: 12,
		}).setOrigin(0.5).setDepth(70).setAlpha(0);

		this.tweens.add({
			targets: txt, alpha: 1, duration: 400,
			onComplete: () => {
				window.FreshPlay.levelComplete(() => {
					this.tweens.add({
						targets: txt, alpha: 0, duration: 400, delay: 800,
						onComplete: () => {
							txt.destroy();
							this.level++;
							this.scrollSpeed += SPEED_INCREMENT;
							this.o2DrainRate += O2_DRAIN_INC;
							this.spawnInterval = Math.max(600, this.spawnInterval - SPAWN_RATE_DEC);
							this._monsterTimer.reset({ delay: this.spawnInterval, callback: this._spawnMonster, callbackScope: this, loop: true });
							const newRockDelay = Math.max(700, 1400 - (this.level - 1) * 80);
							this._rockTimer.reset({ delay: newRockDelay, callback: this._spawnRock, callbackScope: this, loop: true });
							this._monsterTimer.paused = false;
							this._rockTimer.paused = false;
							this.isLevelingUp = false;
							this._levelText.setText('LVL ' + this.level);
						}
					});
				});
			}
		});
	}

	// Game Over
	_triggerGameOver(reason) {
		if (this.isDead) return;
		this.isDead = true;
		this._gameOverReported = false;

		this.audio.stopAmbient();
		this.audio.playExplosion();

		if (!this.revived) {
			this._monsterTimer.paused = true;
			this._rockTimer.paused = true;
			this._bubbleTimer.paused = true;
			this._pingTimer.paused = true;
		} else {
			this._monsterTimer.remove();
			this._rockTimer.remove();
			this._bubbleTimer.remove();
			this._pingTimer.remove();
		}

		// Flash
		this._redFlash.clear();
		this._redFlash.fillStyle(0xff0000, 0.5);
		this._redFlash.fillRect(0, 0, this.W, this.H);
		this.tweens.add({ targets: this._redFlash, alpha: 0, duration: 900 });

		if (!this.revived) {
			this.revived = true;
			const cx = this.W / 2, cy = this.H / 2;
			const rBg = this.add.graphics().setDepth(200);
			rBg.fillStyle(0x000000, 0.85);
			rBg.fillRoundedRect(cx - 150, cy - 80, 300, 160, 12);
			rBg.lineStyle(2, 0x00e5ff, 1);
			rBg.strokeRoundedRect(cx - 150, cy - 80, 300, 160, 12);

			const rTxt = this.add.text(cx, cy - 40, 'SECOND CHANCE?', {
				fontFamily: "'Orbitron', sans-serif", fontSize: '20px', color: '#00e5ff'
			}).setOrigin(0.5).setDepth(201);

			const btnRevive = this.add.text(cx - 70, cy + 30, 'WATCH AD\nTO REVIVE', {
				fontFamily: "'Share Tech Mono', monospace", fontSize: '14px', color: '#00e5ff', align: 'center',
				backgroundColor: 0xc4e2f5, padding: {x: 10, y: 10}
			}).setOrigin(0.5).setDepth(201).setInteractive({useHandCursor: true});
			btnRevive.setStroke('#00c8e8', 1);

			const btnSkip = this.add.text(cx + 70, cy + 30, 'SKIP', {
				fontFamily: "'Share Tech Mono', monospace", fontSize: '16px', color: '#00234f',
				backgroundColor: 0xc4e2f5, padding: {x: 20, y: 16}
			}).setOrigin(0.5).setDepth(201).setInteractive({useHandCursor: true});

			const cleanUpRevive = () => {
				rBg.destroy(); rTxt.destroy(); btnRevive.destroy(); btnSkip.destroy();
			};

			btnSkip.on('pointerdown', () => {
				cleanUpRevive();
				this.isDead = false; // Temporarily unset so _triggerGameOver works
				this._triggerGameOver('skip');
			});

			btnRevive.on('pointerdown', () => {
				cleanUpRevive();
				const doRevive = () => {
					this.isDead = false;
					this.o2 = 100;
					// clear obstacles
					this.monsters.forEach(m => m.sprite.destroy()); this.monsters = [];
					this.rocks.forEach(r => r.sprite.destroy()); this.rocks = [];
					// unpause timers
					this._monsterTimer.paused = false;
					this._rockTimer.paused = false;
					this._bubbleTimer.paused = false;
					this._pingTimer.paused = false;
					
					this.cameras.main.flash(400, 0, 255, 0, true);
					this.audio.playAmbient();
				};

				if (window.FreshPlay && typeof window.FreshPlay.showVideoAd === 'function') {
					window.FreshPlay.showVideoAd(doRevive);
				} else {
					doRevive();
				}
			});
			return;
		}
		this._redFlash.fillStyle(0xff0000, 0.5);
		this._redFlash.fillRect(0, 0, this.W, this.H);
		this.tweens.add({ targets: this._redFlash, alpha: 0, duration: 900 });

		const score = Math.floor(this.depth);
		const W = this.W, H = this.H;
		const s = this._isSmall;

		// Death panel
		const panelW = s ? 260 : 340;
		const panelH = s ? 220 : 260;

		const panel = this.add.graphics().setDepth(80);
		// Background
		panel.fillStyle(0x040e18, 0.95);
		panel.fillRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 16);
		// Border glow
		panel.lineStyle(2, 0xff3c3c, 0.6);
		panel.strokeRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 16);
		// Inner glow
		panel.fillStyle(0xff3c3c, 0.03);
		panel.fillRoundedRect(W / 2 - panelW / 2 + 2, H / 2 - panelH / 2 + 2, panelW - 4, panelH - 4, 14);

		const topY = H / 2 - panelH / 2;

		this.add.text(W / 2, topY + (s ? 28 : 35), 'CRUSHED BY THE DEEP', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: s ? '11px' : '14px',
			fontStyle: 'bold',
			color: '#ff4444',
			shadow: { offsetX: 0, offsetY: 0, color: '#ff0000', blur: 15, fill: true },
		}).setOrigin(0.5).setDepth(81);

		this.add.text(W / 2, topY + (s ? 56 : 72), 'DEPTH REACHED', {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: s ? '9px' : '11px',
			color: '#00a0c0',
			alpha: 0.7,
		}).setOrigin(0.5).setDepth(81);

		this.add.text(W / 2, topY + (s ? 80 : 105), `${score} m`, {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: s ? '28px' : '38px',
			fontStyle: 'bold',
			color: '#d0f4ff',
			shadow: { offsetX: 0, offsetY: 0, color: '#00e5ff', blur: 20, fill: true },
		}).setOrigin(0.5).setDepth(81);

		this.add.text(W / 2, topY + (s ? 110 : 140), `LEVEL ${this.level}  •  SCORE ${Math.floor(score + this.level * 500)}`, {
			fontFamily: "'Share Tech Mono', monospace",
			fontSize: s ? '9px' : '12px',
			color: '#00a0c0',
		}).setOrigin(0.5).setDepth(81);

		// Separator line
		const sepY = topY + (s ? 128 : 162);
		const sepPanel = this.add.graphics().setDepth(81);
		sepPanel.lineStyle(1, 0x1a3050, 0.5);
		sepPanel.lineBetween(W / 2 - panelW / 2 + 20, sepY, W / 2 + panelW / 2 - 20, sepY);

		// Restart button
		const btnY = topY + (s ? 158 : 195);
		const btnW2 = s ? 160 : 200;
		const btnH2 = s ? 36 : 44;

		const restartBg = this.add.graphics().setDepth(81);
		restartBg.fillStyle(0x003040, 0.85);
		restartBg.fillRoundedRect(W / 2 - btnW2 / 2, btnY - btnH2 / 2, btnW2, btnH2, 10);
		restartBg.lineStyle(1.5, 0x00c8e8, 0.6);
		restartBg.strokeRoundedRect(W / 2 - btnW2 / 2, btnY - btnH2 / 2, btnW2, btnH2, 10);

		const restartBtn = this.add.text(W / 2, btnY, '▼ DIVE AGAIN ▼', {
			fontFamily: "'Orbitron', sans-serif",
			fontSize: s ? '11px' : '14px',
			fontStyle: 'bold',
			color: '#00e5ff',
		}).setOrigin(0.5).setDepth(82).setInteractive({ useHandCursor: true });

		this.tweens.add({ targets: restartBtn, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

		const _doGameOver = () => {
			if (!this._gameOverReported) { this._gameOverReported = true; window.FreshPlay.gameOver(score); }
			this.scene.start('GameScene');
		};

		restartBtn.on('pointerdown', _doGameOver);
		this.input.keyboard.once('keydown', _doGameOver);

		this.time.delayedCall(1200, () => {
			if (!this._gameOverReported) { this._gameOverReported = true; window.FreshPlay.gameOver(score); }
		});
	}

	// Thruster particles
	_emitThruster() {
		const sub = this.sub;
		for (let i = 0; i < 2; i++) {
			const p = this.add.image(
				sub.x - sub.displayWidth * 0.35 + Phaser.Math.Between(-3, 3),
				sub.y + Phaser.Math.Between(-3, 3),
				'particle'
			).setScale(0.3 + Math.random() * 0.2).setAlpha(0.6).setDepth(9).setTint(0x40d8ff);
			this._thrusterParticles.push({
				img: p,
				life: 350,
				vx: -Phaser.Math.FloatBetween(40, 90),
				vy: Phaser.Math.FloatBetween(-15, 15),
			});
		}
	}

	// Main Update
	update(_, delta) {
		if (this.isDead || this.isLevelingUp) return;
		const dt = delta / 1000;
		const W = this.W, H = this.H;
		this._warpTime += delta;

		// Background scroll
		this._bg1.tilePositionY -= this.scrollSpeed * dt * 0.18;

		// Fog animation
		this._fogTime += delta;
		if (Math.floor(this._fogTime / 2000) !== Math.floor((this._fogTime - delta) / 2000)) {
			this._fogLayer1.clear();
			this._fogLayer1.fillStyle(0x00405a, 0.15);
			const fogY = (this._fogTime * 0.01) % H;
			this._fogLayer1.fillRect(0, fogY - 50, W, 100);
		}

		// Ambient bubbles
		this._ambientBubbles.forEach(b => {
			b.img.y += b.vy * dt;
			b.img.x += b.vx * dt;
			if (b.img.y < -10) {
				b.img.y = H + 10;
				b.img.x = Phaser.Math.Between(0, W);
			}
			if (b.img.x < -10) b.img.x = W + 10;
			if (b.img.x > W + 10) b.img.x = -10;
		});

		// ── Submarine steering ──
		const leftDown = this.cursors.left.isDown || this.wasd.left.isDown;
		const rightDown = this.cursors.right.isDown || this.wasd.right.isDown;
		const upDown = this.cursors.up.isDown || (this.wasd.up && this.wasd.up.isDown);
		const downDown = this.cursors.down.isDown || (this.wasd.down && this.wasd.down.isDown);
		let moveX = 0;
		let moveY = 0;

		if (leftDown) moveX = -1;
		if (rightDown) moveX = 1;
		if (upDown) moveY = -1;
		if (downDown) moveY = 1;

		// Touch/pointer control
		if (this._touchActive && this._touchTargetX !== null) {
			const diff = this._touchTargetX - this.sub.x;
			if (Math.abs(diff) > 12) {
				moveX = diff > 0 ? 1 : -1;
				// Proportional speed for smoother control
				const proportion = Math.min(1, Math.abs(diff) / (W * 0.2));
				moveX *= proportion;
			}
		}

		const subSpeed = 280 + this.level * 15;
		const margin = 30;
		this.sub.x = Phaser.Math.Clamp(this.sub.x + moveX * subSpeed * dt, margin, W - margin);
		this.sub.y = Phaser.Math.Clamp(this.sub.y + moveY * subSpeed * 0.6 * dt, H * 0.1, H * 0.85);

		// Tilt
		const targetTilt = Phaser.Math.Clamp(moveX, -1, 1) * 0.22;
		this._subTilt += (targetTilt - this._subTilt) * 5 * dt;
		this.sub.rotation = this._subTilt;

		// Headlight follows sub
		this._headlight.x = this.sub.x;
		this._headlight.y = this.sub.y + this.sub.displayHeight * 0.5;
		this._headlight.rotation = this.sub.rotation;
		// Flicker headlight subtly
		this._headlight.setAlpha(0.35 + 0.1 * Math.sin(this._warpTime * 0.003));

		// Thruster
		this._propAngle += delta * 0.02;
		if (Math.random() < 0.45) this._emitThruster();

		// Update thruster particles
		for (let i = this._thrusterParticles.length - 1; i >= 0; i--) {
			const p = this._thrusterParticles[i];
			p.life -= delta;
			p.img.x += p.vx * dt;
			p.img.y += p.vy * dt;
			p.img.setAlpha(Math.max(0, (p.life / 350) * 0.6));
			p.img.setScale(Math.max(0.05, 0.3 * (p.life / 350)));
			if (p.life <= 0) { p.img.destroy(); this._thrusterParticles.splice(i, 1); }
		}

		// Depth & scoring
		this.depth += this.scrollSpeed * dt * 0.25;
		this._depthText.setText(Math.floor(this.depth) + ' m');
		this._scoreText.setText(Math.floor(this.depth + this.level * 500));

		// Depth ping
		if (Math.floor(this.depth / 100) > this._lastPingDepth) {
			this._lastPingDepth = Math.floor(this.depth / 100);
			if (this._lastPingDepth % 2 === 0) this.audio.playPing();
		}

		// Level threshold
		if (this.depth >= this.level * DEPTH_PER_LEVEL) {
			this._triggerLevelUp();
			return;
		}

		// O2 depletion
		this.o2 -= this.o2DrainRate * dt;
		this.o2 = Math.max(0, this.o2);
		this._updateO2Bar();

		// Low O2 warning
		if (this.o2 < 25 && this.o2 > 0) {
			const warnTick = Math.floor(this.o2 / 8);
			if (warnTick !== this.warningPlayed) { this.warningPlayed = warnTick; this.audio.playWarning(); }
		}
		if (this.o2 <= 0) { this._triggerGameOver('oxygen'); return; }

		// Move obstacles
		this.rocksGroup.getChildren().forEach(rock => {
			rock.y -= rock._speed * dt;
			if (rock.y < -120) { rock.destroy(); this.rocksGroup.remove(rock, false, false); }
			if (this._overlaps(this.sub, rock, 0.6)) { this._triggerGameOver('rock'); }
		});

		this.monstersGroup.getChildren().forEach(mon => {
			mon.x += mon._vx * dt;
			mon.y += mon._vy * dt;
			mon.y -= this.scrollSpeed * dt * 0.15;
			if (mon.x < -160 || mon.x > W + 160 || mon.y < -120) {
				mon.destroy(); this.monstersGroup.remove(mon, false, false);
			}
			if (!this.isDead && this._overlaps(this.sub, mon, 0.5)) { this._triggerGameOver('monster'); }
		});

		this.bubblesGroup.getChildren().forEach(bub => {
			bub.y -= bub._speed * dt;
			if (bub.y < -40) { bub.destroy(); this.bubblesGroup.remove(bub, false, false); }
			if (this._overlaps(this.sub, bub, 0.8)) {
				this.audio.playBubblePop();
				this._popBubble(bub.x, bub.y);
				this.o2 = Math.min(MAX_O2, this.o2 + 18);
				bub.destroy();
				this.bubblesGroup.remove(bub, false, false);
			}
		});

		// Depth distortion effect
		if (this.level > 2) {
			const flicker = Math.sin(this._warpTime * 0.003) * 0.04;
			this._bg1.setAlpha(0.92 + flicker);
		}
	}

	// Bubble pop VFX
	_popBubble(x, y) {
		for (let i = 0; i < 10; i++) {
			const angle = (Math.PI * 2 / 10) * i;
			const p = this.add.image(x, y, 'particle')
				.setScale(0.4).setAlpha(0.85).setDepth(12)
				.setTint(toHexInt(this.pal.fxAccent));
			const spd = Phaser.Math.FloatBetween(50, 120);
			this.tweens.add({
				targets: p,
				x: x + Math.cos(angle) * spd,
				y: y + Math.sin(angle) * spd,
				alpha: 0,
				scaleX: 0,
				scaleY: 0,
				duration: 400,
				ease: 'Quad.Out',
				onComplete: () => p.destroy(),
			});
		}
		// Ring burst
		const ring = this.add.graphics().setDepth(12);
		ring.lineStyle(2, toHexInt(this.pal.fxAccent), 0.5);
		ring.strokeCircle(x, y, 5);
		this.tweens.add({
			targets: ring,
			alpha: 0,
			scaleX: 3,
			scaleY: 3,
			duration: 350,
			ease: 'Quad.Out',
			onComplete: () => ring.destroy(),
		});
	}

	// Scene shutdown
	shutdown() {
		if (this.audio) {
			this.audio.stopAmbient();
			try { if (this.audio.ctx) this.audio.ctx.close(); } catch (e) { }
		}
	}
}

// ===========================================================================
// Phaser Game config
// ===========================================================================
const config = {
	type: Phaser.AUTO,
	width: window.innerWidth,
	height: window.innerHeight,
	backgroundColor: 0xc4e2f5,
	parent: document.body,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	input: {
		activePointers: 3,
		touch: {
			capture: true,
		},
	},
	scene: [BootScene, MenuScene, GameScene],
};

// Export for host or run standalone
if (typeof module !== 'undefined' && module.exports) {
	module.exports = config;
} else {
	window.__DeepDiveConfig = config;
	window.addEventListener('DOMContentLoaded', () => {
		new Phaser.Game(config);
	});
}
