// ── SUPABASE CONFIGURATION ──────────────────────────────────────────────────
// Replace these with your actual Supabase project details
const SUPABASE_URL = 'https://vgcrioslaqcrimrdchin.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Cw5imAxvIhxnKZC4ThK41Q_kcWhpsKE';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

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

// ── PROSPECTUS FORM FLOW (Supabase Integrated) ──────────────────────────────
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

// Step 1 → Send OTP via Supabase
step1.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const org = document.getElementById('input-org').value.trim();

  if (!name || !isValidEmail(email)) {
    formError.textContent = "Please enter a valid name and corporate email.";
    formError.classList.remove('hidden');
    return;
  }

  if (!supabase) {
    formError.textContent = "Database connection error. Please check Supabase setup.";
    formError.classList.remove('hidden');
    return;
  }

  formError.classList.add('hidden');
  btnSendCode.disabled = true;
  btnSendCode.querySelector('.btn-label').textContent = "Sending Code...";

  try {
    // 1. Send OTP to user's email
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) throw error;

    // Store data for next step
    submittedEmail = email;
    submittedName = name;
    submittedOrg = org;

    otpEmailDisplay.textContent = email;
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    otpDigits[0].focus();

  } catch (error) {
    console.error('Error sending OTP:', error.message);
    formError.textContent = `Error: ${error.message}`;
    formError.classList.remove('hidden');
  } finally {
    btnSendCode.disabled = false;
    btnSendCode.querySelector('.btn-label').textContent = "Send Verification Code";
  }
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

// Step 2 → Verify OTP and Store Lead
step2.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = [...otpDigits].map(d => d.value).join('');

  if (token.length < 6) return;

  otpError.classList.add('hidden');
  btnVerify.disabled = true;
  btnVerify.querySelector('.btn-label').textContent = "Verifying...";

  try {
    // 2. Verify the OTP code
    const { error: authError } = await supabase.auth.verifyOtp({
      email: submittedEmail,
      token: token,
      type: 'signup'
    });

    if (authError) throw authError;

    // 3. Verification success! Store the lead in the database table
    const { error: dbError } = await supabase
      .from('leads')
      .insert([
        {
          full_name: submittedName,
          email: submittedEmail,
          organisation: submittedOrg,
          created_at: new Date().toISOString()
        }
      ]);

    if (dbError) throw dbError;

    // Success UI
    step2.classList.add('hidden');
    success.classList.remove('hidden');

  } catch (error) {
    console.error('Verification failed:', error.message);
    otpError.textContent = `Verification failed: ${error.message}`;
    otpError.classList.remove('hidden');
    otpDigits.forEach(d => { d.value = ''; d.style.borderColor = 'rgba(224,112,112,.6)'; });
    otpDigits[0].focus();
    setTimeout(() => otpDigits.forEach(d => d.style.borderColor = ''), 1800);
  } finally {
    btnVerify.disabled = false;
    btnVerify.querySelector('.btn-label').textContent = "Verify & Send Prospectus";
  }
});

// Back button
btnBack.addEventListener('click', () => {
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  otpDigits.forEach(d => d.value = '');
});

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
