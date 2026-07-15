/* ==========================================================================
   aCXend — main.js
   Site-wide behavior, loaded on every page: nav, mobile menu, dropdown
   accordion, smooth anchor scroll, word-reveal text, scroll reveals, stat
   counters, FAQ accordion, Web3Forms contact handler, inertia smooth
   scroll, cursor-reactive parallax, magnetic buttons, and background
   videos (CTA banner + inner-page hero). Respects prefers-reduced-motion.

   No third-party libraries required — no GSAP/ScrollTrigger. The reverse
   curtain-reveal hero transition that used to live here was removed: it
   relied on GSAP ScrollTrigger pinning layered on top of this file's own
   custom inertia-scroll engine, and the two scroll systems could drift out
   of sync (GSAP's pin transform occasionally got stuck mid-animation after
   a scroll-down-then-back-to-top, leaving the hero rendered off-screen).
   Rather than patch around that fragility, the effect was removed
   entirely in favor of the simpler, more reliable normal-scroll behavior
   below.

   Exposes window.ACX — a small shared-state bridge — in case a future
   page-specific script needs to hook into the smooth-scroll position
   without duplicating this engine.
   ========================================================================== */
(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => window.matchMedia('(min-width: 992px)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, n) => a + (b - a) * n;

  /* Shared, lerped scroll position. The smooth-scroll engine writes it every
     frame; exposed on window.ACX in case a future page-specific script
     needs the eased VISUAL scroll position rather than raw window.scrollY. */
  const smoothScroll = { current: window.scrollY };

  /* Shared bridge in case a future page-specific script needs it. Only the
     read-only bits a page script might need are exposed; each page
     script still guards for missing elements before using them. */
  window.ACX = { reducedMotion, isDesktop, finePointer, lerp, smoothScroll };

  /* ==========================================================================
     Habito-style inertia smooth-scroll + cursor-reactive motion layer.
     - #smooth-content is transformed by a lerped scroll value (real page
       scroll happens against a spacer, so native scrollbar/anchor jumps
       still work — we're just easing the visual position toward it).
     - Every pointer move drives a lerped "reactive" cursor value that
       parallaxes the hero glows/panel and a custom two-part cursor.
     ========================================================================== */
  (function smoothScrollEngine() {
    const root = document.documentElement;
    const content = document.getElementById('smooth-content');
    const spacer = document.getElementById('smooth-spacer');
    const curtainFooter = document.querySelector('.footer-curtain');
    const nav = document.querySelector('[data-nav]');
    if (!content || !spacer) return;

    if (reducedMotion) { root.classList.add('no-smooth-scroll'); return; }
    root.classList.add('has-smooth-scroll');

    smoothScroll.current = window.scrollY;
    let target = window.scrollY;
    let navH = nav ? nav.offsetHeight : 78;

    const setNavHeight = () => {
      navH = nav ? nav.offsetHeight : 78;
      root.style.setProperty('--nav-h', navH + 'px');
    };

    const setSpacerHeight = () => {
      const footerH = curtainFooter ? curtainFooter.offsetHeight : 0;
      spacer.style.height = (content.scrollHeight + footerH) + 'px';
    };

    setNavHeight();
    setSpacerHeight();

    window.addEventListener('resize', () => { setNavHeight(); setSpacerHeight(); });
    if ('ResizeObserver' in window) {
      new ResizeObserver(setSpacerHeight).observe(content);
      if (curtainFooter) new ResizeObserver(setSpacerHeight).observe(curtainFooter);
    } else {
      window.addEventListener('load', setSpacerHeight);
    }

    function raf() {
      target = window.scrollY;
      // Plain lerp for every scroll, large or small. This used to have a
      // large-delta "snap instantly" branch to guard against the hero
      // getting stuck off-screen after a big jump (Home key, scrollbar
      // drag) — but that was defensive hardening layered on top of the
      // real fix, and it had a real cost: normal fast scrolling (a quick
      // trackpad flick, a fast wheel scroll) can easily produce a
      // per-frame delta past that same threshold, so it was also
      // snapping during completely ordinary scrolling — the harsh "snap"
      // feel. The actual root cause was CSS `scroll-behavior: smooth` on
      // <html> fighting this lerp for native scroll actions (see
      // base.css) — with that removed, a plain lerp handles a Home-key
      // jump correctly on its own: it just glides into place a little
      // slower for a bigger distance, which reads as smooth inertia
      // rather than a snap or a stall.
      smoothScroll.current = lerp(smoothScroll.current, target, 0.085);
      if (Math.abs(target - smoothScroll.current) < 0.05) smoothScroll.current = target;
      content.style.transform = `translate3d(0, ${-smoothScroll.current}px, 0)`;
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  })();

  /* ==========================================================================
  /* ---------- Background videos (CTA banner + inner-page hero) ----------
     One engine for every autoplay/muted/loop background video on the site
     — the CTA banner's ambient loop and every inner page's hero video.
     Fades each in once it's actually decoded a frame (avoids a jarring
     pop-in on slower connections — the overlay/gradient is a clean
     placeholder until then). CSS decides the target opacity per class
     (.cta-video.is-ready is a subtle .5; .page-hero-video.is-ready is a
     full 1 — it's the primary visual there), so this engine only needs to
     toggle one class. Respects prefers-reduced-motion by removing each
     video outright and leaving the static brand gradient. Some mobile
     browsers block autoplay even when muted; if so, we retry once on the
     first user interaction rather than leaving a frozen frame. */
  (function backgroundVideoEngine() {
    const videos = document.querySelectorAll('.cta-video, .page-hero-video');
    if (!videos.length) return;

    videos.forEach((video) => {
      if (reducedMotion) { video.closest('.cta-video-wrap, .page-hero-media')?.remove(); return; }

      const reveal = () => video.classList.add('is-ready');
      if (video.readyState >= 3) reveal();
      else video.addEventListener('canplay', reveal, { once: true });

      const tryPlay = () => video.play().catch(() => {});
      tryPlay();
      document.addEventListener('pointerdown', tryPlay, { once: true });
    });
  })();

  /* ---------- Scroll-direction-driven marquee ----------
     Moves left while the page scrolls down, right while it scrolls up.
     Drifts left at its base speed when the page is idle. */
  (function scrollDirectionMarquee() {
    const track = document.querySelector('.marquee-track');
    const group = document.querySelector('.marquee-group');
    if (!track || !group) return;

    if (reducedMotion) return; // CSS fallback already disables motion here

    track.classList.add('js-marquee');

    let groupWidth = group.getBoundingClientRect().width;
    window.addEventListener('resize', () => { groupWidth = group.getBoundingClientRect().width; });

    const baseSpeed = 0.45;   // idle drift, px/frame
    const maxSpeed = 3.2;     // cap while actively scrolling
    const boost = 0.09;       // how strongly scroll velocity affects speed

    let pos = 0;
    let dir = -1;             // -1 = left, 1 = right
    let lastY = window.scrollY;

    function tick() {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;

      if (dy > 0.5) dir = -1;
      else if (dy < -0.5) dir = 1;

      const speed = Math.min(baseSpeed + Math.abs(dy) * boost, maxSpeed);
      pos += dir * speed;

      if (groupWidth > 0) {
        if (pos <= -groupWidth) pos += groupWidth;
        if (pos > 0) pos -= groupWidth;
      }

      track.style.transform = `translateX(${pos}px)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- Cursor-reactive parallax + custom cursor ---------- */
  (function pointerReactiveLayer() {
    if (!finePointer || reducedMotion) return;

    const root = document.documentElement;
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    const heroGlow1 = document.querySelector('.hero-glow--1');
    const heroGlow2 = document.querySelector('.hero-glow--2');

    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let dotX = mouseX, dotY = mouseY, ringX = mouseX, ringY = mouseY;
    let glowX = 0, glowY = 0, glowTX = 0, glowTY = 0;
    let ready = false;

    window.addEventListener('pointermove', (e) => {
      mouseX = e.clientX; mouseY = e.clientY;
      if (!ready) { ready = true; dotX = mouseX; dotY = mouseY; ringX = mouseX; ringY = mouseY; root.classList.add('cursor-ready'); }

      // Normalized -1..1 from viewport center, used for ambient parallax
      glowTX = (mouseX / window.innerWidth - 0.5) * 2;
      glowTY = (mouseY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    document.addEventListener('pointerdown', () => ring && ring.classList.add('is-down'));
    document.addEventListener('pointerup', () => ring && ring.classList.remove('is-down'));

    const hoverTargets = 'a, button, [role="button"], input, textarea, select, summary, .btn';
    document.addEventListener('pointerover', (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest(hoverTargets)) {
        dot && dot.classList.add('is-hover');
        ring && ring.classList.add('is-hover');
      }
    });
    document.addEventListener('pointerout', (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest(hoverTargets)) {
        dot && dot.classList.remove('is-hover');
        ring && ring.classList.remove('is-hover');
      }
    });
    document.addEventListener('pointerleave', () => {
      ready = false;
      root.classList.remove('cursor-ready');
    });

    function raf() {
      // Cursor: dot tracks tight, ring trails looser
      dotX = lerp(dotX, mouseX, 0.32);
      dotY = lerp(dotY, mouseY, 0.32);
      ringX = lerp(ringX, mouseX, 0.16);
      ringY = lerp(ringY, mouseY, 0.16);
      if (dot) dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%,-50%)`;
      if (ring) ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%,-50%)`;

      // Ambient glow parallax (slow, wide drift)
      glowX = lerp(glowX, glowTX, 0.05);
      glowY = lerp(glowY, glowTY, 0.05);
      if (heroGlow1) heroGlow1.style.transform = `translate3d(${glowX * 26}px, ${glowY * 22}px, 0)`;
      if (heroGlow2) heroGlow2.style.transform = `translate3d(${glowX * -32}px, ${glowY * -18}px, 0)`;

      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  })();

  /* ---------- Magnetic buttons ---------- */
  (function magneticButtons() {
    if (!finePointer || reducedMotion) return;
    document.querySelectorAll('.btn-primary, .btn-ghost, .btn-secondary').forEach((btn) => {
      btn.setAttribute('data-magnetic', '');
      let tx = 0, ty = 0, cx = 0, cy = 0;
      let raf = null;

      const loop = () => {
        cx = lerp(cx, tx, 0.2);
        cy = lerp(cy, ty, 0.2);
        btn.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      };

      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        ty = (e.clientY - (r.top + r.height / 2)) * 0.4;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      btn.addEventListener('pointerleave', () => {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  })();

  /* ---------- Sticky nav shadow ---------- */
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    let ticking = false;
    const update = () => { nav.classList.toggle('scrolled', window.scrollY > 8); ticking = false; };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.nav-menu');

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }
    document.querySelectorAll('.nav-item.open').forEach((i) => i.classList.remove('open'));
    document.querySelectorAll('.caret[aria-expanded="true"]').forEach((c) => c.setAttribute('aria-expanded', 'false'));
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    // Close on link tap (mobile), Escape, or outside click
    menu.addEventListener('click', (e) => {
      if (e.target.closest('.caret')) return;
      if (e.target.closest('a') && !isDesktop()) closeMenu();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', (e) => {
      if (!isDesktop() && menu.classList.contains('open') && !e.target.closest('.nav-wrap')) closeMenu();
    });
  }

  /* ---------- Dropdown accordion (mobile) ---------- */
  document.querySelectorAll('.nav-item .caret').forEach((caret) => {
    caret.addEventListener('click', (e) => {
      if (isDesktop()) return; // desktop uses hover / focus-within (CSS)
      e.preventDefault();
      e.stopPropagation();
      const item = caret.closest('.nav-item');
      document.querySelectorAll('.nav-item.open').forEach((other) => {
        if (other !== item) {
          other.classList.remove('open');
          const c = other.querySelector('.caret');
          if (c) c.setAttribute('aria-expanded', 'false');
        }
      });
      const open = item.classList.toggle('open');
      caret.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Smooth anchor scrolling with sticky-nav offset ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const navH = nav ? nav.offsetHeight : 0;
      const top = el.getBoundingClientRect().top + window.scrollY - navH - 12;
      const usesEngine = document.documentElement.classList.contains('has-smooth-scroll');
      window.scrollTo({ top, behavior: (reducedMotion || usesEngine) ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Handle an initial #hash in the URL on page load ----------
     Native browser fragment-scroll can't do this on its own: the visible
     content lives inside #smooth-content, which is position:fixed (needed
     for the inertia-scroll engine), so it isn't part of the normal
     document flow the browser scrolls natively — arriving at, say,
     engagement-models.html#managed-services would otherwise silently land
     at the very top of the page instead of the section. Reuses the same
     offset math as the click handler above; waits for the 'load' event
     (plus a small buffer) so images and the spacer's final height have
     settled before measuring anything. */
  if (window.location.hash && window.location.hash.length > 1) {
    const jumpToInitialHash = () => {
      let el;
      try { el = document.querySelector(window.location.hash); } catch (err) { return; }
      if (!el) return;
      const navH = nav ? nav.offsetHeight : 0;
      const top = el.getBoundingClientRect().top + window.scrollY - navH - 12;
      window.scrollTo({ top, behavior: 'auto' });
    };
    if (document.readyState === 'complete') {
      setTimeout(jumpToInitialHash, 60);
    } else {
      window.addEventListener('load', () => setTimeout(jumpToInitialHash, 60));
    }
  }

  /* ---------- Split-text word reveal ---------- */
  function splitTextIntoWords(el) {
    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          if (!child.textContent || !child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((tok) => {
            if (tok === '') return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
            const outer = document.createElement('span');
            outer.className = 'sp-word';
            const inner = document.createElement('span');
            inner.className = 'sp-word-i';
            inner.textContent = tok;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    })(el);

    el.querySelectorAll('.sp-word-i').forEach((w, i) => {
      w.style.setProperty('--wd', Math.min(i * 0.032, 0.6) + 's');
    });
  }

  const splitTargets = document.querySelectorAll('.split-text');
  if (splitTargets.length && ('IntersectionObserver' in window)) {
    splitTargets.forEach(splitTextIntoWords);
  }

  /* ---------- Scroll reveal with stagger ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    // Stagger siblings inside any [data-stagger] container
    document.querySelectorAll('[data-stagger]').forEach((group) => {
      group.querySelectorAll('.reveal').forEach((el, i) => {
        el.style.setProperty('--d', (i * 0.09) + 's');
      });
    });

    if (reducedMotion || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });
      reveals.forEach((el) => io.observe(el));
    }
  }

  /* ---------- Animated stat counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const animate = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      if (reducedMotion || isNaN(target)) { el.textContent = target + suffix; return; }
      const dur = 1200;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window && !reducedMotion) {
      const cio = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { animate(entry.target); cio.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      counters.forEach((el) => cio.observe(el));
    } else {
      counters.forEach(animate);
    }
  }

  /* ---------- FAQ accordion (exclusive open) ---------- */
  // Native <details name="faq"> gives exclusivity in modern browsers;
  // this is a fallback for older ones, plus smooth scroll-into-view.
  const faqItems = document.querySelectorAll('.faq-item');
  if (faqItems.length) {
    faqItems.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        faqItems.forEach((other) => { if (other !== item && other.open) other.open = false; });
      });
    });
  }

  /* ---------- Contact form → Web3Forms (used on contact page) ---------- */
  const form = document.querySelector('#contact-form');
  if (form) {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (status) status.className = 'form-status';
      const submitBtn = form.querySelector('button[type="submit"]');
      const original = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
      try {
        const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Submission failed');
        if (status) {
          status.textContent = 'Thanks — your message is on its way. We will reply within one business day.';
          status.className = 'form-status show ok';
        }
        form.reset();
      } catch (err) {
        if (status) {
          status.textContent = 'Something went wrong. Please email sales@acxend.com or try again.';
          status.className = 'form-status show err';
        }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
      }
    });
  }
})();
