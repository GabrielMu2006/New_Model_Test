/* ═══════════════════════════════════════════════════════════════
   AEVUM — interactions & procedural SVG timepieces
   No libraries. Every watch, gear and texture is generated here.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ── Palettes ─────────────────────────────────────────────────── */
const METALS = {
  gold:     { light: "#f6dcae", mid: "#c99a58", dark: "#8a5f2c", edge: "#4a3112" },
  steel:    { light: "#f7f8fa", mid: "#c2c6cf", dark: "#767b85", edge: "#33353b" },
  platinum: { light: "#eef1f5", mid: "#c7ccd6", dark: "#828898", edge: "#2a2c31" }
};

const DIALS = {
  ivory:    { center: "#f2e9d3", edge: "#d9c9a6", text: "#4a3b1f", tick: "#8a7648",
              hand: "#7a5a24", handHi: "#e9cf9a", second: "#8a6a34" },
  onyx:     { center: "#2b2924", edge: "#090807", text: "#e5cb92", tick: "#9a8052",
              hand: "#c99a58", handHi: "#f6dcae", second: "#e9d3a1" },
  midnight: { center: "#24365e", edge: "#0a1124", text: "#e2e8f4", tick: "#8fa0c6",
              hand: "#d7dce6", handHi: "#ffffff", second: "#c8a25e" }
};

/* ── Tiny SVG helpers ─────────────────────────────────────────── */
const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (cx, cy, r, deg) =>
  [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))]
    .map((n) => n.toFixed(2)).join(" ");

let uid = 0;

/**
 * Build a complete wristwatch as an SVG string.
 * opts: { metal, dial, moon, subSeconds, liveId }
 * Returns { svg, hands: {h,m,s} } — hands null unless liveId given.
 */
function buildWatch(opts) {
  const id = "w" + (++uid);
  const M = METALS[opts.metal];
  const D = DIALS[opts.dial];

  const CX = 180, CY = 240;         // dial centre
  const CASE = 138, DIAL = 122;     // radii
  const s = [];

  /* ── defs ── */
  s.push(`<defs>
    <linearGradient id="${id}-case" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${M.light}"/>
      <stop offset=".45" stop-color="${M.mid}"/>
      <stop offset=".72" stop-color="${M.dark}"/>
      <stop offset="1" stop-color="${M.light}"/>
    </linearGradient>
    <linearGradient id="${id}-bezel" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${M.dark}"/>
      <stop offset=".5" stop-color="${M.light}"/>
      <stop offset="1" stop-color="${M.mid}"/>
    </linearGradient>
    <radialGradient id="${id}-dial" cx=".5" cy=".42" r=".75">
      <stop offset="0" stop-color="${D.center}"/>
      <stop offset="1" stop-color="${D.edge}"/>
    </radialGradient>
    <linearGradient id="${id}-strap" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${opts.strap[1]}"/>
      <stop offset=".5" stop-color="${opts.strap[0]}"/>
      <stop offset="1" stop-color="${opts.strap[1]}"/>
    </linearGradient>
    <linearGradient id="${id}-hand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${D.hand}"/>
      <stop offset=".5" stop-color="${D.handHi}"/>
      <stop offset="1" stop-color="${D.hand}"/>
    </linearGradient>
    <radialGradient id="${id}-cap" cx=".38" cy=".35" r=".8">
      <stop offset="0" stop-color="${D.handHi}"/>
      <stop offset="1" stop-color="${D.hand}"/>
    </radialGradient>
    <radialGradient id="${id}-moon" cx=".35" cy=".3" r=".9">
      <stop offset="0" stop-color="#f4e3b2"/>
      <stop offset="1" stop-color="#c89a4e"/>
    </radialGradient>
    <clipPath id="${id}-win"><circle cx="${CX}" cy="${CY + 76}" r="27"/></clipPath>
  </defs>`);

  /* ── strap ── */
  const strapTop = CY - CASE + 14, strapBot = CY + CASE - 14;
  s.push(`<path d="M118 ${strapTop} L112 26 Q111.6 16 122 16 L238 16 Q248.4 16 248 26 L242 ${strapTop} Z"
            fill="url(#${id}-strap)" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`);
  s.push(`<path d="M118 ${strapBot} L112 454 Q111.6 464 122 464 L238 464 Q248.4 464 248 454 L242 ${strapBot} Z"
            fill="url(#${id}-strap)" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`);
  /* stitching */
  s.push(`<path d="M126 ${strapTop - 6} L120.5 30 M234 ${strapTop - 6} L239.5 30"
            stroke="${opts.stitch}" stroke-width="1.4" stroke-dasharray="4 3.4" fill="none" opacity=".8"/>`);
  s.push(`<path d="M126 ${strapBot + 6} L120.5 450 M234 ${strapBot + 6} L239.5 450"
            stroke="${opts.stitch}" stroke-width="1.4" stroke-dasharray="4 3.4" fill="none" opacity=".8"/>`);

  /* ── lugs & crown ── */
  for (const a of [-32, 32, 148, 212]) {
    s.push(`<rect x="${CX - 9}" y="${CY - CASE - 22}" width="18" height="34" rx="7"
              fill="url(#${id}-case)" stroke="${M.edge}" stroke-width="1"
              transform="rotate(${a} ${CX} ${CY})"/>`);
  }
  s.push(`<rect x="${CX + CASE - 4}" y="${CY - 13}" width="15" height="26" rx="6"
            fill="url(#${id}-case)" stroke="${M.edge}" stroke-width="1"/>`);
  s.push(`<line x1="${CX + CASE + 1}" y1="${CY - 8}" x2="${CX + CASE + 1}" y2="${CY + 8}"
            stroke="${M.edge}" stroke-width="1" opacity=".7"/>
          <line x1="${CX + CASE + 6}" y1="${CY - 9}" x2="${CX + CASE + 6}" y2="${CY + 9}"
            stroke="${M.edge}" stroke-width="1" opacity=".7"/>`);

  /* ── case & bezel ── */
  s.push(`<circle cx="${CX}" cy="${CY}" r="${CASE}" fill="url(#${id}-case)" stroke="${M.edge}" stroke-width="1.5"/>`);
  s.push(`<circle cx="${CX}" cy="${CY}" r="${CASE - 4}" fill="url(#${id}-bezel)"/>`);
  s.push(`<circle cx="${CX}" cy="${CY}" r="${DIAL}" fill="url(#${id}-dial)" stroke="rgba(0,0,0,.4)" stroke-width="1"/>`);

  /* ── sunburst ── */
  s.push(`<g>`);
  for (let i = 0; i < 144; i++) {
    const a = i * 2.5;
    s.push(`<line x1="${pt(CX, CY, 16, a).split(" ")[0]}" y1="${pt(CX, CY, 16, a).split(" ")[1]}"
              x2="${pt(CX, CY, DIAL - 2, a).split(" ")[0]}" y2="${pt(CX, CY, DIAL - 2, a).split(" ")[1]}"
              stroke="#ffffff" stroke-width="1" opacity="${i % 2 ? 0.028 : 0.014}"/>`);
  }
  s.push(`</g>`);

  /* ── minute track ── */
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const a = i * 6;
    const r1 = DIAL - 6, r2 = major ? DIAL - 14 : DIAL - 10;
    s.push(`<line x1="${pt(CX, CY, r1, a).split(" ")[0]}" y1="${pt(CX, CY, r1, a).split(" ")[1]}"
              x2="${pt(CX, CY, r2, a).split(" ")[0]}" y2="${pt(CX, CY, r2, a).split(" ")[1]}"
              stroke="${D.tick}" stroke-width="${major ? 2 : 1}" opacity="${major ? 0.95 : 0.55}"/>`);
  }

  /* ── applied hour batons ── */
  for (let i = 0; i < 12; i++) {
    const a = i * 30;
    const len = i % 3 === 0 ? 26 : 21;
    const half = i === 0 ? 3.4 : 0;             // double baton at XII
    const rOut = 94, rIn = rOut - len;
    const [xo, yo] = pt(CX, CY, rOut, a).split(" ").map(Number);
    const [xi, yi] = pt(CX, CY, rIn, a).split(" ").map(Number);
    const w = 2.6;
    const dx = Math.cos(rad(a)) * w, dy = Math.sin(rad(a)) * w;
    const baton = (ox, oy) =>
      `M${xo + ox - dx},${yo + oy - dy} L${xo + ox + dx},${yo + oy + dy}
       L${xi + ox + dx * 0.7},${yi + oy + dy * 0.7} L${xi + ox - dx * 0.7},${yi + oy - dy * 0.7} Z`;
    if (half) {
      const ox = Math.cos(rad(a)) * half * 2.2, oy = Math.sin(rad(a)) * half * 2.2;
      s.push(`<path d="${baton(ox, oy)}" fill="url(#${id}-hand)" stroke="rgba(0,0,0,.3)" stroke-width=".4"/>`);
      s.push(`<path d="${baton(-ox, -oy)}" fill="url(#${id}-hand)" stroke="rgba(0,0,0,.3)" stroke-width=".4"/>`);
    } else {
      s.push(`<path d="${baton(0, 0)}" fill="url(#${id}-hand)" stroke="rgba(0,0,0,.3)" stroke-width=".4"/>`);
    }
  }

  /* ── texts ── */
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "'Helvetica Neue', Arial, sans-serif";
  s.push(`<text x="${CX}" y="${CY - 52}" text-anchor="middle" font-family="${serif}"
            font-size="20" letter-spacing="7" fill="${D.text}">AEVUM</text>`);
  s.push(`<text x="${CX + 1}" y="${CY - 34}" text-anchor="middle" font-family="${sans}"
            font-size="8" letter-spacing="4.5" fill="${D.text}" opacity=".85">GENÈVE</text>`);
  s.push(`<text x="${CX}" y="${CY + 44}" text-anchor="middle" font-family="${sans}"
            font-size="7.5" letter-spacing="3" fill="${D.text}" opacity=".8">${opts.moon ? "AUTOMATIC · 122-YEAR MOON" : "AUTOMATIC"}</text>`);

  /* ── moonphase ── */
  if (opts.moon) {
    const WY = CY + 76;
    s.push(`<g clip-path="url(#${id}-win)">
              <circle cx="${CX}" cy="${WY}" r="27" fill="#0b1230"/>
              <circle cx="${CX - 9}" cy="${WY - 8}" r="1.4" fill="#dfe6f5"/>
              <circle cx="${CX + 12}" cy="${WY + 10}" r="1.1" fill="#dfe6f5"/>
              <circle cx="${CX + 16}" cy="${WY - 12}" r=".9" fill="#dfe6f5"/>
              <circle cx="${CX - 18}" cy="${WY + 8}" r="1" fill="#dfe6f5"/>
              <circle cx="${CX - 2}" cy="${WY - 6}" r="11.5" fill="url(#${id}-moon)"/>
              <circle cx="${CX + 4}" cy="${WY - 10}" r="10.5" fill="#0b1230" opacity=".92"/>
            </g>
            <circle cx="${CX}" cy="${WY}" r="27" fill="none"
              stroke="${D.tick}" stroke-width="1.6"/>`);
  }

  /* ── small seconds sub-dial ── */
  if (opts.subSeconds) {
    const SY = CY + 70;
    s.push(`<circle cx="${CX}" cy="${SY}" r="25" fill="${D.edge}" opacity=".55"/>
            <circle cx="${CX}" cy="${SY}" r="25" fill="none" stroke="${D.tick}" stroke-width="1" opacity=".8"/>`);
    for (let i = 0; i < 12; i++) {
      const a = i * 30;
      s.push(`<line x1="${pt(CX, SY, 22, a).split(" ")[0]}" y1="${pt(CX, SY, 22, a).split(" ")[1]}"
                x2="${pt(CX, SY, 18, a).split(" ")[0]}" y2="${pt(CX, SY, 18, a).split(" ")[1]}"
                stroke="${D.tick}" stroke-width="1.2" opacity=".8"/>`);
    }
    s.push(`<line x1="${CX}" y1="${SY + 7}" x2="${CX}" y2="${SY - 17}"
              stroke="${D.second}" stroke-width="1.3"
              transform="rotate(210 ${CX} ${SY})"/>
            <circle cx="${CX}" cy="${SY}" r="2.2" fill="${D.second}"/>`);
  }

  /* ── hands (dauphine, faceted) ── */
  function dauphine(len, tail, wid, deg, cls) {
    const tip = pt(CX, CY, len, deg), tl = pt(CX, CY, tail, deg + 180);
    const wx = Math.cos(rad(deg)) * wid, wy = Math.sin(rad(deg)) * wid;
    const l = pt(CX, CY, wid * 1.15, deg - 90).split(" ").map(Number);
    const r = pt(CX, CY, wid * 1.15, deg + 90).split(" ").map(Number);
    const [tx, ty] = tip.split(" ").map(Number);
    const [bx, by] = tl.split(" ").map(Number);
    return `<g class="${cls}">
      <path d="M${tx},${ty} L${CX},${CY} L${l[0]},${l[1]} L${bx - wx * 0.4},${by - wy * 0.4} Z" fill="${D.hand}"/>
      <path d="M${tx},${ty} L${r[0]},${r[1]} L${CX},${CY} L${bx + wx * 0.4},${by + wy * 0.4} Z" fill="${D.handHi}"/>
    </g>`;
  }

  /* display time 10:09:35 unless live */
  const live = !!opts.liveId;
  const hDeg = ((10 + 9 / 60 + 35 / 3600) / 12) * 360;
  const mDeg = (9 + 35 / 60) * 6;
  const sDeg = 35 * 6;

  s.push(`<g ${live ? `id="${opts.liveId}-h"` : ""} transform="rotate(${live ? 0 : hDeg} ${CX} ${CY})">
            ${dauphine(64, 17, 4.6, 0, "hour-hand")}</g>`);
  s.push(`<g ${live ? `id="${opts.liveId}-m"` : ""} transform="rotate(${live ? 0 : mDeg} ${CX} ${CY})">
            ${dauphine(96, 19, 3.6, 0, "minute-hand")}</g>`);
  s.push(`<g ${live ? `id="${opts.liveId}-s"` : ""} transform="rotate(${live ? 0 : sDeg} ${CX} ${CY})">
            <line x1="${CX}" y1="${CY + 26}" x2="${CX}" y2="${CY - 106}"
              stroke="${D.second}" stroke-width="1.5"/>
            <circle cx="${CX}" cy="${CY + 26}" r="5.5" fill="none" stroke="${D.second}" stroke-width="1.5"/>
          </g>`);

  /* ── centre cap & crystal ── */
  s.push(`<circle cx="${CX}" cy="${CY}" r="5.6" fill="url(#${id}-cap)" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
          <circle cx="${CX}" cy="${CY}" r="1.9" fill="${D.edge}"/>`);
  s.push(`<ellipse cx="${CX}" cy="${CY}" rx="${DIAL - 6}" ry="${(DIAL - 6) * 0.55}"
            fill="#ffffff" opacity=".045"
            transform="rotate(-32 ${CX} ${CY})"/>
          <ellipse cx="${CX - 18}" cy="${CY - 30}" rx="56" ry="30"
            fill="#ffffff" opacity=".05"
            transform="rotate(-32 ${CX} ${CY})"/>`);

  return {
    svg: `<svg class="watch-svg" viewBox="0 0 360 480" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s.join("")}</svg>`
  };
}

/* ── Decorative gear train for the Atelier section ───────────── */
function buildGears() {
  const gold = "#c8a25e", faint = "rgba(200,162,94,.5)";
  function gear(cx, cy, r, teeth, cls, thick) {
    const parts = [`<g class="${cls}">`];
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(200,162,94,.05)" stroke="${gold}" stroke-width="${thick}"/>`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="${faint}" stroke-width="1"/>`);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * 360;
      parts.push(`<rect x="${cx - r * 0.085}" y="${cy - r - r * 0.14}" width="${r * 0.17}" height="${r * 0.16}" rx="${r * 0.03}"
                    fill="${gold}" opacity=".85" transform="rotate(${a} ${cx} ${cy})"/>`);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 360;
      const [x2, y2] = pt(cx, cy, r * 0.68, a).split(" ");
      parts.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${faint}" stroke-width="2.5"/>`);
    }
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="${gold}"/>`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.055}" fill="#14120e"/>`);
    parts.push(`</g>`);
    return parts.join("");
  }
  const balance = `
    <g class="gear-swing">
      <circle cx="388" cy="312" r="44" fill="none" stroke="${gold}" stroke-width="4"/>
      <circle cx="388" cy="312" r="44" fill="none" stroke="${faint}" stroke-width="1" stroke-dasharray="2 5"/>
      <line x1="344" y1="312" x2="432" y2="312" stroke="${gold}" stroke-width="3"/>
      <line x1="388" y1="268" x2="388" y2="356" stroke="${gold}" stroke-width="3"/>
      <circle cx="388" cy="312" r="6" fill="${gold}"/>
      <circle cx="388" cy="268" r="3" fill="${gold}"/>
      <circle cx="388" cy="356" r="3" fill="${gold}"/>
    </g>`;
  return `<svg class="watch-svg" viewBox="0 0 480 420" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${gear(150, 150, 96, 30, "gear-spin-a", 2.5)}
    ${gear(286, 232, 58, 18, "gear-spin-b", 2)}
    ${gear(334, 130, 36, 12, "gear-spin-c", 1.6)}
    ${balance}
  </svg>`;
}

/* ═══════════════════════════════════════════════════════════════
   Page behaviour (runs in the browser only)
   ═══════════════════════════════════════════════════════════════ */
if (typeof document !== "undefined") {
  const reduceMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Mount the timepieces ── */
  const mounts = [
    ["heroWatch",      { metal: "gold",     dial: "onyx",     strap: ["#241a10", "#0f0b06"], stitch: "#7a6448", liveId: "hero" }],
    ["watchMeridian",  { metal: "gold",     dial: "ivory",    strap: ["#4a2f1d", "#241407"], stitch: "#c8a882" }],
    ["watchNocturne",  { metal: "steel",    dial: "onyx",     strap: ["#1c1913", "#0c0a07"], stitch: "#5f584a", subSeconds: true }],
    ["watchCeleste",   { metal: "platinum", dial: "midnight", strap: ["#1b2740", "#0c1322"], stitch: "#7d8db0", moon: true }]
  ];
  for (const [id, opts] of mounts) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = buildWatch(opts).svg;
  }
  const gears = document.getElementById("gearsMount");
  if (gears) gears.innerHTML = buildGears();

  /* ── The hero watch keeps real time ── */
  const hh = document.getElementById("hero-h");
  const mh = document.getElementById("hero-m");
  const sh = document.getElementById("hero-s");
  const clockLabel = document.getElementById("heroClock");
  if (hh && mh && sh) {
    const CX = 180, CY = 240;
    let lastSec = -1;
    const tick = () => {
      const now = new Date();
      const ms = reduceMotion ? 0 : now.getMilliseconds();
      const s = now.getSeconds() + ms / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      sh.setAttribute("transform", `rotate(${(s * 6).toFixed(3)} ${CX} ${CY})`);
      mh.setAttribute("transform", `rotate(${(m * 6).toFixed(3)} ${CX} ${CY})`);
      hh.setAttribute("transform", `rotate(${(h * 30).toFixed(3)} ${CX} ${CY})`);
      if (clockLabel && now.getSeconds() !== lastSec) {
        lastSec = now.getSeconds();
        clockLabel.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ── Navigation ── */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  menuBtn.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });

  /* ── Reveal on scroll ── */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ── Animated counters ── */
  const fmt = new Intl.NumberFormat("en-US");
  const animateCount = (el) => {
    const target = Number(el.dataset.count);
    const useFmt = el.dataset.format === "1";
    const dur = 1600;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.textContent = useFmt ? fmt.format(val) : String(val);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const cio = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        animateCount(en.target);
        cio.unobserve(en.target);
      }
    }
  }, { threshold: 0.6 });
  document.querySelectorAll(".num").forEach((el) => cio.observe(el));

  /* ── Gentle parallax on the hero stage ── */
  if (!reduceMotion) {
    const stage = document.querySelector(".hero-stage");
    const hero = document.querySelector(".hero");
    if (stage && hero) {
      hero.addEventListener("mousemove", (e) => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        stage.style.transform = `translate(${x * 14}px, ${y * 10}px)`;
      });
      hero.addEventListener("mouseleave", () => { stage.style.transform = ""; });
    }
  }

  /* ── Private-viewing form ── */
  const form = document.getElementById("viewingForm");
  const note = document.getElementById("formNote");
  const done = document.getElementById("formDone");
  const doneText = document.getElementById("doneText");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const salon = String(fd.get("salon") || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !salon) {
      note.textContent = "Kindly complete your name, a valid email and a salon.";
      return;
    }
    note.textContent = "";
    doneText.textContent =
      `Thank you, ${name}. Our concierge in ${salon} will write to ${email} within one working day.`;
    form.hidden = true;
    done.hidden = false;
  });
}

/* Export the pure builders for smoke-testing outside the browser */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildWatch, buildGears, METALS, DIALS };
}
