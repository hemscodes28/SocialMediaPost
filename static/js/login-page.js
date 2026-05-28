import {
  signInWithEmail,
  completeSession,
  mapFirebaseAuthError,
  showAuthError,
  requestPasswordReset,
} from "./firebase-auth.js";
import { initGoogleAuth } from "./google-auth.js";

function initLoginPage() {
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

  const loginForm = document.getElementById("loginForm");
  const status = document.getElementById("status");
  const forgotPanel = document.getElementById("forgotPasswordPanel");
  const forgotEmailInput = document.getElementById("forgotEmail");
  const emailInput = document.getElementById("email");

  function showLoginForm() {
    if (forgotPanel) {
      forgotPanel.classList.remove("open");
      forgotPanel.setAttribute("aria-hidden", "true");
    }
    if (loginForm) loginForm.style.display = "";
    document.getElementById("googleSignInContainer")?.style.setProperty("display", "flex");
    document.querySelector(".auth-divider")?.style.setProperty("display", "");
  }

  function showForgotPanel() {
    if (forgotPanel) {
      forgotPanel.classList.add("open");
      forgotPanel.setAttribute("aria-hidden", "false");
      if (emailInput?.value && forgotEmailInput) {
        forgotEmailInput.value = emailInput.value.trim();
      }
      forgotEmailInput?.focus();
    }
    if (loginForm) loginForm.style.display = "none";
    document.getElementById("googleSignInContainer")?.style.setProperty("display", "none");
    document.querySelector(".auth-divider")?.style.setProperty("display", "none");
    if (status) status.style.display = "none";
  }

  function showResetSuccessBanner() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") !== "success") return;
    if (status) {
      status.textContent =
        "Password updated successfully. Sign in with your new password to open your dashboard.";
      status.className = "status-msg success";
      status.style.display = "block";
    }
    window.history.replaceState({}, "", "/static/login.html");
  }

  bindPasswordToggle();
  PPAuthValidation.bindLiveValidation(loginForm, "login");
  showResetSuccessBanner();

  if (window.location.hash === "#forgot") {
    showForgotPanel();
    window.history.replaceState({}, "", "/static/login.html");
  }

  document.getElementById("forgotPasswordBtn")?.addEventListener("click", showForgotPanel);
  document.getElementById("cancelForgotBtn")?.addEventListener("click", showLoginForm);

  document.getElementById("sendResetEmailBtn")?.addEventListener("click", async () => {
    const email = (forgotEmailInput?.value || emailInput?.value || "").trim();
    const forgotEmailField = forgotEmailInput;
    if (forgotEmailField && !PPAuthValidation.validateEmail(email, forgotEmailField)) return;

    const btn = document.getElementById("sendResetEmailBtn");
    if (btn) btn.disabled = true;
    if (status) status.style.display = "none";

    try {
      await requestPasswordReset(email);
      if (status) {
        status.textContent =
          "Reset link sent! Check your inbox (and spam folder), then open the link to set a new password.";
        status.className = "status-msg success";
        status.style.display = "block";
      }
      showLoginForm();
    } catch (err) {
      showAuthError(status, mapFirebaseAuthError(err));
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!PPAuthValidation.validateLoginForm(loginForm)) return;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    status.style.display = "none";

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const data = await signInWithEmail(email, password);
      completeSession(data, status, "Welcome back! Opening your dashboard…");
    } catch (err) {
      showAuthError(status, mapFirebaseAuthError(err));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  initGoogleAuth("login");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoginPage);
} else {
  initLoginPage();
}
