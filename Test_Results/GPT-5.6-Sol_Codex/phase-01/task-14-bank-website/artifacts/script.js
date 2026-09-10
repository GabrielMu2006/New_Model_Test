const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');

menuButton?.addEventListener('click', () => {
  const isOpen = header.classList.toggle('menu-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

nav?.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    header.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
});

const tabs = [...document.querySelectorAll('[data-tab]')];
const panels = [...document.querySelectorAll('[data-panel]')];

function selectTab(tab) {
  tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    selectTab(tabs[next]);
  });
});

const deposit = document.querySelector('#deposit');
const monthly = document.querySelector('#monthly');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function updateCalculator() {
  const principal = Number(deposit.value);
  const monthlyPayment = Number(monthly.value);
  const months = 60;
  const monthlyRate = 0.05 / 12;
  const futurePrincipal = principal * Math.pow(1 + monthlyRate, months);
  const futureContributions = monthlyPayment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  const total = futurePrincipal + futureContributions;
  const contributed = principal + monthlyPayment * months;
  document.querySelector('#deposit-output').textContent = currency.format(principal);
  document.querySelector('#monthly-output').textContent = currency.format(monthlyPayment);
  document.querySelector('#future-value').textContent = currency.format(total);
  document.querySelector('#interest-earned').textContent = currency.format(total - contributed);
}

[deposit, monthly].forEach((input) => input?.addEventListener('input', updateCalculator));
updateCalculator();

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll('.reveal').forEach((element) => {
  if (observer) observer.observe(element);
  else element.classList.add('visible');
});

const toast = document.querySelector('[data-toast-box]');
let toastTimer;
document.querySelectorAll('[data-toast]').forEach((button) => {
  button.addEventListener('click', () => {
    toast.textContent = button.dataset.toast;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  });
});

document.querySelectorAll('a[href="#"]').forEach((link) => link.addEventListener('click', (event) => event.preventDefault()));
