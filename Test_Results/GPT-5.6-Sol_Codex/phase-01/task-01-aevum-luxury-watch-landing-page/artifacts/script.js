const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('.mobile-menu');

function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : !menuButton.classList.contains('open');
  menuButton.classList.toggle('open', open);
  mobileMenu.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mobileMenu.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
}

menuButton.addEventListener('click', () => toggleMenu());
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => toggleMenu(false)));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const configurator = document.querySelector('.configurator');
const materialName = document.querySelector('#material-name');
document.querySelectorAll('.swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('active'));
    swatch.classList.add('active');
    const material = swatch.dataset.material;
    materialName.textContent = material;
    configurator.dataset.finish = material;
  });
});

const soundToggle = document.querySelector('.sound-toggle');
soundToggle.addEventListener('click', () => {
  const enabled = soundToggle.classList.toggle('on');
  soundToggle.lastChild.textContent = enabled ? ' Atmosphere on' : ' Atmosphere';
});

let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      const y = window.scrollY;
      document.querySelector('.watch-hero').style.translate = `0 ${Math.min(y * 0.045, 24)}px`;
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });
