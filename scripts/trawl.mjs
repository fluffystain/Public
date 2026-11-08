#!/usr/bin/env node
// Scheduled collector for the Intel Brief web app.
//
// Browsers are not allowed to read Google News, Bing News or most outlet RSS feeds directly
// (they send no CORS headers), so a GitHub Actions job runs this script every few hours and
// publishes the results as static JSON next to the web page:
//   data/outlets.json        all items from the international outlet feeds
//   data/news/<key>.json     Google News + Bing News results for each preset location
//   data/meta.json           when it ran and what succeeded
//
// Usage: node scripts/trawl.mjs <site-dir>     (Node 20+, no dependencies)
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { buildCatalog, orClause, queryTerms, OUTLET_FEEDS } from "../web/js/core.js";
import { parseFeed } from "./feed.mjs";
import { gdeltEvents, roads, places } from "./geo.mjs";

const OUT = path.resolve(process.argv[2] || "_site");
const countries = JSON.parse(await readFile(new URL("../data/countries.json", import.meta.url)));
const catalog = buildCatalog(countries);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const DEADLINE = Date.now() + 15 * 60 * 1000; // keep each run bounded

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9" }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return await res.text();
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000);
    }
  }
  throw new Error("failed");
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); }
  }));
  return results;
}

const meta = { generatedAt: Date.now(), outlets: {}, locations: 0, googleFailures: 0, bingFailures: 0 };
await mkdir(path.join(OUT, "data", "news"), { recursive: true });

// 1. Outlet feeds
const outletItems = (await pool(OUTLET_FEEDS, 6, async ([name, url]) => {
  try {
    const items = parseFeed(await get(url), name, name);
    meta.outlets[name] = items.length;
    return items;
  } catch (e) {
    meta.outlets[name] = `failed: ${e.message}`;
    return [];
  }
})).flat();
await writeFile(path.join(OUT, "data", "outlets.json"), JSON.stringify(outletItems));
console.log(`outlets: ${outletItems.length} items`);

// 2. Google News + Bing News per preset location
await pool(catalog.all, 5, async (loc) => {
  if (Date.now() > DEADLINE) { meta.skipped = (meta.skipped || 0) + 1; return; }
  const q = orClause(queryTerms(loc));
  const google = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=en-GB&gl=GB&ceid=GB:en`;
  const bing = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&count=50`;
  const items = [];
  try { items.push(...parseFeed(await get(google), "Google News")); } catch { meta.googleFailures++; }
  await sleep(300);
  try { items.push(...parseFeed(await get(bing), "Bing News")); } catch { meta.bingFailures++; }
  await writeFile(path.join(OUT, "data", "news", loc.key.replace(":", "_") + ".json"),
    JSON.stringify({ generatedAt: meta.generatedAt, items }));
  meta.locations++;
  await sleep(300);
});

// 3. Map layers: geolocated GDELT events, road incidents, gazetteer
async function geo(name, fn) {
  try { await fn(); } catch (e) { meta[name] = `failed: ${e.message}`; console.log(`${name} failed: ${e.message}`); }
}
await geo("events", async () => {
  const ev = await gdeltEvents(24);
  await writeFile(path.join(OUT, "data", "events.json"), JSON.stringify({ generatedAt: meta.generatedAt, hours: 24, cells: ev.list }));
  meta.events = { cells: ev.list.length, rows: ev.rows, files: ev.files, failedFiles: ev.failed };
  console.log("events:", meta.events);
});
await geo("roads", async () => {
  const r = await roads();
  await writeFile(path.join(OUT, "data", "roads.json"), JSON.stringify({ generatedAt: meta.generatedAt, incidents: r.list }));
  meta.roads = r.report;
  console.log("roads:", r.report);
});
await geo("places", async () => {
  const p = await places();
  await writeFile(path.join(OUT, "data", "places.json"), JSON.stringify(p));
  meta.places = p.length;
  console.log("places:", p.length);
});

await writeFile(path.join(OUT, "data", "meta.json"), JSON.stringify(meta, null, 1));
console.log(`locations: ${meta.locations}, google failures: ${meta.googleFailures}, bing failures: ${meta.bingFailures}`);
