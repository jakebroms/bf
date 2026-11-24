# Ball Five Baseball 1977

A web version of the Ball Five Baseball 1977 replay game: one roll of 1-1000 reads the batter's card (1-500) or the pitcher's card (501-1000), with every 1977 player's real card, the real schedule and lineups, fielding checks, base running, steals, bunts, pickoffs, weather, pitcher rest, a scorebook, season stats, leaders, records and playoffs.

Live at https://bf.bromsey.work (accounts and a stats database on Cloudflare).

## Layout

| folder | what it is |
|---|---|
| `src/` | the game: `data.js` (all cards and tables), `core.js`, `play.js` (the at-bat engine), `manage.js` (season, standings, playoffs), `field.js` (the ballpark), `sound.js`, `net.js` (accounts and sync), `ui.js`, `styles.css`, `index.html` |
| `tools/` | `build.js` bundles `src/` into one HTML file; `extract.py` regenerates `data.js` from the original workbook; the rest are tests |
| `BallFive_1977.html` | the built single-file game, playable offline from any browser |
| `worker/` | the deployed version: a Cloudflare Worker with a D1 database (see its README) |
| `server/` | the same server for self-hosting with Node and SQLite (see its README) |

## Building

    node tools/build.js                         # -> BallFive_1977.html
    node tools/build.js worker/public/index.html
    node tools/build.js server/public/index.html

## Tests

    node tools/simtest.js 100     # simulates 100 games headlessly and checks the box scores add up
    node tools/booktest.js        # scorebook entries vs box scores
    node tools/uitest.js          # plays a game in a headless browser (needs Playwright)
    node tools/audiotest.js       # renders every sound effect offline

Dedicated to Jim Bouton (1939-2019).
