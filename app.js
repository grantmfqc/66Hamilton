// Initialization Function
function init() {
  console.log("App initializing...");

  // Navbar
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar && !navbar.classList.contains('hidden-fade')) {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }
  });

  // Hero Parallax & Video
  const heroBg = document.getElementById('hero-bg');
  const heroVideo = document.getElementById('hero-video');
  const playBtn = document.getElementById('play-video-btn');
  const heroContent = document.getElementById('hero-content');
  const scrollHint = document.querySelector('.hero-scroll-hint');

  window.addEventListener('scroll', () => {
    if (heroBg && heroBg.style.opacity !== '0') {
      heroBg.style.transform = `translateY(${window.scrollY * 0.35}px)`;
    }
  }, { passive: true });

  if (playBtn && heroVideo) {
    const heroFullscreenBtn = document.getElementById('hero-fullscreen');
    const heroVideoWrap = document.getElementById('hero-video-wrap');
    const heroRotateHint = document.querySelector('.hero-rotate-hint');

    const handlePlay = () => {
      // Fade out EVERYTHING
      if (heroBg) heroBg.style.opacity = '0';
      if (navbar) navbar.classList.add('hidden-fade');
      if (scrollHint) scrollHint.style.opacity = '0';
      if (heroRotateHint) heroRotateHint.style.opacity = '0';
      
      heroContent.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      heroContent.style.opacity = '0';
      heroContent.style.transform = 'translateY(-20px)';
      
      // Start video
      heroVideo.style.opacity = '1';
      heroVideo.muted = true; // Essential for mobile playback reliability
      heroVideo.play().then(() => {
        console.log("Video playing successfully");
      }).catch(err => {
        console.warn("Video play failed:", err);
        // Fallback: Show UI again if play is blocked
        restoreHeroUI();
      });
      
      // Interaction to pause/restore
      const togglePlay = () => {
        if (!heroVideo.paused) {
          heroVideo.pause();
          restoreHeroUI();
        } else {
          heroVideo.play();
          if (heroRotateHint) heroRotateHint.style.opacity = '0';
        }
      };

      heroVideo.addEventListener('click', togglePlay);
      heroVideo.addEventListener('touchstart', togglePlay, { passive: true });
      heroVideo.addEventListener('ended', restoreHeroUI);
    };

    playBtn.addEventListener('click', handlePlay);
    playBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handlePlay();
    }, { passive: false });

    // Hero Fullscreen
    if (heroFullscreenBtn && heroVideoWrap) {
      const toggleHeroFS = (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          heroVideoWrap.requestFullscreen().catch(err => {
            console.error(`Error: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      };
      heroFullscreenBtn.addEventListener('click', toggleHeroFS);
      heroFullscreenBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleHeroFS(e);
      }, { passive: false });
    }
  }

  function restoreHeroUI() {
    if (heroBg) heroBg.style.opacity = '1';
    if (navbar) navbar.classList.remove('hidden-fade');
    if (scrollHint) scrollHint.style.opacity = '1';
    heroContent.style.opacity = '1';
    heroContent.style.transform = 'translateY(0)';
  }

  // Carousel Logic
  initCarousel();

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

function initCarousel() {
  const track = document.querySelector('.carousel-track');
  const thumbs = document.querySelectorAll('.carousel-thumb');
  const nextBtn = document.querySelector('.carousel-arrow--next');
  const prevBtn = document.querySelector('.carousel-arrow--prev');
  
  if (!track || thumbs.length === 0) return;

  let currentIndex = 0;

  const updateCarousel = (index) => {
    currentIndex = index;
    track.style.transform = `translateX(-${index * 100}%)`;
    
    // Update thumbnails
    thumbs.forEach(t => t.classList.remove('active'));
    thumbs[index].classList.add('active');
    
    // Scroll thumbnail into view
    thumbs[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  nextBtn?.addEventListener('click', () => {
    let nextIndex = (currentIndex + 1) % thumbs.length;
    updateCarousel(nextIndex);
  });

  prevBtn?.addEventListener('click', () => {
    let prevIndex = (currentIndex - 1 + thumbs.length) % thumbs.length;
    updateCarousel(prevIndex);
  });

  thumbs.forEach((thumb, index) => {
    thumb.addEventListener('click', () => updateCarousel(index));
  });

  // Fullscreen Logic
  const fullscreenBtn = document.getElementById('toggle-fullscreen');
  const fullscreenWrap = document.getElementById('gallery-fullscreen-wrap');
  const expandIcon = document.querySelector('.icon-expand');
  const shrinkIcon = document.querySelector('.icon-shrink');

  if (fullscreenBtn && fullscreenWrap) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        fullscreenWrap.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        expandIcon?.classList.add('hidden');
        shrinkIcon?.classList.remove('hidden');
      } else {
        expandIcon?.classList.remove('hidden');
        shrinkIcon?.classList.add('hidden');
      }
    });
  }
}
