import { TOPICS, TOPIC, buildCatalog, analyse, subtitle, windowText, BINS } from "./core.js";
import { collectedNews, outletNews, gdelt, baseline, ago } from "./sources.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const OPTS = ["collected", "outlets", "gdelt", "local", "factbook", "fcdo", "wikipedia", "english"];
const state = { catalog: null, brief: null, reports: [], topic: null, product: null, filter: null, run: 0, busy: false };

// ---------- Setup ----------

async function init() {
  $("#topic-legend").innerHTML = TOPICS.map((t) => `<li style="--c:${t.color}"><i class="dot"></i>${t.title}</li>`).join("");
  const saved = store.get("opts", {});
  for (const o of OPTS) { const el = $(`#opt-${o}`); if (o in saved) el.checked = saved[o]; el.addEventListener("change", saveOpts); }

  let countries;
  try {
    countries = await (await fetch("data/countries.json")).json();
  } catch {
    $("#location").innerHTML = `<option value="">Could not load the location list. Reload the page.</option>`;
    return;
  }
  state.catalog = buildCatalog(countries);
  $("#custom-country").insertAdjacentHTML("beforeend",
    [...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join(""));
  fillLocations("country");

  document.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener("change", () => fillLocations(r.value)));
  $("#location").addEventListener("change", () => { $("#custom-fields").hidden = $("#location").value !== "__custom"; });
  $("#controls").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  document.addEventListener("click", onClick);
  renderRecents();
  collectorStatus();

  const params = new URLSearchParams(location.search);
  const loc = params.get("loc") && state.catalog.fromKey(params.get("loc"));
  if (loc) {
    const h = [24, 72, 168].includes(+params.get("h")) ? +params.get("h") : 72;
    $("#window").value = String(h);
    selectInForm(loc);
    generate(loc, h);
  }
}

function saveOpts() { store.set("opts", Object.fromEntries(OPTS.map((o) => [o, $(`#opt-${o}`).checked]))); }
const opt = (o) => $(`#opt-${o}`).checked;

function fillLocations(kind) {
  const { catalog } = state;
  const sel = $("#location");
  const group = (label, items) => `<optgroup label="${esc(label)}">${items.join("")}</optgroup>`;
  const option = (l, text = l.name) => `<option value="${esc(l.key)}">${esc(text)}</option>`;
  let html = `<option value="">Choose a ${kind}…</option>`;
  if (kind === "country") {
    const areas = {};
    for (const c of catalog.countries) (areas[c.area] ||= []).push(catalog.countryLoc(c));
    html += Object.keys(areas).sort().map((a) => group(a, areas[a].sort((x, y) => x.name.localeCompare(y.name)).map((l) => option(l)))).join("");
  } else if (kind === "region") {
    html += catalog.all.filter((l) => l.kind === "region").map((l) => option(l)).join("");
  } else {
    html += `<option value="__custom">Another city or area…</option>`;
    const areas = {};
    for (const l of catalog.all.filter((l) => l.kind === "city")) {
      const c = catalog.byCode[l.countryCode];
      (areas[c?.area || "Other"] ||= []).push(option(l, `${l.name} (${c?.name || ""})`));
    }
    html += Object.keys(areas).sort().map((a) => group(a, areas[a].sort())).join("");
  }
  sel.innerHTML = html;
  $("#custom-fields").hidden = true;
}

function selectInForm(loc) {
  const kind = loc.key.startsWith("custom:") ? "city" : loc.kind;
  $(`input[name="kind"][value="${kind}"]`).checked = true;
  fillLocations(kind);
  if (loc.key.startsWith("custom:")) {
    $("#location").value = "__custom";
    $("#custom-fields").hidden = false;
    $("#custom-name").value = loc.name;
    $("#custom-country").value = loc.countryCode || "";
  } else $("#location").value = loc.key;
}

function submit() {
  const v = $("#location").value;
  let loc = null;
  if (v === "__custom") {
    const name = $("#custom-name").value.trim();
    if (name.length < 2) { $("#custom-name").focus(); toast("Type a city or area name first."); return; }
    loc = state.catalog.customCity(name, $("#custom-country").value || null);
  } else loc = state.catalog.byKey[v];
  if (!loc) { $("#location").focus(); toast("Choose a location first."); return; }
  generate(loc, +$("#window").value);
}

// ---------- Generation ----------

async function generate(loc, hours) {
  const run = ++state.run;
  state.busy = true;
  state.brief = null; state.reports = [];
  state.topic = null; state.product = null; state.filter = null;
  $("#intro").hidden = true;
  $("#brief").hidden = false;
  $("#generate").disabled = true;
  history.replaceState(null, "", `?loc=${encodeURIComponent(loc.key)}&h=${hours}`);
  document.title = `${loc.name} · Intel Brief`;

  const parts = { articles: [], reports: [] };
  const add = (p) => { parts.articles.push(...p.articles); parts.reports.push(...p.reports); };
  let base = null;
  const progress = { done: 0, total: 4, text: "Collecting reporting and reference material…" };
  const refresh = () => {
    if (run !== state.run) return;
    state.reports = [...parts.reports, ...(base?.reports || [])];
    state.brief = analyse({ location: loc, articles: parts.articles, hours,
      baseline: base || { overview: [], byTopic: {}, alerts: [], reports: [] } });
    render(progress);
  };
  render(progress, loc, hours);

  const step = (label) => (p) => { if (p) add(p); progress.done++; progress.text = label; refresh(); };
  const tasks = [
    (opt("collected") ? collectedNews(loc) : null) ,
    (opt("outlets") ? outletNews(loc) : null),
  ].map((t, i) => Promise.resolve(t).then(step(i ? "Outlet feeds filtered" : "Aggregator results loaded")));
  tasks.push(baseline(loc, state.catalog, { factbook: opt("factbook"), fcdo: opt("fcdo"), wikipedia: opt("wikipedia") })
    .then((b) => { base = b; progress.done++; progress.text = "Reference material loaded"; refresh(); }));
  tasks.push(opt("gdelt")
    ? gdelt(loc, hours, { englishOnly: opt("english"), localPress: opt("local") }, () => { progress.text = "GDELT global results in; querying local press…"; })
        .then(step("GDELT monitoring complete"))
    : Promise.resolve(null).then(step("")));
  await Promise.allSettled(tasks);
  if (run !== state.run) return;
  state.busy = false;
  $("#generate").disabled = false;
  refresh();
  saveRecent(loc, hours);
}

function saveRecent(loc, hours) {
  const list = store.get("recents", []).filter((r) => r.key !== loc.key);
  list.unshift({ key: loc.key, name: loc.name, h: hours, at: Date.now(), n: state.brief.articles.length });
  store.set("recents", list.slice(0, 12));
  renderRecents();
}

function renderRecents() {
  const list = store.get("recents", []);
  const nav = $("#recents");
  nav.hidden = !list.length;
  nav.innerHTML = `<span class="label">Recent</span>` +
    list.map((r) => `<button type="button" class="chip" data-try="${esc(r.key)}" data-h="${r.h}">${esc(r.name)}</button>`).join("");
}

async function collectorStatus() {
  try {
    const m = await (await fetch("data/meta.json", { cache: "no-store" })).json();
    $("#collector-status").textContent = `News aggregators and outlet feeds last collected ${ago(m.generatedAt)} (${m.locations} locations). GDELT, Factbook, FCDO and Wikipedia are queried live.`;
  } catch {
    $("#collector-status").textContent = "Scheduled news collection has not run yet; live sources still work.";
  }
}

// ---------- Rendering ----------

const fmtTime = (ts) => new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function render(progress, loc = state.brief?.location, hours = state.brief?.hours) {
  const b = state.brief;
  const el = $("#brief");
  const busy = state.busy;
  const pct = Math.round((progress.done / progress.total) * 100);
  const head = `
    <header class="brief-head">
      <span class="eyebrow">${esc(subtitle(loc, state.catalog))} · Last ${windowText(hours)}</span>
      <h2>${esc(loc.name)}</h2>
      ${b ? `<div class="stats">
        <span class="stat"><b>${b.articles.length}</b><span>reports</span></span>
        <span class="stat"><b>${new Set(b.articles.map((a) => a.publisher)).size}</b><span>outlets</span></span>
        <span class="stat"><b>${state.reports.filter((r) => r.status === "ok").length}</b><span>sources</span></span>
      </div>
      <div class="meta">Generated ${fmtTime(b.generatedAt)}</div>
      <div class="actions">
        <button type="button" class="ghost" data-act="share">Share link</button>
        <button type="button" class="ghost" data-act="copy">Copy brief as text</button>
        <button type="button" class="ghost" data-act="refresh"${busy ? " disabled" : ""}>Refresh</button>
        <a class="ghost" href="map.html?place=${encodeURIComponent(loc.name)}">Open on map</a>
      </div>` : ""}
    </header>
    ${busy ? `<div class="progress" role="status"><span>${esc(progress.text)}</span><div class="bar"><i style="width:${pct}%"></i></div></div>` : ""}`;
  if (!b) { el.innerHTML = head; return; }

  el.innerHTML = head + `
    ${b.alerts.length ? `<section class="panel alert"><div class="panel-title"><span class="label">FCDO travel advice</span></div>
      ${b.alerts.slice(0, 4).map((a) => `<p>${esc(a)}</p>`).join("")}</section>` : ""}
    <section class="panel bluf">
      <div class="panel-title"><span class="label">Bottom line up front</span><span class="method">Automatic extract</span></div>
      <p>${esc(b.bluf[0])}</p>
      ${b.bluf.length > 1 ? `<ul>${b.bluf.slice(1).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
    </section>

    <div class="section-title"><h3>Topics</h3><small>Select a topic for detail</small></div>
    <div class="tiles">${b.sections.map(tile).join("")}${timelineTile(b)}</div>
    ${state.topic ? detail(b.sections.find((s) => s.topic.id === state.topic)) : ""}

    <div class="section-title"><h3>Latest reporting</h3><small>Most recent first</small></div>
    <section class="panel">${b.articles.length ? b.articles.slice(0, 10).map((a) => article(a, true)).join("")
      : `<p class="empty-note">${busy ? "Waiting for sources…" : "No reporting found in this window. Try a longer window or a broader location."}</p>`}</section>

    ${b.overview.length ? `<div class="section-title"><h3>Background</h3><small>Reference sources</small></div>
      <section class="panel">${b.overview.map(baselineEntry).join("")}</section>` : ""}

    <div class="section-title"><h3>Analytical products</h3><small>Ready now and planned</small></div>
    <div class="products">${PRODUCTS.map(productTile).join("")}</div>
    ${state.product ? `<section class="panel" id="product-view">${PRODUCTS.find((p) => p.id === state.product).render(b)}</section>` : ""}

    <div class="section-title"><h3>Sources consulted</h3><small>Items retrieved before de-duplication</small></div>
    <section class="panel"><table class="sources"><tbody>${state.reports.map(sourceRow).join("")}</tbody></table></section>`;
}

const levelBadge = (s) => `<span class="level" data-l="${s.level}"><i class="dot"></i>${s.level === "quiet" ? "No reporting" : s.level}${s.level !== "quiet" ? ` · ${s.trend}` : ""}</span>`;
const spark = (h) => { const m = Math.max(1, ...h); return `<div class="spark" aria-hidden="true">${h.map((v) => `<i class="${v ? "" : "zero"}" style="height:${Math.max(8, (v / m) * 100)}%"></i>`).join("")}</div>`; };

function tile(s) {
  return `<button type="button" class="tile" style="--c:${s.topic.color}" data-topic="${s.topic.id}" aria-pressed="${state.topic === s.topic.id}">
    <span class="tile-head"><strong>${s.topic.title}</strong><b>${s.count}</b></span>
    ${levelBadge(s)}
    <p>${esc(s.stories[0]?.headline || "No recent reporting")}</p>
    ${spark(s.histogram)}
  </button>`;
}

function timelineTile(b) {
  return `<button type="button" class="tile" style="--c:var(--accent)" data-product="timeline" aria-pressed="${state.product === "timeline"}">
    <span class="tile-head"><strong>All reporting</strong><b>${b.articles.length}</b></span>
    <span class="level" data-l="low" style="color:var(--muted)">Timeline view</span>
    <p>${b.other.length} reports did not fit a single topic. Open the timeline to see everything in order.</p>
    ${spark(b.sections.reduce((acc, s) => acc.map((v, i) => v + s.histogram[i]), Array(BINS).fill(0)))}
  </button>`;
}

function detail(s) {
  const pane = state.detailPane || "stories";
  const max = Math.max(1, ...s.histogram);
  const body = pane === "stories"
    ? (s.stories.length ? s.stories.slice(0, 15).map(story).join("") : `<p class="empty-note">Nothing matched this topic in the selected window.</p>`)
    : pane === "all"
      ? (s.count ? s.stories.flatMap((x) => x.articles).sort((a, b) => (b.published || 0) - (a.published || 0)).map((a) => article(a)).join("") : `<p class="empty-note">No reports.</p>`)
      : (s.baseline.length ? s.baseline.map(baselineEntry).join("") : `<p class="empty-note">Factbook and FCDO material is available for countries, regions, and cities with a country set.</p>`);
  return `<section class="panel detail" id="topic-detail" style="--c:${s.topic.color}">
    <div class="detail-head"><h4>${s.topic.title}</h4><span class="method">${s.count} reports · ${s.outlets} outlets · automatic extract</span></div>
    <p class="synopsis">${esc(s.synopsis)}</p>
    <div class="histo" role="img" aria-label="Reports per period, oldest to newest: ${s.histogram.join(", ")}">${s.histogram.map((v) => `<i style="height:${(v / max) * 100}%" title="${v} reports"></i>`).join("")}</div>
    <div class="histo-axis"><span>${windowText(state.brief.hours)} ago</span><span>Now</span></div>
    <div class="tabs" role="tablist">
      ${[["stories", "Key stories"], ["all", "All reports"], ["background", "Background"]].map(([id, label]) =>
        `<button type="button" role="tab" data-pane="${id}" aria-selected="${pane === id}">${label}</button>`).join("")}
    </div>
    ${body}
  </section>`;
}

function story(st) {
  const local = st.articles.some((a) => a.local);
  if (st.articles.length === 1) return `<div class="story">${article(st.articles[0])}</div>`;
  return `<div class="story">
    <strong>${esc(st.headline)}</strong>
    <div class="story-meta"><span>${st.articles.length} report${st.articles.length > 1 ? "s" : ""}</span><span>${st.publishers} outlet${st.publishers > 1 ? "s" : ""}</span>${st.latest ? `<span>${ago(st.latest)}</span>` : ""}${local ? `<span class="tag local">LOCAL</span>` : ""}</div>
    ${article(st.articles[0])}
    ${st.articles.length > 1 ? `<details><summary>Show all ${st.articles.length} reports</summary>${st.articles.slice(1).map((a) => article(a)).join("")}</details>` : ""}
  </div>`;
}

function article(a, dots = false) {
  const link = a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : `<span>${esc(a.title)}</span>`;
  return `<div class="article">${link}${a.summary ? `<p>${esc(a.summary)}</p>` : ""}
    <div class="byline"><span class="pub">${esc(a.publisher)}</span>${a.local ? `<span class="tag local">LOCAL</span>` : ""}${a.published ? `<span>${ago(a.published)}</span>` : ""}
    ${dots ? a.topics.map((t) => `<i class="dot" style="--c:${TOPIC[t].color}" title="${TOPIC[t].title}"></i>`).join("") : ""}</div></div>`;
}

function baselineEntry(e) {
  return `<details class="baseline"><summary><span>${esc(e.heading)}</span><small>${esc(e.source)}</small></summary>
    <div class="text">${esc(e.text)}</div>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ""}</details>`;
}

function sourceRow(r) {
  return `<tr><td><span class="st ${r.status}">${r.status}</span></td><td>${esc(r.name)}${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</td><td>${r.count}</td></tr>`;
}

// ---------- Analytical products (extension point) ----------
// Each product receives the whole analysed brief. Add one by appending to PRODUCTS with a render(brief) function.

const PRODUCTS = [
  { id: "timeline", title: "Reporting Timeline", summary: "Every report in time order, tagged by topic.", render: renderTimeline },
  { id: "trends", title: "Reporting Trends", summary: "Volume per topic across the window.", render: renderTrends },
  { id: "judgements", title: "Key Judgements", summary: "Judgements with confidence levels and probability yardsticks." },
  { id: "threat", title: "Threat Assessment", summary: "Actors, intent, capability and likelihood by sector." },
  { id: "iw", title: "Indicators & Warnings", summary: "Watch-list with tripwires triggered by new reporting." },
  { id: "actors", title: "Actor Network", summary: "People, organisations and groups, and their links." },
  { id: "geo", title: "Geospatial View", summary: "Map of reported incidents and infrastructure." },
  { id: "outlook", title: "Outlook & Scenarios", summary: "Most likely and most dangerous courses over 1–3 months." },
];

function productTile(p) {
  const ready = !!p.render;
  return ready
    ? `<button type="button" class="product ready" data-product="${p.id}" aria-pressed="${state.product === p.id}"><span class="badge">READY</span><strong>${p.title}</strong><p>${p.summary}</p></button>`
    : `<div class="product"><span class="badge">PLANNED</span><strong>${p.title}</strong><p>${p.summary}</p></div>`;
}

function renderTimeline(b) {
  const f = state.filter;
  const items = b.articles.filter((a) => !f || a.topics.includes(f));
  const days = {};
  for (const a of items) {
    const k = a.published ? new Date(a.published).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Undated";
    (days[k] ||= []).push(a);
  }
  return `<div class="panel-title"><span class="label">Reporting timeline</span><span class="method">${items.length} reports</span></div>
    <div class="filters"><button type="button" data-filter="" aria-pressed="${!f}">All</button>${TOPICS.map((t) =>
      `<button type="button" data-filter="${t.id}" style="--c:${t.color}" aria-pressed="${f === t.id}">${t.title}</button>`).join("")}</div>
    ${Object.entries(days).map(([d, list]) => `<p class="day">${esc(d)}</p>${list.map((a) => article(a, true)).join("")}`).join("") || `<p class="empty-note">No reports.</p>`}`;
}

function renderTrends(b) {
  const W = 640, H = 220, P = { l: 30, r: 8, t: 10, b: 26 };
  const totals = Array.from({ length: BINS }, (_, i) => b.sections.reduce((n, s) => n + s.histogram[i], 0));
  const max = Math.max(1, ...totals);
  const step = Math.ceil(max / 4) || 1;
  const top = step * 4;
  const bw = (W - P.l - P.r) / BINS;
  const y = (v) => H - P.b - (v / top) * (H - P.t - P.b);
  const span = (b.hours * 3.6e6) / BINS;
  let bars = "";
  for (let i = 0; i < BINS; i++) {
    let acc = 0;
    for (const s of b.sections) {
      const v = s.histogram[i];
      if (!v) continue;
      bars += `<rect x="${P.l + i * bw + 3}" y="${y(acc + v)}" width="${bw - 6}" height="${y(acc) - y(acc + v)}" fill="${s.topic.color}"><title>${s.topic.title}: ${v}</title></rect>`;
      acc += v;
    }
    const start = new Date(b.generatedAt - span * (BINS - i));
    const lbl = b.hours <= 24 ? start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : start.toLocaleDateString("en-GB", { weekday: "short", hour: "2-digit" });
    bars += `<text x="${P.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(lbl)}</text>`;
  }
  const grid = [0, 1, 2, 3, 4].map((k) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(k * step)}" y2="${y(k * step)}" stroke="var(--line)" /><text x="${P.l - 6}" y="${y(k * step) + 3}" text-anchor="end">${k * step}</text>`).join("");
  return `<div class="panel-title"><span class="label">Reporting trends</span><span class="method">Reports per period, by topic</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked bar chart of reports per period by topic">${grid}${bars}</svg>
    <div class="legend">${b.sections.map((s) => `<span><i class="dot" style="--c:${s.topic.color}"></i>${s.topic.title} ${s.count} (${s.trend})</span>`).join("")}</div>`;
}

// ---------- Interaction ----------

function onClick(e) {
  const t = e.target.closest("[data-topic],[data-pane],[data-product],[data-filter],[data-act],[data-try]");
  if (!t) return;
  if (t.dataset.try !== undefined) {
    const loc = state.catalog?.fromKey(t.dataset.try);
    if (!loc) return;
    const h = +(t.dataset.h || $("#window").value);
    $("#window").value = String(h);
    selectInForm(loc);
    generate(loc, h);
    window.scrollTo({ top: $("#brief").offsetTop - 12, behavior: "smooth" });
    return;
  }
  if (!state.brief) return;
  const progress = { done: 4, total: 4, text: "" };
  if (t.dataset.topic) {
    state.topic = state.topic === t.dataset.topic ? null : t.dataset.topic;
    state.detailPane = "stories";
    render(progress);
    if (state.topic) $("#topic-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (t.dataset.pane) {
    state.detailPane = t.dataset.pane; render(progress);
  } else if (t.dataset.product) {
    state.product = state.product === t.dataset.product ? null : t.dataset.product;
    render(progress);
    if (state.product) $("#product-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (t.dataset.filter !== undefined) {
    state.filter = t.dataset.filter || null; render(progress);
  } else if (t.dataset.act === "share") share();
  else if (t.dataset.act === "copy") copy(briefText(state.brief), "Brief copied");
  else if (t.dataset.act === "refresh") generate(state.brief.location, state.brief.hours);
}

async function share() {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: `Intel brief: ${state.brief.location.name}`, url }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  copy(url, "Link copied. Anyone who opens it gets a fresh brief.");
}

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { toast("Copy is blocked here. Select the text manually."); }
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.role = "status"; el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

function briefText(b) {
  const out = ["UNCLASSIFIED // OPEN SOURCE", `INTELLIGENCE BRIEF: ${b.location.name.toUpperCase()}`,
    `Generated ${fmtTime(b.generatedAt)} · window ${windowText(b.hours)} · ${b.articles.length} reports`, location.href, ""];
  if (b.alerts.length) out.push("FCDO TRAVEL ADVICE", ...b.alerts.map((a) => `• ${a}`), "");
  out.push("BOTTOM LINE UP FRONT", ...b.bluf, "");
  for (const s of b.sections) {
    out.push(`${s.topic.title.toUpperCase()}: ${s.level}, ${s.trend} (${s.count} reports)`, s.synopsis);
    for (const st of s.stories.slice(0, 4)) out.push(`  • ${st.headline} (${st.articles[0].publisher})${st.articles[0].url ? `\n    ${st.articles[0].url}` : ""}`);
    out.push("");
  }
  out.push("Sources: " + state.reports.map((r) => `${r.name} (${r.status})`).join(", "), "Machine-collected open-source material. Verify before use.");
  return out.join("\n");
}

init();
