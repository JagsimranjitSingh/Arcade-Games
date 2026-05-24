/**
 * contact.js - Secure form validation and submission via Web3Forms API
 */
document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('contact-form');
	const resultDiv = document.getElementById('form-result');
	const submitBtn = document.getElementById('submit-btn');
	const submitBtnText = submitBtn.querySelector('span');

	// Make sure to replace this with your actual Web3Forms public access key
	const WEB3FORMS_ACCESS_KEY = "86f8a79c-4940-4248-86a5-3f73049a5627";

	if (form) {
		form.addEventListener('submit', function (e) {
			e.preventDefault();

			// 1. Basic Frontend Validation
			const firstName = document.getElementById('first_name').value.trim();
			const lastName = document.getElementById('last_name').value.trim();
			const email = document.getElementById('email').value.trim();
			const message = document.getElementById('message').value.trim();

			if (!firstName || !lastName || !email || !message) {
				showResult("Please fill out all required fields.", "error");
				return;
			}

			// Advanced Email Regex Validation
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				showResult("Please enter a valid email address.", "error");
				return;
			}

			// 2. Prepare Data Payload
			const formData = new FormData(form);
			formData.append("access_key", WEB3FORMS_ACCESS_KEY);
			// Subject line for the email you receive
			formData.append("subject", `New Arcade Contact: ${document.getElementById('subject').value} from ${firstName}`);

			// 3. UI State Update (Loading)
			submitBtn.disabled = true;
			submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
			submitBtnText.textContent = "TRANSMITTING...";

			// Hide previous results
			resultDiv.classList.add('hidden');

			// 4. Secure Fetch Submission
			fetch('https://api.web3forms.com/submit', {
				method: 'POST',
				body: formData
			})
				.then(async (response) => {
					let json = await response.json();
					if (response.status == 200) {
						showResult("Transmission Successful. We'll be in touch.", "success");
						form.reset();
					} else {
						console.error("Form Submission Error:", json);
						showResult(json.message || "Transmission Failed. Please try again later.", "error");
					}
				})
				.catch(error => {
					console.error("Network Error:", error);
					showResult("Network Error. Check your connection.", "error");
				})
				.finally(() => {
					// Restore button state
					submitBtn.disabled = false;
					submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
					submitBtnText.textContent = "SEND MESSAGE";
				});
		});
	}

	// Helper to display UI feedback
	function showResult(message, type) {
		resultDiv.textContent = message;
		resultDiv.className = 'px-4 py-3 rounded text-xs font-mono tracking-widest uppercase text-center border mb-6 transition-all duration-300';

		if (type === 'success') {
			resultDiv.classList.add('bg-[#00ff00]/10', 'border-[#00ff00]', 'text-[#00ff00]');
		} else {
			resultDiv.classList.add('bg-red-500/10', 'border-red-500', 'text-red-500');
		}

		resultDiv.classList.remove('hidden');

		// Auto-hide success messages after 5 seconds
		if (type === 'success') {
			setTimeout(() => {
				resultDiv.classList.add('hidden');
			}, 5000);
		}
	}
});
