// Intersection Observer for fade-in animations
document.addEventListener("DOMContentLoaded", () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const elementsToFadeIn = document.querySelectorAll('.fade-in-section');
    elementsToFadeIn.forEach(el => observer.observe(el));
});

window.togglePremiumMobileMenu = function () {
    const menu = document.getElementById('premium-mobile-menu');
    const burger = document.querySelector('.premium-burger-icon');
    const label = document.querySelector('.burger-label');
    const body = document.body;

    if (!menu || !burger) return;

    // Toggle active classes
    menu.classList.toggle('active');
    burger.classList.toggle('active');

    if (menu.classList.contains('active')) {
        body.style.overflow = 'hidden';
        if (label) label.textContent = 'CLOSE';
    } else {
        body.style.overflow = '';
        if (label) label.textContent = 'MENU';
    }
}
