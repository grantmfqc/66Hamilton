// Supabase Configuration
const SUPABASE_URL = 'https://vgcrioslaqcrimrdchin.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Cw5imAxvIhxnKZC4ThK41Q_kcWhpsKE';

let supabase = null;

// Initialization Function
function init() {
  console.log("App initializing...");

  // Initialize Supabase
  try {
    if (window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Supabase connected.");
    }
  } catch (e) {
    console.error("Supabase error:", e);
  }

  // Navbar
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // Hero Parallax
  const heroBg = document.getElementById('hero-bg');
  window.addEventListener('scroll', () => {
    if (heroBg) {
      heroBg.style.transform = `translateY(${window.scrollY * 0.35}px)`;
    }
  }, { passive: true });

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

  // Form Logic
  const step1 = document.getElementById('form-step1');
  const step2 = document.getElementById('form-step2');
  const success = document.getElementById('form-success');
  const formError = document.getElementById('form-error');
  const otpError = document.getElementById('otp-error');
  const otpEmailDisplay = document.getElementById('otp-email-display');
  const btnBack = document.getElementById('btn-back');
  const otpDigits = document.querySelectorAll('.otp-digit');
  const btnSendCode = document.getElementById('btn-send-code');
  const btnVerify = document.getElementById('btn-verify');

  let submittedEmail = '';
  let submittedName = '';
  let submittedOrg = '';

  if (step1) {
    step1.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-name').value.trim();
      const email = document.getElementById('input-email').value.trim();
      const org = document.getElementById('input-org').value.trim();

      if (!name || !isValidEmail(email)) {
        formError.textContent = "Valid name and corporate email required.";
        formError.classList.remove('hidden');
        return;
      }

      if (!supabase) {
        formError.textContent = "Database error. Please refresh.";
        formError.classList.remove('hidden');
        return;
      }

      formError.classList.add('hidden');
      btnSendCode.disabled = true;
      btnSendCode.querySelector('.btn-label').textContent = "Sending...";

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: email,
          options: { shouldCreateUser: true }
        });
        if (error) throw error;

        submittedEmail = email;
        submittedName = name;
        submittedOrg = org;
        otpEmailDisplay.textContent = email;
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        if (otpDigits[0]) otpDigits[0].focus();
      } catch (err) {
        formError.textContent = "Error: " + err.message;
        formError.classList.remove('hidden');
      } finally {
        btnSendCode.disabled = false;
        btnSendCode.querySelector('.btn-label').textContent = "Send Verification Code";
      }
    });
  }

  otpDigits.forEach((digit, i) => {
    digit.addEventListener('input', () => {
      digit.value = digit.value.replace(/\D/g, '');
      if (digit.value && i < otpDigits.length - 1) otpDigits[i + 1].focus();
    });
    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && i > 0) otpDigits[i - 1].focus();
    });
  });

  if (step2) {
    step2.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = [...otpDigits].map(d => d.value).join('');
      if (token.length < 6) return;

      otpError.classList.add('hidden');
      btnVerify.disabled = true;
      btnVerify.querySelector('.btn-label').textContent = "Verifying...";

      try {
        const { error: authError } = await supabase.auth.verifyOtp({
          email: submittedEmail,
          token: token,
          type: 'signup'
        });
        if (authError) throw authError;

        await supabase.from('leads').insert([{
          full_name: submittedName,
          email: submittedEmail,
          organisation: submittedOrg
        }]);

        step2.classList.add('hidden');
        success.classList.remove('hidden');
      } catch (err) {
        otpError.textContent = "Failed: " + err.message;
        otpError.classList.remove('hidden');
      } finally {
        btnVerify.disabled = false;
        btnVerify.querySelector('.btn-label').textContent = "Verify & Send Prospectus";
      }
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
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
