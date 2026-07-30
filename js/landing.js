/**
 * Landing overlay: nose hitbox -> jumpscare -> hand-off to the roster.
 *
 * The overlay lives in the same document as the roster, so the transition is
 * a fade rather than a navigation — no white flash, no second page load.
 */

import { ASSETS } from './asset-map.js';
import * as audio from './audio.js';

const SEEN_KEY = 'fnafverse:seen-intro';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function initLanding({ onEnter }) {
  const landing = document.getElementById('landing');
  const scene = document.getElementById('landingScene');
  const nose = document.getElementById('noseButton');
  const skip = document.getElementById('skipIntro');
  const jumpscare = document.getElementById('jumpscare');
  const jumpscareImg = document.getElementById('jumpscareImg');
  const flash = document.getElementById('flash');

  if (ASSETS['jumpscare-freddy']) jumpscareImg.src = ASSETS['jumpscare-freddy'];

  let dismissed = false;

  /* --- subtle parallax so the office feels like a room, not a wallpaper --- */
  if (!reduceMotion.matches) {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      gsap.to(scene, { x: x * -16, y: y * -12, duration: 1.1, ease: 'power2.out' });
    };
    landing.addEventListener('pointermove', onMove);
    landing.addEventListener('pointerleave', () =>
      gsap.to(scene, { x: 0, y: 0, duration: 1.1, ease: 'power2.out' })
    );
  }

  /* --------------------------------------------------------- the hand-off */
  function reveal() {
    if (dismissed) return;
    dismissed = true;
    sessionStorage.setItem(SEEN_KEY, '1');

    landing.classList.add('is-leaving');
    document.body.classList.remove('is-locked');

    landing.addEventListener(
      'animationend',
      () => {
        landing.classList.add('is-gone');
        jumpscare.classList.remove('is-active');
      },
      { once: true }
    );

    onEnter();
    // Move focus into the content so keyboard and screen-reader users land
    // where sighted users are now looking.
    document.getElementById('roster').focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------- the scare */
  async function boop() {
    if (dismissed) return;
    await audio.unlock();
    audio.playJumpscare();

    // Reduced motion still gets the beat, just without the strobe and shake.
    const hold = reduceMotion.matches ? 380 : 900;

    jumpscare.classList.add('is-active');
    if (!reduceMotion.matches) {
      flash.classList.add('is-firing');
      flash.addEventListener('animationend', () => flash.classList.remove('is-firing'), {
        once: true,
      });
    }

    setTimeout(reveal, hold);
  }

  nose.addEventListener('click', boop);

  skip.addEventListener('click', async () => {
    // Still a gesture, so still the right moment to unlock the ambience.
    await audio.unlock();
    reveal();
  });

  // Escape is the conventional way out of a modal layer.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dismissed) {
      audio.unlock().then(reveal);
    }
  });
}
