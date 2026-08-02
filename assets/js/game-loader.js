
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
                                    ${instruction.keys.map(key => `<span class="text-[#00234f] border border-[#00234f] bg-[#c4e2f5] px-2 py-1 rounded text-center tracking-widest text-xs font-bold">${key}</span>`).join('')}
                                </div>
                                <span class="uppercase text-[#00234f] ml-4 tracking-widest text-xs font-mono font-bold">${instruction.action}</span>
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
                                    class="w-full h-full border-2 border-white rounded-lg box-border"
                                    allow="autoplay; fullscreen"
                                    onload="this.contentWindow.focus()"
                                ></iframe>
                            `;
						});
					}

					// --- SEO: Generate Dynamic Game Article ---
				const seoSection = document.getElementById('seo-game-article');
				const seoContent = document.getElementById('seo-article-content');
				if (seoSection && seoContent) {
					const keywords = (game.seo_keywords || []).join(', ');
					const category = game.category || 'Arcade';
					const title = game.title;
					const desc = game.description;
					const author = game.author || 'FreshPlay Studios';

					// Update page meta dynamically for this specific game
					document.title = `${title} — Play Free on FreshPlay Arcade`;
					const metaDesc = document.querySelector('meta[name="description"]');
					if (metaDesc) metaDesc.setAttribute('content', `Play ${title} for free on FreshPlay Arcade. ${desc} No downloads required — instant browser gaming.`);
					const canonical = document.querySelector('link[rel="canonical"]');
					if (canonical) canonical.setAttribute('href', `https://mytopscore.com/game/${game.id}`);
					const ogTitle = document.querySelector('meta[property="og:title"]');
					if (ogTitle) ogTitle.setAttribute('content', `${title} — FreshPlay Arcade`);
					const ogDesc = document.querySelector('meta[property="og:description"]');
					if (ogDesc) ogDesc.setAttribute('content', `Play ${title} free in your browser. ${desc}`);
					const ogUrl = document.querySelector('meta[property="og:url"]');
					if (ogUrl) ogUrl.setAttribute('content', `https://mytopscore.com/game/${game.id}`);

					// Build control instructions text
					const controlsText = game.how_to_play ? game.how_to_play.map(h => `${h.keys.join(' / ')} to ${h.action}`).join('; ') : 'Use your keyboard, mouse, or touchscreen';

					seoContent.innerHTML = `
						<h2 class="text-lg font-bold text-[#00234f] uppercase tracking-widest mb-6 font-liberation border-l-2 border-[#48d1cc] pl-4">${title} — Complete Game Guide & Review</h2>
						<div class="text-[#64748b] text-xs leading-relaxed space-y-4">
							<p><strong>${title}</strong> is a free-to-play browser game in the <strong>${category}</strong> category, developed by ${author} and available exclusively on FreshPlay Arcade. ${desc} Dive into this carefully crafted experience that combines intuitive controls with progressively challenging gameplay, all running natively in your web browser without any downloads or installations.</p>
							<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mt-6 mb-2">How to Play ${title}</h3>
							<p>Getting started with ${title} is easy. Controls are designed to be intuitive: ${controlsText}. The game features responsive controls that work on both desktop (keyboard and mouse) and mobile devices (touch input). Difficulty scales progressively, starting with accessible early levels and ramping up to challenge even experienced players. Each session is unique, ensuring high replay value.</p>
							<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mt-6 mb-2">Game Features</h3>
							<ul class="list-disc pl-6 space-y-1">
								<li>Original ${category.toLowerCase()} gameplay designed by FreshPlay Studios</li>
								<li>Smooth 60 FPS performance on all modern browsers</li>
								<li>Fully responsive — plays perfectly on desktop, tablet, and mobile</li>
								<li>Synthesized audio soundtrack and sound effects</li>
								<li>Progressive difficulty with engaging score systems</li>
								<li>No downloads, no plugins, no account required</li>
							</ul>
							<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-widest mt-6 mb-2">System Requirements</h3>
							<p>${title} runs on any device with a modern web browser. We recommend Google Chrome, Mozilla Firefox, Apple Safari, or Microsoft Edge for the best experience. The game is optimized to run smoothly even on lower-spec devices and slower internet connections. No additional software, plugins, or extensions are needed — just open the page and play.</p>
							<p>FreshPlay Arcade is committed to providing a premium, ad-supported gaming experience with no paywalls or locked content. All games, including ${title}, are completely free to play. We regularly update our games based on player feedback. If you enjoy ${title}, explore our library of over 20 original browser games spanning ${category.toLowerCase()}, puzzle, action, survival, and strategy categories.</p>
						</div>
					`;
					seoSection.classList.remove('hidden');
				}

					// --- SEO: Inject VideoGame Schema ---
					const schemaScript = document.getElementById('game-schema');
					if (schemaScript) {
						const schema = {
							"@context": "https://schema.org",
							"@type": "VideoGame",
							"name": game.title,
							"description": game.description,
							"url": `https://mytopscore.com/game/${game.id}`,
							"image": `https://mytopscore.com${game.thumbnail_url}`,
							"author": {
								"@type": "Organization",
								"name": game.author || "FreshPlay Studios"
							},
							"publisher": {
								"@type": "Organization",
								"name": "FreshPlay Arcade",
								"url": "https://mytopscore.com/"
							},
							"genre": game.category,
							"gamePlatform": ["Web Browser", "HTML5"],
							"applicationCategory": "Game",
							"operatingSystem": "Any",
							"offers": {
								"@type": "Offer",
								"price": "0",
								"priceCurrency": "USD",
								"availability": "https://schema.org/InStock"
							},
							"aggregateRating": {
								"@type": "AggregateRating",
								"ratingValue": game.rating || "4.7",
								"ratingCount": "150",
								"bestRating": "5",
								"worstRating": "1"
							}
						};
						schemaScript.textContent = JSON.stringify(schema);
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
