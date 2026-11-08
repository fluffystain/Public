#!/usr/bin/env python3
"""Regenerate data/countries.json from a local clone of
https://github.com/factbook/factbook.json (the archived CIA World Factbook).

Usage: python3 scripts/build_countries.py /path/to/factbook.json
"""
import glob, html, json, os, re, sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "countries.json")

SKIP_REGIONS = {"oceans", "world", "meta", "antarctica"}
SKIP_CODES = {"at", "cr", "um", "bq", "wq", "jn", "ip", "ax", "dx", "sx", "io"}

NAME_FIX = {
    "cg": "Democratic Republic of the Congo", "cf": "Republic of the Congo", "iv": "Côte d'Ivoire",
    "dr": "Dominican Republic", "ee": "European Union", "gz": "Gaza Strip", "bf": "Bahamas",
    "ga": "Gambia", "sv": "Svalbard", "fk": "Falkland Islands", "vt": "Vatican City",
    "sh": "Saint Helena", "bm": "Myanmar",
}
CAPITAL_FIX = {"cs": "San José", "br": "Brasília", "co": "Bogotá", "pa": "Asunción", "mv": "Malé",
               "md": "Chisinau", "nr": "", "hk": "", "mc": "", "io": "", "ee": "Brussels", "gz": "Gaza City", "we": "Ramallah"}
ALIASES = {
    "bm": ["Burma"], "cg": ["DRC", "DR Congo", "Congo-Kinshasa"], "cf": ["Congo-Brazzaville", "Congo"],
    "ez": ["Czech Republic"], "tu": ["Türkiye", "Turkiye"], "cv": ["Cape Verde"], "wz": ["Swaziland"],
    "tt": ["East Timor"], "iv": ["Ivory Coast", "Cote d'Ivoire"], "us": ["USA", "United States of America", "US"],
    "uk": ["UK", "Britain", "Great Britain"], "kn": ["DPRK"], "ks": ["Republic of Korea"],
    "gz": ["Gaza", "Palestine", "Occupied Palestinian Territories"], "we": ["Palestine", "Occupied Palestinian Territories"],
    "mk": ["Macedonia"], "rs": ["Russian Federation"], "ae": ["UAE"], "fm": ["Micronesia"], "va": [],
    "vt": ["Holy See"], "ga": ["The Gambia"], "bf": ["The Bahamas"], "ch": ["PRC"], "tw": ["Republic of China"],
}
FCDO = {  # gov.uk/foreign-travel-advice/<slug> overrides; others are resolved at runtime
    "bm": "myanmar", "cg": "democratic-republic-of-the-congo", "cf": "congo", "us": "usa",
    "gz": "the-occupied-palestinian-territories", "we": "the-occupied-palestinian-territories",
    "iv": "cote-d-ivoire", "tu": "turkey", "ez": "czech-republic", "cv": "cape-verde", "ga": "the-gambia",
    "bf": "bahamas", "vt": "", "ee": "",
}
AREA = {
    "africa": "Africa", "australia-oceania": "Oceania", "central-america-n-caribbean": "Central America & Caribbean",
    "central-asia": "Russia, Caucasus & Central Asia", "east-n-southeast-asia": "East & Southeast Asia",
    "europe": "Europe", "middle-east": "Middle East", "north-america": "North America",
    "south-america": "South America", "south-asia": "South Asia",
}

def text(x):
    if not isinstance(x, dict):
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", x.get("text", ""))).strip()

out = []
for f in sorted(glob.glob(os.path.join(SRC, "*", "*.json"))):
    region = os.path.basename(os.path.dirname(f))
    code = os.path.basename(f)[:-5]
    if region in SKIP_REGIONS or code in SKIP_CODES:
        continue
    d = json.load(open(f))
    g = d.get("Government", {})
    cn = g.get("Country name", {})
    name = text(cn.get("conventional short form", {}))
    if not name or name.lower() == "none":
        name = text(cn.get("conventional long form", {}))
    name = NAME_FIX.get(code, name)
    cap = text(g.get("Capital", {}).get("name", {})).split(";")[0].split("(")[0].strip()
    cap = CAPITAL_FIX.get(code, cap)
    if cap.lower().startswith(("no official", "none", "administered")):
        cap = ""
    adj = text(d.get("People and Society", {}).get("Nationality", {}).get("adjective", {}))
    adj = re.split(r"[;,(]| or ", adj)[0].strip()
    if adj.lower() in ("none", "na") or adj == name:
        adj = ""
    entry = {"code": code, "fbRegion": region, "area": AREA[region], "name": name, "capital": cap,
             "adjective": adj, "aliases": ALIASES.get(code, [])}
    if code in FCDO:
        entry["fcdo"] = FCDO[code]
    out.append(entry)

out.sort(key=lambda e: e["name"])
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"wrote {len(out)} countries to {OUT}")
