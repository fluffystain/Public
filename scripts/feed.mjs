// Minimal RSS 2.0 / RDF / Atom parser for the scheduled collector (no dependencies).
import { makeArticle } from "../web/js/core.js";

const MAX_AGE = 7 * 24 * 3.6e6;

const tag = (block, names) => {
  for (const n of names) {
    const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i").exec(block);
    if (m) return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
  }
  return "";
};

export function parseFeed(xml, collector, publisher) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return blocks.map((b) => {
    let link = tag(b, ["link"]);
    if (!link) link = (/<link[^>]*href="([^"]+)"/i.exec(b) || [])[1] || tag(b, ["guid", "id"]);
    const a = makeArticle({
      title: tag(b, ["title"]), link,
      description: tag(b, ["description", "summary", "content:encoded", "content"]),
      date: tag(b, ["pubDate", "published", "updated", "dc:date"]),
      source: publisher || tag(b, ["source", "News:Source", "dc:creator"]), collector,
    });
    return a && slim(a);
  }).filter(Boolean).filter((a) => !a.published || Date.now() - a.published < MAX_AGE);
}

// Keep files small: drop fields the browser re-derives.
const slim = ({ id, title, summary, url, publisher, published, collector }) =>
  ({ id, title, summary: summary.slice(0, 300), url, publisher, published, collector });

