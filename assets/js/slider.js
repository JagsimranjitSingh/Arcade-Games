// ==========================================
// FreshPlay Arcade – SwiperJS Controller
// Initializes Swiper instances dynamically once games are loaded
// ==========================================

document.addEventListener('initDynamicSwipers', (e) => {
	const count = e.detail.count;
	
	for (let i = 0; i < count; i++) {
		new Swiper(`.swiper-${i}`, {
			slidesPerView: 2,
			spaceBetween: 10,
			navigation: {
				nextEl: `.swiper-button-next-${i}`,
				prevEl: `.swiper-button-prev-${i}`,
			},
			breakpoints: {
				640: { slidesPerView: 2, spaceBetween: 20 },
				768: { slidesPerView: 3, spaceBetween: 20 },
				1024: { slidesPerView: 4, spaceBetween: 20 },
				1280: { slidesPerView: 5, spaceBetween: 20 }
			},
			observer: true,
			observeParents: true,
		});
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