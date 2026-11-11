function getGameUrl(gameId) {
	return `/game/${gameId}`;
}

function getCategoryUrl(categoryName) {
	if (!categoryName || categoryName.toLowerCase() === 'all') return '/category/all';
	// Normalize to clean slug: "Physics & Skill" → "physics-skill"
	const slug = categoryName.toLowerCase()
		.replace(/&/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `/category/${slug}`;
}

document.addEventListener('DOMContentLoaded', () => {
	document.body.classList.add('fp-ready');
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
		if (currentLevel > 0 && currentLevel % 5 === 0) {
			const overlay = document.createElement('div');
			overlay.className = 'fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center';
			overlay.innerHTML = `
                <div class="absolute top-4 right-6 text-[#64748b] font-mono text-xs">
                    Ad closing in <span id="ad-timer" class="text-[#00234f] font-bold">15</span>s
                </div>
                <div class="text-[#48d1cc] font-mono text-xs tracking-widest uppercase mb-4">Sponsor Message</div>
                <div class="w-full max-w-3xl aspect-video bg-white border border-[#333] flex items-center justify-center shadow-[0_0_50px_rgba(72,209,204,0.1)]">
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
			if (typeof resumeCallback === 'function') resumeCallback();
		}
	};

	window.triggerRewardAd = function (resumeCallback) {
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center';
		overlay.innerHTML = `
			<div class="absolute top-4 right-6 text-[#64748b] font-mono text-xs">
				Reward Ad closing in <span id="reward-ad-timer" class="text-[#00234f] font-bold">15</span>s
			</div>
			<div class="text-[#48d1cc] font-mono text-xs tracking-widest uppercase mb-4">Sponsor Message (Reward)</div>
			<div class="w-full max-w-3xl aspect-video bg-white border border-[#333] flex items-center justify-center shadow-[0_0_50px_rgba(72,209,204,0.1)]">
				<svg class="w-16 h-16 text-[#3f3f46] animate-pulse" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"></path></svg>
			</div>
		`;
		document.body.appendChild(overlay);

		let timeLeft = 15;
		const timerEl = overlay.querySelector('#reward-ad-timer');
		const countdown = setInterval(() => {
			timeLeft -= 1;
			timerEl.textContent = timeLeft;
			if (timeLeft <= 0) {
				clearInterval(countdown);
				document.body.removeChild(overlay);
				if (typeof resumeCallback === 'function') resumeCallback();
			}
		}, 1000);
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

			if (document.getElementById('dynamic-path')) {
				init404Page(allGames);
			} else if (path.endsWith('index.html') || path === '/') {
				initHomepage(allGames);
			} else if (path.endsWith('explore.html') || path.includes('/category/')) {
				initExplorePage(allGames);
			} else if (path.endsWith('play.html') || path.includes('/game/')) {
				initGamePageSidebar(allGames);
			}
		})
		.catch(err => console.error("Error loading games.json:", err));


	function parsePlayCount(countStr) {
		if (!countStr) return 0;
		let str = countStr.toString().toUpperCase();
		let val = parseFloat(str.replace(/[^0-9.]/g, ''));
		if (isNaN(val)) return 0;
		if (str.includes('M')) return val * 1000000;
		if (str.includes('K')) return val * 1000;
		return val;
	}

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
							a.href = getGameUrl(g.id);
							a.className = 'search-item';
							a.innerHTML = `
                                <img src="${g.thumbnail_url}" alt="${g.title}">
                                <div>
                                    <div class="text-sm font-bold truncate w-48">${g.title}</div>
                                    <div class="text-[10px] text-[#48d1cc] font-mono uppercase">${g.category}</div>
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

	function initHomepage(games) {
		// 1. Trending Now (top, full width) — top 2 rated games
		const trendingGrid = document.getElementById('trending-grid');
		const trendingGames = [...games].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 2);
		const trendingIds = new Set(trendingGames.map(g => g.id));

		if (trendingGrid) {
			trendingGrid.innerHTML = '';
			trendingGames.forEach(g => {
				trendingGrid.innerHTML += `
					<a href="${getGameUrl(g.id)}" class="flex bg-white border border-[#e2e8f0] rounded-[12px] overflow-hidden card-glow group transition-all">
						<img src="${g.thumbnail_url}" alt="${g.title}" class="w-1/3 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
						<div class="w-2/3 p-4 md:p-5 flex flex-col justify-center">
							<span class="text-[#48d1cc] text-[10px] font-mono uppercase mb-1 tracking-wider">${g.category}</span>
							<h3 class="font-bold text-[#00234f] uppercase group-hover:text-[#48d1cc] transition-colors truncate mb-1.5">${g.title}</h3>
							<p class="text-xs text-[#00234f] line-clamp-2 mb-2 leading-relaxed">${g.description}</p>
							<span class="text-[10px] font-mono text-[#94a3b8]">🔥 ${g.play_count} Playing Now</span>
						</div>
					</a>
				`;
			});
		}

		// 2. All Games Grid (excluding trending)
		const allGamesGrid = document.getElementById('all-games-grid');
		const gameCountEl = document.getElementById('game-count');
		const remainingGames = games.filter(g => !trendingIds.has(g.id));

		if (gameCountEl) {
			gameCountEl.textContent = `${remainingGames.length} Games`;
		}

		if (allGamesGrid) {
			allGamesGrid.innerHTML = '';
			remainingGames.forEach(g => {
				allGamesGrid.innerHTML += `
                    <a href="${getGameUrl(g.id)}" class="game-card card-glow bg-white rounded-[12px] overflow-hidden flex flex-col border border-[#e2e8f0] transition-all">
                        <div class="aspect-video w-full bg-[#111] relative overflow-hidden group">
                            <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover opacity-100 group-hover:opacity-100 transition-opacity" loading="lazy">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                <span class="text-[#48d1cc] font-mono text-xs uppercase tracking-widest border border-[#48d1cc] px-2 py-1 bg-black/50 backdrop-blur-sm shadow-[0_0_10px_rgba(72,209,204,0.2)]">Play Now</span>
                            </div>
                        </div>
                        <div class="p-2 pl-3 flex items-center">
                            <div class="flex-1 min-w-0 pr-2">
                                <h3 class="font-bold text-sm text-[#00234f] truncate">${g.title}</h3>
                                <p class="text-[10px] text-[#64748b] font-mono mt-0.5 uppercase tracking-wider">${g.category}</p>
                            </div>
                            <div class="w-10 h-10 bg-[#00234f] rounded-lg flex items-center justify-center shrink-0"><svg class="w-5 h-5 text-[#c4e2f5]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
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

		const categorySidebar = document.querySelectorAll('aside .bg-white')[0];
		if (categorySidebar) {
			const ul = categorySidebar.querySelector('ul');
			ul.innerHTML = '';
			for (const [category, count] of Object.entries(categoryCounts)) {
				ul.innerHTML += `
                    <li>
                        <a href="${getCategoryUrl(category)}" class="flex justify-between items-center py-2 px-1 rounded hover:bg-[#e0f0fc] text-[#00234f] hover:text-[#00234f] transition-colors">
                            <span class="uppercase">${category}</span>
                            <span class="bg-[#00234f] text-[#f0f4f8] px-1.5 py-0.5 rounded text-[10px]">${count}</span>
                        </a>
                    </li>
                `;
			}
		}

		// 4. Top Played
		const topPlayedSidebar = document.querySelectorAll('aside .bg-white')[1];
		if (topPlayedSidebar) {
			const container = topPlayedSidebar.querySelector('.space-y-4');
			container.innerHTML = '';

			const sortedGames = [...games].sort((a, b) => parsePlayCount(b.play_count) - parsePlayCount(a.play_count)).slice(0, 5);
			const opacityClasses = ['', 'opacity-80 drop-shadow-[0_0_8px_rgba(72,209,204,0.3)]', 'opacity-60', 'opacity-40', 'opacity-20'];

			sortedGames.forEach((g, index) => {
				const shadowClass = index === 0 ? 'drop-shadow-[0_0_8px_rgba(72,209,204,0.5)]' : opacityClasses[index];
				container.innerHTML += `
                    <a href="${getGameUrl(g.id)}" class="flex items-center gap-4 group transition-colors hover:bg-[#c4e2f5]/50 p-1.5 rounded">
                        <span class="text-3xl font-extrabold text-[#48d1cc] font-mono italic w-8 text-right ${shadowClass}">${index + 1}</span>
                        <img src="${g.thumbnail_url}" alt="${g.title}" class="w-16 h-12 rounded object-cover border border-[#e2e8f0] group-hover:border-[#48d1cc]" loading="lazy">
                        <div>
                            <h4 class="text-xs font-bold text-[#00234f] uppercase group-hover:text-[#48d1cc] transition-colors line-clamp-1">${g.title}</h4>
                            <p class="text-[9px] text-[#94a3b8] font-mono uppercase tracking-wider mt-0.5">${g.category}</p>
                        </div>
                    </a>
                `;
			});
		}
	}

	// --- Explore Page Injection ---
	function initExplorePage(games) {
		const container = document.getElementById('categories-container');
		if (!container) return;

		const categories = {};
		games.forEach(g => {
			const cat = g.category.toUpperCase();
			if (!categories[cat]) categories[cat] = [];
			categories[cat].push(g);
		});

		const categoryNames = Object.keys(categories);
		let visibleCount = categoryNames.length;

		function slugify(str) {
			return str.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
		}

		function renderCategories(filter = 'all', searchQuery = '') {
			container.innerHTML = '';

			if (searchQuery) {
				const term = searchQuery.toLowerCase().trim();
				const matchedGames = games.filter(g =>
					g.title.toLowerCase().includes(term) ||
					g.category.toLowerCase().includes(term) ||
					g.description.toLowerCase().includes(term) ||
					(g.seo_keywords && g.seo_keywords.some(k => k.toLowerCase().includes(term)))
				);
				const sectionHtml = `
					<section class="mb-12 explore-category-section">
						<div class="flex justify-between items-center mb-6 pb-2 border-b border-[#cbd5e1]">
							<h2 class="text-xl font-bold text-[#00234f] uppercase tracking-widest font-liberation border-l-4 border-[#48d1cc] pl-3">
								Search Results for "${term.replace(/"/g, '&quot;')}" (${matchedGames.length})
							</h2>
							<a href="/category/all" class="text-xs font-bold text-[#00234f] hover:text-[#48d1cc] uppercase tracking-widest font-mono">Clear Search →</a>
						</div>
						${matchedGames.length === 0 ? `<p class="text-sm text-[#64748b] font-mono">No games matched your search. Browse all categories below.</p>` : `
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
							${matchedGames.map(g => `
								<div class="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 group">
									<div class="aspect-[4/3] bg-[#c4e2f5] overflow-hidden relative">
										<img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
										<span class="absolute top-2 right-2 bg-[#00234f]/90 text-[#c4e2f5] text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">${g.rating} ★</span>
									</div>
									<div class="p-4">
										<span class="text-[10px] font-bold text-[#48d1cc] uppercase tracking-widest font-mono">${g.category}</span>
										<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-wider font-liberation mt-1 group-hover:text-[#48d1cc] transition-colors">${g.title}</h3>
										<p class="text-xs text-[#64748b] mt-1.5 line-clamp-2 leading-relaxed">${g.description}</p>
										<div class="flex items-center justify-between mt-4 pt-3 border-t border-[#e2e8f0]">
											<span class="text-[10px] text-[#94a3b8] font-mono">${g.play_count} Plays</span>
											<a href="${getGameUrl(g.id)}" class="bg-[#00234f] text-[#c4e2f5] hover:bg-[#48d1cc] hover:text-[#00234f] font-bold text-xs px-3 py-1.5 rounded uppercase tracking-wider font-mono transition-colors">Play Now</a>
										</div>
									</div>
								</div>
							`).join('')}
						</div>`}
					</section>
				`;
				container.insertAdjacentHTML('beforeend', sectionHtml);
				return;
			}

			let toShow = [];
			if (filter === 'all') {
				toShow = categoryNames.slice(0, visibleCount);
			} else {
				const filterSlug = slugify(filter);
				toShow = categoryNames.filter(c => slugify(c) === filterSlug);
			}

			toShow.forEach((cat) => {
				const catGames = categories[cat];
				const catSlug = slugify(cat);

				const sectionHtml = `
					<section class="mb-12 explore-category-section" id="category-${catSlug}" data-category="${cat.toLowerCase()}">
						<div class="flex justify-between items-center mb-6 pb-2 border-b border-[#cbd5e1]">
							<h2 class="text-xl font-bold text-[#00234f] uppercase tracking-widest font-liberation border-l-4 border-[#48d1cc] pl-3">
								${cat} Games (${catGames.length})
							</h2>
							<a href="/category/${catSlug}" class="text-xs font-bold text-[#00234f] hover:text-[#48d1cc] uppercase tracking-widest font-mono">View Category →</a>
						</div>
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
							${catGames.map(g => `
								<div class="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 group">
									<div class="aspect-[4/3] bg-[#c4e2f5] overflow-hidden relative">
										<img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
										<span class="absolute top-2 right-2 bg-[#00234f]/90 text-[#c4e2f5] text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">${g.rating} ★</span>
									</div>
									<div class="p-4">
										<span class="text-[10px] font-bold text-[#48d1cc] uppercase tracking-widest font-mono">${g.category}</span>
										<h3 class="text-sm font-bold text-[#00234f] uppercase tracking-wider font-liberation mt-1 group-hover:text-[#48d1cc] transition-colors">${g.title}</h3>
										<p class="text-xs text-[#64748b] mt-1.5 line-clamp-2 leading-relaxed">${g.description}</p>
										<div class="flex items-center justify-between mt-4 pt-3 border-t border-[#e2e8f0]">
											<span class="text-[10px] text-[#94a3b8] font-mono">${g.play_count} Plays</span>
											<a href="${getGameUrl(g.id)}" class="bg-[#00234f] text-[#c4e2f5] hover:bg-[#48d1cc] hover:text-[#00234f] font-bold text-xs px-3 py-1.5 rounded uppercase tracking-wider font-mono transition-colors">Play Now</a>
										</div>
									</div>
								</div>
							`).join('')}
						</div>
					</section>
				`;
				container.insertAdjacentHTML('beforeend', sectionHtml);
			});

			const loadMoreBtn = document.getElementById('load-more-btn');
			if (loadMoreBtn) {
				loadMoreBtn.style.display = 'none';
			}
		}

		const pathParts = window.location.pathname.split('/').filter(p => p);
		const urlParams = new URLSearchParams(window.location.search);
		const searchQuery = urlParams.get('q') || '';
		let initialCategory = 'all';
		if (pathParts.includes('category')) {
			initialCategory = decodeURIComponent(pathParts[pathParts.indexOf('category') + 1] || 'all').replace(/\.html$/, '');
		} else {
			initialCategory = urlParams.get('category') || 'all';
		}

		const categorySelect = document.getElementById('category-filter');
		if (categorySelect) {
			const existingOptions = Array.from(categorySelect.options).map(o => o.value);
			categoryNames.forEach(cat => {
				const catSlug = slugify(cat);
				if (!existingOptions.includes(catSlug)) {
					const opt = document.createElement('option');
					opt.value = catSlug;
					opt.textContent = cat;
					categorySelect.appendChild(opt);
				}
			});

			const initialSlug = slugify(initialCategory);
			Array.from(categorySelect.options).forEach(opt => {
				if (opt.value === initialSlug) {
					opt.selected = true;
					categorySelect.value = opt.value;
				}
			});

			const newSelect = categorySelect.cloneNode(true);
			categorySelect.parentNode.replaceChild(newSelect, categorySelect);
			newSelect.value = initialSlug;

			newSelect.addEventListener('change', (e) => {
				const val = e.target.value;
				window.location.href = getCategoryUrl(val);
			});
		}

		if (searchQuery || !container.dataset.staticRendered) {
			renderCategories(initialCategory, searchQuery);
		}
	}

	// --- Game Page Sidebar Injection ---
	function initGamePageSidebar(games) {
		let gameId = '';
		const pathParts = window.location.pathname.split('/').filter(p => p);
		if (pathParts.includes('game')) {
			gameId = pathParts[pathParts.indexOf('game') + 1];
		} else if (pathParts.length > 0 && pathParts[pathParts.length - 1] !== 'play.html') {
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
			const similarGames = games.filter(g => g.category.toLowerCase() === currentGame.category.toLowerCase() && g.id !== currentGame.id).slice(0, 4);
			similarGames.forEach(g => {
				similarGrid.innerHTML += `
                    <a href="${getGameUrl(g.id)}" class="group">
                        <div class="overflow-hidden rounded mb-1 border border-[#e2e8f0] group-hover:border-[#48d1cc] transition-colors relative aspect-video">
                            <img src="${g.thumbnail_url}" alt="${g.title}" class="absolute inset-0 w-full h-full object-cover opacity-100 group-hover:opacity-100 transition-opacity" loading="lazy">
                        </div>
                        <h4 class="text-xs font-bold text-[#00234f] truncate">${g.title}</h4>
                        <p class="text-[9px] text-[#94a3b8] font-mono uppercase tracking-widest mt-0.5">${g.category}</p>
                    </a>
                `;
			});
		}
	}

	// --- 404 Page Injection ---
	function init404Page(games) {
		const pathElement = document.getElementById('dynamic-path');
		if (pathElement) {
			const safePath = window.location.pathname.replace(/</g, "&lt;").replace(/>/g, "&gt;");
			pathElement.textContent = safePath;
		}

		let shuffled = [...games];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		const mainGame = shuffled[0];
		const gameContainer = document.getElementById('random-game-container');
		if (gameContainer && mainGame) {
			gameContainer.innerHTML = `
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-white group cursor-pointer" onclick="window.location.href='${getGameUrl(mainGame.id)}'">
                    <img src="${mainGame.thumbnail_url}" class="w-full h-full object-cover opacity-100 group-hover:opacity-100 transition-opacity blur-sm" loading="lazy">
					<div class="z-10 absolute flex flex-col items-center">
						<span class="bg-red-500 text-[#00234f] text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-widest mb-3">Backup Core Loaded</span>
						<h2 class="text-3xl font-bold text-[#00234f] uppercase font-liberation tracking-widest text-center">${mainGame.title}</h2>
						<button class="mt-6 bg-[#00234f] text-[#c4e2f5] font-bold px-6 py-2 uppercase tracking-widest text-xs btn-glow rounded-sm shadow-[0_0_15px_rgba(72,209,204,0.4)]">Initialize Play</button>
					</div>
				</div>
			`;
		}

		const gridContainer = document.getElementById('recommended-games');
		if (gridContainer) {
			let html = '';
			for (let i = 1; i < Math.min(5, shuffled.length); i++) {
				const g = shuffled[i];
				html += `
					<a href="${getGameUrl(g.id)}" class="game-card card-glow bg-white rounded-[12px] overflow-hidden flex flex-col border border-[#e2e8f0] transition-all text-left">
                        <div class="aspect-video w-full bg-[#111] relative overflow-hidden group">
						    <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover opacity-100 group-hover:opacity-100 transition-opacity" loading="lazy">
                        </div>
						<div class="p-2 pl-3 flex items-center">
							<div class="flex-1 min-w-0 pr-2">
								<h3 class="font-bold text-sm text-[#00234f] truncate">${g.title}</h3>
								<p class="text-[10px] text-[#64748b] font-mono mt-0.5 uppercase tracking-wider">${g.category}</p>
							</div>
							<div class="w-10 h-10 bg-[#00234f] rounded-lg flex items-center justify-center shrink-0"><svg class="w-5 h-5 text-[#c4e2f5]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
						</div>
					</a>
				`;
			}
			gridContainer.innerHTML = html;
		}
	}
});

// Interactive Background Initialization
function initInteractiveBackground() {
	const bg = document.createElement('div');
	bg.className = 'interactive-bg';

	const gradient = document.createElement('div');
	gradient.className = 'interactive-bg-gradient';

	bg.appendChild(gradient);

	// Create geometric 3D shapes
	const shapes = [];
	for (let i = 0; i < 6; i++) {
		const shape = document.createElement('div');
		shape.className = `geom-shape geom-shape-${i}`;
		bg.appendChild(shape);
		shapes.push(shape);
	}

	// Prepend to body so it sits behind everything
	document.body.prepend(bg);

	// Mouse tracking for gradient and 3D hover effects
	if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
		document.addEventListener('mousemove', (e) => {
			gradient.style.setProperty('--mouse-x', `${e.clientX}px`);
			gradient.style.setProperty('--mouse-y', `${e.clientY}px`);

			// Update shapes for 3D proximity hover effect
			shapes.forEach(shape => {
				const rect = shape.getBoundingClientRect();
				const shapeX = rect.left + rect.width / 2;
				const shapeY = rect.top + rect.height / 2;

				const distX = e.clientX - shapeX;
				const distY = e.clientY - shapeY;
				const distance = Math.sqrt(distX * distX + distY * distY);

				if (distance < 250) {
					const rotateX = (distY / 250) * 35;
					const rotateY = -(distX / 250) * 35;
					shape.style.setProperty('--rx', `${rotateX}deg`);
					shape.style.setProperty('--ry', `${rotateY}deg`);
					shape.style.setProperty('--tz', `50px`);
					shape.style.setProperty('--scale', `1.1`);
					shape.classList.add('is-hovered');
				} else {
					shape.style.setProperty('--rx', `0deg`);
					shape.style.setProperty('--ry', `0deg`);
					shape.style.setProperty('--tz', `0px`);
					shape.style.setProperty('--scale', `1`);
					shape.classList.remove('is-hovered');
				}
			});
		});
	}
}

// Run init when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	initInteractiveBackground();
});
