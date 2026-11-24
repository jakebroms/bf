# Ball Five Baseball 1977 · web app with accounts and a stats database

The same game as the single file, served by a small web server. Each person signs in with an email and
password, their season is saved on the server (so it follows them to any computer), and every finished
game is written into a SQLite database: games, batting lines, pitching lines, and every plate appearance
in scorebook notation. Nothing else is needed: no cloud account, no external database.

## Run it on a computer (home network)

1. Install Node.js 18 or newer from https://nodejs.org (the LTS download).
2. Open a terminal in this `server` folder and run:

       npm install
       npm start

3. Open http://localhost:3000 in a browser. Click **Account** at the top to create an account.
4. Other computers on the same network can use it at `http://<this computer's IP>:3000`
   (find the IP with `ipconfig` on Windows or `ifconfig` on a Mac).

The database lives in `server/data/ballfive.db`. Back it up by copying that file.
To use another path, set `BF_DB=/path/to/ballfive.db` before starting. To use another port, set `PORT=8080`.

## Put it on the internet

Any host that runs Node and keeps a disk between restarts works. Two easy ones:

- **Railway** or **Render**: create a new service from this folder (or a Git repository containing it), set
  the start command to `npm start`, add a persistent volume mounted at `/data`, and set the environment
  variables `BF_DB=/data/ballfive.db` and `BF_SECURE_COOKIES=1`. Both give you an HTTPS address.
- **Docker** anywhere: `docker build -t ballfive .` then
  `docker run -p 3000:3000 -v ballfive-data:/data -e BF_DB=/data/ballfive.db ballfive`.

Set `BF_SECURE_COOKIES=1` whenever the site is reached over HTTPS; leave it unset on a plain home network.

## What the database holds

| table               | one row per                                   |
|---------------------|-----------------------------------------------|
| users               | account                                       |
| saves               | user: the live season exactly as the game keeps it |
| games               | finished game: score, line score, pitchers of record, park, notes |
| batting_lines       | batter in a game: AB R H 2B 3B HR RBI BB K SB CS SF SH GIDP E HBP IBB |
| pitching_lines      | pitcher in a game: outs H R ER BB K HR BF and decisions |
| plate_appearances   | plate appearance: inning, batter, scorebook code (6-3, F8, K, HR...), RBI, run, steal |

Exhibition and playoff games are stored but flagged, and left out of season totals.

You can open the database with any SQLite tool (for example "DB Browser for SQLite") and run your own
queries. Example, the top home run hitters across everything stored:

    SELECT name, SUM(hr) AS hr FROM batting_lines b JOIN games g ON g.id = b.game_id
    WHERE g.exhibition = 0 GROUP BY player_id ORDER BY hr DESC LIMIT 10;

## API (what the page uses)

    POST /api/register {email, name, password}      POST /api/login {email, password}      POST /api/logout
    GET  /api/me                                     GET/PUT /api/save
    POST /api/games (a finished game)                GET /api/games?limit=&offset=          GET /api/games/:no
    PUT  /api/games/:no/notes {notes}                GET /api/stats/batting                 GET /api/stats/pitching
    GET  /api/players/:id/games

## Rebuilding the page

`public/index.html` is the built game. To rebuild it after changing the source, run
`node ../tools/build.js public/index.html` from this folder (the source lives one level up in `src/`).
