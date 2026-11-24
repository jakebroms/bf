# Ball Five Baseball 1977 on Cloudflare (Workers + D1)

Live at **https://bf.bromsey.work** (also https://ballfive.jakebromsey.workers.dev).

This folder is the deployed app: a Cloudflare Worker that serves the game page, handles accounts
(email + password), keeps each player's season, and writes every finished game into a D1 database
(Cloudflare's SQLite). Same API and same tables as the Node version in `../server`.

## Redeploying after a change

1. Rebuild the page: from the folder above, `node tools/build.js worker/public/index.html`
   (the page is bundled into the Worker script, so no separate upload is needed).
2. `npx wrangler deploy` in this folder. Wrangler needs a Cloudflare API token
   (`CLOUDFLARE_API_TOKEN`) with Workers Scripts Edit, D1 Edit and Workers Routes Edit, and
   `CLOUDFLARE_ACCOUNT_ID=07de9813bf23236dfaad84568b0fbd00`.

The database `ballfive` (id in `wrangler.toml`) already has its tables. If the schema ever changes,
add a new file to `migrations/` and run `npx wrangler d1 migrations apply ballfive --remote`.

## Looking at the data

- Cloudflare dashboard → Storage & Databases → D1 → ballfive: browse tables and run SQL.
- Or from here: `npx wrangler d1 execute ballfive --remote --command "SELECT name, SUM(hr) hr FROM batting_lines GROUP BY player_id ORDER BY hr DESC LIMIT 10"`
- Export everything: `npx wrangler d1 export ballfive --remote --output ballfive.sql`

Tables: users, sessions, saves (each user's live season), games, batting_lines, pitching_lines,
plate_appearances (scorebook notation per plate appearance). Exhibition and playoff games are flagged
and left out of the totals.

## Costs

Everything here fits in Cloudflare's free tier for a family's use: the Worker (100,000 requests a day),
D1 (5 GB, 5 million reads a day), and the custom domain.
