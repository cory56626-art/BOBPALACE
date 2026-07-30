/**
 * Scroll choreography: the morphing backdrop, the section reveals, and the
 * night clock.
 *
 * The backdrop is a stack of fixed layers, one per game. Rather than snapping
 * between them, each layer's opacity is driven by the reader's position so
 * FNAF 1 dissolves into FNAF 2 as the boundary is crossed.
 */

import { GAMES } from './data/characters.js';
import { ASSETS } from './asset-map.js';
import * as audio from './audio.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** FNAF nights run midnight to 6 AM; the clock reports progress in those units. */
const HOURS = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM'];

export function buildBackdrops(stack) {
  stack.innerHTML = GAMES.map((game) => {
    // Absolute URL on purpose: a relative url() inside a custom property is
    // resolved against the stylesheet that *consumes* it, which would make
    // these load from css/ rather than the document root.
    const src = new URL(ASSETS[game.scene], document.baseURI).href;
    return `<div class="bglayer" data-game="${game.id}" style="
      --src:url('${src}');
      --glow:color-mix(in srgb, var(--${game.key}) 26%, transparent);
    "></div>`;
  }).join('');
  return [...stack.querySelectorAll('.bglayer')];
}

export function initScrollChoreography({ layers, specs }) {
  const sections = [...document.querySelectorAll('.game')];
  const nightGame = document.getElementById('nightGame');
  const nightTime = document.getElementById('nightTime');
  const powerFill = document.getElementById('powerFill');
  const root = document.documentElement;

  // First layer is visible before any scrolling happens.
  gsap.set(layers[0], { opacity: 1 });

  sections.forEach((section, i) => {
    const game = GAMES[i];
    const layer = layers[i];
    const next = layers[i + 1];

    /* --- crossfade this layer out as the next section arrives --- */
    if (next) {
      ScrollTrigger.create({
        trigger: sections[i + 1],
        start: 'top bottom',
        end: 'top center',
        onUpdate: (self) => {
          gsap.set(layer, { opacity: 1 - self.progress });
          gsap.set(next, { opacity: self.progress });
        },
      });
    }

    /* --- accent colour + ambience follow the section in view --- */
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 45%',
      onToggle: (self) => {
        if (!self.isActive) return;
        root.style.setProperty('--accent', `var(--${game.key})`);
        nightGame.textContent = `Night ${game.id}`;
        audio.setSection(game.ambience);
      },
    });

    /* --- the clock advances 12 AM -> 6 AM across the section --- */
    ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      end: 'bottom 30%',
      onUpdate: (self) => {
        const hour = Math.min(HOURS.length - 1, Math.floor(self.progress * HOURS.length));
        if (nightTime.textContent !== HOURS[hour]) nightTime.textContent = HOURS[hour];
      },
    });
  });

  /* --- power meter drains across the whole page --- */
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      gsap.set(powerFill, { scaleX: 1 - self.progress * 0.92 });
    },
  });

  /* --- reveals --- */
  if (reduceMotion.matches) {
    document.querySelectorAll('.spec, .game__intro').forEach((el) => el.classList.add('is-revealed'));
  } else {
    document.querySelectorAll('.game__intro').forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 34 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%', once: true },
        }
      );
    });

    specs.forEach((spec) => {
      const copy = spec.querySelector('.spec__copy');
      const rail = spec.querySelector('.spec__rail');
      const plate = spec.querySelector('.spec__plate');

      gsap
        .timeline({ scrollTrigger: { trigger: spec, start: 'top 78%', once: true } })
        .set(spec, { opacity: 1 })
        .fromTo(rail, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' })
        .fromTo(copy, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }, '<0.05')
        // the render arrives last and from further out, so it reads as the
        // thing stepping forward out of the page
        .fromTo(
          plate,
          { opacity: 0, y: 44, scale: 0.94 },
          { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' },
          '<0.1'
        );
    });
  }
}

/** Smooth scrolling, kept in sync with ScrollTrigger. */
export function initSmoothScroll() {
  if (reduceMotion.matches) return null;

  const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
