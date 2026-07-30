/**
 * Ambience and the jumpscare.
 *
 * Four looping beds, one per game, cross-faded by volume as the reader moves
 * between sections. Browsers refuse programmatic playback until the page has
 * seen a real user gesture, which is exactly what the nose boop provides —
 * unlock() is called from that click, priming every element so the later
 * scroll-driven plays are allowed.
 */

import { ASSETS } from './asset-map.js';

const BEDS = ['fnaf1', 'fnaf2', 'fnaf3', 'fnaf4'];
const AMBIENCE_VOLUME = 0.34;
const FADE = 0.9;
const STORAGE_KEY = 'fnafverse:muted';

const beds = new Map();
let jumpscareEl = null;
let current = null;
let unlocked = false;
let muted = localStorage.getItem(STORAGE_KEY) === '1';

function make(src, { loop = false, volume = 0, role = 'bed' } = {}) {
  const el = new Audio(src);
  el.loop = loop;
  el.volume = volume;
  el.preload = 'auto';
  // Kept in the document (rather than as detached Audio objects) so playback
  // state is inspectable from devtools and from the verification suite.
  el.dataset.audio = role;
  document.body.append(el);
  return el;
}

export function init() {
  for (const key of BEDS) {
    if (ASSETS[key]) beds.set(key, make(ASSETS[key], { loop: true, volume: 0 }));
  }
  if (ASSETS.jumpscare) jumpscareEl = make(ASSETS.jumpscare, { volume: 0.85, role: 'sfx' });

  // A backgrounded tab should go quiet rather than keep droning.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) beds.forEach((el) => el.pause());
    else if (current && !muted) beds.get(current)?.play().catch(() => {});
  });
}

/** Prime playback from inside a user gesture. Safe to call more than once. */
export async function unlock() {
  if (unlocked) return;
  unlocked = true;
  const all = [...beds.values(), jumpscareEl].filter(Boolean);
  await Promise.all(
    all.map((el) =>
      el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
        })
        .catch(() => {})
    )
  );
}

export function playJumpscare() {
  if (!jumpscareEl || muted) return;
  jumpscareEl.currentTime = 0;
  jumpscareEl.volume = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 0.85;
  jumpscareEl.play().catch(() => {});
}

/** Cross-fade to a game's bed. Passing null fades everything out. */
export function setSection(key) {
  if (key === current) return;
  const previous = current;
  current = key;

  if (previous && beds.has(previous)) {
    const el = beds.get(previous);
    gsap.to(el, {
      volume: 0,
      duration: FADE,
      overwrite: 'auto',
      onComplete: () => el.pause(),
    });
  }

  if (!key || !beds.has(key) || muted) return;
  const el = beds.get(key);
  el.play().catch(() => {});
  gsap.to(el, { volume: AMBIENCE_VOLUME, duration: FADE, overwrite: 'auto' });
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = next;
  localStorage.setItem(STORAGE_KEY, next ? '1' : '0');

  if (muted) {
    beds.forEach((el) => {
      gsap.killTweensOf(el);
      el.pause();
      el.volume = 0;
    });
  } else if (current && beds.has(current)) {
    const el = beds.get(current);
    el.play().catch(() => {});
    gsap.to(el, { volume: AMBIENCE_VOLUME, duration: FADE, overwrite: 'auto' });
  }
  return muted;
}
