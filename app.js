// Initialization Function
function init() {
  console.log("App initializing...");

  // Navbar
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // Hero Parallax & Video
  const heroBg = document.getElementById('hero-bg');
  const heroVideo = document.getElementById('hero-video');
  const playBtn = document.getElementById('play-video-btn');
  const heroContent = document.getElementById('hero-content');

  window.addEventListener('scroll', () => {
    if (heroBg && heroBg.style.opacity !== '0') {
      heroBg.style.transform = `translateY(${window.scrollY * 0.35}px)`;
    }
  }, { passive: true });

  if (playBtn && heroVideo) {
    playBtn.addEventListener('click', () => {
      // Fade out background and content
      if (heroBg) heroBg.style.opacity = '0';
      heroContent.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      heroContent.style.opacity = '0';
      heroContent.style.transform = 'translateY(-20px)';
      
      // Start video
      heroVideo.style.opacity = '1';
      heroVideo.play();
      
      // Optional: Add a way to pause or exit
      heroVideo.addEventListener('click', () => {
        if (heroVideo.paused) {
          heroVideo.play();
        } else {
          heroVideo.pause();
          // Bring back content
          if (heroBg) heroBg.style.opacity = '1';
          heroContent.style.opacity = '1';
          heroContent.style.transform = 'translateY(0)';
        }
      });

      // When video ends, bring back the UI
      heroVideo.addEventListener('ended', () => {
        if (heroBg) heroBg.style.opacity = '1';
        heroContent.style.opacity = '1';
        heroContent.style.transform = 'translateY(0)';
      });
    });
  }

  // Reveal Logic
  const revealEls = document.querySelectorAll('.reveal');
  console.log("Found " + revealEls.length + " reveal elements.");

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(el => {
        if (el.isIntersecting) {
          el.target.classList.add('visible');
          revealObserver.unobserve(el.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  // Fallback: If nothing is visible after 2 seconds, force show everything
  setTimeout(() => {
    const firstReveal = document.querySelector('.reveal:not(.visible)');
    if (firstReveal) {
      console.warn("Reveal fallback triggered.");
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }
  }, 2000);

  // Form Logic
  const step1 = document.getElementById('form-step1');
  const success = document.getElementById('form-success');
  const formError = document.getElementById('form-error');
  const btnSendCode = document.getElementById('btn-send-code');

  if (step1) {
    step1.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-name').value.trim();
      const email = document.getElementById('input-email').value.trim();
      const org = document.getElementById('input-org').value.trim();
      const phone = document.getElementById('input-phone').value.trim();
      const pref = document.getElementById('input-pref').value;
      
      const formData = new FormData(e.target);
      const turnstileToken = formData.get('cf-turnstile-response');

      if (!name || !isValidEmail(email) || !phone || !turnstileToken) {
        formError.textContent = "Please fill in all fields and verify you are human.";
        formError.classList.remove('hidden');
        return;
      }

      formError.classList.add('hidden');
      btnSendCode.disabled = true;
      btnSendCode.querySelector('.btn-label').textContent = "Requesting...";

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, org, phone, pref, token: turnstileToken })
        });
        
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Server error');
        }

        step1.classList.add('hidden');
        success.classList.remove('hidden');
      } catch (err) {
        formError.textContent = "Error: " + err.message;
        formError.classList.remove('hidden');
      } finally {
        btnSendCode.disabled = false;
        btnSendCode.querySelector('.btn-label').textContent = "Request Prospectus";
        // Reset turnstile
        if (window.turnstile) {
          window.turnstile.reset();
        }
      }
    });
  }
}

// Ensure the script runs even if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
