#!/usr/bin/env node
// Extract the full song catalog from setlist-builder.html (built-in CATALOG array)
// plus extra-songs.json into script/catalog.json as unique [title, artist] pairs.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "setlist-builder.html"), "utf8");

// --- extract var CATALOG = [ ... ]; (array literal may contain // comments) ---
const start = html.indexOf("var CATALOG = [");
if (start < 0) throw new Error("CATALOG not found");
// the array is followed by "];" then "  var TOP50 = [...]" (CHORDBOOK comes later)
const end = html.indexOf("var TOP50", start);
if (end < 0) throw new Error("TOP50 boundary not found");
const block = html.slice(start + "var CATALOG = [".length, end);

// strip // comments and whitespace, then parse as JSON with trailing-comma tolerance
const lines = block.split("\n");
const cleanLines = lines
  .map((l) => l.replace(/\/\/.*$/, "").trim())
  .filter((l) => l.length > 0 && l !== "];" && l !== "]");
const jsonStr = "[" + cleanLines.join("") + "]";
const builtin = JSON.parse(jsonStr);
console.log("built-in rows:", builtin.length);

// --- extra-songs.json ---
const extra = JSON.parse(fs.readFileSync(path.join(root, "extra-songs.json"), "utf8"));
console.log("extra rows:", extra.length);

// --- dedupe by lowercase title|artist ---
const seen = new Set();
const songs = [];
function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function push(t, a, k, b) {
  const key = norm(t) + "|" + norm(a);
  if (seen.has(key)) return;
  seen.add(key);
  songs.push([String(t).slice(0, 120), String(a || "").slice(0, 120), String(k || "").slice(0, 8), String(b || "").slice(0, 8)]);
}
builtin.forEach((r) => push(r[0], r[1], r[2], r[3]));
extra.forEach((r) => push(r[0], r[1], r[2], r[3]));

fs.writeFileSync(
  path.join(root, "script", "catalog.json"),
  JSON.stringify(songs),
  "utf8"
);
console.log("unique songs written to script/catalog.json:", songs.length);
