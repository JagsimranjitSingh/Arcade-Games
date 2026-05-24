// PORTAL_DOMAINS is already declared in main.js
// const PORTAL_DOMAINS = [
//     'https://mytopscore.com',
//     'https://noinstallgames.com',
//     'https://games365days.com',
//     'https://game360s.com',
//     'https://mygame360.com'
// ];

function getCanonicalDomain(gId) {
    let hash = 0;
    for (let i = 0; i < gId.length; i++) {
        hash = gId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PORTAL_DOMAINS[Math.abs(hash) % PORTAL_DOMAINS.length];
}

document.addEventListener('DOMContentLoaded', () => {
	let gameId = 'neon-blade-dash'; // Default to our new game
	const pathParts = window.location.pathname.split('/').filter(p => p);

	if (pathParts.includes('game')) {
		gameId = pathParts[pathParts.indexOf('game') + 1];
	} else if (pathParts.length > 0 && pathParts[pathParts.length - 1] !== 'play.html') {
		gameId = pathParts[pathParts.length - 1].replace('.html', '');
	} else {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.has('id')) gameId = urlParams.get('id');
	}

	// Domain enforcement removed to prevent infinite loops with GoDaddy 301 forwarding.
	// Users arriving from secondary domains will stay on the current domain.

	const container = document.getElementById('game-hero-container');

	if (container) {
		fetch('/data/games.json')
			.then(response => response.json())
			.then(games => {
				const game = games.find(g => g.id === gameId);

				if (game) {
					document.title = `${game.title} - FRESHPLAY ARCADE`;

					const setSafeText = (id, text) => {
						const el = document.getElementById(id);
						if (el) el.textContent = text;
					};

					setSafeText('hero-game-title', game.title);
					setSafeText('hero-game-desc', game.description);
					setSafeText('info-game-title', game.title);
					setSafeText('info-game-author', `By ${game.author || 'FreshPlay Studios'}`);
					setSafeText('info-game-desc', game.description);

					const heroImg = document.getElementById('game-hero-img');
					if (heroImg) heroImg.src = game.thumbnail_url;

					// Dynamically populate "How To Play"
					const howToPlayContainer = document.querySelector('#info-game-desc').parentElement.nextElementSibling.querySelector('ul');
					if (howToPlayContainer && game.how_to_play) {
						howToPlayContainer.innerHTML = game.how_to_play.map(instruction => `
                            <li class="flex items-center mb-3">
                                <div class="flex gap-1">
                                    ${instruction.keys.map(key => `<span class="text-[#00ff00] border border-[#3f3f46] bg-[#0f0f0f] px-2 py-1 rounded text-center tracking-widest text-xs">${key}</span>`).join('')}
                                </div>
                                <span class="uppercase text-[#52525b] ml-4 tracking-widest text-xs font-mono">${instruction.action}</span>
                            </li>
                        `).join('');
					}

					// Setup Iframe Injection
					const playBtn = document.getElementById('play-game-btn');
					const overlay = document.getElementById('game-start-overlay');
					const phaserContainer = document.getElementById('phaser-game-container');

					if (playBtn && overlay && phaserContainer && game.game_url) {
						playBtn.addEventListener('click', () => {
							overlay.style.display = 'none';
							heroImg.style.display = 'none';
							phaserContainer.classList.remove('hidden');

							// Inject Secure Iframe and FORCE FOCUS so the game loop starts
							phaserContainer.innerHTML = `
                                <iframe 
                                    id="freshplay-game-frame"
                                    src="${game.game_url}" 
                                    class="w-full h-full border-none"
                                    allow="autoplay; fullscreen"
                                    onload="this.contentWindow.focus()"
                                ></iframe>
                            `;
						});
					}
				} else {
					window.location.href = '/404';
				}
			})
			.catch(err => console.error("Error loading game data:", err));
	}

	// --- SDK Event Listener (Listens for Iframe Messages) ---
	window.addEventListener('message', (event) => {
		// Security check: Only accept messages from our own domain
		if (event.origin !== window.location.origin) return;

		const data = event.data;
		if (data && data.type) {
			if (data.type === 'FP_LEVEL_COMPLETE') {
				console.log(`[Portal] Level ${data.level} completed. Checking ad threshold...`);

				// Pause the iframe game
				const frame = document.getElementById('freshplay-game-frame');

				// Trigger the existing ad logic from main.js
				if (window.triggerInGameAd) {
					window.triggerInGameAd(data.level, () => {
						// Resume callback: You can send a message back to the iframe to unpause if needed
						console.log("[Portal] Ad finished. Resuming game.");
					});
				}
			}
			else if (data.type === 'FP_GAME_OVER') {
				console.log(`[Portal] Game Over. Score: ${data.finalScore}`);
				// In the future, this is where you'd save high scores to a database
			}
			else if (data.type === 'FP_SHOW_REWARD_AD') {
				console.log(`[Portal] Triggering reward ad...`);
				if (window.triggerRewardAd) {
					window.triggerRewardAd(() => {
						console.log("[Portal] Reward ad finished.");
						const frame = document.getElementById('freshplay-game-frame');
						if (frame && frame.contentWindow) {
							frame.contentWindow.postMessage({ type: 'FP_REWARD_AD_FINISHED' }, '*');
						}
					});
				}
			}
		}
	});
});
