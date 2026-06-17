import { auth } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  onIdTokenChanged,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const FIREBASE_AUTH_ERRORS = {
  "auth/email-already-in-use": "This email is already registered. Try signing in instead.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase. Enable it in the Firebase console.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters with upper, lower, and a symbol.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/account-exists-with-different-credential":
    "An account already exists with this email using a different sign-in method.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/invalid-action-code": "This reset link is invalid or has already been used. Request a new one.",
  "auth/expired-action-code": "This reset link has expired. Request a new password reset email.",
  "auth/missing-email": "Enter your email address first.",
};

/** Where users land after clicking the link in the reset email (must be an authorized domain). */
export function getPasswordResetActionSettings() {
  const origin = window.location.origin;
  return {
    url: `${origin}/static/reset-password.html`,
    handleCodeInApp: true,
  };
}

/** Send Firebase password reset email. */
export async function requestPasswordReset(email) {
  const trimmed = (email || "").trim();
  if (!trimmed) {
    const err = new Error("Enter your email address.");
    err.code = "auth/missing-email";
    throw err;
  }
  await sendPasswordResetEmail(auth, trimmed, getPasswordResetActionSettings());
}

/** Read mode/oobCode from query string or hash (Firebase email links). */
export function parseEmailActionParams() {
  const search = new URLSearchParams(window.location.search);
  if (search.get("oobCode") || search.get("mode")) return search;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) return new URLSearchParams(hash);
  return search;
}

/** Validate reset code and return the account email. */
export async function verifyResetCodeAndGetEmail(oobCode) {
  return verifyPasswordResetCode(auth, oobCode);
}

/** Set new password using the code from the email link. */
export async function applyPasswordReset(oobCode, newPassword) {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

/** Keep Firebase ID token fresh for the signed-in user session. */
onIdTokenChanged(auth, async (user) => {
  if (user) {
    try {
      await user.getIdToken(true);
    } catch {
      /* ignore background refresh errors */
    }
  }
});

export function mapFirebaseAuthError(err) {
  const code = err?.code || "";
  if (FIREBASE_AUTH_ERRORS[code]) return FIREBASE_AUTH_ERRORS[code];
  const msg = err?.message || "";
  if (msg.includes("Invalid or expired Firebase token")) {
    return "Sign-in session expired. Please try Google sign-in again.";
  }
  return msg || "Authentication failed. Please try again.";
}

async function waitForAuthReady() {
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
}

/**
 * Force-refresh the Firebase ID token (replaces expired tokens).
 * @param {import('firebase/auth').User} user
 * @param {boolean} forceRefresh
 */
export async function getFreshFirebaseIdToken(user, forceRefresh = true) {
  if (!user) throw new Error("Not signed in.");
  await waitForAuthReady();
  return user.getIdToken(forceRefresh);
}

async function postFirebaseToken(idToken, fullName) {
  return fetch("/api/auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_token: idToken,
      full_name: fullName || undefined,
    }),
  });
}

/**
 * Exchange Firebase session with automatic token refresh + one retry on 401.
 * @param {import('firebase/auth').User} user
 * @param {string} [fullName]
 */
export async function exchangeFirebaseSessionWithUser(user, fullName) {
  let idToken = await getFreshFirebaseIdToken(user, true);
  let resp = await postFirebaseToken(idToken, fullName);

  if (resp.status === 401) {
    idToken = await getFreshFirebaseIdToken(user, true);
    resp = await postFirebaseToken(idToken, fullName);
  }

  let data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.detail || "Could not sign in to Post Pilot.");
    err.code = resp.status === 401 ? "auth/token-expired" : undefined;
    throw err;
  }
  
  if (data.otp_required) {
    data = await showOtpVerificationModal(data.email, {
      id_token: idToken,
      full_name: fullName
    });
  }
  
  return data;
}

export async function exchangeFirebaseSession(idToken, fullName) {
  const resp = await postFirebaseToken(idToken, fullName);
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || "Could not sign in to Post Pilot.");
  }
  return data;
}

/**
 * Used after EMAIL or GOOGLE sign-in (existing / returning users).
 * Always routes to the main dashboard.
 */
export function completeSession(data, statusEl, successMessage) {
  if (!data?.access_token) {
    throw new Error("Server did not return an access token.");
  }
  localStorage.setItem("access_token", data.access_token);
  // Clear any stale new-user flag so returning users are never sent to onboarding
  localStorage.removeItem('is_new_user');
  if (statusEl) {
    statusEl.textContent = successMessage;
    statusEl.className = "status-msg success";
    statusEl.style.display = "block";
  }
  setTimeout(() => {
    window.location.href = "/static/index.html?tab=profile";
  }, 800);
}

/**
 * Used ONLY after a brand-new sign-up.
 * Always routes to the onboarding questionnaire first.
 */
export function completeSessionNewUser(data, statusEl, successMessage) {
  if (!data?.access_token) {
    throw new Error("Server did not return an access token.");
  }
  localStorage.setItem("access_token", data.access_token);
  localStorage.removeItem('is_new_user'); // clean up just in case
  if (statusEl) {
    statusEl.textContent = successMessage;
    statusEl.className = "status-msg success";
    statusEl.style.display = "block";
  }
  setTimeout(() => {
    window.location.href = "/static/onboarding.html";
  }, 700);
}

export function showAuthError(statusEl, message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = "status-msg error";
  statusEl.style.display = "block";
}

async function legacyEmailLogin(email, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  let data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Sign in failed. Check your credentials.");
  }
  
  if (data.otp_required) {
    data = await showOtpVerificationModal(data.email, {
      password: password
    });
  }
  
  return data;
}

export async function signInWithEmail(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return exchangeFirebaseSessionWithUser(credential.user, credential.user.displayName);
  } catch (err) {
    const code = err?.code || "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-not-found" ||
      code === "auth/wrong-password"
    ) {
      return legacyEmailLogin(email, password);
    }
    throw err;
  }
}

export async function signUpWithEmail(email, password, fullName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (fullName) {
    await updateProfile(credential.user, { displayName: fullName });
  }
  await waitForAuthReady();
  return exchangeFirebaseSessionWithUser(credential.user, fullName);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;
  await waitForAuthReady();
  const name = user.displayName || user.email?.split("@")[0] || "";
  return exchangeFirebaseSessionWithUser(user, name);
}

function showOtpVerificationModal(email, authParams) {
  return new Promise((resolve, reject) => {
    // 1. Inject Styles dynamically if not already injected
    if (!document.getElementById("otpModalStyles")) {
      const style = document.createElement("style");
      style.id = "otpModalStyles";
      style.textContent = `
        .otp-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .otp-modal-backdrop.open {
          opacity: 1;
        }
        .otp-modal-card {
          width: min(420px, 92vw);
          background: var(--surface-dark, #fff);
          border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
          border-radius: 24px;
          padding: 36px 32px;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.12);
          text-align: center;
          transform: translateY(20px) scale(0.96);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .otp-modal-backdrop.open .otp-modal-card {
          transform: translateY(0) scale(1);
        }
        .otp-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: none;
          border: none;
          font-size: 1.25rem;
          color: var(--text-dim, #64748b);
          cursor: pointer;
          transition: var(--transition, all 0.2s);
        }
        .otp-close-btn:hover {
          color: var(--text-main, #0f172a);
        }
        .otp-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: var(--accent-glow, rgba(37, 99, 235, 0.08));
          color: var(--accent, #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin: 0 auto 20px;
        }
        .otp-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--text-main, #0f172a);
          margin-bottom: 8px;
          font-family: 'Outfit', sans-serif;
        }
        .otp-subtitle {
          color: var(--text-dim, #64748b);
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .otp-input-group {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .otp-input-group input {
          width: 46px;
          height: 52px;
          text-align: center;
          font-size: 1.35rem;
          font-weight: 700;
          border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
          border-radius: 12px;
          background: var(--surface-lighter, #f3f4f6);
          color: var(--text-main, #0f172a);
          transition: var(--transition, all 0.2s);
        }
        .otp-input-group input:focus {
          outline: none;
          border-color: var(--accent, #2563eb);
          background: #fff;
          box-shadow: 0 0 0 4px var(--accent-glow, rgba(37, 99, 235, 0.08));
        }
        .otp-dev-badge {
          display: block;
          margin: 0 auto 20px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px dashed rgba(16, 185, 129, 0.25);
          color: #059669;
          font-size: 0.82rem;
          font-weight: 600;
          max-width: max-content;
        }
        .otp-btn {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 0.95rem;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, var(--primary, #000), var(--accent, #2563eb));
          color: #fff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
          transition: var(--transition, all 0.2s);
          margin-bottom: 20px;
        }
        .otp-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }
        .otp-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .otp-resend {
          font-size: 0.82rem;
          color: var(--text-dim, #64748b);
        }
        .otp-resend-btn {
          background: none;
          border: none;
          color: var(--accent, #2563eb);
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }
        .otp-resend-btn:disabled {
          color: var(--text-dim, #64748b);
          text-decoration: none;
          cursor: not-allowed;
        }
        .otp-status {
          font-size: 0.82rem;
          margin-bottom: 16px;
          display: none;
          padding: 10px 14px;
          border-radius: 10px;
          text-align: left;
        }
        .otp-status.error {
          display: block;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: var(--error, #ef4444);
        }
        .otp-status.success {
          display: block;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.15);
          color: var(--success, #10b981);
        }
      `;
      document.head.appendChild(style);
    }

    const backdrop = document.createElement("div");
    backdrop.className = "otp-modal-backdrop";

    backdrop.innerHTML = `
      <div class="otp-modal-card">
        <button type="button" class="otp-close-btn" id="otpCloseBtn" aria-label="Close modal">&times;</button>
        <div class="otp-icon"><i class="fas fa-envelope-open-text"></i></div>
        <h3 class="otp-title">Enter Verification Code</h3>
        <p class="otp-subtitle">We have sent a 6-digit verification code to<br><strong style="color: var(--text-main); font-weight: 600;">${email}</strong></p>
        
        <div id="otpStatus" class="otp-status"></div>
        
        <div class="otp-input-group" id="otpInputGroup">
          <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" required>
          <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" required>
          <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" required>
          <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" required>
          <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" required>
          <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" required>
        </div>

        <button type="button" class="otp-btn" id="otpSubmitBtn">Verify Code</button>
        
        <div class="otp-resend">
          Didn't receive the email? 
          <button type="button" class="otp-resend-btn" id="otpResendBtn" disabled>Resend in 60s</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Trigger reflow & open transition
    setTimeout(() => backdrop.classList.add("open"), 10);

    const inputs = backdrop.querySelectorAll(".otp-input-group input");
    const closeBtn = backdrop.querySelector("#otpCloseBtn");
    const submitBtn = backdrop.querySelector("#otpSubmitBtn");
    const resendBtn = backdrop.querySelector("#otpResendBtn");
    const statusEl = backdrop.querySelector("#otpStatus");

    // Focus the first input box
    setTimeout(() => inputs[0].focus(), 150);

    // 3. Handle Input Focus jumping
    inputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        // Replace non-numeric input
        input.value = input.value.replace(/[^0-9]/g, "");
        if (input.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });
      
      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text").replace(/[^0-9]/g, "");
        if (text.length >= 6) {
          inputs.forEach((inp, idx) => {
            inp.value = text[idx] || "";
          });
          inputs[inputs.length - 1].focus();
        }
      });
    });

    // 4. Timer logic for resending OTP
    let cooldown = 60;
    let timerId = setInterval(() => {
      cooldown--;
      if (cooldown <= 0) {
        clearInterval(timerId);
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend Code";
      } else {
        resendBtn.textContent = `Resend in ${cooldown}s`;
      }
    }, 1000);

    // Cleanup helper
    function cleanup() {
      clearInterval(timerId);
      backdrop.classList.remove("open");
      setTimeout(() => {
        backdrop.remove();
      }, 300);
    }

    // Close logic
    closeBtn.addEventListener("click", () => {
      cleanup();
      reject(new Error("Verification cancelled by user."));
    });

    // 5. Verification submit logic
    async function handleVerify() {
      const code = Array.from(inputs).map(inp => inp.value).join("");
      if (code.length < 6) {
        statusEl.textContent = "Please enter all 6 digits.";
        statusEl.className = "otp-status error";
        statusEl.style.display = "block";
        return;
      }

      statusEl.style.display = "none";
      submitBtn.disabled = true;
      inputs.forEach(inp => inp.disabled = true);

      try {
        const payload = {
          email: email,
          code: code,
          id_token: authParams.id_token || undefined,
          password: authParams.password || undefined,
          full_name: authParams.full_name || undefined
        };

        const resp = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.detail || "Verification failed. Try again.");
        }

        // Success!
        statusEl.textContent = "Identity verified successfully!";
        statusEl.className = "otp-status success";
        statusEl.style.display = "block";
        setTimeout(() => {
          cleanup();
          resolve(data);
        }, 800);

      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = "otp-status error";
        statusEl.style.display = "block";
        submitBtn.disabled = false;
        inputs.forEach(inp => inp.disabled = false);
        inputs[0].focus();
      }
    }

    submitBtn.addEventListener("click", handleVerify);

    // Support Enter key submission
    inputs.forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          handleVerify();
        }
      });
    });

    // 6. Resend logic
    resendBtn.addEventListener("click", async () => {
      resendBtn.disabled = true;
      statusEl.style.display = "none";

      try {
        const payload = {
          email: email,
          id_token: authParams.id_token || undefined,
          password: authParams.password || undefined,
          full_name: authParams.full_name || undefined
        };

        const resp = await fetch("/api/auth/resend-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.detail || "Failed to resend code.");
        }

        statusEl.textContent = "New verification code sent successfully!";
        statusEl.className = "otp-status success";
        statusEl.style.display = "block";

        // Restart timer
        cooldown = 60;
        timerId = setInterval(() => {
          cooldown--;
          if (cooldown <= 0) {
            clearInterval(timerId);
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend Code";
          } else {
            resendBtn.textContent = `Resend in ${cooldown}s`;
          }
        }, 1000);

      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = "otp-status error";
        statusEl.style.display = "block";
        resendBtn.disabled = false;
      }
    });
  });
}
