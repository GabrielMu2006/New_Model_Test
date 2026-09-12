# Meridian Bank — demo bank website

A complete, self-contained marketing site plus demo online banking for **Meridian Bank**, a
fictional member-owned bank. Built with plain HTML, CSS, and JavaScript — no frameworks, no
build step, no external requests (works fully offline).

> Meridian Bank is fictional. No real banking services are offered; all rates, balances, and
> testimonials are illustrative. The site deliberately warns visitors never to enter real
> credentials or personal information.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

The demo sign-in works best over `http://localhost` (some browsers restrict `sessionStorage`
on `file://`). Any invented username (3+ chars) / password (4+ chars) works, e.g. `demo` /
`meridian`. The session flag lives in `sessionStorage` only; closing the tab ends it.

## Pages

| Page | What's on it |
| --- | --- |
| `index.html` | Hero with CSS credit card, trust bar, product cards, live savings-growth calculator with mini bar chart, features, testimonials, CTA |
| `personal.html` | Account comparison table, per-product detail sections, FAQ accordion |
| `business.html` | Three business tiers, treasury stats, onboarding steps |
| `loans.html` | Loan products, live amortized-payment calculator, published rates table, process steps |
| `about.html` | History timeline, stats, values grid, leadership cards |
| `contact.html` | Validated contact form (inline errors + success state), contact channels |
| `login.html` | Demo sign-in with prominent "do not use real credentials" notice |
| `dashboard.html` | Demo dashboard: account balances, fictional transactions, working in-page transfer demo, sign out. Redirects to `login.html` when no demo session exists |

## Structure

```
index.html / personal.html / business.html / loans.html
about.html / contact.html / login.html / dashboard.html
css/style.css        # design system (navy + gold, serif display type, responsive)
js/main.js           # nav toggle, calculators, form validation, demo banking logic
assets/favicon.svg   # logo mark (also inlined into each header)
README.md
```

## Implementation notes

- **Responsive**: mobile nav under 720 px, grid collapses at 960/600 px.
- **Accessibility**: skip link, semantic landmarks, `aria-current` on nav, `aria-live` on
  calculator results, focus-visible outlines via `:focus`, `prefers-reduced-motion` support.
- **Calculators**: savings uses monthly compounding derived from APY; loans use the standard
  amortization formula. Both recompute live on input.
- **No dependencies**: fonts are system stacks; icons and the credit-card visual are inline
  SVG / CSS.

## Known limitations

- Front-end demo only: there is no backend, so login, transfers, and the contact form are
  client-side simulations; balances reset on refresh.
- Demo session gating uses `sessionStorage`, which some browsers block on `file://` URLs —
  serve over HTTP if the dashboard bounces you back to login.
