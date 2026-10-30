# Alwahaa search visibility

Canonical website: https://www.alwahaagroup.com/

## Search topics

- Home and visible service catalogue: document clearing Dubai, business setup Dubai, company formation, Deira PRO services, trade licence renewal, UAE visas, Emirates ID, certificate attestation, legal translation, WPS, VAT and banking support.
- About: Alwahaa Documents Clearing LLC, Dubai since 1983, leadership and named employee profiles.
- Contact: Port Saeed, Deira, Dubai; office +971 4 255 2895; info@alwahaagroup.com; map and WhatsApp enquiries.
- Individual resources and newsroom guides retain topic-specific titles, descriptions and canonical URLs. Government guides identify Alwahaa as an independent private service provider.

Keywords are expressed naturally in visible copy, titles, descriptions and service data. Meta-keywords are deliberately omitted: Google does not use them for indexing or ranking.

## Implemented

Unique page titles/descriptions, canonical and social metadata across 30 indexable pages; matching image descriptions and real dimensions; crawlable image URLs and responsive images; current team and 15-service structured data; breadcrumbs; English/Arabic sitemap alternates; current primary, service and staff images in the XML sitemap; correct office address with P.O. Box recorded separately from postcode.

Decorative background photographs retain empty HTML alt text. Service images and staff portraits have contextual alt text. Conceptual generated scenes are not represented as photographs of Alwahaa's real premises.

## Updating and validation

- `npm run seo:update`: refresh metadata and sitemap after changing content.
- `npm run check:seo`: validate metadata, canonical URLs, JSON-LD syntax, sitemap coverage, image files/dimensions, and internal links/anchors.
- `npm run export:static`: regenerate PHP-derived static pages, then reapply SEO updates.
- `npm run build:resources`: regenerate resource guides, then reapply SEO updates.

Approved business facts and page-specific overrides live in `scripts/update-seo.py`. Update MODIFIED only for a real published revision. The script is idempotent. Do not change publication dates or invent ratings, reviews, accreditations or government affiliations to influence search appearance.

## After deployment

Verify the live canonical pages and assets, then submit https://www.alwahaagroup.com/sitemap.xml in the property's Google Search Console account and inspect the homepage/About/contact URLs. Keep the Google Business Profile name, address, contact details and hours consistent with the website. Search Console and Business Profile actions require account access and were not performed as part of this code change.

Search engines choose when to crawl, index and rank pages. These changes improve technical clarity and discoverability; they do not guarantee rankings or immediate rich results.
