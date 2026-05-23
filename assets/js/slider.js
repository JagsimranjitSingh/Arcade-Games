// ==========================================
// FreshPlay Arcade – Native Scroll-Snap Slider Controller
// Replaces Swiper.js with vanilla JS arrow navigation.
// The actual scrolling & snapping is handled by CSS:
//   scroll-snap-type: x mandatory (on .fp-slider)
//   scroll-snap-align: start      (on .fp-slide)
// ==========================================

// Listen for the custom event fired by main.js once the dynamic DOM is inserted
document.addEventListener('initDynamicSliders', () => {
	// Attach click handlers to all prev/next arrow buttons
	document.querySelectorAll('.fp-slider-prev').forEach(btn => {
		btn.addEventListener('click', () => {
			const index = btn.dataset.sliderIndex;
			const slider = document.querySelector(`.fp-slider[data-slider-index="${index}"]`);
			if (slider) {
				// Scroll left by 80% of the visible container width
				slider.scrollBy({ left: -slider.offsetWidth * 0.8, behavior: 'smooth' });
			}
		});
	});

	document.querySelectorAll('.fp-slider-next').forEach(btn => {
		btn.addEventListener('click', () => {
			const index = btn.dataset.sliderIndex;
			const slider = document.querySelector(`.fp-slider[data-slider-index="${index}"]`);
			if (slider) {
				// Scroll right by 80% of the visible container width
				slider.scrollBy({ left: slider.offsetWidth * 0.8, behavior: 'smooth' });
			}
		});
	});
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