
// ── Nav scroll effect ──────────────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Scroll-triggered fade-up animations ───────────────────────────────────
const fadeEls = document.querySelectorAll(
  '.feature-card, .category-card, .safety-step, .stat-item, .section-header'
);

fadeEls.forEach(el => el.classList.add('fade-up'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger siblings
      const siblings = Array.from(entry.target.parentElement?.children ?? []);
      const idx = siblings.indexOf(entry.target);
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, idx * 80);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

fadeEls.forEach(el => observer.observe(el));

// ── Smooth anchor scrolling ────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Theme switcher ─────────────────────────────────────────────────────────
const THEME_KEY = 'quieter-website-theme';
const toggleBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
  // Smooth transition
  document.body.classList.add('theme-transitioning');

  if (theme === 'light') {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }

  toggleBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  toggleBtn.setAttribute('title',      theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');

  setTimeout(() => document.body.classList.remove('theme-transitioning'), 300);
}

// Load saved preference, or follow system
const saved = localStorage.getItem(THEME_KEY);
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initial = saved ?? (prefersDark ? 'dark' : 'light');
applyTheme(initial);

toggleBtn.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// Follow system changes if no saved preference
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});
