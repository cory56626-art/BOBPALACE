/**
 * Bootstrap. Builds the roster up front so the page behind the landing
 * overlay is already complete, then starts the scroll choreography once the
 * reader has come through the intro.
 */

import { renderRoster, initTilt } from './characters.js';
import { buildBackdrops, initScrollChoreography, initSmoothScroll } from './backgrounds.js';
import { initSearch } from './search.js';
import { initLanding } from './landing.js';
import * as audio from './audio.js';

gsap.registerPlugin(ScrollTrigger);

const specs = renderRoster(document.getElementById('rosterMount'));
const layers = buildBackdrops(document.getElementById('bgstack'));

audio.init();

/* The HUD's height depends on how the filter chips wrap, which depends on the
   viewport and the loaded fonts — so measure it instead of hard-coding it, and
   keep --hud-h correct through resizes. Content padding and every scroll-to
   offset are derived from it. */
const hud = document.getElementById('hud');
function syncHudHeight() {
  const h = Math.ceil(hud.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hud-h', `${h}px`);
}
new ResizeObserver(syncHudHeight).observe(hud);
syncHudHeight();

let lenis = null;

/** Scroll a card into view, accounting for the fixed HUD. */
function scrollToSpec(el) {
  const offset = -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) + 24);
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.3 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
}

initSearch({ specs, scrollTo: scrollToSpec });
initTilt(specs);

/* ------------------------------------------------------------ mute toggle */
const muteToggle = document.getElementById('muteToggle');
const muteLabel = muteToggle.querySelector('.hud__mute-label');

function paintMute() {
  const muted = audio.isMuted();
  muteToggle.setAttribute('aria-pressed', String(muted));
  muteLabel.textContent = muted ? 'Sound off' : 'Sound on';
}
muteToggle.addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  paintMute();
});
paintMute();

/* ------------------------------------------------------------- the intro */
initLanding({
  onEnter() {
    document.getElementById('hud').classList.add('is-in');
    document.getElementById('nightclock').classList.add('is-in');

    lenis = initSmoothScroll();
    initScrollChoreography({ layers, specs });

    // Layout only settles once the overlay is out of the way and the fonts
    // have landed, so the triggers need their positions recalculated.
    ScrollTrigger.refresh();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    audio.setSection('fnaf1');
  },
});
