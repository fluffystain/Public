// Pure logic shared by the browser app and the scheduled collector. No DOM access here.
import { TOPICS, REGIONS, CITIES } from "./data.js";

export { TOPICS, REGIONS, CITIES };
export const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// ---------- Text ----------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", eacute: "é", egrave: "è", aacute: "á",
  iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç", ocirc: "ô", uuml: "ü", ouml: "ö",
  auml: "ä", pound: "£", euro: "€" };

export function decodeEntities(s = "") {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function plainText(html = "") {
  if (html.includes("&lt;")) html = decodeEntities(html); // feeds that escape their HTML twice
  return decodeEntities(
    html.replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div|\/tr)\s*\/?>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
  ).replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

export function truncate(s, n) {
  if (!s || s.length <= n) return s || "";
  const cut = s.slice(0, n);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > n / 2 ? cut.slice(0, stop + 1) : cut.trimEnd() + "…";
}

export function normalized(s = "") {
  return " " + s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
}

export const slug = (s) => normalized(s).trim().replace(/ /g, "-");

const STOP = new Set(("the and for with from that this are was were has have had its his her their they will would " +
  "says said say after over into amid about more than new not but who what when why how out off can could been " +
  "being also may might per via news live update updates latest video watch report reports week day year years today").split(" "));

export function tokens(s) {
  return new Set(normalized(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function splitPublisher(title) {
  const i = title.lastIndexOf(" - ");
  if (i < 0) return [title, null];
  const pub = title.slice(i + 3).trim();
  return pub && pub.length <= 60 ? [title.slice(0, i), pub] : [title, null];
}

export function hostName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Unknown"; }
}

export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const g = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s); // GDELT seendate
  const d = g ? new Date(Date.UTC(+g[1], g[2] - 1, +g[3], +g[4], +g[5], +g[6])) : new Date(s);
  return isNaN(d) ? null : d.getTime();
}

// ---------- Articles ----------

/** Normalises a raw item into the article shape used everywhere. */
export function makeArticle({ title, link, description = "", date, source = "", collector, topic = null, local = false }) {
  let t = decodeEntities(title || "").trim();
  let publisher = decodeEntities(source || "").trim();
  const [bare, suffix] = splitPublisher(t);
  if (!publisher && suffix) publisher = suffix;
  if (suffix && suffix === publisher) t = bare;
  if (t.length <= 12) return null;
  if (!publisher) publisher = hostName(link);
  let summary = plainText(description);
  if (summary.startsWith(t) || jaccard(tokens(summary), tokens(t)) > 0.7) summary = "";
  return { id: (link || t).toLowerCase(), title: t, summary: truncate(summary, 400), url: link || null,
    publisher, published: parseDate(date), collector, local, queryTopic: topic, topics: [] };
}

// ---------- Locations ----------

export function buildCatalog(countries) {
  const byCode = Object.fromEntries(countries.map((c) => [c.code, c]));
  const countryLoc = (c) => ({ key: `country:${c.code}`, kind: "country", name: c.name, countryCode: c.code,
    memberCodes: [], extra: [...c.aliases, c.capital, c.adjective].filter(Boolean), wiki: c.name });
  const regionLoc = (r) => ({ key: `region:${slug(r.name)}`, kind: "region", name: r.name, countryCode: null,
    memberCodes: r.members, extra: [...r.extra, ...r.members.map((m) => byCode[m]?.name).filter(Boolean)], wiki: r.wiki });
  const cityLoc = (c) => ({ key: `city:${slug(c.name)}-${c.country}`, kind: "city", name: c.name, countryCode: c.country,
    memberCodes: [], extra: c.extra, wiki: c.name });
  const customCity = (name, code) => ({ key: `custom:${slug(name)}${code ? "-" + code : ""}`, kind: "city", name: name.trim(),
    countryCode: code || null, memberCodes: [], extra: [], wiki: name.trim() });

  const all = [...countries.map(countryLoc), ...REGIONS.map(regionLoc), ...CITIES.map(cityLoc)];
  const byKey = Object.fromEntries(all.map((l) => [l.key, l]));
  return { countries, byCode, all, byKey, countryLoc, regionLoc, cityLoc, customCity,
    fromKey(key) {
      if (byKey[key]) return byKey[key];
      const m = /^custom:(.+?)(?:-([a-z]{2}))?$/.exec(key || "");
      return m ? customCity(m[1].replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()), m[2]) : null;
    } };
}

export function matchTerms(loc) {
  const seen = new Set();
  return [loc.name, ...loc.extra].filter((t) => {
    const k = (t || "").toLowerCase();
    if (k.length < 3 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const queryTerms = (loc) => matchTerms(loc).slice(0, loc.kind === "region" ? 6 : 3);

export function orClause(terms) {
  const q = terms.map((t) => (/[\s-]/.test(t) ? `"${t}"` : t));
  return q.length === 1 ? q[0] : `(${q.join(" OR ")})`;
}

export function makeMatcher(loc) {
  const needles = matchTerms(loc).map(normalized).filter((n) => n.length > 4);
  return (text) => { const h = normalized(text); return needles.some((n) => h.includes(n)); };
}

export function subtitle(loc, catalog) {
  if (loc.kind === "country") return "Country";
  if (loc.kind === "region") return `Region · ${loc.memberCodes.length} countries`;
  const c = loc.countryCode && catalog.byCode[loc.countryCode];
  return c ? `City · ${c.name}` : "City";
}

// ---------- Classification ----------

const COMPILED = TOPICS.map((t) => [t.id, Object.entries(t.keywords).map(([k, w]) => [normalized(k), w])]);

export function classify(article) {
  const title = normalized(article.title), body = normalized(article.summary);
  const scores = [];
  for (const [id, kws] of COMPILED) {
    let s = 0;
    for (const [needle, w] of kws) {
      if (title.includes(needle)) s += w * 2;
      else if (body.includes(needle)) s += w;
    }
    if (article.queryTopic === id) s += 1.5;
    if (s > 0) scores.push([id, s]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  if (!scores.length || scores[0][1] < 2) return article.queryTopic ? [article.queryTopic] : [];
  const floor = Math.max(2, scores[0][1] * 0.6);
  return scores.slice(0, 2).filter(([, s]) => s >= floor).map(([id]) => id);
}

// ---------- De-duplication and clustering ----------

const byDateDesc = (a, b) => (b.published || 0) - (a.published || 0);

export function deduplicate(articles) {
  const byId = new Map();
  for (const a of articles) {
    const e = byId.get(a.id);
    if (e) {
      e.queryTopic ||= a.queryTopic;
      e.local ||= a.local;
      e.summary ||= a.summary;
    } else byId.set(a.id, { ...a });
  }
  const kept = [];
  for (const a of [...byId.values()].sort(byDateDesc)) {
    const tk = tokens(a.title);
    if (kept.some(([k, kt]) => (k.publisher === a.publisher && jaccard(kt, tk) > 0.8) || jaccard(kt, tk) > 0.92)) continue;
    kept.push([a, tk]);
  }
  return kept.map(([a]) => a);
}

export function cluster(articles, now = Date.now()) {
  const clusters = [];
  for (const a of [...articles].sort(byDateDesc)) {
    const tk = tokens(a.title + " " + (a.summary || "").slice(0, 160));
    let best = -1, bestScore = 0;
    clusters.forEach((c, i) => { const s = jaccard(c.tokens, tk); if (s > bestScore) { bestScore = s; best = i; } });
    if (best >= 0 && bestScore >= 0.28) {
      clusters[best].items.push(a);
      for (const t of tk) clusters[best].tokens.add(t);
    } else clusters.push({ tokens: tk, items: [a] });
  }
  return clusters.map((c) => {
    const latest = Math.max(0, ...c.items.map((a) => a.published || 0)) || null;
    const ageH = latest ? Math.max(0, (now - latest) / 3.6e6) : 72;
    const pubs = new Set(c.items.map((a) => a.publisher)).size;
    const score = Math.log(1 + c.items.length) * 2 + pubs * 0.6 + Math.exp(-ageH / 24) * 2 + (c.items.some((a) => a.local) ? 0.5 : 0);
    const lead = c.items.reduce((best, a) => (jaccard(tokens(a.title), c.tokens) > jaccard(tokens(best.title), c.tokens) ? a : best));
    return { id: lead.id, headline: lead.title, articles: c.items, latest, score, publishers: pubs };
  }).sort((a, b) => b.score - a.score);
}

// ---------- Metrics ----------

export const BINS = 8;

export function histogram(articles, hours, now = Date.now()) {
  const counts = Array(BINS).fill(0), span = hours * 3.6e6;
  for (const a of articles) {
    if (!a.published) continue;
    const age = now - a.published;
    if (age < 0 || age > span) continue;
    counts[BINS - 1 - Math.min(BINS - 1, Math.floor((age / span) * BINS))]++;
  }
  return counts;
}

export function trend(hist) {
  const half = hist.length / 2;
  const older = hist.slice(0, half).reduce((a, b) => a + b, 0);
  const recent = hist.slice(half).reduce((a, b) => a + b, 0);
  if (recent + older < 4) return "steady";
  if (recent > older * 1.35) return "rising";
  if (recent < older * 0.7) return "falling";
  return "steady";
}

export function level(count, hours) {
  const perDay = count / Math.max(1, hours / 24);
  if (perDay === 0) return "quiet";
  if (perDay < 4) return "low";
  if (perDay < 12) return "moderate";
  return "high";
}

export const windowText = (h) => (h <= 24 ? "24 hours" : `${Math.round(h / 24)} days`);

// ---------- Summaries ----------

export function topicSynopsis(topic, place, stories, count, outlets, tr, hours) {
  if (!stories.length) return `No ${topic.title.toLowerCase()} reporting on ${place} was found in the last ${windowText(hours)}.`;
  const leads = stories.slice(0, 3).map((s, i) => `(${i + 1}) ${s.headline}${s.articles.length > 1 ? ` (${s.articles.length} reports)` : ""}`);
  return `${count} report${count === 1 ? "" : "s"} from ${outlets} outlet${outlets === 1 ? "" : "s"} in the last ${windowText(hours)}; volume is ${tr}. Main threads: ${leads.join("; ")}.`;
}

export function bluf(place, sections, hours, alerts) {
  const active = sections.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  if (!active.length) return [`Little or no open-source reporting on ${place} in the last ${windowText(hours)}.`];
  const rising = active.filter((s) => s.trend === "rising").map((s) => s.topic.title);
  const lines = [`Reporting on ${place} is led by ${active[0].topic.title.toLowerCase()}` +
    (active[1] ? ` and ${active[1].topic.title.toLowerCase()}` : "") + "." +
    (rising.length ? ` Rising volume: ${rising.join(", ")}.` : "")];
  for (const s of active.slice(0, 3)) if (s.stories[0]) lines.push(`${s.topic.title}: ${s.stories[0].headline}`);
  if (alerts[0]) lines.push(`Travel: ${alerts[0]}`);
  return lines;
}

/** Runs the whole analysis over collected articles and reference material. */
export function analyse({ location, articles, baseline, hours, now = Date.now() }) {
  const cutoff = now - hours * 3.6e6;
  const fresh = deduplicate(articles.filter((a) => !a.published || a.published >= cutoff));
  for (const a of fresh) a.topics = classify(a);
  const sections = TOPICS.map((topic) => {
    const items = fresh.filter((a) => a.topics.includes(topic.id));
    const stories = cluster(items, now).slice(0, 60);
    const hist = histogram(items, hours, now);
    const tr = trend(hist);
    const outlets = new Set(items.map((a) => a.publisher)).size;
    return { topic, count: items.length, outlets, stories, histogram: hist, trend: tr, level: level(items.length, hours),
      synopsis: topicSynopsis(topic, location.name, stories, items.length, outlets, tr, hours),
      baseline: baseline.byTopic[topic.id] || [] };
  });
  return { location, generatedAt: now, hours, articles: fresh.sort(byDateDesc), sections,
    other: fresh.filter((a) => !a.topics.length), bluf: bluf(location.name, sections, hours, baseline.alerts),
    alerts: baseline.alerts, overview: baseline.overview };
}

// ---------- Outlet feeds collected by the scheduled job ----------

export const OUTLET_FEEDS = [
  ["BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml"],
  ["BBC Africa", "https://feeds.bbci.co.uk/news/world/africa/rss.xml"],
  ["BBC Asia", "https://feeds.bbci.co.uk/news/world/asia/rss.xml"],
  ["BBC Europe", "https://feeds.bbci.co.uk/news/world/europe/rss.xml"],
  ["BBC Latin America", "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml"],
  ["BBC Middle East", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"],
  ["BBC US & Canada", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
  ["BBC UK", "https://feeds.bbci.co.uk/news/uk/rss.xml"],
  ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"],
  ["The Guardian", "https://www.theguardian.com/world/rss"],
  ["France 24", "https://www.france24.com/en/rss"],
  ["DW", "https://rss.dw.com/rdf/rss-en-world"],
  ["UN News", "https://news.un.org/feed/subscribe/en/news/all/rss.xml"],
  ["NPR World", "https://feeds.npr.org/1004/rss.xml"],
  ["CNBC World", "https://www.cnbc.com/id/100727362/device/rss/rss.html"],
  ["Defense News", "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml"],
  ["The Record (cyber)", "https://therecord.media/feed"],
  ["US travel advisories", "https://travel.state.gov/_res/rss/TAsTWs.xml"],
];
