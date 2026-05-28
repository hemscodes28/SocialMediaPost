/** Session helpers for public auth pages (landing, login, signup). */
async function validateStoredSession() {
    const token = localStorage.getItem('access_token');
    if (!token || !token.trim()) {
        localStorage.removeItem('access_token');
        return false;
    }
    try {
        const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token.trim()}` }
        });
        if (!response.ok) {
            localStorage.removeItem('access_token');
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

/** If already signed in, go straight to My Profile (persistent login). */
async function redirectToProfileIfAuthed() {
    if (sessionStorage.getItem('pp_skip_auth_redirect') === '1') return;
    const valid = await validateStoredSession();
    if (valid) {
        window.location.replace('/static/index.html?tab=profile');
    }
}
