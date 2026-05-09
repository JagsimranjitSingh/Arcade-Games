document.addEventListener('DOMContentLoaded', () => {
	// --- Mobile Menu Toggle (Right-to-Left Slide & Backdrop) ---
	const menuBtn = document.getElementById('mobile-menu-btn');
	const mobileMenu = document.getElementById('mobile-menu');
	const closeBtn = document.getElementById('mobile-menu-close');
	const backdrop = document.getElementById('mobile-menu-backdrop');

	function openMenu() {
		if (backdrop) {
			backdrop.classList.remove('hidden');
			// Request animation frame ensures display:block applies before opacity transition starts
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
			// Wait for the transition to finish before hiding the element
			setTimeout(() => {
				backdrop.classList.add('hidden');
			}, 300);
		}
		if (mobileMenu) {
			mobileMenu.classList.remove('translate-x-0');
			mobileMenu.classList.add('translate-x-full');
		}
	}

	if (menuBtn) menuBtn.addEventListener('click', openMenu);
	if (closeBtn) closeBtn.addEventListener('click', closeMenu);
	if (backdrop) backdrop.addEventListener('click', closeMenu);


	// --- Global Search Dropdown Logic ---
	const searchInput = document.getElementById('global-search');
	const searchDropdown = document.getElementById('search-dropdown');

	if (searchInput && searchDropdown) {
		let allGames = [];

		// Fetch games list once for search functionality
		fetch('/data/games.json')
			.then(r => r.json())
			.then(data => allGames = data)
			.catch(err => console.error("Error loading games for search:", err));

		searchInput.addEventListener('input', (e) => {
			const term = e.target.value.toLowerCase().trim();
			searchDropdown.innerHTML = ''; // clear previous

			if (term.length > 0) {
				const matches = allGames.filter(g =>
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

		// Hide dropdown on click outside
		document.addEventListener('click', (e) => {
			if (!e.target.closest('.search-container')) {
				searchDropdown.classList.remove('active');
			}
		});
	}

	// --- Explore Page Category Filtering ---
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
				if (secCategory === category.toLowerCase()) {
					sec.style.display = 'block';
				} else {
					sec.style.display = 'none';
				}
			}
		});
	}

	if (categorySelect && exploreSections.length > 0) {
		// Init from URL
		if (categoryParam) {
			// Find option that matches and set it
			Array.from(categorySelect.options).forEach(opt => {
				if (opt.value === categoryParam.toLowerCase()) {
					categorySelect.value = opt.value;
				}
			});
			filterExplore(categoryParam);
		}

		// Listen for manual select changes
		categorySelect.addEventListener('change', (e) => {
			filterExplore(e.target.value);
			// Optional: update URL without reloading
			const newUrl = new URL(window.location);
			if (e.target.value === 'all') {
				newUrl.searchParams.delete('category');
			} else {
				newUrl.searchParams.set('category', e.target.value);
			}
			window.history.pushState({}, '', newUrl);
		});
	}

	// --- Horizontal Scroll Arrows ---
	const scrollRows = document.querySelectorAll('.scroll-row-container');
	scrollRows.forEach(container => {
		const leftBtn = container.querySelector('.scroll-left');
		const rightBtn = container.querySelector('.scroll-right');
		const scrollArea = container.querySelector('.scroll-area');

		if (leftBtn && rightBtn && scrollArea) {
			leftBtn.addEventListener('click', () => scrollArea.scrollBy({ left: -300, behavior: 'smooth' }));
			rightBtn.addEventListener('click', () => scrollArea.scrollBy({ left: 300, behavior: 'smooth' }));
		}
	});

	// --- Global Ad Engine (Level Threshold Logic) ---
	let levelsPlayedSinceLastAd = 0;

	window.triggerInGameAd = function (currentLevel, resumeCallback) {
		levelsPlayedSinceLastAd++;

		// Trigger randomly every 3 or 4 levels
		const triggerThreshold = Math.floor(Math.random() * 2) + 3; // Returns 3 or 4

		if (levelsPlayedSinceLastAd >= triggerThreshold) {
			// Reset counter
			levelsPlayedSinceLastAd = 0;

			// Create Video Ad Overlay
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
			console.log(`Level complete. Next ad in ${triggerThreshold - levelsPlayedSinceLastAd} levels.`);
			if (typeof resumeCallback === 'function') resumeCallback();
		}
	};
});