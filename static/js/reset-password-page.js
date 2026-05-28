import {
  parseEmailActionParams,
  verifyResetCodeAndGetEmail,
  applyPasswordReset,
  mapFirebaseAuthError,
  showAuthError,
} from "./firebase-auth.js";

function bindPasswordToggle() {
  const togglePw = document.getElementById("toggleNewPw");
  const pwInput = document.getElementById("newPassword");
  const eyeIcon = document.getElementById("eyeIconNew");
  if (!togglePw || !pwInput || !eyeIcon) return;

  const eyeOpen = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  const eyeClosed = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  togglePw.addEventListener("click", () => {
    const isHidden = pwInput.type === "password";
    pwInput.type = isHidden ? "text" : "password";
    eyeIcon.innerHTML = isHidden ? eyeClosed : eyeOpen;
  });
}

function showInvalid(message) {
  document.getElementById("resetLoading").style.display = "none";
  document.getElementById("resetPasswordForm").style.display = "none";
  document.getElementById("resetInvalid").style.display = "block";
  const msg = document.getElementById("resetInvalidMsg");
  if (msg) msg.textContent = message;
}

function showForm(email) {
  document.getElementById("resetLoading").style.display = "none";
  document.getElementById("resetInvalid").style.display = "none";
  document.getElementById("resetPasswordForm").style.display = "block";
  const hint = document.getElementById("resetEmailHint");
  if (hint && email) {
    hint.textContent = `Set a new password for ${email}`;
  }
}

async function initResetPage() {
  const params = parseEmailActionParams();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  bindPasswordToggle();

  if (mode !== "resetPassword" || !oobCode) {
    showInvalid("Invalid reset link. Open the link from your email or request a new reset from Sign In.");
    return;
  }

  let accountEmail = "";
  try {
    accountEmail = await verifyResetCodeAndGetEmail(oobCode);
    showForm(accountEmail);
  } catch (err) {
    showInvalid(mapFirebaseAuthError(err));
    return;
  }

  const form = document.getElementById("resetPasswordForm");
  const status = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.style.display = "none";

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const pwInput = document.getElementById("newPassword");

    if (!PPAuthValidation.validatePassword(newPassword, pwInput)) return;

    if (newPassword !== confirmPassword) {
      showAuthError(status, "Passwords do not match.");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await applyPasswordReset(oobCode, newPassword);
      status.textContent = "Password updated! Redirecting to sign in…";
      status.className = "status-msg success";
      status.style.display = "block";
      setTimeout(() => {
        window.location.href = "/static/login.html?reset=success";
      }, 1200);
    } catch (err) {
      showAuthError(status, mapFirebaseAuthError(err));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initResetPage);
} else {
  initResetPage();
}
