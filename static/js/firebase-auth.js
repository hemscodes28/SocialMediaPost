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

  const data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.detail || "Could not sign in to Post Pilot.");
    err.code = resp.status === 401 ? "auth/token-expired" : undefined;
    throw err;
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

export function completeSession(data, statusEl, successMessage) {
  if (!data?.access_token) {
    throw new Error("Server did not return an access token.");
  }
  localStorage.setItem("access_token", data.access_token);
  if (statusEl) {
    statusEl.textContent = successMessage;
    statusEl.className = "status-msg success";
    statusEl.style.display = "block";
  }
  setTimeout(() => {
    window.location.href = "/static/index.html?tab=profile";
  }, 800);
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
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Sign in failed. Check your credentials.");
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
