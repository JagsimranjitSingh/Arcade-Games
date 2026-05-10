document.addEventListener('DOMContentLoaded', () => {
	// ==========================================
	// 1. MOBILE MENU LOGIC
	// ==========================================
	const menuBtn = document.getElementById('mobile-menu-btn');
	const mobileMenu = document.getElementById('mobile-menu');
	const closeBtn = document.getElementById('mobile-menu-close');
	const backdrop = document.getElementById('mobile-menu-backdrop');

	function openMenu() {
		if (backdrop) {
			backdrop.classList.remove('hidden');
			requestAnimationFrame(() => {
				backdrop.classList.remove('opacity-0');
				backdrop.classList.add('opacity-100');
			});
		}
		if (mobileMenu) {
			mobileMenu.classList.remove('translate-x-full');
			mobileMenu.classList.add('translate-x-0');
		}
	}

	function closeMenu() {
		if (backdrop) {
			backdrop.classList.remove('opacity-100');
			backdrop.classList.add('opacity-0');
			setTimeout(() => backdrop.classList.add('hidden'), 300);
		}
		if (mobileMenu) {
			mobileMenu.classList.remove('translate-x-0');
			mobileMenu.classList.add('translate-x-full');
		}
	}

	if (menuBtn) menuBtn.addEventListener('click', openMenu);
	if (closeBtn) closeBtn.addEventListener('click', closeMenu);
	if (backdrop) backdrop.addEventListener('click', closeMenu);


	// ==========================================
	// 2. GLOBAL AD ENGINE LOGIC
	// ==========================================
	window.triggerInGameAd = function (currentLevel, resumeCallback) {
		// Production Logic: Exactly every 5 levels
		if (currentLevel > 0 && currentLevel % 5 === 0) {
			const overlay = document.createElement('div');
			overlay.className = 'fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center';
			overlay.innerHTML = `
                <div class="absolute top-4 right-6 text-[#a1a1aa] font-mono text-xs">
                    Ad closing in <span id="ad-timer" class="text-white font-bold">15</span>s
                </div>
                <div class="text-[#00ff00] font-mono text-xs tracking-widest uppercase mb-4">Sponsor Message</div>
                <div class="w-full max-w-3xl aspect-video bg-[#1a1a1a] border border-[#333] flex items-center justify-center shadow-[0_0_50px_rgba(0,255,0,0.1)]">
                    <svg class="w-16 h-16 text-[#3f3f46] animate-pulse" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"></path></svg>
                </div>
            `;
			document.body.appendChild(overlay);

			let timeLeft = 15;
			const timerEl = overlay.querySelector('#ad-timer');
			const countdown = setInterval(() => {
				timeLeft -= 1;
				timerEl.textContent = timeLeft;
				if (timeLeft <= 0) {
					clearInterval(countdown);
					document.body.removeChild(overlay);
					if (typeof resumeCallback === 'function') resumeCallback();
				}
			}, 1000);
		} else {
			// Not a multiple of 5, immediately resume game seamlessly
			if (typeof resumeCallback === 'function') resumeCallback();
		}
	};


	// ==========================================
	// 3. CENTRALIZED DATA FETCH & INJECTION
	// ==========================================
	fetch('/data/games.json')
		.then(r => r.json())
		.then(allGames => {
			if (!allGames || allGames.length === 0) return;

			initSearch(allGames);

			const path = window.location.pathname;
			
			// Detect 404 Page (Because the URL could be anything, we check the DOM instead)
			if (document.getElementById('dynamic-path')) {
				init404Page(allGames);
			}
			// Standard Page Routing
			else if (path.endsWith('index.html') || path === '/') {
				initHomepage(allGames);
			} else if (path.endsWith('explore.html')) {
				initExplorePage(allGames);
				initCategoryFilter();
			} else if (path.endsWith('game.html')) {
				initGamePageSidebar(allGames);
			}
		})
		.catch(err => console.error("Error loading games.json:", err));


	// --- Helper: Parse strings like "1.2M" or "850K" into numbers ---
	function parsePlayCount(countStr) {
		if (!countStr) return 0;
		let str = countStr.toString().toUpperCase();
		let val = parseFloat(str.replace(/[^0-9.]/g, ''));
		if (isNaN(val)) return 0;
		if (str.includes('M')) return val * 1000000;
		if (str.includes('K')) return val * 1000;
		return val;
	}

	// --- Search Bar Logic ---
	function initSearch(games) {
		const searchInput = document.getElementById('global-search');
		const searchDropdown = document.getElementById('search-dropdown');

		if (searchInput && searchDropdown) {
			searchInput.addEventListener('input', (e) => {
				const term = e.target.value.toLowerCase().trim();
				searchDropdown.innerHTML = '';
				if (term.length > 0) {
					const matches = games.filter(g =>
						g.title.toLowerCase().includes(term) ||
						g.category.toLowerCase().includes(term) ||
						(g.seo_keywords && g.seo_keywords.some(k => k.toLowerCase().includes(term)))
					);
					if (matches.length > 0) {
						searchDropdown.classList.add('active');
						matches.forEach(g => {
							const a = document.createElement('a');
							a.href = `/game.html?id=${g.id}`;
							a.className = 'search-item';
							a.innerHTML = `
                                <img src="${g.thumbnail_url}" alt="${g.title}">
                                <div>
                                    <div class="text-sm font-bold truncate w-48">${g.title}</div>
                                    <div class="text-[10px] text-[#00ff00] font-mono uppercase">${g.category}</div>
                                </div>
                            `;
							searchDropdown.appendChild(a);
						});
					} else {
						searchDropdown.classList.remove('active');
					}
				} else {
					searchDropdown.classList.remove('active');
				}
			});
			document.addEventListener('click', (e) => {
				if (!e.target.closest('.search-container')) searchDropdown.classList.remove('active');
			});
		}
	}

	// --- Homepage Injection ---
	function initHomepage(games) {
		// 1. Hero Banner
		const heroSection = document.querySelector('article.relative.group');
		if (heroSection) {
			const featured = games[0];
			heroSection.querySelector('img').src = featured.thumbnail_url;
			heroSection.querySelector('h1').textContent = featured.title;
			heroSection.querySelector('p').textContent = featured.description;
			heroSection.querySelector('a').href = `/game.html?id=${featured.id}`;
            // Optional: update rating text
            const ratingSpan = heroSection.querySelector('span.text-\\[\\#a1a1aa\\]');
            if(ratingSpan) ratingSpan.innerHTML = `<svg class="w-3 h-3 text-[#00ff00]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg> ${featured.rating || '4.9'}`;
		}

		// 2. New Arrivals Grid
		const newArrivalsGrid = document.querySelector('section .grid.grid-cols-2.lg\\:grid-cols-4');
		if (newArrivalsGrid) {
			newArrivalsGrid.innerHTML = '';
			games.slice(0, 8).forEach(g => {
				newArrivalsGrid.innerHTML += `
                    <a href="/game.html?id=${g.id}" class="game-card card-glow bg-[#1a1a1a] rounded overflow-hidden flex flex-col border border-[#27272a] transition-all">
                        <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full aspect-video object-cover" loading="lazy">
                        <div class="p-3">
                            <h3 class="font-bold text-sm text-white truncate">${g.title}</h3>
                            <p class="text-[10px] text-[#a1a1aa] font-mono mt-1 uppercase tracking-wider">${g.category}</p>
                        </div>
                    </a>
                `;
			});
		}

		// 3. Hot Categories
		const categoryCounts = games.reduce((acc, g) => {
			acc[g.category] = (acc[g.category] || 0) + 1;
			return acc;
		}, {});
		
		const categorySidebar = document.querySelectorAll('aside .bg-\\[\\#1a1a1a\\]')[0];
		if (categorySidebar) {
			const ul = categorySidebar.querySelector('ul');
			ul.innerHTML = '';
			for (const [category, count] of Object.entries(categoryCounts)) {
				ul.innerHTML += `
                    <li>
                        <a href="/explore.html?category=${category.toLowerCase()}" class="flex justify-between items-center py-2 px-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#00ff00] transition-colors">
                            <span class="uppercase">${category}</span>
                            <span class="bg-[#0f0f0f] px-1.5 py-0.5 rounded">${count}</span>
                        </a>
                    </li>
                `;
			}
		}

		// 4. Top Played
		const topPlayedSidebar = document.querySelectorAll('aside .bg-\\[\\#1a1a1a\\]')[1];
		if (topPlayedSidebar) {
			const container = topPlayedSidebar.querySelector('.space-y-4');
			container.innerHTML = '';
			
			// Sort games by our parsed play_count
			const sortedGames = [...games].sort((a, b) => parsePlayCount(b.play_count) - parsePlayCount(a.play_count)).slice(0, 5);
			
			const opacityClasses = ['', 'opacity-80 drop-shadow-[0_0_8px_rgba(0,255,0,0.3)]', 'opacity-60', 'opacity-40', 'opacity-20'];
			
			sortedGames.forEach((g, index) => {
				const shadowClass = index === 0 ? 'drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]' : opacityClasses[index];
				container.innerHTML += `
                    <a href="/game.html?id=${g.id}" class="flex items-center gap-4 group transition-colors hover:bg-[#0f0f0f]/50 p-1.5 rounded">
                        <span class="text-3xl font-extrabold text-[#00ff00] font-mono italic w-8 text-right ${shadowClass}">${index + 1}</span>
                        <img src="${g.thumbnail_url}" alt="${g.title}" class="w-16 h-12 rounded object-cover border border-[#27272a] group-hover:border-[#00ff00]" loading="lazy">
                        <div>
                            <h4 class="text-xs font-bold text-white uppercase group-hover:text-[#00ff00] transition-colors line-clamp-1">${g.title}</h4>
                            <p class="text-[9px] text-[#52525b] font-mono uppercase tracking-wider mt-0.5">${g.category}</p>
                        </div>
                    </a>
                `;
			});
		}

		// 5. Trending Now
		const trendingSection = document.querySelectorAll('section')[1];
		if (trendingSection) {
			const trendingGrid = trendingSection.querySelector('.grid');
			if (trendingGrid) {
				trendingGrid.innerHTML = ''; // Clear the static HTML
				
				// Sort by highest rating and grab the top 2 games
				const trendingGames = [...games].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 2);
				
				trendingGames.forEach(g => {
					trendingGrid.innerHTML += `
						<a href="/game.html?id=${g.id}" class="flex bg-[#1a1a1a] border border-[#27272a] rounded overflow-hidden card-glow group transition-all">
							<img src="${g.thumbnail_url}" alt="${g.title}" class="w-1/3 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
							<div class="w-2/3 p-5 flex flex-col justify-center">
								<span class="text-[#00ff00] text-[10px] font-mono uppercase mb-1 tracking-wider">${g.category}</span>
								<h3 class="font-bold text-white mb-2 uppercase group-hover:text-[#00ff00] transition-colors">${g.title}</h3>
								<p class="text-xs text-[#a1a1aa] line-clamp-2 mb-3 leading-relaxed">${g.description}</p>
								<span class="text-[10px] font-mono text-[#52525b]">🔥 ${g.play_count} Playing Now</span>
							</div>
						</a>
					`;
				});
			}
		}
	}

	// --- Explore Page Injection ---
	function initExplorePage(games) {
		const populateSwiper = (category, wrapperSelector) => {
			const wrapper = document.querySelector(wrapperSelector);
			if (!wrapper) return;
			wrapper.innerHTML = '';
			const categoryGames = games.filter(g => g.category.toLowerCase() === category.toLowerCase());
			categoryGames.forEach(g => {
				wrapper.innerHTML += `
                    <div class="swiper-slide">
                        <a href="/game.html?id=${g.id}" class="game-card card-glow bg-[#1a1a1a] rounded overflow-hidden flex flex-col border border-[#27272a] transition-all">
                            <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full aspect-video object-cover" loading="lazy">
                            <div class="p-3">
                                <h3 class="font-bold text-sm text-white truncate uppercase">${g.title}</h3>
                                <p class="text-[10px] text-[#a1a1aa] font-mono mt-1 uppercase">${g.category}</p>
                            </div>
                        </a>
                    </div>
                `;
			});
		};

		// Populate all Swipers on the Explore page based on data-category attributes
		const sections = document.querySelectorAll('.explore-category-section');
		sections.forEach(sec => {
			const cat = sec.getAttribute('data-category');
			populateSwiper(cat, `.swiper-${cat} .swiper-wrapper`);
		});

		// Notify slider.js that dynamic HTML is ready
		document.dispatchEvent(new Event('gamesLoadedForSwiper'));
	}

	// --- Explore Page Category Filter Dropdown ---
	function initCategoryFilter() {
		const urlParams = new URLSearchParams(window.location.search);
		const categoryParam = urlParams.get('category');
		const categorySelect = document.getElementById('category-filter');
		const exploreSections = document.querySelectorAll('.explore-category-section');

		function filterExplore(category) {
			if (!exploreSections.length) return;
			exploreSections.forEach(sec => {
				const secCategory = sec.getAttribute('data-category').toLowerCase();
				if (category === 'all' || !category) {
					sec.style.display = 'block';
				} else {
					sec.style.display = secCategory === category.toLowerCase() ? 'block' : 'none';
				}
			});
		}

		if (categorySelect && exploreSections.length > 0) {
			if (categoryParam) {
				Array.from(categorySelect.options).forEach(opt => {
					if (opt.value === categoryParam.toLowerCase()) categorySelect.value = opt.value;
				});
				filterExplore(categoryParam);
			}
			categorySelect.addEventListener('change', (e) => {
				filterExplore(e.target.value);
				const newUrl = new URL(window.location);
				if (e.target.value === 'all') newUrl.searchParams.delete('category');
				else newUrl.searchParams.set('category', e.target.value);
				window.history.pushState({}, '', newUrl);
			});
		}
	}

	// --- Game Page Sidebar Injection (Similar Games) ---
	function initGamePageSidebar(games) {
		let gameId = '';
		const pathParts = window.location.pathname.split('/').filter(p => p);
		if (pathParts.length > 0 && pathParts[pathParts.length - 1] !== 'game.html') {
			gameId = pathParts[pathParts.length - 1].replace('.html', '');
		} else {
			const urlParams = new URLSearchParams(window.location.search);
			if (urlParams.has('id')) gameId = urlParams.get('id');
		}

		const currentGame = games.find(g => g.id === gameId);
		if (!currentGame) return;

		const similarGrid = document.querySelector('aside .grid.grid-cols-2.gap-3');
		if (similarGrid) {
			similarGrid.innerHTML = '';
			
			// Find games in the same category, excluding the current game
			const similarGames = games.filter(g => g.category.toLowerCase() === currentGame.category.toLowerCase() && g.id !== currentGame.id).slice(0, 4);
			
			similarGames.forEach(g => {
				similarGrid.innerHTML += `
                    <a href="/game.html?id=${g.id}" class="group">
                        <div class="overflow-hidden rounded mb-1 border border-[#27272a] group-hover:border-[#00ff00] transition-colors relative">
                            <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full object-cover aspect-video opacity-80 group-hover:opacity-100 transition-opacity">
                        </div>
                        <h4 class="text-xs font-bold text-white truncate">${g.title}</h4>
                        <p class="text-[9px] text-[#52525b] font-mono uppercase tracking-widest mt-0.5">${g.category}</p>
                    </a>
                `;
			});
		}
	}

	// --- 404 Page Injection (Random Easter Egg & Recommendations) ---
	function init404Page(games) {
		const pathElement = document.getElementById('dynamic-path');
		if (pathElement) {
			const safePath = window.location.pathname.replace(/</g, "&lt;").replace(/>/g, "&gt;");
			pathElement.textContent = safePath;
		}

		// Shuffle array using Fisher-Yates
		let shuffled = [...games];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		// Inject Easter Egg Game
		const mainGame = shuffled[0];
		const gameContainer = document.getElementById('random-game-container');
		if (gameContainer && mainGame) {
			gameContainer.innerHTML = `
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] group cursor-pointer" onclick="window.location.href='/game.html?id=${mainGame.id}'">
					<img src="${mainGame.thumbnail_url}" class="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity blur-sm" loading="lazy">
					<div class="z-10 flex flex-col items-center">
						<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-widest mb-3">Backup Core Loaded</span>
						<h2 class="text-3xl font-bold text-white uppercase font-liberation tracking-widest text-center">${mainGame.title}</h2>
						<button class="mt-6 bg-[#00ff00] text-black font-bold px-6 py-2 uppercase tracking-widest text-xs btn-glow rounded-sm shadow-[0_0_15px_rgba(0,255,0,0.4)]">Initialize Play</button>
					</div>
				</div>
			`;
		}

		// Inject Recommendations Grid
		const gridContainer = document.getElementById('recommended-games');
		if (gridContainer) {
			let html = '';
			for (let i = 1; i < Math.min(5, shuffled.length); i++) {
				const g = shuffled[i];
				html += `
					<a href="/game.html?id=${g.id}" class="game-card card-glow bg-[#1a1a1a] rounded overflow-hidden flex flex-col border border-[#27272a] transition-all text-left">
						<img src="${g.thumbnail_url}" alt="${g.title}" class="w-full aspect-video object-cover" loading="lazy">
						<div class="p-3">
							<h3 class="font-bold text-sm text-white truncate">${g.title}</h3>
							<p class="text-[10px] text-[#a1a1aa] font-mono mt-1 uppercase tracking-wider">${g.category}</p>
						</div>
					</a>
				`;
			}
			gridContainer.innerHTML = html;
		}
	}
});