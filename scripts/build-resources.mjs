#!/usr/bin/env node
/**
 * Resources generator — renders static /resources pages from a single JSON file.
 *
 *   node scripts/build-resources.mjs
 *
 * Input:  v2/resources/authorities.json
 * Output: v2//resources  (searchable Government Directory hub)
 *         v2/resources/<slug>.html (one static page per authority)
 *
 * Add an authority = add an object to authorities.json and re-run. No hand-coding.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RES_DIR = join(ROOT, "v2", "resources");
const data = JSON.parse(readFileSync(join(RES_DIR, "authorities.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SITE = "https://www.alwahaagroup.com";
const label = (a, key, fallback) => a.labels?.[key] || fallback;

// Path prefixes per page depth. Hubs sit at /resources (browser base "/"),
// detail pages at /resources/<slug> (browser base "/resources/").
function L(kind) {
  return kind === "hub"
    ? { asset: "", home: "index.html", about: "about.html", services: "/#services", tools: "/tools", blog: "blog.html", contact: "contact.php", resHub: "/resources", res: "/resources/" }
    : { asset: "../", home: "../index.html", about: "../about.html", services: "/#services", tools: "/tools", blog: "../blog.html", contact: "../contact.php", resHub: "/resources", res: "/resources/" };
}

// ---- shared chrome -------------------------------------------------------
const head = ({ title, desc, canonical, schema, P }) => `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f7f7f5" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#06080c" media="(prefers-color-scheme: dark)" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Alwahaa Documents Clearing" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/assets/img/logo.png" />
  <link rel="icon" type="image/x-icon" href="${P.asset}assets/icons/favicon.ico" />
  <link rel="apple-touch-icon" href="${P.asset}assets/icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
  <link rel="stylesheet" href="${P.asset}assets/css/main.css?v=20260627e" />
${schema.map((s) => `  <script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n")}
  <script>
    (function () {
      document.documentElement.classList.remove('no-js');
      try { var t = localStorage.getItem('aw-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.setAttribute('data-theme', t); } catch (e) {}
    })();
  </script>
  <style>
    .res { max-width: 880px; margin-inline: auto; }
    .res-flag { font-size: 2.4rem; line-height: 1; }
    .res-check { display: grid; gap: 0.7rem; margin-top: 1.4rem; }
    .res-check li { display: flex; gap: 0.7rem; align-items: flex-start; color: var(--ink-soft); font-size: 0.98rem; }
    .res-check li::before { content: ""; flex: 0 0 auto; width: 20px; height: 20px; margin-top: 2px; border-radius: 50%; background: var(--gold-soft); -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9.55 17.6 4.4 12.45l1.4-1.4 3.75 3.75 8.25-8.25 1.4 1.4z'/%3E%3C/svg%3E") center/contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9.55 17.6 4.4 12.45l1.4-1.4 3.75 3.75 8.25-8.25 1.4 1.4z'/%3E%3C/svg%3E") center/contain no-repeat; }
    .res-when { display: grid; gap: 0.7rem; margin-top: 1.4rem; padding-left: 1.3rem; }
    .res-when li { color: var(--ink-soft); }
    .res-faq { display: grid; gap: 0.8rem; margin-top: 1.4rem; }
    .res-faq details { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-elevated); overflow: hidden; transition: border-color 0.3s; }
    .res-faq details[open] { border-color: var(--gold-soft); }
    .res-faq summary { cursor: pointer; list-style: none; padding: 1.1rem 1.4rem; font-family: var(--font-display); font-weight: 600; font-size: 1.02rem; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    .res-faq summary::-webkit-details-marker { display: none; }
    .res-faq summary::after { content: "+"; color: var(--gold); font-size: 1.3rem; line-height: 1; transition: transform 0.3s; }
    .res-faq details[open] summary::after { transform: rotate(45deg); }
    .res-faq p { padding: 0 1.4rem 1.3rem; font-size: 0.96rem; color: var(--ink-soft); }
    .res-official { display: inline-flex; align-items: center; gap: 0.6rem; margin-top: 1rem; }
    .res-note { margin-top: 1.8rem; font-size: 0.8rem; color: var(--ink-mute); line-height: 1.6; padding: 1rem 1.2rem; border: 1px dashed var(--line-strong); border-radius: var(--r-md); }
    .res-related { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 1.2rem; }
    .res-related a { font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: var(--r-pill); border: 1px solid var(--line); color: var(--ink-soft); transition: color 0.3s, border-color 0.3s, transform 0.3s var(--ease-out); }
    .res-related a:hover { color: var(--ink); border-color: var(--gold-soft); transform: translateY(-2px); }
    /* directory hub */
    .dir-search { display: flex; align-items: center; gap: 0.7rem; max-width: 560px; margin: 2rem 0 0; padding: 1rem 1.2rem; border-radius: var(--r-pill); background: var(--surface-solid); border: 1px solid var(--line-strong); transition: border-color 0.3s, box-shadow 0.3s; }
    [data-theme="dark"] .dir-search { background: var(--bg-tint); }
    .dir-search:focus-within { border-color: var(--gold-soft); box-shadow: 0 0 0 4px rgba(176,141,58,0.12); }
    .dir-search svg { width: 20px; height: 20px; color: var(--ink-mute); flex: 0 0 auto; }
    .dir-search input { width: 100%; border: none; outline: none; background: none; font: inherit; font-size: 1.05rem; color: var(--ink); }
    .dir-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.2rem; margin-top: 2rem; }
    @media (max-width: 720px) { .dir-grid { grid-template-columns: 1fr; } }
    .dir-card { display: flex; gap: 1rem; padding: 1.4rem 1.5rem; border-radius: var(--r-lg); background: var(--bg-elevated); border: 1px solid var(--line); box-shadow: var(--shadow-sm); transition: transform 0.3s var(--ease-out), box-shadow 0.3s, border-color 0.3s; }
    a.dir-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--line-strong); }
    .dir-card .fl { font-size: 1.6rem; line-height: 1; flex: 0 0 auto; }
    .dir-card .kicker { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); }
    .dir-card h3 { font-size: 1.05rem; margin: 0.2rem 0 0.3rem; }
    .dir-card p { font-size: 0.88rem; color: var(--ink-soft); }
    .dir-empty { grid-column: 1/-1; text-align: center; color: var(--ink-mute); padding: 2rem 0; }
    .res-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2rem; margin-top: 2.6rem; }
    @media (max-width: 720px) { .res-strip { grid-template-columns: 1fr; } }
    .res-strip a { padding: 1.4rem 1.5rem; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--bg-elevated); box-shadow: var(--shadow-sm); transition: transform 0.3s var(--ease-out), border-color 0.3s; }
    .res-strip a:hover { transform: translateY(-3px); border-color: var(--gold-soft); }
    .res-strip h4 { font-size: 1.02rem; margin-bottom: 0.3rem; }
    .res-strip p { font-size: 0.86rem; color: var(--ink-soft); }
  </style>
</head>`;

const nav = (P) => `<body class="no-js">
  <div class="preloader" id="preloader" aria-hidden="true"><div class="preloader__inner"><img class="preloader__logo" src="${P.asset}assets/img/logo.webp" alt="" width="64" height="74" /><div class="preloader__bar"><i id="pl-bar"></i></div><div class="preloader__num"><span id="pl-num">0</span>%</div></div></div>
  <div class="atmosphere" aria-hidden="true"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span></div>
  <div class="noise" aria-hidden="true"></div>
  <div class="cursor-ring" aria-hidden="true"></div>
  <div class="cursor-dot" aria-hidden="true"></div>
  <div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>
  <header class="site-header" id="header">
    <nav class="nav" aria-label="Primary">
      <a class="brand" href="${P.home}" aria-label="Alwahaa Documents Clearing home"><img src="${P.asset}assets/img/logo.webp" alt="Alwahaa Documents Clearing logo" width="30" height="35" /><span class="brand__txt"><span class="wahaa">Alwahaa</span><small>Document Clearing</small></span></a>
      <div class="nav__links">
        <a href="${P.about}">About Us</a><a href="${P.services}">Services</a><a href="${P.resHub}" aria-current="page">Resources</a><a href="${P.blog}">Newsroom</a><a href="${P.contact}">Contact</a>
      </div>
      <div class="nav__right">
        <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode"><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg></button>
        <button class="menu-toggle" id="menuToggle" type="button" aria-expanded="false" aria-controls="mobileNav" aria-label="Open menu"><span></span><span></span><span></span></button>
      </div>
    </nav>
  </header>
  <div class="mobile-nav" id="mobileNav"><a href="${P.about}"><span>01</span>About Us</a><a href="${P.services}"><span>02</span>Services</a><a href="${P.resHub}"><span>03</span>Resources</a><a href="${P.blog}"><span>04</span>Newsroom</a><a href="${P.contact}"><span>05</span>Contact</a></div>`;

const footer = (P, withGlobe) => `  <footer class="site-footer">
    <div class="container">
      <div class="footer__top">
        <div class="footer__brand"><a class="brand" href="${P.home}"><img src="${P.asset}assets/img/logo.webp" alt="Alwahaa Documents Clearing logo" width="30" height="35" /><span class="brand__txt"><span class="wahaa">Alwahaa</span><small>Document Clearing</small></span></a><p>Dubai business setup, visa, attestation and PRO services, backed by more than 42 years of local experience.</p></div>
        <div class="footer__col"><h4>Explore</h4><a href="${P.about}">About Us</a><a href="${P.services}">Services</a><a href="${P.resHub}">Resources</a><a href="${P.blog}">Newsroom</a><a href="${P.contact}">Contact</a></div>
        <div class="footer__col"><h4>Government links</h4>${data.authorities.map((a) => `<a href="${P.res}${a.slug}">${esc(label(a, "footer", a.abbr))}</a>`).join("")}</div>
        <div class="footer__col"><h4>Get in touch</h4><a href="tel:+97142552895">+971 4 255 2895</a><a href="https://wa.me/971502277187">WhatsApp +971 50 227 7187</a><a href="mailto:info@alwahaagroup.com">info@alwahaagroup.com</a></div>
      </div>
      <div class="footer__bottom"><p>© <span id="year">2026</span> Alwahaa Documents Clearing. All rights reserved.</p></div>
    </div>
  </footer>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js" defer></script>
${withGlobe ? `  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>\n` : ""}  <script src="${P.asset}assets/js/main.js?v=20260627a" defer></script>`;

// ---- authority page ------------------------------------------------------
function authorityPage(a) {
  const P = L("detail");
  const canonical = `${SITE}/resources/${a.slug}`;
  const title = a.metaTitle ? `${esc(a.metaTitle)} | Alwahaa` : `${esc(a.name)} (${esc(a.abbr)}) — Services, FAQs & Official Link | Alwahaa`;
  const desc = a.metaDescription ? esc(a.metaDescription) : `${esc(a.abbr)}: ${esc(a.tagline)} What it is, services, when you need it, FAQs and the official website — plus how Alwahaa can handle the process for you.`;
  const breadcrumb = label(a, "breadcrumb", a.abbr);
  const h1 = label(a, "h1", `${a.abbr} — ${a.name}`);
  const whatHeading = label(a, "whatHeading", `What is ${a.abbr}?`);
  const whenHeading = label(a, "whenHeading", `When do you need ${a.abbr}?`);
  const officialLabel = label(a, "officialLink", `Visit the official ${a.abbr} website`);
  const noteAuthority = label(a, "noteAuthority", a.abbr);
  const ctaHeading = label(a, "ctaHeading", `Let Alwahaa handle your ${a.abbr} process.`);
  const ctaLead = label(a, "ctaLead", `From paperwork to submission and follow-up, our Dubai desk can complete the entire ${a.abbr} application for you.`);
  const schema = [
    { "@context": "https://schema.org", "@type": "GovernmentService", name: a.name, alternateName: label(a, "schemaAlternate", a.abbr), serviceArea: { "@type": "Country", name: "United Arab Emirates" }, url: canonical, provider: { "@type": "GovernmentOrganization", name: label(a, "provider", a.name), url: a.officialUrl } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Resources", item: `${SITE}/resources` },
      { "@type": "ListItem", position: 3, name: breadcrumb, item: canonical }
    ] }
  ];
  return `${head({ title, desc, canonical, schema, P })}
${nav(P)}
  <main>
    <section class="page-hero">
      <div class="container">
        <div class="res">
          <div class="breadcrumb" data-reveal><a href="${P.home}">Home</a><span>/</span><a href="${P.resHub}">Resources</a><span>/</span>${esc(breadcrumb)}</div>
          <div class="sec-head" data-reveal>
            <p class="eyebrow"><span class="res-flag" style="font-size:1rem">${a.flag}</span> ${esc(a.category)}</p>
            <h1 style="font-size:clamp(1.9rem,3.6vw,2.8rem)">${esc(h1)}</h1>
            <p class="lead">${esc(a.tagline)}</p>
          </div>

          <div class="article__body" data-reveal style="margin-top:1.6rem">
            <h2>${esc(whatHeading)}</h2>
            ${a.whatIs.map((p) => `<p>${esc(p)}</p>`).join("\n            ")}

            <h2 style="margin-top:2.4rem">Services</h2>
            <ul class="res-check">${a.services.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>

            <h2 style="margin-top:2.4rem">${esc(whenHeading)}</h2>
            <ul class="res-when">${a.whenNeeded.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>

            <h2 style="margin-top:2.4rem">Frequently asked questions</h2>
            <div class="res-faq">${a.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>

            <a class="btn btn--ghost res-official" href="${a.officialUrl}" target="_blank" rel="noopener nofollow">${esc(officialLabel)}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8"/></svg>
            </a>
            <p class="res-note">Information is provided for general guidance and was last reviewed ${esc(data.lastReviewed)}. Official requirements, fees and processes are set by ${esc(noteAuthority)} and may change — always confirm on the official website. Alwahaa Documents Clearing is a private service provider and is not affiliated with ${esc(noteAuthority)} or any government authority.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section-pad">
      <div class="container cta"><div class="cta__card" data-reveal="scale"><p class="eyebrow" style="justify-content:center">Need assistance?</p><h2>${esc(ctaHeading)}</h2><p class="lead">${esc(ctaLead)}</p><div class="cta__actions"><a class="btn btn--gold btn--lg" href="${P.contact}">Contact Alwahaa</a><a class="btn btn--ghost btn--lg" href="${P.resHub}">Back to directory</a></div>
        <div class="res-related">${a.relatedServices.map((r) => `<a href="${r.href}">${esc(r.label)}</a>`).join("")}</div>
      </div></div>
    </section>
  </main>
${footer(P)}
</body>
</html>
`;
}

// ---- hub / directory -----------------------------------------------------
function hubPage(authorities) {
  const P = L("hub");
  const canonical = `${SITE}/resources`;
  const title = "UAE Government Directory & Business Resources | Alwahaa";
  const desc = "Searchable UAE government directory — ICP, MOHRE, GDRFA and more — plus calculators, guides and checklists for business setup, visas and document clearing in Dubai.";
  const schema = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: canonical, about: authorities.map((a) => ({ "@type": "GovernmentService", name: a.name, alternateName: label(a, "schemaAlternate", a.abbr) })) }
  ];
  const search = authorities.map((a) => ({ slug: a.slug, name: a.name, abbr: a.abbr, cardTitle: label(a, "card", a.abbr), flag: a.flag, category: a.category, tagline: a.tagline, kw: a.keywords.join(" ") }));
  const cards = search.map((a) => `<a class="dir-card" href="${P.res}${a.slug}" data-search="${esc((a.abbr + " " + a.cardTitle + " " + a.name + " " + a.category + " " + a.kw).toLowerCase())}"><span class="fl">${a.flag}</span><div><div class="kicker">${esc(a.category)}</div><h3>${esc(a.cardTitle)}</h3><p>${esc(a.tagline)}</p></div></a>`).join("\n          ");
  return `${head({ title, desc, canonical, schema, P })}
${nav(P)}
  <main>
    <section class="hero" style="min-height:clamp(440px,62vh,640px);overflow:hidden;display:flex;align-items:center;padding-block:clamp(6.5rem,9vw,7.5rem) 2.5rem">
      <canvas class="hero__canvas" id="heroCanvas" aria-hidden="true"></canvas>
      <div class="hero__grid" aria-hidden="true"></div>
      <div class="container" style="position:relative;z-index:2">
        <div class="sec-head" data-reveal style="max-width:46rem">
          <p class="eyebrow">🇦🇪 UAE Government Directory</p>
          <h1 style="font-size:clamp(2.3rem,4.2vw,3.6rem)">The UAE government &amp; business resource hub.</h1>
          <p class="lead">Plain-English explainers for every UAE government authority — services, FAQs and official links — plus calculators, guides and checklists, all in one connected place.</p>
          <div class="dir-search" data-reveal style="margin-top:1.6rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="dirSearch" placeholder="Search authorities, e.g. &quot;passport&quot;, &quot;Emirates ID&quot;…" aria-label="Search the directory" autocomplete="off" />
          </div>
        </div>
      </div>
    </section>

    <section class="section-pad" style="padding-top:clamp(1.6rem,3vw,2.6rem)">
      <div class="container">
        <div class="dir-grid" id="dirGrid" data-stagger>
          ${cards}
          <p class="dir-empty" id="dirEmpty" style="display:none">No matches. Try another keyword — or <a href="${P.contact}" style="color:var(--gold)">ask the Alwahaa desk</a>.</p>
        </div>
        <div class="res-strip" data-reveal style="margin-top:2.6rem">
          <a href="${P.tools}"><h4>🧮 Calculators</h4><p>Corporate tax, public holidays and more free UAE tools.</p></a>
          <a href="${P.blog}"><h4>📚 Guides &amp; news</h4><p>Practical guides on setup, visas, attestation and tax.</p></a>
          <a href="${P.contact}"><h4>📋 Checklists &amp; help</h4><p>Need the documents for a specific process? Ask the desk.</p></a>
        </div>
      </div>
    </section>

    <section class="section-pad">
      <div class="container cta"><div class="cta__card" data-reveal="scale"><p class="eyebrow" style="justify-content:center">Need the process done?</p><h2>From information to execution.</h2><p class="lead">Understand the authority here, then let Alwahaa handle the actual application end to end.</p><div class="cta__actions"><a class="btn btn--gold btn--lg" href="${P.contact}">Talk to Alwahaa</a><a class="btn btn--ghost btn--lg" href="${P.services}">Our services</a></div></div></div>
    </section>
  </main>
${footer(P, true)}
  <script>
    (function () {
      var input = document.getElementById('dirSearch');
      var cards = Array.prototype.slice.call(document.querySelectorAll('.dir-card'));
      var empty = document.getElementById('dirEmpty');
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        cards.forEach(function (c) {
          var hit = !q || c.getAttribute('data-search').indexOf(q) !== -1;
          c.style.display = hit ? '' : 'none';
          if (hit) shown++;
        });
        empty.style.display = shown ? 'none' : '';
      });
    })();
  </script>
</body>
</html>
`;
}

// ---- write ---------------------------------------------------------------
let count = 0;
for (const a of data.authorities) {
  writeFileSync(join(RES_DIR, `${a.slug}.html`), authorityPage(a));
  count++;
}
writeFileSync(join(RES_DIR, "index.html"), hubPage(data.authorities));
console.log(`Generated ${count} authority page(s) + 1 hub → v2/resources/`);
