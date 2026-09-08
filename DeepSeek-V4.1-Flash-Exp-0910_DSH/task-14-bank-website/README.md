# Meridian Bank — website

A complete, multi-page retail bank website built as a front-end design demo.
Plain HTML, CSS and vanilla JavaScript: no framework, no bundler, no
dependencies, no network calls. Open `index.html` and it runs.

> **Meridian Bank is fictional.** It is not a real bank, it holds no deposits,
> and every rate, fee, figure and testimonial on the site is illustrative
> sample data. The forms are deliberately inert — nothing is transmitted or
> stored anywhere. Don't type real personal or financial information into it.

---

## Quick start

```bash
open index.html          # just browse it — the built site is committed
```

To change the site, edit `src/` and rebuild:

```bash
node build.js            # regenerate the HTML at the project root
npm test                 # finance maths (49 assertions) + interactions (73)
npm run audit            # layout, contrast and a11y audit at 1440px and 390px
npm run verify           # build + test + audit in one go
npm run shots            # screenshots into tools/shots/
```

There is nothing to install. Node 18+ is needed only for the build and the
test tooling.

---

## Pages

| File | What it covers |
| --- | --- |
| `index.html` | Home: hero with app mock, quick actions, product tabs (Personal / Business / Wealth), rate preview, security pillars, animated stats, testimonial rotator, FAQ, CTA |
| `personal.html` | Checking tiers, High-Yield Savings with a **live savings calculator**, term savings (CDs) with a **maturity calculator**, three credit cards with CSS artwork, plain-English fee schedule |
| `business.html` | Business checking tiers, treasury management, merchant services pricing, **business loan calculator**, payroll tools |
| `loans.html` | **Mortgage calculator** (price, down payment, term, rate, taxes, insurance, APR), **auto and personal loan calculators**, rate tables, application timeline, FAQ |
| `rates.html` | The full rate sheet: 29 products with **search, category filters and sortable rate column**, plus the complete fee schedule |
| `security.html` | Security pillars, an **interactive 8-point security checklist with a live score**, fraud-report form with validation, first-hour playbook, scam guide |
| `help.html` | Contact channels, message form, **branch/ATM finder with live filtering**, 12-question FAQ, accessibility / privacy / careers |
| `login.html` | A **two-step sign-in demo**: credentials → one-time passcode, with attempt limiting, a 60-second lockout, password reset branch and a signed-in overview. Demo login `dana.morgan` / `meridian-demo`, code `123456` |
| `open-account.html` | A **four-step application wizard**: account choice, personal details, funding, review-and-confirm, with per-step validation, a progress bar, a generated summary and a confirmation screen |

---

## How it is built

```
task-14-bank-website/
├── index.html … open-account.html   ← built output (committed, works from disk)
├── build.js                          ← ~110-line static site generator
├── src/
│   ├── partials/
│   │   ├── base.html                 ← document shell + meta + JSON-LD
│   │   ├── header.html               ← utility bar, nav with dropdowns, mobile drawer
│   │   └── footer.html               ← five-column footer + demo disclaimer
│   └── pages/*.html                  ← page bodies with front matter
├── assets/
│   ├── css/site.css                  ← the whole design system (~1,200 lines)
│   ├── js/
│   │   ├── site.js                   ← nav, drawer, tabs, counters, reveal, rotator, filters
│   │   ├── finance.js                ← pure finance maths (browser + Node)
│   │   ├── calculators.js            ← declarative [data-calc] widgets
│   │   ├── forms.js                  ← validation, error rendering, checklist score
│   │   ├── rates.js                  ← rate table filter / search / sort
│   │   ├── login.js                  ← sign-in state machine
│   │   └── apply.js                  ← application wizard
│   ├── favicon.svg
├── tests/finance.test.js             ← 49 assertions over the maths
├── tools/
│   ├── cdp.js                        ← tiny DevTools-protocol client (built-in WebSocket)
│   ├── audit.js                      ← layout / contrast / a11y audit
│   ├── interact.js                   ← 73 behavioural assertions
│   └── screenshot.js                 ← full-page and sliced screenshots
├── package.json
└── README.md
```

**Why a build step for a static site?** Nine pages share one header, one footer
and one nav. Generating them from partials guarantees the chrome stays
identical and means a nav change is a one-line edit. The output is plain static
HTML — the build is a convenience, not a runtime dependency.

Each page starts with a small front matter block:

```yaml
---
title: Personal Banking
description: …
nav: personal        # marks the matching nav link aria-current="page"
scripts: calculators # resolved with dependencies (calculators → finance)
---
```

---

## Design system

One stylesheet defines everything, in 27 numbered sections:

- **Palette** — deep navy ink, cream paper, a single blue brand colour and a
  mint accent for positive figures. Rates use a monospace stack with tabular
  numerals so columns line up.
- **Type** — a serif display face for headings (trust, permanence) over a
  system sans for UI and body copy.
- **Components** — buttons, cards, pills, tables, tabs, accordions, forms,
  callouts, timelines, choice cards, credit-card artwork, stat counters,
  progress bars, calculator panels and the auth shell.
- **Responsive** — breakpoints at 1080 / 980 / 780 / 560px. The wide rate
  tables scroll horizontally inside their container instead of breaking the
  page.

## JavaScript modules

Everything is written as an IIFE with no globals except two small namespaces
(`MeridianFinance`, `MeridianForms`). Features are progressive: the markup is
complete and usable without JavaScript, and the CSS only hides scroll-reveal
content once `html.js` is present.

The calculators are declarative. A widget is described entirely in markup —
inputs use `data-in="name"`, outputs use `data-out="name"` — so the same engine
can appear twice on a page without id collisions:

```html
<div class="calc" data-calc="mortgage" data-tax-rate="1.05" data-insurance="1800">
  <input class="range" data-in="price" type="range" …>
  <output data-out="priceLabel">$450,000</output>
  <p class="calc__amount" data-out="monthly">$0</p>
  …
</div>
```

`finance.js` holds every calculation as a pure function — payment, amortisation
schedule, APR by bisection, compound growth, annuity future value, months to a
savings goal, housing payment with escrow, term-deposit maturity. It is the only
file loaded by both the browser and the test runner, so the numbers the site
shows are the numbers the tests check.

---

## Verification

The site was built against three automated gates, all of which pass.

**`npm test` — 122 assertions**

- `tests/finance.test.js` (49): known-value checks against a real 30-year
  mortgage payment, schedule integrity (principal repaid equals amount
  borrowed, balance monotonic, final balance zero), APR monotonicity in fees,
  compounding, annuity maths, goal timelines, formatting edge cases.
- `tools/interact.js` (73): drives the real DOM in a headless browser — tabs,
  both calculators, rate filtering/sorting/reset, the checklist score, form
  validation (including invalid email and unchecked radio/checkbox groups),
  the sign-in flow through lockout and passcode, the full application wizard,
  the branch filter, and the desktop dropdown plus mobile drawer.

**`npm run audit` — layout, contrast and accessibility**

Runs every page at 1440×900 and 390×844 and asserts zero findings across:
document and leaf-node horizontal overflow, text clipped by a scroll container,
content escaping a clipping ancestor, WCAG AA contrast (resolving the nearest
solid background), accessible names, form labels, duplicate ids, dangling
`aria-controls`/`aria-labelledby` targets, placeholder links, empty calculator
outputs, stale zero-state outputs, a single `<h1>` per page, image `alt` text,
nested interactive elements, and 24px touch targets with the WCAG 2.5.8 inline
exception applied.

This gate earned its keep. It caught, among others: a `.card--ink p` rule that
lost a specificity fight and rendered dark-card copy at 2.4:1; a `.sec--ink a`
rule that turned a light button's label into pale blue on white; `h4` headings
left dark inside dark sections; and two muted colour tokens that fell just short
of 4.5:1.

**`npm run shots` — visual regression**

Captures full-page and sliced screenshots of every page into `tools/shots/`,
and fails on any console error or uncaught exception. Reviewing those renders
caught a bug the DOM tests could not see: author `display` rules were overriding
the `[hidden]` attribute, so the wizard's Back and Submit buttons rendered on
step one and every "success" panel was visible before submission. The fix is a
single `[hidden] { display: none !important; }` rule — and the interaction
helper now judges visibility from computed style rather than the property.

**Accessibility notes.** Keyboard: every control is reachable and focus is
visible; the drawer traps focus and closes on `Escape`; tabs support arrow-key
navigation; the mobile drawer uses `<details>` groups. Motion: all animation,
including the scroll reveal and counters, is disabled under
`prefers-reduced-motion`. Semantics: skip link, one `<h1>` per page, labelled
landmarks, `aria-live` regions for the rate count and checklist score.

---

## Editing notes

- Change a rate in one place: the number lives in the page markup and, for
  calculators, in the `data-in="rate"` option values. `finance.js` computes
  from whatever the control says.
- Add a page: drop a file into `src/pages/` with front matter, run `node build.js`.
- Add a nav item: edit `src/partials/header.html` (desktop menu and the drawer
  list are both there), rebuild once, and all nine pages update.
- `login.html` opts out of the shared chrome with `chrome: none` in its front
  matter, because it is a focused auth screen.

## Licence

MIT. The Meridian Bank name, copy and figures are original fictional content
created for this demo.
