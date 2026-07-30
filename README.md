# FNAF-Verse

An interactive catalogue of every animatronic from *Five Nights at Freddy's* 1 through 4.
Boop Freddy's nose to get in, then scroll from 1993 to 1983 while the backdrop, the accent
colour and the ambience change under you.

Plain HTML, CSS and JavaScript. **No build step** — clone it and open `index.html`, or
serve the folder.

```bash
npm start          # python3 -m http.server 8080
```

## What's in it

| | |
|---|---|
| **Intro** | The FNAF 1 office with the *Celebrate!* poster. Freddy's nose is a real focusable button; clicking it fires the authentic `XSCREAM` jumpscare and hands off to the roster without a page load. |
| **Roster** | 43 animatronics across the four games, in chronological order. Description centre, render right, layered drop-shadows and a mouse-tracked tilt for depth. |
| **Backdrops** | One fixed layer per game, cross-faded against scroll position so FNAF 1 dissolves into FNAF 2 rather than cutting. |
| **Ambience** | Each game has its own looping bed, cross-faded on section change. Muted state persists. |
| **Night clock** | Bottom-left HUD. The hour advances 12 AM → 6 AM across each section and the power meter drains across the whole page, so scroll position is reported in the franchise's own units. |
| **Search & filters** | Filter by game or by type (Toys, Withered, Phantoms, Nightmares…). Search matches names and aliases, throws music notes off the bar as you type, and scrolls to the character you pick. Press `/` to focus it. |

## Layout

```
index.html              single page — landing overlay sits above the roster
css/                    base (tokens/type) · nav (HUD) · landing · main
js/
  data/characters.js    the static character database
  asset-map.js          generated id -> local file map
  landing.js            nose hitbox, jumpscare, hand-off, audio unlock
  backgrounds.js        backdrop cross-fade, reveals, night clock
  audio.js              ambience beds and the scream
  characters.js         roster markup + 3D tilt
  search.js             search, filters, music notes
assets/                 renders, backdrops, audio, fonts (all committed)
scripts/fetch-assets.mjs   re-downloads the media from the FNAF Wiki
tests/verify.mjs        end-to-end checks in a real browser
vendor/                 GSAP, ScrollTrigger, Lenis
```

## Assets

Media is downloaded from the [FNAF Wiki](https://freddy-fazbears-pizza.fandom.com/) and
**committed to the repo**, deliberately: `static.wikia.nocookie.net` returns a 404 for any
request carrying a third-party `Referer`, so hotlinked wiki URLs would break on a deployed
page. Everything the site loads is local — there are no runtime calls to the wiki, which
the test suite asserts.

To refresh or re-source the media:

```bash
npm run fetch-assets          # skips files already present
npm run fetch-assets:force    # re-downloads everything
```

`scripts/manifest.json` maps each asset to its wiki source. Resolution is tiered: an
explicit `File:` title wins, then the article's lead image, then the best-named image on
the article. The middle tier covers most characters but has traps worth knowing about —
the `Springtrap` article redirects to `William Afton` and yields a Purple Guy sprite, and
all four Withered articles redirect onto their classic counterparts — so those entries pin
an explicit `file`. Anything that falls through all three tiers is printed as UNRESOLVED at
the end of the run and needs a `file` added by hand.

## Tests

```bash
npm start &                   # site must be served first
npm run verify
```

Drives Chromium and asserts the things source review can't: that the jumpscare fires and
hands off, that backdrops genuinely cross-fade mid-boundary, that a different ambience bed
plays in each section, that all 43 renders decode, that search scrolls to its target, that
filters narrow correctly, and that the page makes no external requests and logs no console
errors. It also re-runs the intro under `prefers-reduced-motion` and checks a 390px
viewport for horizontal overflow. Screenshots land in `tests/screenshots/`.

## Accessibility

The jumpscare is loud and strobing, so it is opt-in in both directions: **Enter quietly**
skips it, `Escape` dismisses the intro, and there's a persistent sound toggle in the HUD.
Under `prefers-reduced-motion` the shake, strobe and card tilt are dropped, the scream
plays quieter, and sections appear without scroll animation. The nose is a real `<button>`,
focus is moved into the roster on entry, and focus outlines are visible throughout.

## Credits

*Five Nights at Freddy's* and all its characters are the property of Scott Cawthon and
Steel Wool Studios. This is a non-commercial fan project; character renders, backdrops and
audio come from the FNAF Wiki and are used for reference only. Character descriptions were
written for this site from the factual content documented there.

Typefaces: Big Shoulders Display, IBM Plex Sans, IBM Plex Mono (SIL Open Font License).
