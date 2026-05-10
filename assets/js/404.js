document.addEventListener('DOMContentLoaded', () => {
	// 1. Output the broken URL the user tried to visit
	const pathElement = document.getElementById('dynamic-path');
	if (pathElement) {
		// Grab the pathname and escape it to prevent XSS
		const safePath = window.location.pathname.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		pathElement.textContent = safePath;
	}

	// 2. Fetch and Inject Random Games
	fetch('/data/games.json')
		.then(response => response.json())
		.then(games => {
			if (!games || games.length < 5) return; // Failsafe

			// Shuffle array using Fisher-Yates algorithm
			let shuffled = [...games];
			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}

			// A. The Easter Egg Game (First item in shuffled array)
			const mainGame = shuffled[0];
			const gameContainer = document.getElementById('random-game-container');

			if (gameContainer) {
				// For Phase 2, we simulate the iframe. In Phase 3, this becomes a real <iframe>
				gameContainer.innerHTML = `
                    <div class="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] group cursor-pointer" onclick="window.location.href='/game.html?id=${mainGame.id}'">
                        <img src="${mainGame.thumbnail_url}" class="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity blur-sm">
                        <div class="z-10 flex flex-col items-center">
                            <span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-widest mb-3">Backup Core Loaded</span>
                            <h2 class="text-3xl font-bold text-white uppercase font-liberation tracking-widest text-center">${mainGame.title}</h2>
                            <button class="mt-6 bg-[#00ff00] text-black font-bold px-6 py-2 uppercase tracking-widest text-xs btn-glow rounded-sm shadow-[0_0_15px_rgba(0,255,0,0.4)]">Initialize Play</button>
                        </div>
                    </div>
                `;
			}

			// B. The Recommendations Grid (Items 2-5)
			const gridContainer = document.getElementById('recommended-games');
			if (gridContainer) {
				let html = '';
				for (let i = 1; i < 5; i++) {
					const g = shuffled[i];
					html += `
                        <a href="/game.html?id=${g.id}" class="game-card card-glow bg-[#1a1a1a] rounded overflow-hidden flex flex-col border border-[#27272a] transition-all text-left">
                            <img src="${g.thumbnail_url}" alt="${g.title} thumbnail" class="w-full aspect-video object-cover" loading="lazy">
                            <div class="p-3">
                                <h3 class="font-bold text-sm text-white truncate">${g.title}</h3>
                                <p class="text-[10px] text-[#a1a1aa] font-mono mt-1 uppercase tracking-wider">${g.category}</p>
                            </div>
                        </a>
                    `;
				}
				gridContainer.innerHTML = html;
			}
		})
		.catch(err => console.error("Error loading 404 fallback games:", err));
});