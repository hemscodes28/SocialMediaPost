/** Sign-up / sign-in field validation (auth pages only). */
const PPAuthValidation = (function () {
    const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    function showError(input, message) {
        const group = input.closest('.form-group');
        if (!group) return;
        let el = group.querySelector('.field-error');
        if (!el) {
            el = document.createElement('div');
            el.className = 'field-error';
            group.appendChild(el);
        }
        el.textContent = message;
        el.style.display = 'block';
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('input-invalid');
    }

    function clearError(input) {
        const group = input.closest('.form-group');
        if (!group) return;
        const el = group.querySelector('.field-error');
        if (el) {
            el.textContent = '';
            el.style.display = 'none';
        }
        input.removeAttribute('aria-invalid');
        input.classList.remove('input-invalid');
    }

    function validateEmail(value, input) {
        const v = (value || '').trim();
        if (!v) {
            showError(input, 'Email is required.');
            return false;
        }
        if (!EMAIL_RE.test(v)) {
            showError(input, 'Enter a valid email address (e.g. name@domain.com).');
            return false;
        }
        clearError(input);
        return true;
    }

    function validatePassword(value, input) {
        const v = value || '';
        if (v.length < 6) {
            showError(input, 'Password must be at least 6 characters.');
            return false;
        }
        if (!/[A-Z]/.test(v)) {
            showError(input, 'Include at least one uppercase letter.');
            return false;
        }
        if (!/[a-z]/.test(v)) {
            showError(input, 'Include at least one lowercase letter.');
            return false;
        }
        if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(v)) {
            showError(input, 'Include at least one special symbol (!@#$%^&* etc.).');
            return false;
        }
        clearError(input);
        return true;
    }

    function validateName(value, input) {
        const v = (value || '').trim();
        if (v.length < 3) {
            showError(input, 'Name must be at least 3 characters.');
            return false;
        }
        if (!/^[a-zA-Z][a-zA-Z\s'-]{2,}$/.test(v)) {
            showError(input, 'Use letters and spaces only (no numbers or symbols).');
            return false;
        }
        clearError(input);
        return true;
    }

    function bindLiveValidation(form, mode) {
        const email = form.querySelector('#email');
        const password = form.querySelector('#password');
        const fullname = form.querySelector('#fullname');

        if (email) {
            email.addEventListener('input', () => validateEmail(email.value, email));
            email.addEventListener('blur', () => validateEmail(email.value, email));
        }
        if (password && mode === 'signup') {
            password.addEventListener('input', () => validatePassword(password.value, password));
            password.addEventListener('blur', () => validatePassword(password.value, password));
        }
        if (fullname && mode === 'signup') {
            fullname.addEventListener('input', () => validateName(fullname.value, fullname));
            fullname.addEventListener('blur', () => validateName(fullname.value, fullname));
        }
    }

    function validateSignupForm(form) {
        const fullname = form.querySelector('#fullname');
        const email = form.querySelector('#email');
        const password = form.querySelector('#password');
        const okName = validateName(fullname.value, fullname);
        const okEmail = validateEmail(email.value, email);
        const okPw = validatePassword(password.value, password);
        return okName && okEmail && okPw;
    }

    function validateLoginForm(form) {
        const email = form.querySelector('#email');
        const password = form.querySelector('#password');
        const okEmail = validateEmail(email.value, email);
        if (!password.value) {
            showError(password, 'Password is required.');
            return false;
        }
        clearError(password);
        return okEmail;
    }

    return {
        bindLiveValidation,
        validateSignupForm,
        validateLoginForm,
        validateEmail,
        validateName,
    };
})();
