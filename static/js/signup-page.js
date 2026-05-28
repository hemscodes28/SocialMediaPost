import {
  signUpWithEmail,
  completeSession,
  mapFirebaseAuthError,
  showAuthError,
} from "./firebase-auth.js";
import { initGoogleAuth } from "./google-auth.js";

function initSignupPage() {
function bindPasswordToggle() {
  const togglePw = document.getElementById("togglePw");
  const pwInput = document.getElementById("password");
  const eyeIcon = document.getElementById("eyeIcon");
  if (!togglePw || !pwInput || !eyeIcon) return;

  const eyeOpen = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  const eyeClosed = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  togglePw.addEventListener("click", () => {
    const isHidden = pwInput.type === "password";
    pwInput.type = isHidden ? "text" : "password";
    eyeIcon.innerHTML = isHidden ? eyeClosed : eyeOpen;
  });
}

const signupForm = document.getElementById("signupForm");
const status = document.getElementById("status");

bindPasswordToggle();
PPAuthValidation.bindLiveValidation(signupForm, "signup");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!PPAuthValidation.validateSignupForm(signupForm)) return;

  const full_name = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  status.style.display = "none";

  const submitBtn = signupForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const data = await signUpWithEmail(email, password, full_name);
    completeSession(data, status, "Account created! Opening your dashboard…");
  } catch (err) {
    showAuthError(status, mapFirebaseAuthError(err));
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

initGoogleAuth("signup");

(function prefillSignupFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const fullName = params.get("full_name") || params.get("fullname");
  const email = params.get("email");
  const nameEl = document.getElementById("fullname");
  const emailEl = document.getElementById("email");

  if (fullName && nameEl) nameEl.value = fullName;
  if (email && emailEl) emailEl.value = email;

  if ((fullName || email) && status) {
    status.textContent = "Complete your registration below or continue with Google.";
    status.className = "status-msg success";
    status.style.display = "block";
  }
})();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSignupPage);
} else {
  initSignupPage();
}
