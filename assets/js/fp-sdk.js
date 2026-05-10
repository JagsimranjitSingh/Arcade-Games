/**
 * FreshPlay Arcade - Game SDK (Production v1.0)
 * Secure Parent/Iframe communication, Ad triggers, and Theme Management.
 */
class FreshPlaySDK {
	constructor() {
		this.currentLevel = 1;
		this.isMuted = false;

		// Dynamic 5-Color Hyper-Casual Palettes
		// Loops infinitely: Lvl 41 returns to Palette 0
		this.palettes = [
			{
				name: "The Classic Hacker (Lvl 1-5)",
				background: 0x0f0f0f, // Deep Obsidian (Muted)
				playerCore: 0x00ff00, // Matrix Green (High Contrast)
				hostile: 0xff0044, // Crimson Red (Danger)
				interface: 0xffffff, // Pure White (Readable text)
				fxAccent: 0x00ffff  // Cyan Glow (Particle effects)
			},
			{
				name: "Cyber Sunset (Lvl 6-10)",
				background: 0x1a0a1a, // Dark Indigo
				playerCore: 0x00e5ff, // Electric Blue
				hostile: 0xffaa00, // Warning Orange
				interface: 0xffffff, // Pure White
				fxAccent: 0xff00ff  // Neon Pink
			},
			{
				name: "Toxic Factory (Lvl 11-15)",
				background: 0x101a0f, // Murky Green
				playerCore: 0xffaa00, // Hazmat Yellow
				hostile: 0xaa00ff, // Radioactive Purple
				interface: 0xffffff, // Pure White
				fxAccent: 0x00ff00  // Slime Green
			},
			{
				name: "Vaporwave Dream (Lvl 16-20)",
				background: 0x0a1526, // Midnight Navy
				playerCore: 0xff00ff, // Hot Magenta
				hostile: 0x00ffff, // Ice Cyan
				interface: 0xffffff, // Pure White
				fxAccent: 0xffaa00  // Sunset Orange
			},
			{
				name: "Blood Moon (Lvl 21-25)",
				background: 0x1a0505, // Dark Maroon
				playerCore: 0xffffff, // Pure White
				hostile: 0xff0000, // Blood Red
				interface: 0xa1a1aa, // Slate Gray
				fxAccent: 0xff5500  // Hellfire Orange
			},
			{
				name: "Deep Ocean (Lvl 26-30)",
				background: 0x000a14, // Abyssal Blue
				playerCore: 0x00ffcc, // Bioluminescent Teal
				hostile: 0xff3366, // Coral Pink
				interface: 0xffffff, // Pure White
				fxAccent: 0x3366ff  // Current Blue
			},
			{
				name: "Golden Hour (Lvl 31-35)",
				background: 0x1a1300, // Dark Sepia
				playerCore: 0xffd700, // Pure Gold
				hostile: 0xcc00ff, // Royal Purple
				interface: 0xffffff, // Pure White
				fxAccent: 0xffffff  // Bright White
			},
			{
				name: "The Void (Lvl 36-40)",
				background: 0x000000, // Pitch Black
				playerCore: 0xffffff, // Pure White
				hostile: 0x333333, // Stealth Gray (Hard mode visibility)
				interface: 0x00ff00, // Matrix Green
				fxAccent: 0xff0000  // Laser Red
			}
		];
	}

	/**
	 * Executes when a player finishes a level.
	 * Securely messages the parent portal to handle the AdSense logic.
	 */
	levelComplete(callback) {
		this.currentLevel++;

		// SECURITY: Ensure we only message our own domain origin, preventing cross-site scripting
		const targetOrigin = window.location.origin;

		window.parent.postMessage({
			type: 'FP_LEVEL_COMPLETE',
			level: this.currentLevel
		}, targetOrigin);

		if (callback) callback();
	}

	/**
	 * Returns the exact 5-color palette for the current level.
	 */
	getCurrentPalette() {
		const paletteIndex = Math.floor((this.currentLevel - 1) / 5) % this.palettes.length;
		return this.palettes[paletteIndex];
	}

	/**
	 * Executes when the player dies/fails.
	 */
	gameOver(score) {
		const targetOrigin = window.location.origin;

		window.parent.postMessage({
			type: 'FP_GAME_OVER',
			finalScore: score
		}, targetOrigin);
	}
}

// Initialize the SDK globally so the Phaser game can access it
window.FreshPlay = new FreshPlaySDK();