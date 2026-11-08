# Intel Brief

The same brief as the iPhone app, as a web page that anyone with the link can open on any phone or computer.
It's hosted free on GitHub Pages.

* **Choose and generate:** pick a country, region or city from the drop-down and press **Generate brief**.
* **Share:** the address updates (e.g. `?loc=country:su&h=72`). Anyone who opens that link gets a
  fresh brief for the same place. **Share link** uses the phone's share sheet.
* **Add to Home Screen** in Safari to use it like an app.

## Activity map (`map.html`)

Scroll and zoom anywhere; the panel shows what is happening in the area on screen.

| Layer | Source | Freshness |
|---|---|---|
| News events heat map (protest, violence, military posture, threats, coercion) | GDELT event files, geolocated from news reports, aggregated into ~1 km cells | Last 24 h, collected hourly |
| Social posts heat map | Bluesky search and Mastodon hashtags. Posts are placed by the **town names they mention**, because public posts no longer carry GPS tags | Live, last 24 h |
| News for the area | GDELT, searching the main towns in view plus your filter | Live |
| Road incidents | Autobahn GmbH (DE), Bison Futé (FR), DGT (ES), Digitraffic (FI), NZTA (NZ), TfL (London) | Collected hourly |
| Natural hazards | USGS earthquakes, NASA EONET | Live |
| Street-level imagery | Mapillary (needs a free client token: put it in `web/js/config.js` or paste it in the Layers menu) | Live |

The filter box (e.g. *protest*, *traffic*, *flood*) narrows the posts and news searches. The heat map
then shows where posting about that subject concentrates. Map tiles: © OpenStreetMap contributors, © CARTO.
Places: GeoNames (CC BY 4.0).

**Not included, because they need paid or registered access or block automated reads:** X/Twitter,
Facebook/Instagram, Reddit, Waze, England's National Highways (free registration; a key could be added),
Ontario and Alberta 511, HERE traffic.

## Where the data comes from

| Source | How it reaches the page |
|---|---|
| GDELT (global news + in-country local press) | Queried live from the viewer's browser |
| CIA World Factbook (final 2026 edition, archive) | Live, from the `factbook.json` archive |
| UK FCDO travel advice | Live, from the GOV.UK Content API |
| Wikipedia | Live |
| Google News, Bing News | Collected hourly by `.github/workflows/web-app.yml` for every listed location |
| BBC, Al Jazeera, Guardian, France 24, DW, UN News, NPR, CNBC, Defense News, The Record, US travel advisories | Collected hourly, filtered for the location in the browser |

Browsers aren't allowed to read Google News, Bing or most RSS feeds from another site.
The scheduled GitHub Action (`scripts/trawl.mjs`, hourly) fetches them and publishes the results as
static JSON beside the page. A custom city typed into the box gets the live sources and outlet
feeds only, because the collector only runs searches for listed locations.

Classification, story clustering, trends and summaries all run in the browser (`js/core.js`,
shared with the collector).

**Live at:** https://fluffystain.github.io/public/

A native iPhone version of the same app lives in the private `fluffystain/Tools` repository.

## Files

```
data/countries.json   240 countries from the CIA World Factbook archive (scripts/build_countries.py)
web/
├── index.html, styles.css, manifest.webmanifest, icon.png
└── js/
    ├── data.js     topics + keywords, regions, cities
    ├── core.js     text tools, classifier, clustering, metrics, summaries (no DOM)
    ├── sources.js  live collectors + loaders for the scheduled data
    ├── app.js      UI, analytical products (PRODUCTS array = extension point)
    ├── map.js      activity map
    └── config.js   optional Mapillary token
scripts/
├── build_site.sh   assembles _site/ (adds countries.json)
├── trawl.mjs       scheduled collector (Node 22, no dependencies)
├── geo.mjs         map data: GDELT events, road incidents, gazetteer
└── feed.mjs        RSS/Atom parser
```

## Run it locally

```
scripts/build_site.sh _site && node scripts/trawl.mjs _site && python3 -m http.server -d _site 8000
```
