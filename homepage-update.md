# Homepage accuracy and acquisition update

- [x] Rewrite `/about.html` around the current studio and game; add a static Ukrainian version.
- [x] Remove Early Access and puzzle-platformer descriptions from current acquisition pages, metadata and translations.
- [x] Explain the current loop: planting, harvesting, clearing areas and helping residents generate Light; giving Light to the Magic Oak helps it grow.
- [x] Replace the hero with a forest-restoration promise, a Google Play install CTA and a gameplay video CTA.
- [x] Feature Halloween directly after screenshots, with artwork, an Android CTA and a link to the event article.
- [x] Replace developer wording and fixed decor-pack counts with player benefits; remove the redundant developer roadmap.
- [x] Keep the existing About Points.GS philosophy and small-studio positioning.
- [x] Update the linked guide, EN/UK translations, sharing metadata, sitemap and cached asset versions.
- [x] Validate content, links, schema, languages and responsive layouts.

Validation: `python tests/check_home.py`, `python tests/check_blog.py`, `node --check js/locale.js`, and `git diff --check`. Browser review covers English/Ukrainian homepage and About, narrow mobile, tablet and desktop views, event links and gameplay navigation.

The About URL is fully rewritten rather than redirected. The repository does not establish a server-level redirect configuration, so no HTTP 301 is claimed.

The Halloween spotlight has no guessed end date. Replace it when the event finishes. Historical developer logs and fictional lore remain historical content; the weather article uses “early development” instead of an obsolete release-status label.

These changes are prepared in the local checkout. No production deployment was performed.
