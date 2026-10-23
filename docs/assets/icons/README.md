# Icon sources

Brand assets were retrieved October 18, 2026 and are bundled locally so the quick links do not depend on an icon CDN.

- **LinkedIn:** `linkedin-blue.png` and `linkedin-white.png` are unchanged files (`LI-In-Bug.png` and `InBug-White.png`) from LinkedIn's official [in] download pack: https://brand.linkedin.com/downloads . Download URL: https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/logos/in-logo.zip . The white version is used on the navy sidebar and dark surfaces; the blue version is used on light surfaces. Brand rights remain with LinkedIn.
- **Facebook:** `facebook-mono.svg` uses the Facebook mark from Bootstrap Icons: https://github.com/twbs/icons/blob/main/icons/facebook.svg . The unchanged path is inlined in `docs/social-links.mjs`, inheriting the interface foreground color. Bootstrap Icons' MIT license is included in `LICENSE-bootstrap-icons.txt`. Brand rights remain with Meta.
- **Linktree:** `linktree.svg` uses the exact filled mark path published in Linktree's own newsroom footer at https://linktr.ee/newsroom . The viewport is fitted to the standalone mark; the path geometry is unchanged. The inline copy in `docs/social-links.mjs` inherits the interface foreground color. Brand rights remain with Linktree.
- **Instagram:** the existing recognizable camera glyph is retained.
- **Navigation:** Campaigns uses Lucide `megaphone`, Archive uses Lucide `archive`, and Settings uses Lucide `settings-2`. Original SVG geometry: https://github.com/lucide-icons/lucide/tree/main/icons . These are inlined in `docs/index.html` at 22px (20px on mobile), with a consistent 1.8px stroke. Lucide's ISC license is included in `LICENSE-lucide.txt`.

- **ASME Hub shortcut:** `../logos/asme-hub-mark.svg` is the unchanged Officer Hub navigation mark from ASME-OSU/ASME-HUB, `assets/hub-mark.svg`. It links to the chapter’s Officer Hub, configured by `hubUrl` in `config/chapter.json`.
