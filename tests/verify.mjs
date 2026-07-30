/**
 * End-to-end verification of the site's interactive behaviour.
 *
 * Drives the pre-installed Chromium (do not run `playwright install` here —
 * PLAYWRIGHT_BROWSERS_PATH already points at it) and asserts the things that
 * can't be checked by reading the source: that the jumpscare fires and hands
 * off, that the backdrops actually cross-fade, that ambience swaps per game,
 * that no character render 404s, and that search scrolls to its target.
 *
 * Usage: node tests/verify.mjs [baseURL]
 */

import { chromium } from 'playwright';
import { mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080';
const SHOTS = 'tests/screenshots';

/**
 * Use whatever Chromium the environment already has. The installed build
 * revision often doesn't match the one this Playwright version would download,
 * and downloading another copy is both slow and usually blocked, so prefer the
 * local one and only fall back to Playwright's own resolution.
 */
async function resolveChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = (await readdir(root)).filter((d) => d.startsWith('chromium-'));
    for (const d of dirs) {
      const candidate = `${root}/${d}/chrome-linux/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    /* fall through to Playwright's default */
  }
  return undefined;
}

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    executablePath: await resolveChromium(),
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  const externalRequests = [];

  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    // Priming playback inside the unlock gesture plays then immediately pauses
    // each bed, which cancels the in-flight range requests. An aborted media
    // preload is expected here and isn't a broken asset — everything else is.
    const aborted = r.failure()?.errorText === 'net::ERR_ABORTED';
    if (aborted && /\.(ogg|mp3|wav)$/.test(new URL(r.url()).pathname)) return;
    failedRequests.push(`${r.url()} — ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith('data:')) externalRequests.push(u);
    if (r.status() >= 400 && u.startsWith(BASE)) failedRequests.push(`${r.status()} ${u}`);
  });

  console.log(`\nLoading ${BASE}\n`);
  await page.goto(BASE, { waitUntil: 'networkidle' });

  /* ------------------------------------------------------------- landing */
  console.log('Landing');
  // innerText reflects text-transform in Chromium, so compare case-insensitively
  const headline = await page.locator('.landing__title').innerText();
  check('welcome headline present', /welcome to the\s+fnaf-verse!/i.test(headline), headline.replace(/\n/g, ' '));
  check('office backdrop visible', await page.locator('.landing__office').isVisible());
  check('poster visible', await page.locator('.poster__img').isVisible());
  check('nose hitbox is a real button', (await page.locator('#noseButton').evaluate((e) => e.tagName)) === 'BUTTON');
  check('roster is built behind the overlay', (await page.locator('.spec').count()) === 43);
  check('body scroll locked during intro', await page.locator('body.is-locked').count() === 1);
  await page.screenshot({ path: `${SHOTS}/01-landing.png` });

  /* ---------------------------------------------------------- jumpscare */
  console.log('\nJumpscare');
  // the nose sits over Freddy's face; clicking it must fire the scare
  await page.locator('#noseButton').click();
  await sleep(220);
  const scareVisible = await page.locator('#jumpscare.is-active').count();
  check('jumpscare overlay shown', scareVisible === 1);
  const scareSrc = await page.locator('#jumpscareImg').getAttribute('src');
  check('jumpscare frame loaded', !!scareSrc && scareSrc.includes('jumpscare-freddy'), scareSrc || 'no src');
  const bedCount = await page.locator('audio[data-audio]').count();
  check('ambience beds constructed', bedCount === 5, `${bedCount} audio elements (4 beds + jumpscare)`);
  await page.screenshot({ path: `${SHOTS}/02-jumpscare.png` });

  // Wait for the hand-off rather than racing its ~1.3s scare-plus-fade.
  // state:'attached' matters — is-gone sets display:none, so the default
  // 'visible' wait could never resolve.
  const handedOff = await page
    .waitForSelector('#landing.is-gone', { state: 'attached', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check('overlay handed off to the roster', handedOff);
  check('scroll unlocked', (await page.locator('body.is-locked').count()) === 0);
  check('HUD revealed', (await page.locator('#hud.is-in').count()) === 1);
  await page.screenshot({ path: `${SHOTS}/03-roster-top.png` });

  /* ------------------------------------------------- images actually load */
  console.log('\nArtwork');
  const broken = await page.$$eval('.spec__img', (imgs) =>
    imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('alt'))
  );
  // lazy images below the fold report naturalWidth 0 until scrolled; only the
  // ones already in view are meaningful here, so re-check after the scroll pass.
  console.log(`  (${broken.length} not yet decoded before scrolling — rechecked below)`);

  /* ---------------------------------------------- scroll through the games */
  console.log('\nScroll choreography');
  const seenAmbience = new Set();
  const opacityTrail = [];

  for (const g of [1, 2, 3, 4]) {
    await page.evaluate((game) => {
      const el = document.querySelector(`.game[data-game="${game}"]`);
      window.scrollTo({ top: el.offsetTop + 200, behavior: 'instant' });
    }, g);
    await sleep(900);

    const state = await page.evaluate(() => ({
      layers: [...document.querySelectorAll('.bglayer')].map((l) =>
        Number(getComputedStyle(l).opacity).toFixed(2)
      ),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      night: document.getElementById('nightGame').textContent,
      clock: document.getElementById('nightTime').textContent,
      playing: [...document.querySelectorAll('audio[data-audio="bed"]')]
        .filter((a) => !a.paused && a.volume > 0.01)
        .map((a) => a.src.split('/').pop()),
    }));

    opacityTrail.push(state.layers);
    state.playing.forEach((p) => seenAmbience.add(p));
    check(
      `FNAF ${g}: backdrop layer ${g} is the dominant one`,
      state.layers[g - 1] === Math.max(...state.layers.map(Number)).toFixed(2),
      `opacities ${state.layers.join(' / ')}`
    );
    check(`FNAF ${g}: night clock reports the section`, state.night === `Night ${g}`, state.night);
    check(`FNAF ${g}: ambience playing`, state.playing.length === 1, state.playing.join(',') || 'none');
    await page.screenshot({ path: `${SHOTS}/0${3 + g}-fnaf${g}.png` });
  }

  check('each game has its own ambience bed', seenAmbience.size === 4, [...seenAmbience].join(', '));

  /* --- crossfade: mid-boundary both neighbours should be partially visible --- */
  await page.evaluate(() => {
    const el = document.querySelector('.game[data-game="2"]');
    window.scrollTo({ top: el.offsetTop - window.innerHeight * 0.75, behavior: 'instant' });
  });
  await sleep(700);
  const mid = await page.$$eval('.bglayer', (ls) => ls.map((l) => Number(getComputedStyle(l).opacity)));
  check(
    'backdrops cross-fade rather than cut',
    mid[0] > 0.05 && mid[0] < 0.98 && mid[1] > 0.02,
    `layer1=${mid[0].toFixed(2)} layer2=${mid[1].toFixed(2)}`
  );

  /* --- walk the whole page so every lazy render passes through the viewport --- */
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < pageHeight; y += 700) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await sleep(90);
  }
  await sleep(1500);
  const stillBroken = await page.$$eval('.spec__img', (imgs) =>
    imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('alt'))
  );
  check('every character render decoded', stillBroken.length === 0, stillBroken.slice(0, 4).join('; '));

  /* -------------------------------------------------------------- search */
  console.log('\nSearch');
  await page.locator('#search').fill('Mangle');
  await sleep(450);
  const resultCount = await page.locator('.finder__result').count();
  check('search returns results', resultCount > 0, `${resultCount} results`);
  const noteCount = await page.locator('.note').count();
  check('music notes animate on typing', noteCount > 0, `${noteCount} notes in flight`);
  await page.screenshot({ path: `${SHOTS}/08-search.png` });

  await page.locator('.finder__result').first().click();
  await sleep(1800);
  const targetInView = await page.evaluate(() => {
    const el = document.getElementById('mangle');
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), h: window.innerHeight };
  });
  check(
    'selecting a result scrolls to that character',
    targetInView.top > -50 && targetInView.top < targetInView.h * 0.7,
    `card top at ${targetInView.top}px`
  );
  await page.screenshot({ path: `${SHOTS}/09-search-target.png` });

  /* ------------------------------------------------------------- filters */
  console.log('\nFilters');
  await page.locator('#searchClear').click();
  await page.locator('.chip[data-filter="game"][data-value="3"]').click();
  await sleep(500);
  const visibleAfterGame = await page.locator('.spec:not(.is-filtered)').count();
  check('game filter narrows the roster', visibleAfterGame === 7, `${visibleAfterGame} shown (expected 7)`);

  await page.locator('.chip[data-filter="type"][data-value="phantom"]').click();
  await sleep(500);
  const visibleAfterType = await page.locator('.spec:not(.is-filtered)').count();
  check('type filter narrows further', visibleAfterType === 6, `${visibleAfterType} shown (expected 6 phantoms)`);
  await page.screenshot({ path: `${SHOTS}/10-filtered.png` });

  await page.locator('.chip[data-filter="game"][data-value="3"]').click();
  await page.locator('.chip[data-filter="type"][data-value="phantom"]').click();
  await sleep(400);
  check(
    'clearing filters restores the roster',
    (await page.locator('.spec:not(.is-filtered)').count()) === 43
  );

  /* ---------------------------------------------------------------- mute */
  console.log('\nSound control');
  await page.locator('#muteToggle').click();
  await sleep(400);
  const anyAudible = await page.evaluate(() =>
    [...document.querySelectorAll('audio[data-audio="bed"]')].some((a) => !a.paused && a.volume > 0.01)
  );
  check('mute silences ambience', !anyAudible);

  /* ------------------------------------------------------------ hygiene */
  console.log('\nHygiene');
  const wikiCalls = externalRequests.filter((u) => u.includes('wikia') || u.includes('fandom'));
  check('no runtime calls to the wiki CDN', wikiCalls.length === 0, wikiCalls.slice(0, 2).join(' '));
  check('no external requests at all', externalRequests.length === 0, externalRequests.slice(0, 3).join(' '));
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  /* ------------------------------------------------- reduced motion pass */
  console.log('\nReduced motion');
  const rmContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const rm = await rmContext.newPage();
  const rmErrors = [];
  rm.on('pageerror', (e) => rmErrors.push(e.message));
  await rm.goto(BASE, { waitUntil: 'networkidle' });
  check('nose ping suppressed', (await rm.locator('.poster__ring').evaluate((e) => getComputedStyle(e).display)) === 'none');
  await rm.locator('#noseButton').click();
  await sleep(900);
  check('still hands off to the roster', (await rm.locator('#landing.is-gone').count()) === 1);
  check('cards are visible without scroll animation', (await rm.locator('.spec.is-revealed').count()) === 43);
  check('no errors under reduced motion', rmErrors.length === 0, rmErrors.slice(0, 2).join(' | '));
  await rm.screenshot({ path: `${SHOTS}/11-reduced-motion.png` });

  /* ------------------------------------------------------------- mobile */
  console.log('\nMobile');
  const mContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await mContext.newPage();
  await m.goto(BASE, { waitUntil: 'networkidle' });
  await m.locator('#skipIntro').click();
  await sleep(700);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px of overflow`);
  await m.evaluate(() => window.scrollTo(0, 1400));
  await sleep(600);
  await m.screenshot({ path: `${SHOTS}/12-mobile.png` });

  await browser.close();

  console.log(`\n${'='.repeat(58)}`);
  console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`);
  console.log(`Screenshots in ${SHOTS}/`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
