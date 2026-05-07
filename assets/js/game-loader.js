document.addEventListener('DOMContentLoaded', () => {
	// 1. Secure URL Parsing for SEO (e.g., /game/neon-drift)
	let gameId = 'neon-drift'; // Default fallback
	const pathParts = window.location.pathname.split('/').filter(p => p);

	if (pathParts.length > 0 && pathParts[pathParts.length - 1] !== 'game.html') {
		gameId = pathParts[pathParts.length - 1].replace('.html', '');
	} else {
		// Fallback for local testing (e.g., game.html?id=neon-drift)
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.has('id')) gameId = urlParams.get('id');
	}

	const container = document.getElementById('game-hero-container');

	if (container) {
		fetch('/data/games.json')
			.then(response => response.json())
			.then(games => {
				const game = games.find(g => g.id === gameId);

				if (game) {
					// 2. Secure DOM Population (Prevent XSS using textContent)
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

					// 3. Play Button Interaction & Engine Injection
					const playBtn = document.getElementById('play-game-btn');
					const overlay = document.getElementById('game-start-overlay');
					const phaserContainer = document.getElementById('phaser-game-container');

					if (playBtn && overlay && phaserContainer) {
						playBtn.addEventListener('click', () => {
							// Hide overlay, show game container
							overlay.style.display = 'none';
							heroImg.style.display = 'none';
							phaserContainer.classList.remove('hidden');

							// Revenue Shuffle (Dynamic CDN injection)
							const cdnHosts = [
								'https://cdn1.freshplay-engine.net',
								'https://cdn2.freshplay-engine.net'
							];
							const host = cdnHosts[Math.floor(Math.random() * cdnHosts.length)];

							// Simulate engine load
							phaserContainer.innerHTML = `
                                <div class="flex flex-col items-center justify-center h-full w-full bg-black">
                                    <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00ff00] mb-4"></div>
                                    <p class="text-[#00ff00] font-mono text-xs tracking-widest uppercase">Connecting to ${host}...</p>
                                </div>
                            `;

							// Simulate game engine execution
							setTimeout(() => {
								phaserContainer.innerHTML = `
                                    <div class="text-center">
                                        <h2 class="text-3xl font-bold text-white font-liberation mb-2 uppercase">${game.title}</h2>
                                        <p class="text-[#00ff00] font-mono text-xs mb-6 uppercase">Engine Active</p>
                                        <button onclick="window.triggerInGameAd(3, () => alert('Game Resumed!'))" class="bg-[#27272a] text-white hover:text-[#00ff00] px-4 py-2 text-xs font-mono rounded">
                                            Simulate Level Completion (Ad Test)
                                        </button>
                                    </div>
                                `;
							}, 1500);
						});
					}
				} else {
					container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center bg-black"><p class="text-red-500 font-mono tracking-widest uppercase">ERROR: Game Core Not Found</p></div>';
				}
			})
			.catch(err => console.error("Error loading game data:", err));
	}
});