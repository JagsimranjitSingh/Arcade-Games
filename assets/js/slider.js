document.addEventListener('DOMContentLoaded', () => {
	// --- Swiper Initialization ---
	const sharedConfig = {
		slidesPerView: 2,
		spaceBetween: 20,
		loop: true,
		centeredSlides: false,
		watchSlidesProgress: true, // Helps with rendering during hover
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

	// Initialize Sliders
	const actionSwiper = new Swiper('.swiper-action', {
		...sharedConfig,
		navigation: {
			nextEl: '.swiper-button-next-action',
			prevEl: '.swiper-button-prev-action',
		},
	});

	const puzzleSwiper = new Swiper('.swiper-puzzle', {
		...sharedConfig,
		navigation: {
			nextEl: '.swiper-button-next-puzzle',
			prevEl: '.swiper-button-prev-puzzle',
		},
	});

	// --- UI Functionality: Back to Top ---
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

	// --- UI Functionality: Load More ---
	const loadMoreBtn = document.getElementById('load-more-btn');
	if (loadMoreBtn) {
		loadMoreBtn.addEventListener('click', function () {
			this.textContent = 'LOADING...';
			this.disabled = true;
			this.style.opacity = '0.5';
			this.style.cursor = 'not-allowed';

			// Simulate loading content
			setTimeout(() => {
				alert("More games would be fetched from games.json here.");
				this.textContent = 'LOAD MORE GAMES';
				this.disabled = false;
				this.style.opacity = '1';
				this.style.cursor = 'pointer';
			}, 1000);
		});
	}
});