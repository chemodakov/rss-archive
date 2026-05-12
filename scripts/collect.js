#!/usr/bin/env node
// RSS Aggregator — runs every 2 hours via GitHub Actions
// Fetches all sources, deduplicates, appends new items to weekly NDJSON file

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

// ── Sources ─────────────────────────────────────────────────────────────────

const SOURCES = [
  // Western / European
  { name: "BBC World",          region: "western",  url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Guardian World",     region: "western",  url: "https://www.theguardian.com/world/rss" },
  { name: "Deutsche Welle",     region: "western",  url: "https://rss.dw.com/xml/rss-en-world" },
  { name: "France 24",          region: "western",  url: "https://www.france24.com/en/world/rss" },
  { name: "RFI English",        region: "western",  url: "https://www.rfi.fr/en/rss" },
  { name: "Euronews",           region: "western",  url: "https://feeds.feedburner.com/euronews/en/news" },
  // Asia / Pacific
  { name: "NHK World",          region: "asia",     url: "https://www3.nhk.or.jp/rss/news/cat0.xml" },
  { name: "The Hindu",          region: "asia",     url: "https://www.thehindu.com/news/international/feeder/default.rss" },
  { name: "ABC Australia",      region: "asia",     url: "https://www.abc.net.au/news/feed/51120/rss.xml" },
  { name: "SCMP",               region: "asia",     url: "https://www.scmp.com/rss/91/feed" },
  { name: "CNA",                region: "asia",     url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml" },
  { name: "Times of India",     region: "asia",     url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
  // Middle East / Africa
  { name: "Al Jazeera",         region: "mideast",  url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Premium Times NG",   region: "africa",   url: "https://www.premiumtimesng.com/feed" },
  { name: "Egypt Independent",  region: "mideast",  url: "https://egyptindependent.com/feed/" },
  // Latin America
  { name: "teleSUR",            region: "latam",    url: "https://www.telesurenglish.net/rss/" },
  { name: "Mercopress",         region: "latam",    url: "https://en.mercopress.com/rss" },
  { name: "Buenos Aires Herald",region: "latam",    url: "https://buenosairesherald.com/feed" },
  { name: "Rio Times",          region: "latam",    url: "https://riotimesonline.com/feed/" },
  // Alternative / Global South perspectives
  { name: "IPS News",           region: "global",   url: "https://www.ipsnews.net/feed/" },
  { name: "The Conversation",   region: "global",   url: "https://theconversation.com/global/articles.atom" },
  { name: "Global Times CN",    region: "china",    url: "https://www.globaltimes.cn/rss/outbrain.xml" },
];

// ── Date utils ───────────────────────────────────────────────────────────────

function getWeekId(date = new Date()) {
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - dow + 1);
  const diff = Math.floor((date.getTime() - week1Mon.getTime()) / 864e5);
  const week = Math.floor(diff / 7) + 1;
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── RSS / Atom parser ─────────────────────────────────────────────────────────

function parseItems(xml, sourceName, region) {
  const items = [];
  // Support both RSS <item> and Atom <entry>
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];

    const title = strip(
      block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? ""
    );
    const description = strip(
      (block.match(/<(?:description|summary)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/)?.[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .substring(0, 300)
    );
    const link = strip(
      block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1] ??
      block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? ""
    );
    const rawDate =
      block.match(/<(?:pubDate|published|updated)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated)>/)?.[1]?.trim() ?? "";
    const pubDate = rawDate ? new Date(rawDate) : null;

    if (!title || title.length < 5) continue;

    items.push({
      id: createHash("sha1").update(title.slice(0, 80)).digest("hex").slice(0, 12),
      title,
      description,
      link,
      source: sourceName,
      region,
      pubDate: pubDate && !isNaN(pubDate) ? pubDate.toISOString() : new Date().toISOString(),
      collectedAt: new Date().toISOString(),
    });
  }
  return items;
}

function strip(s) {
  return s.trim().replace(/\s+/g, " ");
}

// ── Fetch one source ──────────────────────────────────────────────────────────

async function fetchSource(source) {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "rss-archive/1.0 (+https://github.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml, source.name, source.region);
  } catch {
    return [];
  }
}

// ── Load / save weekly file ───────────────────────────────────────────────────

function weekFile(weekId) {
  return path.join(DATA_DIR, `${weekId}.ndjson`);
}

function loadExistingIds(weekId) {
  const file = weekFile(weekId);
  if (!existsSync(file)) return new Set();
  const ids = new Set();
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try { ids.add(JSON.parse(line).id); } catch { /* skip */ }
  }
  return ids;
}

function appendItems(weekId, items) {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = weekFile(weekId);
  const lines = items.map((i) => JSON.stringify(i)).join("\n");
  writeFileSync(file, (existsSync(file) ? "\n" : "") + lines, { flag: "a" });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const weekId = getWeekId();
  console.log(`[${new Date().toISOString()}] Collecting for ${weekId}`);

  const existingIds = loadExistingIds(weekId);
  console.log(`  Existing items: ${existingIds.size}`);

  // Fetch all sources in parallel (batches of 6 to be polite)
  const allItems = [];
  for (let i = 0; i < SOURCES.length; i += 6) {
    const batch = await Promise.all(SOURCES.slice(i, i + 6).map(fetchSource));
    batch.forEach((items, j) => {
      console.log(`  ${SOURCES[i + j].name}: ${items.length} items`);
      allItems.push(...items);
    });
  }

  // Deduplicate: skip items we already have (by title hash id)
  const newItems = allItems.filter((item) => !existingIds.has(item.id));

  // Also deduplicate within this batch (same title from multiple sources)
  const seenInBatch = new Set();
  const deduped = newItems.filter((item) => {
    if (seenInBatch.has(item.id)) return false;
    seenInBatch.add(item.id);
    return true;
  });

  if (deduped.length > 0) {
    appendItems(weekId, deduped);
    console.log(`  ✓ Added ${deduped.length} new items (${allItems.length - deduped.length} duplicates skipped)`);
  } else {
    console.log(`  — No new items`);
  }

  console.log(`  Total in ${weekId}: ${existingIds.size + deduped.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
