/* Shared interactions for Post Pilot public pages */
(function () {
    const nav = document.querySelector('.pp-nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            nav.classList.toggle('scrolled', window.scrollY > 12);
        });
    }

    const menuBtn = document.getElementById('ppMenuBtn');
    const mobileMenu = document.getElementById('ppMobileMenu');
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('open'));
        mobileMenu.querySelectorAll('a').forEach((a) => {
            a.addEventListener('click', () => mobileMenu.classList.remove('open'));
        });
    }

    const revealEls = document.querySelectorAll('.reveal');
    if (revealEls.length) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach((el, i) => {
            el.style.transitionDelay = `${(i % 4) * 0.08}s`;
            obs.observe(el);
        });
    }

    document.querySelectorAll('[data-count]').forEach((el) => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        const suffix = el.getAttribute('data-suffix') || '';
        const obs = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            obs.disconnect();
            let start = 0;
            const dur = 1400;
            const t0 = performance.now();
            const tick = (now) => {
                const p = Math.min((now - t0) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.floor(eased * target) + suffix;
                if (p < 1) requestAnimationFrame(tick);
                else el.textContent = target + suffix;
            };
            requestAnimationFrame(tick);
        }, { threshold: 0.5 });
        obs.observe(el);
    });

    document.querySelectorAll('.pp-faq-q').forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.pp-faq-item');
            const open = item.classList.contains('open');
            document.querySelectorAll('.pp-faq-item').forEach((i) => i.classList.remove('open'));
            if (!open) item.classList.add('open');
        });
    });

    if (localStorage.getItem('access_token')) {
        document.querySelectorAll('[data-auth-dashboard]').forEach((a) => {
            a.href = '/static/index.html';
            if (a.dataset.authLabel) a.textContent = a.dataset.authLabel;
        });
    }
})();
