// ── NAVBAR scroll effect ──────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ── HERO parallax ─────────────────────────────────────────────────────────
const heroBg = document.getElementById('hero-bg');
window.addEventListener('scroll', () => {
  if (heroBg) {
    heroBg.style.transform = `translateY(${window.scrollY * 0.35}px)`;
  }
}, { passive: true });

// ── REVEAL on scroll ─────────────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.classList.add('visible');
      revealObserver.unobserve(el.target);
    }
  });
}, { threshold: 0.12 });
revealEls.forEach(el => revealObserver.observe(el));

// ── OTP FORM FLOW ─────────────────────────────────────────────────────────
const step1 = document.getElementById('form-step1');
const step2 = document.getElementById('form-step2');
const success = document.getElementById('form-success');
const formError = document.getElementById('form-error');
const otpError = document.getElementById('otp-error');
const otpEmailDisplay = document.getElementById('otp-email-display');
const btnBack = document.getElementById('btn-back');
const otpDigits = document.querySelectorAll('.otp-digit');

let storedOtp = '';
let submittedEmail = '';

// Step 1 → send OTP
step1.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name  = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  if (!name || !isValidEmail(email)) {
    formError.classList.remove('hidden');
    return;
  }
  formError.classList.add('hidden');
  submittedEmail = email;

  // Generate a 6-digit OTP (demo — in production this happens server-side)
  storedOtp = String(Math.floor(100000 + Math.random() * 900000));
  console.log(`[DEV] OTP for ${email}: ${storedOtp}`);

  // TODO: Replace with your real API call e.g.:
  // await fetch('/api/send-otp', { method:'POST', body: JSON.stringify({ name, email, otp: storedOtp }) });

  otpEmailDisplay.textContent = email;
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
  otpDigits[0].focus();
});

// OTP digit auto-advance
otpDigits.forEach((digit, i) => {
  digit.addEventListener('input', () => {
    digit.value = digit.value.replace(/\D/g, '');
    if (digit.value && i < otpDigits.length - 1) {
      otpDigits[i + 1].focus();
    }
  });
  digit.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !digit.value && i > 0) {
      otpDigits[i - 1].focus();
    }
  });
  digit.addEventListener('paste', (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length) {
      e.preventDefault();
      [...pasted].forEach((ch, idx) => {
        if (otpDigits[idx]) otpDigits[idx].value = ch;
      });
      const nextEmpty = [...otpDigits].findIndex(d => !d.value);
      if (nextEmpty !== -1) otpDigits[nextEmpty].focus();
      else otpDigits[5].focus();
    }
  });
});

// Step 2 → verify OTP
step2.addEventListener('submit', (e) => {
  e.preventDefault();
  const entered = [...otpDigits].map(d => d.value).join('');
  if (entered !== storedOtp) {
    otpError.classList.remove('hidden');
    otpDigits.forEach(d => { d.value = ''; d.style.borderColor = 'rgba(224,112,112,.6)'; });
    otpDigits[0].focus();
    setTimeout(() => otpDigits.forEach(d => d.style.borderColor = ''), 1800);
    return;
  }
  otpError.classList.add('hidden');

  // TODO: Replace with your API call to send the PDF prospectus:
  // await fetch('/api/send-prospectus', { method:'POST', body: JSON.stringify({ email: submittedEmail }) });

  step2.classList.add('hidden');
  success.classList.remove('hidden');
});

// Back button
btnBack.addEventListener('click', () => {
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  otpDigits.forEach(d => d.value = '');
});

// Email validator
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
