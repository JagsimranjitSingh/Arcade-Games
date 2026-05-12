// Array to track active swiper instances so we can cleanly destroy them on filter change
window.activeSwipers = [];

// Listen for the custom event fired by main.js once the dynamic DOM elements are inserted
document.addEventListener('initDynamicSwipers', (e) => {
	// Clean up old instances to prevent memory leaks and broken math
	if (window.activeSwipers.length > 0) {
		window.activeSwipers.forEach(swiper => swiper.destroy(true, true));
		window.activeSwipers = [];
	}

	const count = e.detail.count;
	
	const sharedConfig = {
		slidesPerView: 2,
		spaceBetween: 20,
		loop: false, // FIX: Resolves the Swiper warning if a category has < 5 games
		centeredSlides: false,
		watchSlidesProgress: true, 
		grabCursor: true,
		autoplay: {
			delay: 4000,
			disableOnInteraction: true,
			pauseOnMouseEnter: true
		},
		breakpoints: {
			640: { slidesPerView: 2 },
			768: { slidesPerView: 3 },
			1024: { slidesPerView: 4 },
			1280: { slidesPerView: 5 }
		}
	};

	// Initialize a unique Swiper instance for every dynamic category loaded
	for (let i = 0; i < count; i++) {
		const swiper = new Swiper(`.swiper-${i}`, {
			...sharedConfig,
			navigation: {
				nextEl: `.swiper-button-next-${i}`,
				prevEl: `.swiper-button-prev-${i}`,
			},
		});
		window.activeSwipers.push(swiper);
	}
});

// UI Functionality: Back to Top
document.addEventListener('DOMContentLoaded', () => {
	const backToTopBtn = document.getElementById('back-to-top');
	if (backToTopBtn) {
		backToTopBtn.addEventListener('click', (e) => {
			e.preventDefault();
			window.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		});
	}
});