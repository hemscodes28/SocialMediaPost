/** Google Sign-In via Firebase Auth (login & signup pages). */
import {
  signInWithGoogle,
  completeSession,
  mapFirebaseAuthError,
  showAuthError,
} from "./firebase-auth.js";

/** Official multicolor Google "G" mark (SVG). */
export function googleIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>`;
}

export function setGoogleButtonContent(btn, mode) {
  const label = mode === "signup" ? "Sign up with Google" : "Continue with Google";
  btn.classList.add("btn-google");
  btn.innerHTML = `
    <span class="google-icon-badge">${googleIconSvg()}</span>
    <span class="google-btn-label">${label}</span>
  `;
}

export function initGoogleAuth(mode) {
  const container = document.getElementById("googleSignInContainer");
  const fallbackBtn = document.getElementById("googleFallbackBtn");
  if (!container) return;

  container.innerHTML = "";
  container.style.display = "flex";
  container.style.justifyContent = "center";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary btn-full btn-google";
  setGoogleButtonContent(btn, mode);

  async function runGoogleSignIn() {
    const status = document.getElementById("status");
    if (status) status.style.display = "none";
    btn.disabled = true;
    if (fallbackBtn) fallbackBtn.disabled = true;

    try {
      const data = await signInWithGoogle();
      completeSession(
        data,
        status,
        mode === "signup"
          ? "Account ready! Opening your dashboard…"
          : "Signed in with Google! Opening your dashboard…"
      );
    } catch (err) {
      showAuthError(status, mapFirebaseAuthError(err));
    } finally {
      btn.disabled = false;
      if (fallbackBtn) fallbackBtn.disabled = false;
    }
  }

  btn.addEventListener("click", runGoogleSignIn);
  container.appendChild(btn);

  if (fallbackBtn) {
    fallbackBtn.style.display = "none";
    setGoogleButtonContent(fallbackBtn, mode);
    fallbackBtn.classList.add("btn-google");
    fallbackBtn.addEventListener("click", runGoogleSignIn);
  }
}
