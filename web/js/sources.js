// Browser-side collectors. Only sources that allow cross-origin reads are called live;
// Google News, Bing and outlet RSS come from JSON published by the scheduled collector.
import { makeArticle, orClause, queryTerms, plainText, truncate, normalized, slug, parseDate, makeMatcher } from "./core.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, { timeout = 20000 } = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const report = (name, status, count, detail = null) => ({ name, status, count, detail });

// ---------- Scheduled-collector output ----------

export async function collectedNews(loc) {
  try {
    const data = await getJSON(`data/news/${loc.key.replace(":", "_")}.json`);
    const google = data.items.filter((a) => a.collector === "Google News");
    const bing = data.items.filter((a) => a.collector === "Bing News");
    const age = data.generatedAt ? ` · collected ${ago(data.generatedAt)}` : "";
    return { articles: data.items.map(expand), reports: [
      report("Google News", google.length ? "ok" : "empty", google.length, `National & local publications${age}`),
      report("Bing News", bing.length ? "ok" : "empty", bing.length, age.slice(3) || null)] };
  } catch {
    const why = loc.key.startsWith("custom:") ? "Only collected for listed locations" : "No collected data yet";
    return { articles: [], reports: [report("Google News", "skipped", 0, why), report("Bing News", "skipped", 0, why)] };
  }
}

let outletCache = null;
export async function outletNews(loc) {
  try {
    outletCache ||= getJSON("data/outlets.json");
    const items = await outletCache;
    const matches = makeMatcher(loc);
    const hits = items.filter((a) => matches(a.title + " " + a.summary)).map(expand);
    return { articles: hits, reports: [report("Outlet feeds", hits.length ? "ok" : "empty", hits.length,
      "BBC, Al Jazeera, Guardian, France 24, DW, UN News, NPR, CNBC, Defense News, The Record")] };
  } catch (e) {
    outletCache = null;
    return { articles: [], reports: [report("Outlet feeds", "failed", 0, e.message)] };
  }
}

const expand = (a) => ({ ...a, local: false, queryTopic: null, topics: [] });

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

// ---------- GDELT (live; sends CORS headers; one request per ~5 s per visitor) ----------

let lastGdelt = 0;
async function gdeltCall(query, hours) {
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?" + new URLSearchParams({
    query, mode: "ArtList", format: "json", maxrecords: "150", timespan: `${hours}h`, sort: "DateDesc" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastGdelt + 5600 - Date.now();
    if (wait > 0) await sleep(wait);
    lastGdelt = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { return JSON.parse(text).articles || []; } catch { throw new Error(text.slice(0, 100) || "Empty reply"); }
    } catch (e) {
      // A throttled reply (429) carries no CORS header, so the browser reports a network error: wait and retry.
      if (attempt === 2) throw e;
    }
  }
  return [];
}

export async function gdelt(loc, hours, { englishOnly = true, localPress = true } = {}, onPart) {
  const lang = englishOnly ? " sourcelang:english" : "";
  const toArticle = (local, name) => (r) => makeArticle({ title: r.title, link: r.url, date: r.seendate,
    source: (r.domain || "").replace(/^www\./, ""), collector: name, local });
  const out = { articles: [], reports: [] };
  try {
    const rows = await gdeltCall(orClause(queryTerms(loc)) + lang, hours);
    const arts = rows.map(toArticle(false, "GDELT")).filter(Boolean);
    out.articles.push(...arts);
    out.reports.push(report("GDELT", arts.length ? "ok" : "empty", arts.length, "Global news monitoring (live)"));
  } catch (e) {
    out.reports.push(report("GDELT", "failed", 0, e.message));
  }
  onPart?.(out);
  const codes = loc.kind === "region" ? loc.memberCodes.slice(0, 3) : loc.countryCode ? [loc.countryCode] : [];
  if (localPress && codes.length) {
    const scope = codes.map((c) => `sourcecountry:${c.toUpperCase()}`);
    const subject = loc.kind === "city" ? orClause(queryTerms(loc))
      : orClause(["government", "military", "economy", "security", "protest", "police", "election", "attack", "minister"]);
    try {
      const rows = await gdeltCall(`${subject} ${scope.length > 1 ? `(${scope.join(" OR ")})` : scope[0]}${lang}`, hours);
      const arts = rows.map(toArticle(true, "GDELT local press")).filter(Boolean);
      out.articles.push(...arts);
      out.reports.push(report("GDELT local press", arts.length ? "ok" : "empty", arts.length, "Outlets based in the country (live)"));
    } catch (e) {
      out.reports.push(report("GDELT local press", "failed", 0, e.message));
    }
  }
  return out;
}

// ---------- CIA World Factbook (final 2026 edition, factbook.json archive) ----------

export const FACTBOOK = "CIA World Factbook (2026 archive)";
const FIELD_MAP = {
  politics: [["Government", "Government type"], ["Government", "Executive branch"], ["Government", "Legislative branch"],
    ["Government", "Political parties"], ["Government", "International organization participation"]],
  military: [["Military and Security", "Military and security forces"], ["Military and Security", "Military expenditures"],
    ["Military and Security", "Military and security service personnel strengths"],
    ["Military and Security", "Military equipment inventories and acquisitions"],
    ["Military and Security", "Military deployments"], ["Military and Security", "Military - note"]],
  economy: [["Economy", "Economic overview"], ["Economy", "Real GDP growth rate"], ["Economy", "Real GDP per capita"],
    ["Economy", "Inflation rate (consumer prices)"], ["Economy", "Unemployment rate"], ["Economy", "Public debt"],
    ["Economy", "Exports - partners"], ["Economy", "Imports - partners"]],
  social: [["People and Society", "Population"], ["People and Society", "Ethnic groups"], ["People and Society", "Languages"],
    ["People and Society", "Religions"], ["People and Society", "Median age"], ["People and Society", "Urbanization"],
    ["Transnational Issues", "Refugees and internally displaced persons"]],
  security: [["Terrorism", "Terrorist group(s)"], ["Transnational Issues", "Illicit drugs"],
    ["Transnational Issues", "Trafficking in persons"], ["Geography", "Natural hazards"]],
  information: [["Communications", "Broadcast media"], ["Communications", "Internet users"],
    ["Communications", "Telephones - mobile cellular"], ["Communications", "Communications - note"]],
  infrastructure: [["Energy", "Electricity access"], ["Energy", "Electricity generation sources"], ["Energy", "Petroleum"],
    ["Transportation", "Airports"], ["Transportation", "Railways"], ["Transportation", "Ports"],
    ["Communications", "Broadband - fixed subscriptions"]],
};

function flatten(v) {
  if (v && typeof v === "object") {
    if (typeof v.text === "string") return plainText(v.text);
    return Object.keys(v).sort().map((k) => {
      const inner = flatten(v[k]);
      return inner ? (k === "note" ? `Note: ${inner}` : `${k[0].toUpperCase() + k.slice(1)}: ${inner}`) : null;
    }).filter(Boolean).join("\n");
  }
  return typeof v === "string" ? plainText(v) : "";
}

export async function factbook(country, label) {
  const b = emptyBaseline();
  const prefix = label ? `${label}: ` : "";
  const link = `https://github.com/factbook/factbook.json/blob/master/${country.fbRegion}/${country.code}.json`;
  try {
    const p = await getJSON(`https://raw.githubusercontent.com/factbook/factbook.json/master/${country.fbRegion}/${country.code}.json`);
    const bg = p.Introduction?.Background;
    if (bg) b.overview.push({ source: FACTBOOK, heading: prefix + "Background", text: truncate(flatten(bg), 1800), url: link });
    let n = 0;
    for (const [topic, fields] of Object.entries(FIELD_MAP)) {
      for (const [sec, field] of fields) {
        const text = p[sec]?.[field] && flatten(p[sec][field]);
        if (!text) continue;
        (b.byTopic[topic] ||= []).push({ source: FACTBOOK, heading: prefix + field, text: truncate(text, 1200), url: link });
        n++;
      }
    }
    b.reports.push(report("CIA World Factbook", "ok", n, "Final edition (service closed Feb 2026)"));
  } catch (e) {
    b.reports.push(report("CIA World Factbook", "failed", 0, e.message));
  }
  return b;
}

// ---------- UK FCDO travel advice (GOV.UK Content API) ----------

export const FCDO = "UK FCDO travel advice";
let fcdoIndex = null;

async function fcdoSlugs() {
  if (fcdoIndex) return fcdoIndex;
  try {
    const cached = JSON.parse(localStorage.getItem("fcdo-index") || "null");
    if (cached && Date.now() - cached.at < 7 * 864e5) return (fcdoIndex = cached.map);
  } catch {}
  const map = {};
  try {
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === "object") {
        if (typeof n.base_path === "string" && n.base_path.startsWith("/foreign-travel-advice/") && n.title) {
          const s = n.base_path.slice("/foreign-travel-advice/".length);
          if (!s.includes("/")) map[normalized(n.title)] = s;
        }
        Object.values(n).forEach(walk);
      }
    };
    walk(await getJSON("https://www.gov.uk/api/content/foreign-travel-advice"));
    try { localStorage.setItem("fcdo-index", JSON.stringify({ at: Date.now(), map })); } catch {}
  } catch {}
  return (fcdoIndex = map);
}

async function fcdoSlug(country) {
  if (country.fcdo !== undefined) return country.fcdo || null;
  const index = await fcdoSlugs();
  for (const name of [country.name, ...country.aliases]) {
    const k = normalized(name);
    if (index[k]) return index[k];
    const hit = Object.entries(index).find(([t]) => t.includes(k) || k.includes(t));
    if (hit) return hit[1];
  }
  return slug(country.name);
}

export async function fcdo(country, label) {
  const b = emptyBaseline();
  const s = await fcdoSlug(country);
  if (!s) { b.reports.push(report("FCDO travel advice", "skipped", 0, `No FCDO page for ${country.name}`)); return b; }
  const prefix = label ? `${label}: ` : "";
  const page = `https://www.gov.uk/foreign-travel-advice/${s}`;
  try {
    const json = await getJSON(`https://www.gov.uk/api/content/foreign-travel-advice/${s}`);
    const parts = [...(json.details?.parts || [])];
    if (json.details?.summary) parts.unshift({ title: "Summary", body: json.details.summary, slug: "" });
    let n = 0;
    for (const part of parts) {
      const body = plainText(part.body || "");
      if (!body) continue;
      const entry = { source: FCDO, heading: prefix + part.title, text: truncate(body, 1500), url: part.slug ? `${page}/${part.slug}` : page };
      const t = (part.title || "").toLowerCase();
      if (t.includes("summary") || t.includes("warnings")) {
        b.overview.push(entry);
        b.alerts.push(...body.split(/[.\n]/).map((x) => x.trim()).filter((x) => /advises against/i.test(x)).slice(0, 4).map((x) => prefix + x + "."));
      } else if (t.includes("safety") || t.includes("terrorism")) (b.byTopic.security ||= []).push(entry);
      else if (t.includes("local laws") || t.includes("health")) (b.byTopic.social ||= []).push(entry);
      else if (t.includes("natural disaster")) (b.byTopic.infrastructure ||= []).push(entry);
      else continue;
      n++;
    }
    b.alerts = [...new Set(b.alerts)];
    const upd = parseDate(json.public_updated_at);
    b.reports.push(report("FCDO travel advice", n ? "ok" : "empty", n, upd ? `Updated ${new Date(upd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : null));
  } catch (e) {
    b.reports.push(report("FCDO travel advice", "failed", 0, e.message));
  }
  return b;
}

// ---------- Wikipedia ----------

export async function wikipedia(title, heading) {
  const b = emptyBaseline();
  try {
    const j = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    if (j.extract) b.overview.push({ source: "Wikipedia", heading, text: j.extract, url: j.content_urls?.desktop?.page || null });
    b.reports.push(report("Wikipedia", j.extract ? "ok" : "empty", j.extract ? 1 : 0));
  } catch (e) {
    b.reports.push(report("Wikipedia", "failed", 0, e.message));
  }
  return b;
}

// ---------- Baseline assembly ----------

export function emptyBaseline() { return { overview: [], byTopic: {}, alerts: [], reports: [] }; }

export async function baseline(loc, catalog, opts) {
  const tasks = [];
  if (opts.wikipedia && loc.kind !== "country" && loc.wiki) tasks.push(wikipedia(loc.wiki, loc.name));
  let countries = [];
  if (loc.kind === "country") countries = [[catalog.byCode[loc.countryCode], null]];
  else if (loc.kind === "city" && loc.countryCode) { const c = catalog.byCode[loc.countryCode]; countries = [[c, `National context – ${c.name}`]]; }
  else if (loc.kind === "region") countries = loc.memberCodes.slice(0, 6).map((c) => [catalog.byCode[c], catalog.byCode[c]?.name]);
  for (const [c, label] of countries.filter(([c]) => c)) {
    if (opts.factbook) tasks.push(factbook(c, label));
    if (opts.fcdo) tasks.push(fcdo(c, label));
  }
  const parts = await Promise.all(tasks);
  const out = emptyBaseline();
  const merged = {};
  for (const p of parts) {
    out.overview.push(...p.overview);
    out.alerts.push(...p.alerts);
    for (const [k, v] of Object.entries(p.byTopic)) (out.byTopic[k] ||= []).push(...v);
    for (const r of p.reports) {
      const m = merged[r.name];
      if (!m) merged[r.name] = { ...r };
      else { m.count += r.count; if (m.status !== "ok") m.status = r.status; }
    }
  }
  const rank = (s) => (s === "Wikipedia" ? 0 : s === FACTBOOK ? 1 : 2);
  out.overview.sort((a, b) => rank(a.source) - rank(b.source));
  out.reports = Object.values(merged);
  return out;
}
