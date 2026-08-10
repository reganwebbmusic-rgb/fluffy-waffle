#!/usr/bin/env node
// Split script/lyricbook.json into lyricbook/0.json … 7.json (deployed next to
// the app). Chunk index = djb2 hash of normalized "title|artist" % 8 — must match
// lyricHash() in setlist-builder.html. Entries are trimmed to {text, src}.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const book = JSON.parse(fs.readFileSync(path.join(__dirname, "lyricbook.json"), "utf8"));

function lyricHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % 8;
}

const chunks = Array.from({ length: 8 }, () => ({}));
const outDir = path.join(root, "lyricbook");
fs.mkdirSync(outDir, { recursive: true });

let totalChars = 0;
Object.keys(book).forEach((k) => {
  const e = book[k];
  const chunk = chunks[lyricHash(k)];
  chunk[k] = { text: e.text, src: e.src || "" };
  totalChars += e.text.length;
});

chunks.forEach((c, i) => {
  const p = path.join(outDir, `${i}.json`);
  fs.writeFileSync(p, JSON.stringify(c), "utf8");
  console.log(`${i}.json: ${Object.keys(c).length} entries, ${(fs.statSync(p).size / 1024 / 1024).toFixed(2)} MB`);
});

// sanity: verify a few lookups round-trip
const test = book[Object.keys(book)[0]];
const k0 = Object.keys(book)[0];
const ci = lyricHash(k0);
const back = JSON.parse(fs.readFileSync(path.join(outDir, `${ci}.json`), "utf8"));
console.log("\nsanity:", k0, "->", !!back[k0], "| src:", back[k0] && back[k0].src);
console.log("total entries:", Object.keys(book).length, "| total chars:", totalChars);
