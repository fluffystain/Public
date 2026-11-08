// Activity map: geolocated news events (GDELT), social posts placed by the towns they mention
// (Bluesky, Mastodon), road incidents from highway authorities, natural hazards and Mapillary imagery.
/* global L */
import { normalized, plainText, makeArticle } from "./core.js";
import { gdeltCall, ago } from "./sources.js";
import { MAPILLARY_TOKEN } from "./config.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const getJSON = async (url, opts = {}) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(opts.timeout || 25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const CATS = {
  protest: { title: "Protest", color: "#f2b33d" },
  violence: { title: "Violence", color: "#ff5a4f" },
  military: { title: "Military posture", color: "#8cbf59" },
  threat: { title: "Threats", color: "#d880f2" },
  coercion: { title: "Coercion", color: "#4dd9d9" },
};
const PRESETS = ["protest", "traffic", "accident", "explosion", "flood", "fire", "power cut", "shooting"];
const DAY = 24 * 3.6e6;

const state = {
  map: null, places: [], events: [], roads: [], hazards: [], tab: "events", cats: new Set(Object.keys(CATS)),
  posts: [], postCounts: new Map(), news: [], imagery: [], inView: [], dataAge: null,
  layers: {}, seq: 0, cache: new Map(),
};

// ---------- Boot ----------

async function init() {
  const params = new URLSearchParams(location.search);
  $("#filter").value = params.get("q") || store.get("map-filter", "");
  const ll = (params.get("ll") || "").split(",").map(Number);
  const z = +params.get("z");

  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  state.map = L.map("map", { preferCanvas: true, worldCopyJump: true, zoomControl: true })
    .setView(ll.length === 2 && ll.every(Number.isFinite) ? ll : [30, 15], z || 3);
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, {
    subdomains: "abcd", maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(state.map);

  state.layers.eventsHeat = L.heatLayer([], { radius: 20, blur: 18, maxZoom: 9, minOpacity: 0.25,
    gradient: { 0.2: "#2b59c3", 0.4: "#2bb5a5", 0.6: "#f2e33d", 0.8: "#f28a3d", 1: "#e3342f" } });
  state.layers.postsHeat = L.heatLayer([], { radius: 34, blur: 26, maxZoom: 12, minOpacity: 0.3,
    gradient: { 0.2: "#3a1c71", 0.5: "#b31aa6", 0.8: "#ff6bd6", 1: "#ffe3f7" } });
  state.layers.eventMarkers = L.layerGroup();
  state.layers.roads = L.layerGroup();
  state.layers.hazards = L.layerGroup();
  state.layers.imagery = L.layerGroup();
  L.control.scale({ imperial: false }).addTo(state.map);

  buildLayerMenu();
  bindUI();

  const place = params.get("place");
  if (place && !(ll.length === 2)) await goTo(place);

  await Promise.allSettled([loadPlaces(), loadEvents(), loadRoads(), loadHazards()]);
  applyLayers();
  state.map.on("moveend", onMove);
  onMove();
}

function bindUI() {
  $("#search").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#place").value.trim(); if (q) goTo(q); });
  $("#filter-form").addEventListener("submit", (e) => { e.preventDefault(); setFilter($("#filter").value.trim()); });
  $("#filter").addEventListener("search", () => setFilter($("#filter").value.trim()));
  $("#layers-btn").addEventListener("click", () => toggleLayers());
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-close],[data-tab],[data-cat],[data-preset],[data-fly]");
    if (!t) return;
    if (t.dataset.close) toggleLayers(false);
    else if (t.dataset.tab) { state.tab = t.dataset.tab; renderSide(); }
    else if (t.dataset.cat) { const c = t.dataset.cat; state.cats.has(c) ? state.cats.delete(c) : state.cats.add(c); buildLayerMenu(); applyLayers(); renderSide(); }
    else if (t.dataset.preset !== undefined) { $("#filter").value = t.dataset.preset; setFilter(t.dataset.preset); }
    else if (t.dataset.fly) { const [la, lo, zz] = t.dataset.fly.split(",").map(Number); state.map.flyTo([la, lo], Math.max(state.map.getZoom(), zz || 11)); if (innerWidth <= 760) setSheet("collapsed"); }
  });
  for (const id of ["events", "posts", "roads", "hazards", "mapillary"]) $(`#lyr-${id}`).addEventListener("change", () => { applyLayers(); if (id === "mapillary") { tokenRow(); refreshImagery(); } });
  $("#mly-token").value = store.get("mly-token", "");
  $("#mly-token").addEventListener("change", () => { store.set("mly-token", $("#mly-token").value.trim()); refreshImagery(); });
  $("#grab").addEventListener("click", () => setSheet($("#side").classList.contains("expanded") ? "collapsed" : $("#side").classList.contains("collapsed") ? "" : "expanded"));
}

function setSheet(mode) {
  const s = $("#side");
  s.classList.remove("collapsed", "expanded");
  if (mode) s.classList.add(mode);
}

function toggleLayers(force) {
  const el = $("#layers");
  const show = force ?? el.hidden;
  el.hidden = !show;
  $("#layers-btn").setAttribute("aria-expanded", String(show));
}

function tokenRow() { $("#mly-token-row").hidden = !$("#lyr-mapillary").checked || !!MAPILLARY_TOKEN; }

function buildLayerMenu() {
  $("#cats").innerHTML = Object.entries(CATS).map(([id, c]) =>
    `<button type="button" data-cat="${id}" style="--c:${c.color}" aria-pressed="${state.cats.has(id)}"><i class="dot" style="--c:${c.color}"></i>${c.title}</button>`).join("");
  tokenRow();
}

function setFilter(q) {
  store.set("map-filter", q);
  state.cache.clear();
  updateURL();
  refreshLive(true);
}

async function goTo(q) {
  try {
    const r = await getJSON(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "json", limit: "1" })}`);
    if (!r[0]) { toast(`Couldn't find “${q}”.`); return; }
    const [s, n, w, e] = r[0].boundingbox.map(Number);
    state.map.fitBounds([[s, w], [n, e]], { maxZoom: 12 });
  } catch { toast("Place search is unavailable right now."); }
}

// ---------- Data loading ----------

async function loadPlaces() {
  try { state.places = await getJSON("data/places.json"); } catch { state.places = []; }
}

async function loadEvents() {
  try {
    const d = await getJSON("data/events.json");
    state.dataAge = d.generatedAt;
    state.events = d.cells.map(([lat, lon, cat, n, m, place, t, url, coarse]) => ({ lat, lon, cat, n, m, place, t, url, coarse }));
    $("#data-age").textContent = `News events and road data collected ${ago(d.generatedAt)}. Posts, news, hazards and imagery are live.`;
  } catch { $("#data-age").textContent = "Event data has not been collected yet. Live layers still work."; }
}

async function loadRoads() {
  try { state.roads = (await getJSON("data/roads.json")).incidents; } catch { state.roads = []; }
}

async function loadHazards() {
  const out = [];
  try {
    const q = await getJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
    for (const f of q.features) {
      const [lon, lat] = f.geometry.coordinates;
      out.push({ lat, lon, kind: "Earthquake", title: f.properties.title, t: f.properties.time, url: f.properties.url, mag: f.properties.mag });
    }
  } catch {}
  try {
    const e = await getJSON("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300");
    for (const ev of e.events) {
      const g = ev.geometry?.[ev.geometry.length - 1];
      if (!g || g.type !== "Point") continue;
      out.push({ lat: g.coordinates[1], lon: g.coordinates[0], kind: ev.categories?.[0]?.title || "Natural event", title: ev.title,
        t: Date.parse(g.date), url: ev.sources?.[0]?.url || ev.link });
    }
  } catch {}
  state.hazards = out;
}

// ---------- Layers ----------

const on = (id) => $(`#lyr-${id}`).checked;

function applyLayers() {
  const m = state.map;
  const show = (layer, yes) => (yes ? m.hasLayer(layer) || layer.addTo(m) : m.removeLayer(layer));
  const evs = state.events.filter((e) => state.cats.has(e.cat));
  const maxN = Math.max(1, ...evs.map((e) => e.n));
  state.layers.eventsHeat.setLatLngs(evs.map((e) => [e.lat, e.lon, Math.min(1, (0.25 + Math.log1p(e.n) / Math.log1p(maxN)) * (e.coarse ? 0.5 : 1))]));
  state.layers.eventsHeat.setOptions({ max: 1 });
  show(state.layers.eventsHeat, on("events"));
  show(state.layers.eventMarkers, on("events"));
  show(state.layers.postsHeat, on("posts"));
  show(state.layers.roads, on("roads"));
  show(state.layers.hazards, on("hazards"));
  show(state.layers.imagery, on("mapillary"));
  drawMarkers();
}

function drawMarkers() {
  const m = state.map, b = m.getBounds().pad(0.2), z = m.getZoom();
  const inB = (p) => b.contains([p.lat, p.lon]);

  state.layers.eventMarkers.clearLayers();
  if (on("events") && z >= 9) {
    for (const e of state.events.filter((e) => state.cats.has(e.cat) && inB(e)).sort((a, b) => b.n - a.n).slice(0, 150)) {
      L.circleMarker([e.lat, e.lon], { radius: 3 + Math.min(7, Math.log2(1 + e.n) * 1.5), color: CATS[e.cat].color, weight: 1.5, fillOpacity: 0.2 })
        .bindPopup(eventPopup(e)).addTo(state.layers.eventMarkers);
    }
  }
  state.layers.roads.clearLayers();
  if (on("roads") && z >= 6) {
    for (const r of state.roads.filter(inB).slice(0, 1500)) {
      L.circleMarker([r.lat, r.lon], { radius: 5, color: "#ff9a40", weight: 2, fillColor: "#ff9a40", fillOpacity: 0.6 })
        .bindPopup(roadPopup(r)).addTo(state.layers.roads);
    }
  }
  state.layers.hazards.clearLayers();
  if (on("hazards")) {
    for (const h of state.hazards) {
      L.circleMarker([h.lat, h.lon], { radius: h.mag ? 3 + h.mag * 1.5 : 6, color: h.mag ? "#4dd9d9" : "#ff6b61", weight: 2, fillOpacity: 0.2, dashArray: h.mag ? null : "3 3" })
        .bindPopup(`<span class="pop-title">${esc(h.title)}</span><span class="pop-meta">${esc(h.kind)} · ${h.t ? ago(h.t) : ""}</span>${h.url ? `<br><a href="${esc(h.url)}" target="_blank" rel="noopener">Source ↗</a>` : ""}`)
        .addTo(state.layers.hazards);
    }
  }
}

const eventPopup = (e) => `<span class="pop-title">${esc(CATS[e.cat].title)}: ${esc(e.place)}</span>
  <span class="pop-meta">${e.n} event record${e.n > 1 ? "s" : ""} · ${e.m} mentions · latest ${ago(e.t)}${e.coarse ? " · province-level location" : ""}</span>
  ${e.url ? `<br><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Latest source article ↗</a>` : ""}`;

const roadPopup = (r) => `<span class="pop-title">${esc(r.title)}</span>${r.detail ? `<div>${esc(r.detail)}</div>` : ""}
  <span class="pop-meta">${esc(r.type)} · ${esc(r.src)}${r.start ? ` · since ${new Date(r.start).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
  ${r.url ? `<br><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Authority site ↗</a>` : ""}`;

// ---------- Viewport-driven live layers ----------

let moveTimer = null;
function onMove() {
  updateURL();
  drawMarkers();
  computeInView();
  renderSide();
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => refreshLive(false), 900);
}

function updateURL() {
  const c = state.map.getCenter();
  const p = new URLSearchParams({ ll: `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`, z: String(state.map.getZoom()) });
  const q = $("#filter").value.trim();
  if (q) p.set("q", q);
  history.replaceState(null, "", `?${p}`);
}

function computeInView() {
  const b = state.map.getBounds();
  const seen = new Set();
  state.inView = state.places.filter(([n, la, lo]) => b.contains([la, lo]) && !seen.has(n) && seen.add(n)).slice(0, 300);
  const top = state.inView.slice(0, 4).map((p) => p[0]);
  $("#view-title").textContent = top.length ? top.slice(0, 3).join(" · ") : state.map.getZoom() < 4 ? "Zoom in to an area" : "No towns in view";
  const evs = state.events.filter((e) => state.cats.has(e.cat) && b.contains([e.lat, e.lon]));
  const rds = state.roads.filter((r) => b.contains([r.lat, r.lon]));
  $("#view-sub").textContent = `${evs.reduce((n, e) => n + e.n, 0)} event records · ${rds.length} road incidents · ${state.inView.length} towns`;
}

async function refreshLive(force) {
  const seq = ++state.seq;
  const z = state.map.getZoom();
  const key = state.inView.slice(0, 10).map((p) => p[0]).join("|") + "#" + $("#filter").value.trim();
  if (!force && key === state.lastKey) return;
  state.lastKey = key;
  refreshImagery();
  if (z < 4 || !state.inView.length) {
    state.posts = []; state.news = []; state.postCounts = new Map(); state.layers.postsHeat.setLatLngs([]);
    renderSide();
    return;
  }
  state.loadingPosts = state.loadingNews = true;
  renderSide();
  await Promise.allSettled([refreshPosts(seq), refreshNews(seq)]);
}

// Social posts: Bluesky search per town in view, plus Mastodon hashtag posts matched to towns by name.
async function refreshPosts(seq) {
  const filter = $("#filter").value.trim();
  const towns = state.inView.slice(0, 10);
  const since = new Date(Date.now() - DAY).toISOString();
  const counts = new Map(), posts = [];
  const queue = [...towns];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const [name, lat, lon] = queue.shift();
      const q = `"${name}"${filter ? " " + filter : ""}`;
      try {
        const res = await cached(`bsky:${q}`, () => getJSON(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?${new URLSearchParams({ q, limit: "100", sort: "latest", since })}`));
        const needle = normalized(name);
        const hits = (res.posts || []).filter((p) => normalized(p.record?.text || "").includes(needle));
        counts.set(name, (counts.get(name) || 0) + hits.length);
        for (const p of hits) posts.push(bskyPost(p, name, lat, lon));
      } catch { counts.set(name, counts.get(name) || 0); }
    }
  }));
  // Mastodon: hashtag timeline for a one-word filter, located by the first in-view town mentioned.
  if (/^[\p{L}\p{N}_]+$/u.test(filter)) {
    try {
      const res = await cached(`masto:${filter}`, () => getJSON(`https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(filter)}?limit=40`));
      const index = state.inView.slice(0, 300).map((p) => [normalized(p[0]), p]);
      for (const s of res) {
        if (Date.now() - Date.parse(s.created_at) > DAY) continue;
        const text = plainText(s.content || "");
        const hit = index.find(([n]) => normalized(text).includes(n));
        if (!hit) continue;
        const [, [name, lat, lon]] = hit;
        counts.set(name, (counts.get(name) || 0) + 1);
        posts.push({ net: "Mastodon", author: s.account?.acct || "", text, t: Date.parse(s.created_at), url: s.url, place: name, lat, lon });
      }
    } catch {}
  }
  if (seq !== state.seq) return;
  state.postCounts = counts;
  state.posts = posts.sort((a, b) => b.t - a.t);
  const max = Math.max(1, ...counts.values());
  const pts = state.inView.filter(([n]) => counts.get(n)).map(([n, la, lo]) => [la, lo, 0.2 + 0.8 * Math.log1p(counts.get(n)) / Math.log1p(max)]);
  state.layers.postsHeat.setLatLngs(pts);
  state.loadingPosts = false;
  renderSide();
}

function bskyPost(p, place, lat, lon) {
  const rkey = (p.uri || "").split("/").pop();
  return { net: "Bluesky", author: p.author?.handle || "", text: p.record?.text || "", t: Date.parse(p.record?.createdAt || p.indexedAt),
    url: p.author?.handle ? `https://bsky.app/profile/${p.author.handle}/post/${rkey}` : null, place, lat, lon };
}

async function refreshNews(seq) {
  const filter = $("#filter").value.trim();
  const names = state.inView.slice(0, 6).map((p) => (/\s|-/.test(p[0]) ? `"${p[0]}"` : p[0]));
  const q = `${names.length > 1 ? `(${names.join(" OR ")})` : names[0]}${filter ? ` ${/\s/.test(filter) ? `"${filter}"` : filter}` : ""} sourcelang:english`;
  try {
    const rows = await cached(`gdelt:${q}`, () => gdeltCall(q, 24));
    if (seq !== state.seq) return;
    state.news = rows.map((r) => makeArticle({ title: r.title, link: r.url, date: r.seendate, source: (r.domain || "").replace(/^www\./, ""), collector: "GDELT" })).filter(Boolean);
    state.newsError = null;
  } catch (e) {
    if (seq !== state.seq) return;
    state.news = []; state.newsError = e.message;
  }
  state.loadingNews = false;
  renderSide();
}

async function refreshImagery() {
  state.layers.imagery.clearLayers();
  state.imagery = [];
  const token = MAPILLARY_TOKEN || store.get("mly-token", "");
  if (!on("mapillary") || !token || state.map.getZoom() < 14) { if (state.tab === "imagery") renderSide(); return; }
  const b = state.map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(",");
  try {
    const res = await getJSON(`https://graph.mapillary.com/images?${new URLSearchParams({ access_token: token, bbox, limit: "200",
      fields: "id,geometry,captured_at,thumb_256_url,creator" })}`);
    state.imagery = (res.data || []).map((d) => ({ id: d.id, lat: d.geometry.coordinates[1], lon: d.geometry.coordinates[0], t: d.captured_at,
      thumb: d.thumb_256_url, by: d.creator?.username })).sort((a, b) => b.t - a.t);
    for (const im of state.imagery) {
      L.circleMarker([im.lat, im.lon], { radius: 4, color: "#35af6d", weight: 1, fillOpacity: 0.8 })
        .bindPopup(imageryPopup(im)).addTo(state.layers.imagery);
    }
    state.imageryError = null;
  } catch (e) { state.imageryError = e.message; }
  if (state.tab === "imagery") renderSide();
}

const imageryPopup = (im) => `${im.thumb ? `<img class="thumb" src="${esc(im.thumb)}" alt="Street-level photo">` : ""}
  <span class="pop-meta">Captured ${new Date(im.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${im.by ? ` by ${esc(im.by)}` : ""}</span>
  <br><a href="https://www.mapillary.com/app/?pKey=${esc(im.id)}" target="_blank" rel="noopener">Open in Mapillary ↗</a>`;

async function cached(key, fn) {
  const hit = state.cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const value = await fn();
  state.cache.set(key, { at: Date.now(), value });
  return value;
}

// ---------- Side panel ----------

function renderSide() {
  document.querySelectorAll("#side-tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === state.tab)));
  const b = state.map.getBounds();
  const inB = (p) => b.contains([p.lat, p.lon]);
  const fly = (p, z) => `data-fly="${p.lat},${p.lon},${z}"`;
  const body = $("#side-body");
  const tab = state.tab;
  let html = "";

  if (tab === "events") {
    const evs = state.events.filter((e) => state.cats.has(e.cat) && inB(e));
    const totals = Object.keys(CATS).map((c) => [c, evs.filter((e) => e.cat === c).reduce((n, e) => n + e.n, 0)]);
    const max = Math.max(1, ...totals.map(([, n]) => n));
    html += `<p class="note">Conflict-related events in news reports from the last 24 hours, geolocated by GDELT. Brighter heat means more event records.</p>
      <div class="legend-heat"></div><div class="legend-scale"><span>Fewer</span><span>More</span></div>
      <div class="cat-bars">${totals.map(([c, n]) => `<div class="cat-bar" style="--c:${CATS[c].color}"><span>${CATS[c].title}</span><i style="width:${(n / max) * 100}%"></i><span>${n}</span></div>`).join("")}</div>`;
    const top = evs.sort((a, b) => b.n - a.n).slice(0, 40);
    html += top.length ? top.map((e) => `<div class="item" ${fly(e, 10)}><span class="item-title"><i class="dot" style="--c:${CATS[e.cat].color}"></i> ${esc(e.place)}</span>
        <p>${CATS[e.cat].title} · ${e.n} record${e.n > 1 ? "s" : ""} · latest ${ago(e.t)}${e.url ? ` · <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ""}</p></div>`).join("")
      : `<p class="note">No geolocated events in this view.</p>`;
  } else if (tab === "posts") {
    const f = $("#filter").value.trim();
    html += `<div class="presets">${PRESETS.map((p) => `<button type="button" data-preset="${p}" aria-pressed="${f === p}">${p}</button>`).join("")}${f ? `<button type="button" data-preset="">clear</button>` : ""}</div>
      <p class="note">Public Bluesky posts from the last 24 hours that mention towns in view${f ? ` and “<b>${esc(f)}</b>”` : ""}${/^[\p{L}\p{N}_]+$/u.test(f) ? `, plus Mastodon #${esc(f)} posts` : ""}. Posts are placed by the town they name; they are not GPS-tagged.</p>`;
    if (state.postCounts.size) html += `<div class="place-pills">${[...state.postCounts].filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<span>${esc(n)}<b>${c >= 100 ? "100+" : c}</b></span>`).join("")}</div>`;
    if (state.loadingPosts) html += `<p class="note">Searching posts…</p>`;
    html += state.posts.slice(0, 80).map((p) => `<div class="item" ${fly(p, 11)}><span class="item-title">${esc(p.text.slice(0, 280))}</span>
      <p>${esc(p.net)} · @${esc(p.author)} · ${esc(p.place)} · ${ago(p.t)}${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">open ↗</a>` : ""}</p></div>`).join("")
      || (state.loadingPosts ? "" : `<p class="note">${state.map.getZoom() < 4 ? "Zoom in to search posts." : "No matching posts in the last 24 hours."}</p>`);
  } else if (tab === "news") {
    html += `<p class="note">Live news from the last 24 hours mentioning the main towns in view (GDELT).</p>`;
    if (state.loadingNews) html += `<p class="note">Searching news…</p>`;
    else if (state.newsError) html += `<p class="note">News search failed (${esc(state.newsError)}). GDELT allows one search every 5 seconds; move the map again shortly.</p>`;
    html += state.news.slice(0, 60).map((a) => `<div class="item"><a class="item-title" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>
      <p>${esc(a.publisher)}${a.published ? ` · ${ago(a.published)}` : ""}</p></div>`).join("") || (state.loadingNews || state.newsError ? "" : `<p class="note">No recent news found for this area.</p>`);
  } else if (tab === "roads") {
    const rds = state.roads.filter(inB);
    html += `<p class="note">Incidents, closures and roadworks from national highway authorities: Germany (Autobahn GmbH), France (Bison Futé), Spain (DGT), Finland (Digitraffic), New Zealand (NZTA) and London (TfL). Updated hourly.</p>`;
    html += rds.length ? rds.slice(0, 120).map((r) => `<div class="item" ${fly(r, 13)}><span class="item-title">${esc(r.title)}</span><p>${esc(r.type)} · ${esc(r.src)}</p></div>`).join("")
      : `<p class="note">No road incidents from these sources in view. Coverage is limited to the countries listed.</p>`;
  } else if (tab === "hazards") {
    const hz = state.hazards.filter(inB).sort((a, b) => (b.t || 0) - (a.t || 0));
    html += `<p class="note">Earthquakes of magnitude 2.5+ in the last 24 hours (USGS) and open natural events such as wildfires and storms (NASA EONET).</p>`;
    html += hz.length ? hz.map((h) => `<div class="item" ${fly(h, 8)}><span class="item-title">${esc(h.title)}</span><p>${esc(h.kind)}${h.t ? ` · ${ago(h.t)}` : ""}</p></div>`).join("")
      : `<p class="note">No active hazards in view.</p>`;
  } else if (tab === "imagery") {
    const token = MAPILLARY_TOKEN || store.get("mly-token", "");
    html += `<p class="note">Street-level photos from Mapillary, newest first. Useful for checking roads, checkpoints and infrastructure.</p>`;
    if (!on("mapillary")) html += `<p class="note">Turn on <b>Street-level imagery</b> in Layers.</p>`;
    else if (!token) html += `<p class="note">Add a free Mapillary client token in Layers to load imagery.</p>`;
    else if (state.map.getZoom() < 14) html += `<p class="note">Zoom in to street level (zoom 14+) to load imagery.</p>`;
    else if (state.imageryError) html += `<p class="note">Mapillary request failed (${esc(state.imageryError)}). Check the token.</p>`;
    else html += state.imagery.slice(0, 40).map((im) => `<div class="item" ${fly(im, 17)}>${im.thumb ? `<img class="thumb" src="${esc(im.thumb)}" alt="Street-level photo" loading="lazy">` : ""}
      <p>${new Date(im.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${im.by ? ` · ${esc(im.by)}` : ""}</p></div>`).join("") || `<p class="note">No imagery here.</p>`;
  }
  body.innerHTML = html;
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.role = "status"; el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

init();
