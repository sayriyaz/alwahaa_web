# Alwahaa Documents Clearing — v2

A self-contained, world-class front-end that drops into your existing Apache/PHP stack.
Your original site is untouched — this lives in `awdoc/v2/`.

## View it
- Local: **http://localhost/htdocs/awdoc/v2/**
- The PHP contact form lives directly at `contact.php`.

## Promote to live (when you're happy)
Point your domain/root at this folder, or copy its contents up one level over the old
`index`/`dist`. Nothing here depends on a build step or Node — it's plain HTML/CSS/JS.

## What's inside
```
v2/
├── index.html              # Flagship homepage (all sections, SEO + structured data)
├── assets/
│   ├── css/main.css        # Design system: tokens, light/dark themes, every section
│   ├── js/main.js          # Lenis scroll · GSAP parallax · Three.js hero · cursor · reveals
│   └── img/                # Optimized WebP (logo + service images, ~70–150 KB vs 2 MB PNGs)
└── README.md
```

## Tech
- **Lenis** smooth scroll · **GSAP ScrollTrigger** parallax · **Three.js** hero globe
- Light + dark mode (toggle in nav, remembers your choice)
- Custom cursor, magnetic buttons, glass nav, count-up stats, FAQ accordion, marquees
- Fully responsive; respects `prefers-reduced-motion`; graceful fallback if any CDN is blocked

## Real data now wired in ✓
- Phone (+971 4 255 2895), 3 mobiles, WhatsApp (+971 50 227 7187), both emails, full Port Saeed address + P.O. Box, business hours, live Google Map, and real socials (Instagram, Facebook, X, TikTok) — across the homepage, footer, JSON-LD, and the PHP contact page.
- Domain set to `https://www.alwahaagroup.com/` in canonical, Open Graph, and structured data.
- Contact form: added an optional Phone field with UAE-style example placeholders (Abdullah / info@mail.com / +971 50 123 4567).

## Pages
- `index.html` — homepage
- `about.html` — About Us + **Director's Message** (nav: "About Us")
- `blog.html` — blog index (featured post + grid)
- `blog-post.html` — mainland company formation guide
- `golden-visa-uae.html` — UAE Golden Visa guide
- `guide.php` — topic-based renderer for the remaining service guides
- `robots.txt`, `sitemap.xml`, `llms.txt` — crawler and answer-engine discovery files
- `.htaccess` — clean production routes for pages and articles

## Vercel deployment

The repository root contains `vercel.json`, which publishes the V2 site at `/`,
maps clean page and newsroom URLs, and keeps the public assets inside `v2/`.
`scripts/export-vercel-static.php` generates Vercel-safe static copies of the
contact page and topic guides from the local PHP sources.

The contact form posts to `api/contact.js`. Configure these Vercel environment
variables before testing email delivery:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `CONTACT_TO`

Use a newly generated SMTP app password. Do not commit credentials or enquiry
records to Git.
- `contact.php` — contact page (V2-styled, PHP backend)

Top nav across all pages: **About Us · Services · Process · FAQ · Newsroom · Contact**.

## Content status
- **Director's Message** (`about.html`) — founder name, message, title and portrait are now in place.
- **Newsroom** — every card now opens a topic-specific article with unique metadata, canonical URL, structured data and Alwahaa-focused imagery.

## Still to replace before going live
1. **Testimonials** — omitted until real, approved client reviews are available.
2. **Logo** — using your existing 3D mark, optimized. Swap `assets/img/logo.webp` if you have a flat brand logo.

The full public address consistently includes Port Saeed, Deira, Dubai.

## Stats note
The verified 40+ years figure animates on scroll; unverified company and nationality counts are not published.
