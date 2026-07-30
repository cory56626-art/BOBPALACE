/**
 * Builds the roster markup from the static database and wires the per-card
 * 3D tilt.
 */

import { GAMES, TYPES, CHARACTERS } from './data/characters.js';
import { ASSETS } from './asset-map.js';

const typeLabel = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function specMarkup(character, index) {
  const src = ASSETS[character.id];
  const trivia = character.trivia
    .map((t) => `<li>${escape(t)}</li>`)
    .join('');
  // The section heading already spells the game out; the rail only needs the
  // short form, which also keeps the Halloween Edition debuts distinguishable.
  const debut = character.firstAppearance.replace(/Five Nights at Freddy's/i, 'FNAF');

  return `
<article class="spec" id="${character.id}" data-game="${character.game}" data-type="${character.type}" data-index="${index}">
  <div class="spec__rail">
    <span class="spec__tag">${escape(typeLabel[character.type] || character.type)}</span>
    <span class="spec__debut">${escape(debut)}</span>
  </div>

  <div class="spec__copy">
    <h3 class="spec__name">${escape(character.name)}</h3>
    <p class="spec__tagline">${escape(character.tagline)}</p>
    <p class="spec__body">${escape(character.description)}</p>
    <ul class="spec__trivia">${trivia}</ul>
  </div>

  <figure class="spec__figure">
    <div class="spec__plate">
      ${
        src
          ? `<img class="spec__img" src="${src}" alt="${escape(character.name)} from Five Nights at Freddy's ${character.game}." loading="lazy" decoding="async">`
          : `<div class="spec__img spec__img--missing" role="img" aria-label="${escape(character.name)} — artwork unavailable"></div>`
      }
    </div>
  </figure>
</article>`;
}

function gameMarkup(game, characters, startIndex) {
  const specs = characters
    .map((c, i) => specMarkup(c, startIndex + i))
    .join('');

  return `
<section class="game" id="${game.key}" data-game="${game.id}" style="--accent:var(--${game.key});--glow:color-mix(in srgb, var(--${game.key}) 22%, transparent)">
  <div class="game__intro">
    <p class="game__index">Night ${game.id} · ${characters.length} animatronics</p>
    <h2 class="game__title">FNAF <span>${game.id}</span></h2>
    <p class="game__meta">${escape(game.title)} &nbsp;·&nbsp; ${escape(game.setting)} &nbsp;·&nbsp; released ${escape(game.year)}</p>
    <p class="game__blurb">${escape(game.blurb)}</p>
  </div>
  ${specs}
</section>`;
}

/** Render every game section into the mount point. Returns the spec elements. */
export function renderRoster(mount) {
  let index = 0;
  const html = GAMES.map((game) => {
    const cast = CHARACTERS.filter((c) => c.game === game.id);
    const section = gameMarkup(game, cast, index);
    index += cast.length;
    return section;
  }).join('');

  mount.innerHTML = html;
  return [...mount.querySelectorAll('.spec')];
}

/**
 * Mouse-tracked tilt. Combined with the layered drop-shadows in CSS this is
 * what sells the depth — the render sits forward of its plate in Z, so the
 * silhouette swings against its own shadow as the card turns.
 */
export function initTilt(specs) {
  if (reduceMotion.matches) return;

  for (const spec of specs) {
    const figure = spec.querySelector('.spec__figure');
    const plate = spec.querySelector('.spec__plate');
    if (!figure || !plate) continue;

    const quickX = gsap.quickTo(plate, 'rotationY', { duration: 0.5, ease: 'power2.out' });
    const quickY = gsap.quickTo(plate, 'rotationX', { duration: 0.5, ease: 'power2.out' });

    figure.addEventListener('pointermove', (e) => {
      const r = figure.getBoundingClientRect();
      quickX(((e.clientX - r.left) / r.width - 0.5) * 22);
      quickY(((e.clientY - r.top) / r.height - 0.5) * -16);
    });

    figure.addEventListener('pointerleave', () => {
      quickX(0);
      quickY(0);
    });
  }
}
