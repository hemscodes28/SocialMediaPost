/** Navigation & mobile menu for legal/compliance pages */
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
})();
