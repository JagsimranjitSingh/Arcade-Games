const PORTAL_DOMAINS = [
    'https://mytopscore.com',
    'https://noinstallgames.com',
    'https://games365days.com',
    'https://game360s.com',
    'https://mygame360.com'
];

function getGameUrl(gameId) {
    let hash = 0;
    for (let i = 0; i < gameId.length; i++) {
        hash = gameId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PORTAL_DOMAINS.length;
    return `${PORTAL_DOMAINS[index]}/game/${gameId}`;
}

function getCategoryUrl(categoryName) {
    if (categoryName.toLowerCase() === 'all') return '/explore.html';
    // Normalize to clean slug: "Physics & Skill" → "physics-skill"
    const slug = categoryName.toLowerCase()
        .replace(/&/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `/category/${slug}`;
}

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
		if (currentLevel > 0 && currentLevel % 5 === 0) {
			const overlay = document.createElement('div');
			overlay.className = 'fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center';
			overlay.innerHTML = `
                <div class="absolute top-4 right-6 text-[#64748b] font-mono text-xs">
                    Ad closing in <span id="ad-timer" class="text-[#0f172a] font-bold">15</span>s
                </div>
                <div class="text-[#10b981] font-mono text-xs tracking-widest uppercase mb-4">Sponsor Message</div>
                <div class="w-full max-w-3xl aspect-video bg-white border border-[#333] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
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
				Reward Ad closing in <span id="reward-ad-timer" class="text-[#0f172a] font-bold">15</span>s
			</div>
			<div class="text-[#10b981] font-mono text-xs tracking-widest uppercase mb-4">Sponsor Message (Reward)</div>
			<div class="w-full max-w-3xl aspect-video bg-white border border-[#333] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
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
                                    <div class="text-[10px] text-[#10b981] font-mono uppercase">${g.category}</div>
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
		// 1. Hero Banner (Fully re-written to inject DOM rather than query it)
		const heroSection = document.querySelector('article.relative.group');
		if (heroSection) {
			const featured = games[14];
			heroSection.innerHTML = `
                <img src="${featured.thumbnail_url}" alt="${featured.title}" class="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-700" loading="lazy">
                <div class="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/40 to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#f8fafc]/90 via-[#f8fafc]/50 to-transparent"></div>
                
                <div class="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3 z-20 flex flex-col items-start">
                    <span class="bg-[#10b981] text-black text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-widest mb-4">Featured</span>
                    <h1 class="text-4xl md:text-6xl font-bold text-[#0f172a] mb-4 tracking-wide uppercase font-liberation drop-shadow-lg">${featured.title}</h1>
                    <p class="text-[#64748b] text-sm md:text-base mb-8 line-clamp-2 leading-relaxed max-w-xl">${featured.description}</p>
                    
                    <div class="flex items-center gap-6">
                        <a href="${getGameUrl(featured.id)}" class="flex items-center justify-center gap-2 bg-[#10b981] text-black font-bold px-8 py-3.5 uppercase tracking-widest text-sm btn-glow rounded-sm transition-transform hover:-translate-y-1">
                            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3v18l15-9L5 3z"></path></svg> Play Now
                        </a>
                        <div class="hidden md:flex items-center gap-2 text-[#0f172a] font-mono text-xs tracking-widest bg-black/50 backdrop-blur-md px-3 py-2 border border-[#cbd5e1] rounded">
                            <span class="text-[#64748b] flex items-center gap-1">
                                <svg class="w-3 h-3 text-[#10b981]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg> 
                                ${featured.rating || '4.9'}
                            </span>
                        </div>
                    </div>
                </div>
			`;
		}

		// 2. New Arrivals Grid
		const newArrivalsGrid = document.querySelector('section .grid.grid-cols-2.lg\\:grid-cols-4');
		if (newArrivalsGrid) {
			newArrivalsGrid.innerHTML = '';
			games.slice(0, 8).forEach(g => {
				newArrivalsGrid.innerHTML += `
                    <a href="${getGameUrl(g.id)}" class="game-card card-glow bg-white rounded overflow-hidden flex flex-col border border-[#e2e8f0] transition-all">
                        <div class="aspect-video w-full bg-[#111] relative overflow-hidden group">
                            <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                <span class="text-[#10b981] font-mono text-xs uppercase tracking-widest border border-[#10b981] px-2 py-1 bg-black/50 backdrop-blur-sm shadow-[0_0_10px_rgba(16,185,129,0.2)]">Play Now</span>
                            </div>
                        </div>
                        <div class="p-3 flex flex-col flex-grow">
                            <h3 class="font-bold text-sm text-[#0f172a] truncate">${g.title}</h3>
                            <p class="text-[10px] text-[#64748b] font-mono mt-1 uppercase tracking-wider">${g.category}</p>
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
                        <a href="${getCategoryUrl(category)}" class="flex justify-between items-center py-2 px-1 rounded hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#10b981] transition-colors">
                            <span class="uppercase">${category}</span>
                            <span class="bg-[#f8fafc] px-1.5 py-0.5 rounded">${count}</span>
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
			
			const sortedGames = [...games].sort((a, b) => parsePlayCount(b.play_count) - parsePlayCount(a.play_count)).slice(0, 5);
			const opacityClasses = ['', 'opacity-80 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]', 'opacity-60', 'opacity-40', 'opacity-20'];
			
			sortedGames.forEach((g, index) => {
				const shadowClass = index === 0 ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : opacityClasses[index];
				container.innerHTML += `
                    <a href="${getGameUrl(g.id)}" class="flex items-center gap-4 group transition-colors hover:bg-[#f8fafc]/50 p-1.5 rounded">
                        <span class="text-3xl font-extrabold text-[#10b981] font-mono italic w-8 text-right ${shadowClass}">${index + 1}</span>
                        <img src="${g.thumbnail_url}" alt="${g.title}" class="w-16 h-12 rounded object-cover border border-[#e2e8f0] group-hover:border-[#10b981]" loading="lazy">
                        <div>
                            <h4 class="text-xs font-bold text-[#0f172a] uppercase group-hover:text-[#10b981] transition-colors line-clamp-1">${g.title}</h4>
                            <p class="text-[9px] text-[#94a3b8] font-mono uppercase tracking-wider mt-0.5">${g.category}</p>
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
				trendingGrid.innerHTML = ''; 
				const trendingGames = [...games].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 2);
				
				trendingGames.forEach(g => {
					trendingGrid.innerHTML += `
						<a href="${getGameUrl(g.id)}" class="flex bg-white border border-[#e2e8f0] rounded overflow-hidden card-glow group transition-all">
							<img src="${g.thumbnail_url}" alt="${g.title}" class="w-1/3 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
							<div class="w-2/3 p-5 flex flex-col justify-center">
								<span class="text-[#10b981] text-[10px] font-mono uppercase mb-1 tracking-wider">${g.category}</span>
								<h3 class="font-bold text-[#0f172a] mb-2 uppercase group-hover:text-[#10b981] transition-colors">${g.title}</h3>
								<p class="text-xs text-[#64748b] line-clamp-2 mb-3 leading-relaxed">${g.description}</p>
								<span class="text-[10px] font-mono text-[#94a3b8]">🔥 ${g.play_count} Playing Now</span>
							</div>
						</a>
					`;
				});
			}
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
		let visibleCount = 2; 

		function slugify(str) {
			return str.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
		}

		function renderCategories(filter = 'all') {
			container.innerHTML = '';
			
			let toShow = [];
			if (filter === 'all') {
				toShow = categoryNames.slice(0, visibleCount);
			} else {
				// Match by slug so URL like /category/physics-skill finds "PHYSICS & SKILL"
				const filterSlug = slugify(filter);
				toShow = categoryNames.filter(c => slugify(c) === filterSlug);
			}

			toShow.forEach((cat, index) => {
				const catGames = categories[cat];
				
				let emoji = '🎮';
				if(cat.includes('ACTION')) emoji = '⚔️';
				if(cat.includes('PUZZLE')) emoji = '🧩';
				if(cat.includes('RUNNER')) emoji = '🏃';
				if(cat.includes('SURVIVAL')) emoji = '🛡️';

				const sectionHtml = `
					<section class="mb-16 explore-category-section" data-category="${cat.toLowerCase()}">
						<div class="flex items-center justify-between mb-6 border-b border-[#e2e8f0] pb-2">
							<h2 class="text-lg font-bold flex items-center gap-2 uppercase tracking-widest text-[#0f172a] font-liberation">
								<span class="text-[#10b981]">${emoji}</span> ${cat} Games
							</h2>
							<div class="flex gap-2">
								<div class="swiper-button-prev-${index} cursor-pointer p-1 text-[#64748b] hover:text-[#10b981] transition-colors" data-slider-index="${index}" aria-label="Scroll left">
									<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
								</div>
								<div class="swiper-button-next-${index} cursor-pointer p-1 text-[#64748b] hover:text-[#10b981] transition-colors" data-slider-index="${index}" aria-label="Scroll right">
									<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
								</div>
							</div>
						</div>
						<div class="swiper swiper-${index}">
							<div class="swiper-wrapper">
							${catGames.map(g => `
								<div class="swiper-slide">
									<a href="${getGameUrl(g.id)}" class="game-card card-glow bg-white rounded overflow-hidden flex flex-col border border-[#e2e8f0] transition-all">
										<div class="aspect-video w-full bg-[#111] relative overflow-hidden group">
                                                <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy">
                                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 z-20">
                                                    <span class="text-[#10b981] font-mono text-xs uppercase tracking-widest border border-[#10b981] px-2 py-1 bg-black/50 backdrop-blur-sm shadow-[0_0_10px_rgba(16,185,129,0.2)]">Play Now</span>
                                                </div>
                                            </div>
										<div class="p-3 flex flex-col flex-grow">
											<h3 class="font-bold text-sm text-[#0f172a] truncate uppercase">${g.title}</h3>
											<p class="text-[10px] text-[#64748b] font-mono mt-1 uppercase">${g.category}</p>
										</div>
									</a>
								</div>
							`).join('')}
							</div>
						</div>
					</section>
				`;
				container.insertAdjacentHTML('beforeend', sectionHtml);
			});

			document.dispatchEvent(new CustomEvent('initDynamicSwipers', { detail: { count: toShow.length } }));

			const loadMoreBtn = document.getElementById('load-more-btn');
			if (loadMoreBtn) {
				if (filter !== 'all' || visibleCount >= categoryNames.length) {
					loadMoreBtn.style.display = 'none';
				} else {
					loadMoreBtn.style.display = 'block';
					loadMoreBtn.textContent = 'LOAD MORE CATEGORIES';
					loadMoreBtn.disabled = false;
					loadMoreBtn.style.opacity = '1';
					loadMoreBtn.style.cursor = 'pointer';
				}
			}
		}

		const pathParts = window.location.pathname.split('/').filter(p => p);
		let initialCategory = 'all';
		if (pathParts.includes('category')) {
			// Decode the slug from the URL to match against category names
			initialCategory = decodeURIComponent(pathParts[pathParts.indexOf('category') + 1] || 'all');
		} else {
			const urlParams = new URLSearchParams(window.location.search);
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
				renderCategories(val);
				window.history.pushState({}, '', getCategoryUrl(val));
			});
		}

		renderCategories(initialCategory);

		const loadMoreBtn = document.getElementById('load-more-btn');
		if (loadMoreBtn) {
			const newBtn = loadMoreBtn.cloneNode(true);
			loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);
			newBtn.addEventListener('click', function() {
				this.textContent = 'LOADING...';
				this.disabled = true;
				this.style.opacity = '0.5';
				this.style.cursor = 'not-allowed';

				setTimeout(() => {
					visibleCount += 2; 
					renderCategories('all');
				}, 400);
			});
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
                        <div class="overflow-hidden rounded mb-1 border border-[#e2e8f0] group-hover:border-[#10b981] transition-colors relative aspect-video">
                            <img src="${g.thumbnail_url}" alt="${g.title}" class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy">
                        </div>
                        <h4 class="text-xs font-bold text-[#0f172a] truncate">${g.title}</h4>
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
                    <img src="${mainGame.thumbnail_url}" class="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity blur-sm" loading="lazy">
					<div class="z-10 absolute flex flex-col items-center">
						<span class="bg-red-500 text-[#0f172a] text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-widest mb-3">Backup Core Loaded</span>
						<h2 class="text-3xl font-bold text-[#0f172a] uppercase font-liberation tracking-widest text-center">${mainGame.title}</h2>
						<button class="mt-6 bg-[#10b981] text-black font-bold px-6 py-2 uppercase tracking-widest text-xs btn-glow rounded-sm shadow-[0_0_15px_rgba(16,185,129,0.4)]">Initialize Play</button>
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
					<a href="${getGameUrl(g.id)}" class="game-card card-glow bg-white rounded overflow-hidden flex flex-col border border-[#e2e8f0] transition-all text-left">
                        <div class="aspect-video w-full bg-[#111] relative overflow-hidden group">
						    <img src="${g.thumbnail_url}" alt="${g.title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy">
                        </div>
						<div class="p-3">
							<h3 class="font-bold text-sm text-[#0f172a] truncate">${g.title}</h3>
							<p class="text-[10px] text-[#64748b] font-mono mt-1 uppercase tracking-wider">${g.category}</p>
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
