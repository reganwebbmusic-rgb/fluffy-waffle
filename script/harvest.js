#!/usr/bin/env node
// Bulk-harvest lyrics for the full catalog into script/lyricbook.json.
// Sources & pacing (measured):
//   A. lrclib /api/get   — ~200 requests per ~12s window, then 429; paced batches
//   B. lrclib /api/search — fuzzy fallback for misses, same pacing
//   C. lyrics.ovh        — ~0.5 req/s sustained, sequential with backoff
// Resume-capable: skips keys already present in lyricbook.json.
"use strict";
const fs = require("fs");
const path = require("path");

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const OUT = path.join(__dirname, "lyricbook.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase();
}
function keyOf(t, a) { return norm(t) + "|" + norm(a); }

function cleanLyrics(raw) {
  if (!raw) return null;
  let text = String(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\[offset:\s*-?\d+\]/gi, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/, "").trim())
    .join("\n");
  text = text.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "").trim();
  if (text.length < 20) return null;
  if (text.length > 4000) {
    text = text.slice(0, 4000);
    const nl = text.lastIndexOf("\n");
    if (nl > 3000) text = text.slice(0, nl);
  }
  return text;
}

async function getLrclib(t, a) {
  const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(a)}&track_name=${encodeURIComponent(t)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 429) return { rl: true };
  if (r.status === 200) {
    const d = await r.json();
    return { text: (d && (d.syncedLyrics || d.plainLyrics)) || null };
  }
  return { text: null };
}

function sim(a, b) {
  const ta = norm(a).split(/\W+/).filter(Boolean);
  const tb = norm(b).split(/\W+/).filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  const set = new Set(ta);
  tb.forEach((w) => { if (set.has(w)) hit++; });
  return hit / Math.max(ta.length, tb.length);
}

async function searchLrclib(t, a) {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(a + " " + t)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 429) return { rl: true };
  if (r.status !== 200) return { text: null };
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) return { text: null };
  let best = null, bestScore = 0.5;
  for (const hit of arr) {
    const score = sim(a, hit.artistName) * 0.5 + sim(t, hit.trackName) * 0.5;
    if (score > bestScore) { bestScore = score; best = hit; }
  }
  return { text: best ? (best.syncedLyrics || best.plainLyrics) || null : null };
}

async function getOvh(t, a) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 200) {
    const d = await r.json();
    return { text: (d && d.lyrics) || null };
  }
  return { text: null };
}

const book = {};
if (fs.existsSync(OUT)) Object.assign(book, JSON.parse(fs.readFileSync(OUT, "utf8")));
const stats = { lrclib: 0, search: 0, ovh: 0 };
Object.keys(book).forEach((k) => { const s = book[k].src; if (s) stats[s] = (stats[s] || 0) + 1; });
function saveBook() { fs.writeFileSync(OUT, JSON.stringify(book), "utf8"); }
function store(k, t, a, text, src) {
  const clean = cleanLyrics(text);
  if (!clean) return false;
  book[k] = { t, a, text: clean, src };
  stats[src] = (stats[src] || 0) + 1;
  return true;
}

// Paced batch: runs fn over slice with `conc` workers, workers store into book.
// Returns {rl} count; caller sleeps SLEEP ms after each batch.
async function pacedBatch(slice, fn, conc) {
  let rl = 0, found = 0;
  let i = 0;
  async function worker() {
    while (i < slice.length) {
      const [t, a] = slice[i++];
      const k = keyOf(t, a);
      if (book[k]) continue;
      try {
        const res = await fn(t, a);
        if (res.rl) { rl++; continue; }
        if (res.text && store(k, t, a, res.text, fn.src)) found++;
      } catch (e) { /* transient */ }
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return { rl, found };
}

(async () => {
  const t0 = Date.now();
  console.log(`total=${CATALOG.length} done=${Object.keys(book).length}`);

  // ---- Phase A: lrclib /api/get, paced (single pass over snapshot) ----
  getLrclib.src = "lrclib";
  const todoA = CATALOG.filter(([t, a]) => !book[keyOf(t, a)]);
  console.log(`Phase A (lrclib get): ${todoA.length} to fetch`);
  const BATCH = 200, SLEEP = 12000;
  let batchNo = 0;
  for (let s = 0; s < todoA.length; s += BATCH) {
    const slice = todoA.slice(s, s + BATCH);
    const res = await pacedBatch(slice, getLrclib, 8);
    batchNo++;
    saveBook();
    console.log(`  A#${batchNo}: found=${res.found} rl=${res.rl} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await sleep(res.rl > BATCH * 0.5 ? SLEEP * 2 : SLEEP);
  }
  console.log(`Phase A done: ${Object.keys(book).length} total`);

  // ---- Phase B: variant get attempts + fuzzy search, paced ----
  function stripParens(t) {
    return String(t).replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  }
  function straightQuotes(s) {
    return String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  }
  function stripFeatArtist(a) {
    return String(a).split(/\s+(?:ft\.?|feat\.?|featuring)\s+/i)[0].trim();
  }
  async function phaseBFn(t, a) {
    const variants = [];
    const push = (tt, aa) => {
      const v = [tt, aa];
      const k = norm(tt) + "|" + norm(aa);
      if (!variants.some((x) => norm(x[0]) + "|" + norm(x[1]) === k)) variants.push(v);
    };
    push(t, a);                                          // as-is
    push(stripParens(t), stripFeatArtist(a));            // no parens, no feat artist
    push(straightQuotes(t), stripFeatArtist(a));         // straight quotes
    push(straightQuotes(stripParens(t)), stripFeatArtist(a));
    for (const [tt, aa] of variants) {
      const r = await getLrclib(tt, aa);
      if (r.text) return r;
      if (r.rl) return { rl: true };
    }
    return searchLrclib(t, a);
  }
  phaseBFn.src = "search";
  const todoB = CATALOG.filter(([t, a]) => !book[keyOf(t, a)]);
  console.log(`Phase B (stripped + search): ${todoB.length} to fetch`);
  for (let s = 0; s < todoB.length; s += BATCH) {
    const slice = todoB.slice(s, s + BATCH);
    const res = await pacedBatch(slice, phaseBFn, 6);
    batchNo++;
    saveBook();
    console.log(`  B#${batchNo}: found=${res.found} rl=${res.rl} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await sleep(res.rl > BATCH * 0.5 ? SLEEP * 2 : SLEEP);
  }
  console.log(`Phase B done: ${Object.keys(book).length} total`);

  // ---- Phase C: lyrics.ovh, sequential + gentle, time-capped ----
  getOvh.src = "ovh";
  const todoC = CATALOG.filter(([t, a]) => !book[keyOf(t, a)]);
  console.log(`Phase C (lyrics.ovh): ${todoC.length} to fetch (max 40 min)`);
  const C_DEADLINE = Date.now() + 2400 * 1000;
  let ci = 0;
  for (const [t, a] of todoC) {
    if (Date.now() > C_DEADLINE) { console.log("  Phase C time cap reached"); break; }
    const k = keyOf(t, a);
    if (book[k]) continue;
    ci++;
    // try as-is, then feat-stripped artist
    let res = await getOvh(t, stripFeatArtist(a));
    if (!res.text && norm(stripFeatArtist(a)) !== norm(a)) {
      await sleep(2000);
      res = await getOvh(t, a);
    }
    if (res.text) store(k, t, a, res.text, "ovh");
    if (ci % 20 === 0) { saveBook(); console.log(`  C: ${ci}/${todoC.length} found=${stats.ovh} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    await sleep(2000);
  }
  saveBook();

  const total = Object.keys(book).length;
  console.log("\n=== HARVEST COMPLETE ===");
  console.log(`entries: ${total}/${CATALOG.length} (${(100 * total / CATALOG.length).toFixed(1)}%)`);
  console.log("by source:", JSON.stringify(stats));
  console.log("time:", ((Date.now() - t0) / 60).toFixed(1), "min");
  console.log("file size:", (fs.statSync(OUT).size / 1024 / 1024).toFixed(1), "MB");
})();
