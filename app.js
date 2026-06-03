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
        if (heroVideoWrap.requestFullscreen) {
          if (!document.fullscreenElement) {
            heroVideoWrap.requestFullscreen().catch(err => console.error(err));
          } else {
            document.exitFullscreen();
          }
        } else if (heroVideoWrap.webkitRequestFullscreen) { /* Safari Desktop/iPad */
          if (!document.webkitFullscreenElement) {
            heroVideoWrap.webkitRequestFullscreen();
          } else {
            document.webkitExitFullscreen();
          }
        } else if (heroVideo.webkitEnterFullscreen) { /* iOS iPhone Safari */
          heroVideo.webkitEnterFullscreen();
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

  // Portal Login UI Bindings
  const loginBtn = document.getElementById('portal-login-btn');
  const closeBtn = document.getElementById('login-close-btn');
  const changeEmailBtn = document.getElementById('login-change-email-btn');
  const step1Form = document.getElementById('login-step1-form');
  const step2Form = document.getElementById('login-step2-form');
  const loginModal = document.getElementById('login-modal');

  loginBtn?.addEventListener('click', openLoginModal);
  closeBtn?.addEventListener('click', closeLoginModal);
  changeEmailBtn?.addEventListener('click', backToStep1);
  step1Form?.addEventListener('submit', handleRequestOTP);
  step2Form?.addEventListener('submit', handleVerifyOTP);

  // Close modal if click is on the overlay backdrop
  loginModal?.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      closeLoginModal();
    }
  });

  // Auto-trigger login modal if login=1 query parameter is present (e.g. redirected from session timeout)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('login')) {
    const emailParam = urlParams.get('email');
    if (emailParam) {
      const emailInput = document.getElementById('login-email-input');
      if (emailInput) {
        emailInput.value = emailParam;
      }
    }
    setTimeout(() => { openLoginModal(); }, 300);
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
  const step2 = document.getElementById('form-step2');
  const success = document.getElementById('form-success');
  const formError = document.getElementById('form-error');
  const verifyError = document.getElementById('verify-error');
  const btnSendCode = document.getElementById('btn-send-code');
  const btnVerifyCode = document.getElementById('btn-verify-code');
  const btnBackCode = document.getElementById('btn-back-code');

  if (step1 && step2) {
    // Step 1 Submit Handler (Request validation code)
    step1.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-name').value.trim();
      const email = document.getElementById('input-email').value.trim();
      const org = document.getElementById('input-org').value.trim();
      const phone = document.getElementById('input-phone').value.trim();
      const pref = document.getElementById('input-pref').value;
      const country = document.getElementById('input-country').value.trim();
      
      const formData = new FormData(e.target);
      const turnstileToken = formData.get('cf-turnstile-response');

      if (!name || !isValidEmail(email) || !phone || !country || !turnstileToken) {
        formError.textContent = "Please fill in all fields (including country of residence) and verify you are human.";
        formError.classList.remove('hidden');
        return;
      }

      formError.classList.add('hidden');
      btnSendCode.disabled = true;
      btnSendCode.querySelector('.btn-label').textContent = "Sending Code...";

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, org, phone, pref, token: turnstileToken, country })
        });
        
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Server error');
        }

        // Move to Step 2 Verification code screen
        document.getElementById('verification-target-email').textContent = email;
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
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

    // Step 2 Submit Handler (Verify validation code)
    step2.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-name').value.trim();
      const email = document.getElementById('input-email').value.trim();
      const org = document.getElementById('input-org').value.trim();
      const phone = document.getElementById('input-phone').value.trim();
      const pref = document.getElementById('input-pref').value;
      const code = document.getElementById('input-code').value.trim();
      const country = document.getElementById('input-country').value.trim();

      if (!code || code.length !== 6) {
        verifyError.textContent = "Please enter the 6-digit verification code.";
        verifyError.classList.remove('hidden');
        return;
      }

      verifyError.classList.add('hidden');
      btnVerifyCode.disabled = true;
      btnVerifyCode.querySelector('.btn-label').textContent = "Verifying...";

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, org, phone, pref, code, country })
        });
        
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Server error');
        }

        // Show Success
        step2.classList.add('hidden');
        success.classList.remove('hidden');
      } catch (err) {
        verifyError.textContent = err.message;
        verifyError.classList.remove('hidden');
      } finally {
        btnVerifyCode.disabled = false;
        btnVerifyCode.querySelector('.btn-label').textContent = "Confirm Verification";
      }
    });

    // Step 2 Back Button Handler
    btnBackCode?.addEventListener('click', () => {
      step2.classList.add('hidden');
      step1.classList.remove('hidden');
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

// ═══════════════════════════════ RESIDENT PORTAL LOGIN SCRIPT ═══════════════════════════════
let resendCooldownInterval = null;

function openLoginModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  
  // Clear any existing states
  document.getElementById('login-error-banner').style.display = 'none';
  document.getElementById('login-success-banner').style.display = 'none';
  document.getElementById('login-step1-form').style.display = 'block';
  document.getElementById('login-step2-form').style.display = 'none';
  
  // Restore email from memory
  const savedEmail = localStorage.getItem('login_email') || '';
  document.getElementById('login-email-input').value = savedEmail;
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closeLoginModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore background scroll
  
  if (resendCooldownInterval) {
    clearInterval(resendCooldownInterval);
  }
}

function backToStep1(e) {
  if (e) e.preventDefault();
  document.getElementById('login-step1-form').style.display = 'block';
  document.getElementById('login-step2-form').style.display = 'none';
  document.getElementById('login-error-banner').style.display = 'none';
  document.getElementById('login-success-banner').style.display = 'none';
}

async function handleRequestOTP(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('login-email-input');
  const email = emailInput.value.trim();
  const errorBanner = document.getElementById('login-error-banner');
  const successBanner = document.getElementById('login-success-banner');
  const reqBtn = document.getElementById('login-request-btn');
  
  if (!email || !isValidEmail(email)) {
    showLoginError("Please enter a valid email address.");
    return;
  }

  errorBanner.style.display = 'none';
  successBanner.style.display = 'none';
  reqBtn.disabled = true;
  reqBtn.textContent = "Dispatched Request...";

  try {
    const res = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    // Save email in memory
    localStorage.setItem('login_email', email);

    // Transition to Step 2
    document.getElementById('sent-email-placeholder').textContent = email;
    document.getElementById('login-step1-form').style.display = 'none';
    document.getElementById('login-step2-form').style.display = 'block';
    
    // Clear code input field
    document.getElementById('login-otp-input').value = '';

    // Start 60s cooldown timer
    startResendCooldown();
  } catch (err) {
    showLoginError(err.message);
  } finally {
    reqBtn.disabled = false;
    reqBtn.textContent = "Request Access Code";
  }
}

async function handleVerifyOTP(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('login-email-input').value.trim();
  const otp = document.getElementById('login-otp-input').value.trim();
  const errorBanner = document.getElementById('login-error-banner');
  const successBanner = document.getElementById('login-success-banner');
  const verifyBtn = document.getElementById('login-verify-btn');

  if (!otp || otp.length !== 6) {
    showLoginError("Please enter the 6-digit verification code.");
    return;
  }

  errorBanner.style.display = 'none';
  successBanner.style.display = 'none';
  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying Environment...";

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');

    // Authentication Success! Save session
    localStorage.setItem('session_token', data.token);
    localStorage.setItem('session_role', data.role);
    localStorage.setItem('session_email', email);

    successBanner.textContent = "Identity Verified! Redirecting to Resident Dashboard...";
    successBanner.style.display = 'block';

    setTimeout(() => {
      closeLoginModal();
      if (data.role === 'admin') {
        window.location.href = 'admin.html';
      } else if (data.tokenId) {
        window.location.href = `apply.html?token=${data.tokenId}`;
      } else {
        // Portal-access-only user (manually added, no specific application)
        window.location.href = 'index.html';
      }
    }, 1500);

  } catch (err) {
    showLoginError(err.message);
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify & Sign In";
  }
}

function startResendCooldown() {
  const cooldownText = document.getElementById('login-cooldown-text');
  const resendLink = document.getElementById('login-resend-link');
  
  resendLink.style.display = 'none';
  cooldownText.style.display = 'inline';
  
  let timeLeft = 60;
  
  if (resendCooldownInterval) {
    clearInterval(resendCooldownInterval);
  }
  
  const updateTimer = () => {
    cooldownText.textContent = `Resend code in ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(resendCooldownInterval);
      cooldownText.style.display = 'none';
      resendLink.style.display = 'inline';
    }
    timeLeft--;
  };
  
  updateTimer();
  resendCooldownInterval = setInterval(updateTimer, 1000);
}

function showLoginError(msg) {
  const banner = document.getElementById('login-error-banner');
  banner.textContent = msg;
  banner.style.display = 'block';
}
