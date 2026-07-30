/**
 * Search, category filters, and the music notes that fly out of the bar.
 */

import { GAMES, TYPES, CHARACTERS, matchesQuery } from './data/characters.js';
import { ASSETS } from './asset-map.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const NOTE_GLYPHS = ['♪', '♫', '♬', '♩'];
const NOTE_THROTTLE = 80;
const MAX_RESULTS = 7;

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function initSearch({ specs, scrollTo }) {
  const input = document.getElementById('search');
  const clear = document.getElementById('searchClear');
  const results = document.getElementById('searchResults');
  const notes = document.getElementById('notes');
  const gameFilters = document.getElementById('gameFilters');
  const typeFilters = document.getElementById('typeFilters');
  const noResults = document.getElementById('noResults');
  const resetBtn = document.getElementById('resetFilters');

  const specById = new Map(specs.map((el) => [el.id, el]));
  const state = { game: null, type: null, query: '' };
  let activeIndex = -1;
  let visibleResults = [];

  /* ------------------------------------------------------------- filters */
  // Only offer type chips that actually have members, and show the count —
  // a filter that leads to an empty page is a dead end, not a feature.
  const typeCounts = new Map();
  for (const c of CHARACTERS) typeCounts.set(c.type, (typeCounts.get(c.type) || 0) + 1);

  gameFilters.innerHTML = GAMES.map(
    (g) =>
      `<button class="chip" type="button" data-filter="game" data-value="${g.id}" aria-pressed="false"
        style="--chip-accent:var(--${g.key})">FNAF ${g.id}<span class="chip__count">${
        CHARACTERS.filter((c) => c.game === g.id).length
      }</span></button>`
  ).join('');

  typeFilters.innerHTML = TYPES.filter((t) => typeCounts.get(t.id))
    .map(
      (t) =>
        `<button class="chip" type="button" data-filter="type" data-value="${t.id}" aria-pressed="false">${escape(
          t.label
        )}<span class="chip__count">${typeCounts.get(t.id)}</span></button>`
    )
    .join('');

  const chips = [...document.querySelectorAll('.chip')];

  function applyFilters() {
    let shown = 0;

    for (const spec of specs) {
      const okGame = !state.game || spec.dataset.game === state.game;
      const okType = !state.type || spec.dataset.type === state.type;
      const visible = okGame && okType;
      spec.classList.toggle('is-filtered', !visible);
      if (visible) shown++;
    }

    // A game section whose entire cast is filtered out should go too,
    // otherwise the page keeps a heading with nothing under it.
    for (const section of document.querySelectorAll('.game')) {
      const any = section.querySelector('.spec:not(.is-filtered)');
      section.hidden = !any;
    }

    noResults.hidden = shown > 0;
    ScrollTrigger.refresh();
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const { filter, value } = chip.dataset;
      const isOn = state[filter] === value;
      state[filter] = isOn ? null : value;

      for (const other of chips) {
        if (other.dataset.filter !== filter) continue;
        other.setAttribute('aria-pressed', String(!isOn && other === chip));
      }
      applyFilters();
    });
  }

  resetBtn.addEventListener('click', () => {
    state.game = null;
    state.type = null;
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    applyFilters();
  });

  /* -------------------------------------------------------------- results */
  function renderResults(query) {
    visibleResults = query
      ? CHARACTERS.filter((c) => matchesQuery(c, query)).slice(0, MAX_RESULTS)
      : [];
    activeIndex = -1;

    if (!visibleResults.length) {
      results.hidden = true;
      results.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    results.innerHTML = visibleResults
      .map(
        (c, i) => `
      <li role="option" id="result-${c.id}" aria-selected="false">
        <button class="finder__result" type="button" data-id="${c.id}" data-i="${i}">
          <img class="finder__thumb" src="${ASSETS[c.id] || ''}" alt="" loading="lazy">
          <span class="finder__name">${escape(c.name)}</span>
          <span class="finder__meta">FNAF ${c.game}</span>
        </button>
      </li>`
      )
      .join('');
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function closeResults() {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function select(id) {
    const spec = specById.get(id);
    if (!spec) return;

    // A hidden target can't be scrolled to — drop the filters that hide it
    // rather than silently doing nothing.
    if (spec.classList.contains('is-filtered')) {
      state.game = null;
      state.type = null;
      chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      applyFilters();
    }

    closeResults();
    input.blur();
    scrollTo(spec);

    spec.classList.remove('is-target');
    void spec.offsetWidth; // restart the highlight if the same card is picked twice
    spec.classList.add('is-target');
    spec.addEventListener('animationend', () => spec.classList.remove('is-target'), { once: true });
  }

  results.addEventListener('click', (e) => {
    const btn = e.target.closest('.finder__result');
    if (btn) select(btn.dataset.id);
  });

  function highlight(next) {
    const options = [...results.querySelectorAll('.finder__result')];
    if (!options.length) return;
    activeIndex = (next + options.length) % options.length;
    options.forEach((o, i) => {
      o.classList.toggle('is-active', i === activeIndex);
      o.parentElement.setAttribute('aria-selected', String(i === activeIndex));
    });
    options[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = visibleResults[activeIndex] || visibleResults[0];
      if (pick) select(pick.id);
    } else if (e.key === 'Escape') {
      closeResults();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.finder')) closeResults();
  });

  /* --------------------------------------------------------- music notes */
  let lastNote = 0;
  function spawnNote() {
    if (reduceMotion.matches) return;
    const now = performance.now();
    if (now - lastNote < NOTE_THROTTLE) return;
    lastNote = now;

    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)];
    note.style.left = `${18 + Math.random() * 64}%`;
    note.style.setProperty('--dx', `${(Math.random() - 0.5) * 46}px`);
    note.style.setProperty('--rot', `${(Math.random() - 0.5) * 60}deg`);
    note.style.fontSize = `${0.8 + Math.random() * 0.5}rem`;
    notes.appendChild(note);
    note.addEventListener('animationend', () => note.remove(), { once: true });
  }

  /* --------------------------------------------------------------- input */
  input.addEventListener('input', () => {
    state.query = input.value;
    clear.hidden = !state.query;
    renderResults(state.query.trim());
    spawnNote();
  });

  input.addEventListener('focus', () => {
    if (state.query.trim()) renderResults(state.query.trim());
  });

  clear.addEventListener('click', () => {
    input.value = '';
    state.query = '';
    clear.hidden = true;
    closeResults();
    input.focus();
  });

  // "/" focuses search, the convention readers already know from other sites.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      input.focus();
    }
  });

  applyFilters();
}
