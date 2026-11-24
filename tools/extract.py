"""Build data.js (window.BF_DATA) from the Ball Five workbook sheets."""
import json, sys, openpyxl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)

def rows(name, ncols=None):
    ws = wb[name]
    res = []
    for row in ws.iter_rows(values_only=True):
        r = list(row)
        if ncols: r = r[:ncols]
        while r and r[-1] is None: r.pop()
        res.append(r)
    while res and not res[-1]: res.pop()
    return res

def clean(v):
    if v is None: return None
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e15: return int(v)
        return round(v, 6)
    if isinstance(v, str): return v.strip()
    return v

def table(name, ncols, keycol=0):
    rs = rows(name, ncols)
    hdr = [clean(x) for x in rs[0]]
    body = []
    for r in rs[1:]:
        if not r or r[0] in (None, ""): continue
        r = r + [None] * (ncols - len(r))
        body.append([clean(x) for x in r[:ncols]])
    return hdr, body

data = {}
for name, n in [("Batters", 59), ("Pitchers", 59), ("Fielding", 11), ("Tables", 5), ("Misc", 2),
                ("XChart", 7), ("Teams", 27), ("Staff", 5), ("TypicalLU", 20), ("MyLU", 20),
                ("RealLU", 21), ("Avail", 5), ("Backs", 18), ("Schedule", 10)]:
    hdr, body = table(name, n)
    key = name.lower()
    data[key] = body
    data[key + "_h"] = hdr
    print(name, len(body), "rows")

# a fresh season: no replay W/L, rotation at the top, nothing played
for t in data["teams"]:
    t[6] = 0; t[7] = 0; t[8] = 0
# schedule: GameNo, Date, Away, Home, RealAway, RealHome, Played, Park, GID, DayNo -> drop Played
data["schedule"] = [[r[0], r[1], r[2], r[3], r[4], r[5], r[7], r[8], r[9]] for r in data["schedule"]]
data["schedule_h"] = ["GameNo", "Date", "Away", "Home", "RealAway", "RealHome", "Park", "GID", "DayNo"]

# options: name, default, help
opts = []
for r in rows("Options"):
    if len(r) >= 3 and r[1] and r[1] not in ("Option", "Back to game") and r[2] is not None:
        opts.append([clean(r[1]), clean(r[2]), clean(r[3]) if len(r) > 3 else ""])
data["options"] = opts
print("options", len(opts))

# read me: everything (the help screen shows it)
rm = []
for r in rows("Read me"):
    if len(r) >= 2 and r[1]:
        rm.append(str(r[1]).strip())
data["readme"] = rm

with open(out, "w", encoding="utf-8") as f:
    f.write("window.BF_DATA=")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("wrote", out)
