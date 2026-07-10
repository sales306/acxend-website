# aCXend website

## Folder structure

```
project/
├── index.html            Home page
├── about.html             About page
├── css/
│   ├── tokens.css        Design tokens (colors, spacing, radius, motion, shadows, z-index)
│   ├── base.css          Reset, base elements, layout primitives, buttons, .section-kicker
│   ├── components.css    Nav, footer, marquee, split sections, cards, CTA banner,
│   │                     page-hero (video), services, contact form, FAQ — reusable everywhere
│   ├── animations.css    .reveal / .split-text scroll-reveal utilities + reduced-motion base
│   ├── effects.css       Smooth-scroll engine, reverse curtain reveal, custom cursor,
│   │                     magnetic buttons, footer curtain — all sitewide, all pages
│   └── home.css          Styles unique to index.html only (hero, about-preview)
├── js/
│   └── main.js            ALL site-wide behavior, including the curtain reveal —
│                           load this and only this on every page
├── images/                Logos, posters, photography
└── videos/                Background videos (CTA banner + one per inner-page hero)
```

## Load order

CSS and JS both load in a dependency chain — later files assume earlier ones are present.

**CSS** (in `<head>`, every page):
```
tokens.css → base.css → components.css → animations.css → effects.css → [home.css]
```
`home.css` is the one exception — it's Home-page-only. Every inner page uses only the first five.

**JS** (before `</body>`, every page):
```
GSAP + ScrollTrigger (CDN) → main.js
```
GSAP/ScrollTrigger are required on **every** page now, not just Home — the reverse
curtain-reveal transition in `main.js` runs on every hero, sitewide. `main.js` is a
single file with no page-specific split: it detects what's on the page (a `.hero` or
`.page-hero` immediately followed by a section) and wires up the curtain reveal
automatically, or no-ops safely if that structure isn't present.

There is no more `home.js` — it only ever contained the curtain-reveal function, which
has since been generalized and folded into `main.js` so every page shares the exact
same logic, easing, and timing rather than each page carrying its own copy.

## The reverse curtain reveal, on every page

Same effect as the Home page, same code path — nothing was recreated:

- The **hero** — `.hero` on Home, `.page-hero` on every inner page — gets pinned via
  ScrollTrigger.
- The **section immediately after it** inside `<main>` (whatever that happens to be —
  no hardcoded id) rides up over the pinned hero like a curtain closing from the
  bottom, gaining rounded top corners and a soft shadow via the `.curtain-active`
  class that gets added automatically.
- The hero recedes slightly (scale/drift/dim) as it's covered. The exact same
  `curtainReveal()` function in `main.js` handles both the Home hero's markup
  (`.hero-inner`, `.hero-stats`, `.hero-scroll`, `.hero-dim`) and every inner page's
  markup (`.page-hero-inner`, `.page-hero-dim`) — it only animates whichever of those
  elements actually exist inside the current hero, so no branching or page-specific
  code is needed.

**To build a new inner-page hero that gets this effect for free:** give it the class
`.page-hero`, put it directly inside `<main>` as the first element, and make sure the
very next element in the DOM is the section you want the curtain to reveal. Add a
`.page-hero-dim` element inside the hero (see `about.html` for the exact pattern) so
the depth-recede scrim has something to animate. That's it — no JS changes needed.

## Inner-page hero (video)

Every inner page's hero is `.page-hero` — full-width, autoplay/muted/loop/playsinline
background video, ~20–35% dark overlay, content centered both horizontally and
vertically. Structure (see `about.html`):

```html
<header class="page-hero" aria-label="...">
  <div class="page-hero-media" aria-hidden="true">
    <video class="page-hero-video" autoplay muted loop playsinline preload="auto" poster="images/[page]-hero-poster.jpg">
      <source src="videos/[page]-hero.webm" type="video/webm" />
      <source src="videos/[page]-hero.mp4" type="video/mp4" />
    </video>
  </div>
  <div class="page-hero-overlay" aria-hidden="true"></div>
  <div class="container page-hero-inner">
    <nav class="crumbs">...</nav>
    <span class="eyebrow eyebrow--light">Page Label</span>
    <h1>Heading</h1>
    <p class="page-hero-desc">Supporting paragraph</p>
    <!-- optional: <div class="page-hero-cta"><a class="btn btn-primary">CTA</a></div> -->
  </div>
  <div class="page-hero-dim" aria-hidden="true"></div>
</header>
```

Each page gets its **own** video reflecting its content (About: team/culture, Services:
support/technology, Engagement Models: strategy/planning, Contact: office/workspace) —
swap the `<source>` paths and poster per page. The fade-in-on-load and reduced-motion
handling is shared sitewide (`backgroundVideoEngine()` in `main.js`), so no per-page JS
is needed for this either.

## Adding a new page

1. Copy `about.html` as the starting point — it already has the correct `<head>`
   stylesheet block, nav, video hero + curtain-reveal markup, footer, and script tags.
2. Update the nav's `active`/`aria-current` state to the new page, the `<title>`/meta
   tags, the breadcrumb, and the hero content + video.
3. Build the page's content sections from `components.css` (`.split`, `.svc-*`,
   `.value-grid`, `.model-grid`, `.contact-grid`, `.faq-*`, the CTA banner, etc.) — reuse
   before adding anything new.
4. Only create a new `[pagename].css` if the page truly needs layout that doesn't exist
   yet anywhere else. If so, add one `<link>` for it after `effects.css`, matching the
   `home.css` pattern (page-specific, loaded only on that page).

## Assets

`images/` and `videos/` are referenced with relative paths but are currently empty —
drop in the real files using the names referenced in each page's `<video>`/`<img>` tags
(e.g. `videos/about-hero.mp4`, `images/about-hero-poster.jpg`), or update the `src`
attributes to match whatever you use. The split-section and FAQ photos still point to
placeholder Unsplash URLs; replace those when you have real photography.
