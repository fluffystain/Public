// Geodata collectors for the map view (run by scripts/trawl.mjs in GitHub Actions).
//   data/events.json   GDELT events from the last 24 hours, aggregated into ~1 km cells
//   data/roads.json    road incidents from national highway / traffic open-data feeds
//   data/places.json   gazetteer used to place social posts and news (GeoNames cities ≥15k)
import { inflateRawSync } from "node:zlib";

const UA = "Mozilla/5.0 (X11; Linux x86_64) IntelBrief-collector";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url, { timeout = 30000, headers = {} } = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip", ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const fetchText = async (url, o) => (await fetchBuf(url, o)).toString("utf8");
const fetchJSON = async (url, o) => JSON.parse(await fetchText(url, o));

/** Extracts the first file from a zip archive (enough for GDELT / GeoNames single-file zips). */
export function unzipFirst(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip");
  const method = buf.readUInt16LE(8);
  let size = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26), extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  if (size === 0 || size === 0xffffffff) {
    // Size stored in the central directory instead.
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const cd = buf.readUInt32LE(eocd + 16);
    size = buf.readUInt32LE(cd + 20);
  }
  const data = buf.subarray(start, start + size);
  return method === 0 ? data : inflateRawSync(data);
}

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

// ---------- GDELT events (CAMEO-coded, geolocated by GDELT from news text) ----------

// CAMEO root codes → map categories. Only conflictual activity is kept.
const CAMEO = { 14: "protest", 18: "violence", 19: "violence", 20: "violence", 13: "threat", 15: "military", 16: "threat", 17: "coercion" };

export async function gdeltEvents(hours = 24) {
  const last = await fetchText("http://data.gdeltproject.org/gdeltv2/lastupdate.txt");
  const m = /(\d{14})\.export\.CSV\.zip/.exec(last);
  if (!m) throw new Error("no export listed");
  const t = m[1];
  let ts = Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10), +t.slice(10, 12));
  const stamps = [];
  for (let i = 0; i < hours * 4; i++, ts -= 15 * 60 * 1000) {
    const d = new Date(ts);
    stamps.push(d.toISOString().replace(/[-:T]/g, "").slice(0, 12) + "00");
  }
  const cells = new Map();
  let files = 0, rows = 0, failed = 0;
  const queue = [...stamps];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const s = queue.shift();
      let csv;
      try { csv = unzipFirst(await fetchBuf(`http://data.gdeltproject.org/gdeltv2/${s}.export.CSV.zip`)).toString("utf8"); }
      catch { failed++; continue; }
      files++;
      for (const line of csv.split("\n")) {
        const f = line.split("\t");
        if (f.length < 61) continue;
        const cat = CAMEO[+f[28]];
        const geoType = +f[51];
        const lat = parseFloat(f[56]), lon = parseFloat(f[57]);
        if (!cat || !Number.isFinite(lat) || !Number.isFinite(lon) || geoType === 1 || (lat === 0 && lon === 0)) continue;
        rows++;
        const key = `${cat}|${round(lat, 2)}|${round(lon, 2)}`;
        const added = f[59];
        const c = cells.get(key);
        const mentions = Math.max(1, +f[31] || 1);
        if (c) {
          c.n++; c.m += mentions;
          if (added > c.t) { c.t = added; c.u = f[60].trim(); }
          if (geoType !== 1 && geoType !== 5 && c.g === 5) { c.g = geoType; c.p = f[52]; }
        } else {
          cells.set(key, { lat: round(lat, 2), lon: round(lon, 2), c: cat, n: 1, m: mentions, p: f[52], g: geoType, t: added, u: f[60].trim() });
        }
      }
    }
  }));
  const toMs = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
  const list = [...cells.values()].map((c) => [c.lat, c.lon, c.c, c.n, c.m, c.p, toMs(c.t), c.u, c.g === 5 ? 1 : 0]);
  return { list, files, rows, failed };
}

// ---------- Road incidents ----------

const incident = (src, lat, lon, type, title, detail = "", start = null, url = null) =>
  Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)
    ? { src, lat: round(lat, 4), lon: round(lon, 4), type: type || "Incident", title: (title || type || "Incident").slice(0, 200),
        detail: (detail || "").replace(/\s+/g, " ").trim().slice(0, 400), start, url }
    : null;

function firstCoord(geom) {
  if (!geom) return null;
  let c = geom.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null;
}

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");

/** Generic DATEX II parser: one incident per situationRecord with coordinates. */
function datex(xml, src, url) {
  const out = [];
  const recs = xml.match(/<(?:\w+:)?situationRecord\b[\s\S]*?<\/(?:\w+:)?situationRecord>/g) || [];
  for (const r of recs) {
    const lat = parseFloat((/<(?:\w+:)?latitude>\s*([-\d.]+)/.exec(r) || [])[1]);
    const lon = parseFloat((/<(?:\w+:)?longitude>\s*([-\d.]+)/.exec(r) || [])[1]);
    const type = ((/xsi:type="(?:\w+:)?(\w+)"/.exec(r) || [])[1] || "Incident").replace(/([a-z])([A-Z])/g, "$1 $2");
    const sub = (/<(?:\w+:)?(?:accidentType|obstructionType|roadMaintenanceType|abnormalTrafficType|poorEnvironmentType|environmentalObstructionType|vehicleObstructionType|disturbanceActivityType|publicEventType|roadOrCarriagewayOrLaneManagementType|constructionWorkType|networkManagementType)>([^<]+)</.exec(r) || [])[1];
    const texts = [...r.matchAll(/<(?:\w+:)?value(?: [^>]*)?>([^<]{3,})<\/(?:\w+:)?value>/g)].map((x) => decode(x[1].trim()));
    const start = (/<(?:\w+:)?overallStartTime>([^<]+)</.exec(r) || [])[1];
    const it = incident(src, lat, lon, sub ? sub.replace(/([a-z])([A-Z])/g, "$1 $2") : type, texts[0] || sub || type, texts.slice(1, 3).join(" · "), start ? Date.parse(start) : null, url);
    if (it) out.push(it);
  }
  return out;
}

const ROAD_SOURCES = {
  "Autobahn GmbH (Germany)": async () => {
    const { roads } = await fetchJSON("https://verkehr.autobahn.de/o/autobahn/");
    const out = [];
    const queue = roads.filter((r) => !/\s|\//.test(r)).flatMap((r) => [[r, "warning"], [r, "closure"]]);
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const [road, kind] = queue.shift();
        try {
          const j = await fetchJSON(`https://verkehr.autobahn.de/o/autobahn/${road}/services/${kind}`, { timeout: 20000 });
          for (const w of j[kind] || []) {
            const it = incident("Autobahn GmbH (Germany)", parseFloat(w.coordinate?.lat), parseFloat(w.coordinate?.long),
              kind === "closure" ? "Closure" : "Traffic warning", `${road}: ${w.title || ""} ${w.subtitle || ""}`.trim(),
              (w.description || []).join(" "), w.startTimestamp ? Date.parse(w.startTimestamp) : null, "https://verkehr.autobahn.de/");
            if (it) out.push(it);
          }
        } catch {}
      }
    }));
    return out;
  },
  "Digitraffic (Finland)": async () => {
    const j = await fetchJSON("https://tie.digitraffic.fi/api/traffic-message/v1/messages?inactiveHours=0&includeAreaGeometry=false&situationType=TRAFFIC_ANNOUNCEMENT&situationType=ROAD_WORK&situationType=EXEMPTED_TRANSPORT");
    return (j.features || []).map((f) => {
      const c = firstCoord(f.geometry);
      const a = f.properties?.announcements?.[0] || {};
      return c && incident("Digitraffic (Finland)", c[0], c[1], (f.properties?.situationType || "").replace(/_/g, " ").toLowerCase(),
        a.title, a.location?.description || a.comment, a.timeAndDuration?.startTime ? Date.parse(a.timeAndDuration.startTime) : null, "https://liikennetilanne.fintraffic.fi/");
    }).filter(Boolean);
  },
  "Bison Futé (France)": async () => datex(await fetchText("https://tipi.bison-fute.gouv.fr/bison-fute-ouvert/publicationsDIR/Evenementiel-DIR/grt/RRN/content.xml", { timeout: 60000 }),
    "Bison Futé (France)", "https://www.bison-fute.gouv.fr/"),
  "DGT (Spain)": async () => datex(await fetchText("https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml", { timeout: 60000 }),
    "DGT (Spain)", "https://infocar.dgt.es/etraffic/"),
  "NZTA (New Zealand)": async () => {
    const j = await fetchJSON("https://www.journeys.nzta.govt.nz/assets/map-data-cache/delays.json");
    return (j.features || []).map((f) => {
      const c = firstCoord(f.geometry), p = f.properties || {};
      return c && incident("NZTA (New Zealand)", c[0], c[1], p.EventType || p.EventCategory, p.EventDescription || p.Title || p.LocationArea,
        [p.LocationArea, p.EventComments, p.Impact].filter(Boolean).join(" · "), p.StartDate ? Date.parse(p.StartDate) : null, "https://www.journeys.nzta.govt.nz/");
    }).filter(Boolean);
  },
  "TfL (London)": async () => {
    const j = await fetchJSON("https://api.tfl.gov.uk/Road/all/Disruption");
    const rows = Array.isArray(j) ? j : (j.features || []);
    return rows.map((r) => {
      const p = r.properties || r;
      let c = firstCoord(r.geometry);
      if (!c && typeof p.point === "string") { const [lon, lat] = JSON.parse(p.point); c = [lat, lon]; }
      return c && incident("TfL (London)", c[0], c[1], p.category || p.subCategory, p.location || p.comments,
        p.comments || p.currentUpdate, p.startDateTime ? Date.parse(p.startDateTime) : null, "https://tfl.gov.uk/traffic/status/");
    }).filter(Boolean);
  },
};

export async function roads() {
  const out = [], report = {};
  await Promise.all(Object.entries(ROAD_SOURCES).map(async ([name, fn]) => {
    try { const r = await fn(); out.push(...r); report[name] = r.length; }
    catch (e) { report[name] = `failed: ${e.message}`; }
  }));
  return { list: out, report };
}

// ---------- Gazetteer ----------

export async function places() {
  const txt = unzipFirst(await fetchBuf("https://download.geonames.org/export/dump/cities15000.zip", { timeout: 60000 })).toString("utf8");
  const list = [];
  for (const line of txt.split("\n")) {
    const f = line.split("\t");
    if (f.length < 15) continue;
    const name = f[2] || f[1];
    list.push([name, round(+f[4], 3), round(+f[5], 3), +f[14] || 0, f[8], f[1] !== f[2] ? f[1] : 0]);
  }
  list.sort((a, b) => b[3] - a[3]);
  return list;
}

export { sleep };
