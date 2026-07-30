#!/usr/bin/env node
/**
 * Downloads every image and audio file the site needs from the FNAF Wiki
 * (Fandom) into ./assets, and writes assets/manifest.generated.json mapping
 * each asset id to its local path.
 *
 * Why this exists rather than hotlinking: static.wikia.nocookie.net serves a
 * 404 for any request carrying a third-party Referer header, so wiki URLs
 * embedded in a deployed page would all fail. Assets have to be local.
 *
 * Resolution is tiered per entry, stopping at the first hit:
 *   1. an explicit "file" title            -> prop=imageinfo
 *   2. the article's lead image            -> prop=pageimages
 *   3. the best-named image on the article -> prop=images + heuristics
 *
 * Tier 2 alone covers most characters but has traps: the "Springtrap" article
 * redirects to "William Afton" and yields a Purple Guy sprite, so entries like
 * that pin an explicit file title. Anything that falls through all three tiers
 * is reported loudly at the end so it can be curated into manifest.json.
 *
 * Usage:  node scripts/fetch-assets.mjs [--force] [--resolve-only]
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://freddy-fazbears-pizza.fandom.com/api.php';
const UA = 'FNAF-Verse-fan-site/1.0 (static fan project; one-off asset fetch)';
const CONCURRENCY = 5;

const FORCE = process.argv.includes('--force');
const RESOLVE_ONLY = process.argv.includes('--resolve-only');

/* ------------------------------------------------------------------ helpers */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json' })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(2 ** attempt * 500);
    }
  }
}

/** Run `worker` over `items` with a bounded number in flight. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i], i);
      }
    })
  );
  return results;
}

/**
 * Score a candidate image filename. Renders and infobox art are transparent
 * cut-outs, which is what the drop-shadow "pop out" effect needs; screenshots
 * and icons are not.
 */
function scoreCandidate(title, name) {
  const t = title.toLowerCase();
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  if (/render/.test(t)) score += 40;
  if (/infobox/.test(t)) score += 35;
  if (/full[\s_-]?body/.test(t)) score += 30;
  if (/official/.test(t)) score += 10;
  if (t.endsWith('.png')) score += 15;
  // every word of the character name present is a strong signal
  score += tokens.filter((w) => t.includes(w)).length * 12;
  // things that are definitely not a character cut-out
  if (/icon|logo|header|thumb|banner|nav|wordmark|favicon/.test(t)) score -= 60;
  if (/\.gif$/.test(t)) score -= 40;
  if (/screenshot|gameplay|cutscene|teaser|trailer|poster/.test(t)) score -= 25;
  if (/merch|plush|figure|funko|toy line|action figure/.test(t)) score -= 20;
  if (/movie|film|novel|book|security breach|help wanted|ar |vr /.test(t)) score -= 30;
  return score;
}

/* ---------------------------------------------------------------- resolution */

/**
 * Some source renders are enormous (the Springtrap render is 3047x3482 / 6MB).
 * Asking MediaWiki for a width-capped thumbnail keeps the committed assets
 * reasonable, and Fandom's thumbnailer preserves alpha (it returns VP8X WebP
 * with the alpha flag set), which the cut-out drop-shadow effect depends on.
 * Animated GIFs must skip this — thumbnailing flattens them to a single frame.
 */
const MAX_WIDTH = 900;

async function resolveByFile(fileTitle, { raw = false } = {}) {
  const data = await api({
    action: 'query',
    titles: `File:${fileTitle}`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime',
    ...(raw ? {} : { iiurlwidth: String(MAX_WIDTH) }),
  });
  const page = Object.values(data.query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  // thumburl is absent for audio and for images already under MAX_WIDTH
  return { url: info.thumburl || info.url, via: `file:${fileTitle}` };
}

async function resolveByPageImage(pageTitle) {
  const data = await api({
    action: 'query',
    titles: pageTitle,
    prop: 'pageimages',
    pithumbsize: String(MAX_WIDTH),
    pilicense: 'any',
    redirects: '1',
  });
  const page = Object.values(data.query.pages)[0];
  const src = page?.thumbnail?.source || page?.original?.source;
  return src ? { url: src, via: `pageimage:${page.title}` } : null;
}

async function resolveByPageImageList(pageTitle, name) {
  const data = await api({
    action: 'query',
    titles: pageTitle,
    prop: 'images',
    imlimit: '60',
    redirects: '1',
  });
  const page = Object.values(data.query.pages)[0];
  const images = page?.images || [];
  if (!images.length) return null;

  const ranked = images
    .map((i) => ({ title: i.title.replace(/^File:/, ''), score: scoreCandidate(i.title, name) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;

  const hit = await resolveByFile(ranked[0].title);
  return hit ? { url: hit.url, via: `imagelist:${ranked[0].title}` } : null;
}

async function resolveEntry(entry) {
  if (entry.file) {
    const hit = await resolveByFile(entry.file, { raw: entry.raw });
    if (hit) return hit;
    console.warn(`  ! pinned file missing for ${entry.id}: ${entry.file}`);
  }
  if (entry.page) {
    const hit = await resolveByPageImage(entry.page);
    if (hit) return hit;
    const listHit = await resolveByPageImageList(entry.page, entry.name || entry.id);
    if (listHit) return listHit;
  }
  return null;
}

/* ------------------------------------------------------------------ download */

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'audio/ogg': 'ogg',
  'application/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/**
 * Fandom content-negotiates WebP regardless of the .png in the source URL, so
 * the extension has to come from the response Content-Type, not the URL.
 */
async function download(url, destDir, stem) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } }); // deliberately no Referer
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error(`unexpected content-type "${mime}" for ${url}`);

  const filename = `${stem}.${ext}`;
  const abs = join(destDir, filename);
  await mkdir(destDir, { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(abs));

  const { size } = await stat(abs);
  if (size < 1024) throw new Error(`suspiciously small (${size}B): ${filename}`);
  return { filename, size, mime };
}

/** Existing file for this stem, if any — lets re-runs skip work. */
async function findExisting(destDir, stem) {
  try {
    const files = await readdir(destDir);
    return files.find((f) => f.replace(/\.[^.]+$/, '') === stem) || null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------- main */

const DIRS = {
  characters: 'assets/img/characters',
  scenes: 'assets/img/scenes',
  audio: 'assets/audio',
};

async function main() {
  const manifest = JSON.parse(await readFile(join(ROOT, 'scripts/manifest.json'), 'utf8'));

  const entries = [];
  for (const [section, dir] of Object.entries(DIRS)) {
    for (const entry of manifest[section] || []) {
      entries.push({ ...entry, section, dir });
    }
  }

  console.log(`Resolving ${entries.length} assets from the FNAF Wiki...\n`);

  const failures = [];
  const generated = {};

  await pool(entries, CONCURRENCY, async (entry) => {
    const destDir = join(ROOT, entry.dir);

    if (!FORCE && !RESOLVE_ONLY) {
      const existing = await findExisting(destDir, entry.id);
      if (existing) {
        generated[entry.id] = `${entry.dir}/${existing}`;
        console.log(`  = ${entry.id.padEnd(26)} cached (${existing})`);
        return;
      }
    }

    let hit;
    try {
      hit = await resolveEntry(entry);
    } catch (err) {
      failures.push({ ...entry, reason: `resolve error: ${err.message}` });
      console.log(`  x ${entry.id.padEnd(26)} resolve error: ${err.message}`);
      return;
    }

    if (!hit) {
      failures.push({ ...entry, reason: 'no candidate found' });
      console.log(`  x ${entry.id.padEnd(26)} UNRESOLVED`);
      return;
    }

    if (RESOLVE_ONLY) {
      console.log(`  > ${entry.id.padEnd(26)} ${hit.via}`);
      return;
    }

    try {
      const { filename, size } = await download(hit.url, destDir, entry.id);
      generated[entry.id] = `${entry.dir}/${filename}`;
      console.log(`  + ${entry.id.padEnd(26)} ${filename} (${Math.round(size / 1024)}KB)  ${hit.via}`);
    } catch (err) {
      failures.push({ ...entry, reason: `download failed: ${err.message}` });
      console.log(`  x ${entry.id.padEnd(26)} download failed: ${err.message}`);
    }
  });

  if (!RESOLVE_ONLY) {
    const sorted = Object.fromEntries(Object.entries(generated).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(
      join(ROOT, 'assets/manifest.generated.json'),
      JSON.stringify(sorted, null, 2) + '\n'
    );
    // Emitted as a module rather than read as JSON at runtime: the extensions
    // depend on what the CDN served, so the site can't derive them, and an
    // import keeps the page free of a blocking fetch on first paint.
    await writeFile(
      join(ROOT, 'js/asset-map.js'),
      '// Generated by scripts/fetch-assets.mjs — do not edit by hand.\n' +
        `export const ASSETS = ${JSON.stringify(sorted, null, 2)};\n`
    );
  }

  console.log(`\n${'-'.repeat(64)}`);
  console.log(`resolved: ${entries.length - failures.length}/${entries.length}`);

  if (failures.length) {
    console.log(`\nUNRESOLVED — add a "file" title for these in scripts/manifest.json:`);
    for (const f of failures) console.log(`  - ${f.id} (page: ${f.page || 'n/a'}) — ${f.reason}`);
    process.exitCode = 1;
  } else {
    console.log('All assets present.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
