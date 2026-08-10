#!/usr/bin/env node
// Post-deploy check: confirm the live GitHub Pages site serves the app, the
// lyricbook chunks, and that a sample of songs resolve to lyrics.
"use strict";
const BASE = process.argv[2] || "https://reganwebbmusic-rgb.github.io/fluffy-waffle/";

function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase();
}
function lyricHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % 8;
}

(async () => {
  const UA = "Mozilla/5.0 (compatible; verify-live/1.0)";
  let fail = 0;
  async function get(url) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) { console.log("  FAIL", r.status, url); fail++; return null; }
    return r;
  }
  console.log("checking", BASE);
  const html = await get(BASE + "setlist-builder.html");
  if (!html) return;
  const htmlText = await html.text();
  console.log("  app html:", htmlText.length, "bytes, lyricbook loader:", htmlText.includes("lyricbook/"), "| live fallback:", htmlText.includes("lrclib.net/api/search"));

  // sample songs to verify
  const sample = [
    ["Livin' On A Prayer", "Bon Jovi"],
    ["Blinding Lights", "The Weeknd"],
    ["Sweet Caroline", "Neil Diamond"],
    ["Take Me Home, Country Roads", "John Denver"],
    ["La Bachata", "Manuel Turizo"],
    ["God's Menu", "Stray Kids"],
    ["Tum Se Hi", "Pritam"]
  ];
  // load all 8 chunks and check lookups
  const chunks = {};
  for (let i = 0; i < 8; i++) {
    const r = await get(BASE + "lyricbook/" + i + ".json");
    if (r) chunks[i] = await r.json();
  }
  console.log("  chunks loaded:", Object.keys(chunks).length);
  for (const [t, a] of sample) {
    const k = norm(t) + "|" + norm(a);
    const c = chunks[lyricHash(k)];
    const hit = c && c[k];
    console.log("  " + (hit ? "OK  " : "MISS") + " " + t + " | " + a + (hit ? " (" + (hit.src || "?") + ", " + hit.text.length + " chars)" : ""));
    if (!hit) fail++;
  }
  const extra = await get(BASE + "extra-songs.json");
  if (extra) {
    const arr = await extra.json();
    console.log("  extra-songs.json:", arr.length, "rows");
    if (arr.length < 9000) { console.log("  FAIL extra catalog too small"); fail++; }
  }
  console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECK(S) FAILED");
})();
