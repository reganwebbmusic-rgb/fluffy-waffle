#!/usr/bin/env node
// Stress-test renderChordSheet on real harvested lyrics with a minimal DOM shim.
"use strict";
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "setlist-builder.html"), "utf8");

function grab(name) {
  const i = html.indexOf("function " + name + "(");
  if (i < 0) throw new Error("not found: " + name);
  const open = html.indexOf("{", i);
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error("unclosed: " + name);
}

const helpers = ["isChordToken", "isChordLine", "isSectionLabel", "transNote", "transChord", "transChordLine", "renderChordSheet"];
const TRANS_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TRANS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
globalThis.TRANS_SHARP = TRANS_SHARP;
globalThis.TRANS_FLAT = TRANS_FLAT;
const code = helpers.map(grab).join("\n") +
  "\nglobal.document = { createElement: function () { return { children: [], style: {}, textContent: '', className: '', appendChild: function (c) { this.children.push(c); return c; } }; } };";
(0, eval)(code); // indirect eval -> global scope

const book = JSON.parse(fs.readFileSync(path.join(__dirname, "lyricbook.json"), "utf8"));
const keys = Object.keys(book);
const sample = [];
for (let i = 0; i < keys.length; i += Math.max(1, Math.floor(keys.length / 300))) sample.push(keys[i]);
let crashes = 0, empty = 0, lyricLines = 0;
for (const k of sample) {
  try {
    const song = { name: book[k].t, artist: book[k].a, key: "C" };
    const root = renderChordSheet(book[k].text, song, 0);
    if (!root.children.length) empty++;
    lyricLines += root.children.length;
  } catch (e) { crashes++; console.log("CRASH:", k, "|", e.message); }
}
console.log("tested", sample.length, "sheets | crashes:", crashes, "| empty roots:", empty, "| avg children:", Math.round(lyricLines / sample.length));

// inline-chord splitting: "Another he[C]ad" -> chord row above lyric row, no brackets in lyric
let splitPass = 0, splitFail = 0;
const inlineText = "[Em] Another he[C]ad hangs lowly, ch[G]ild is slowly\n[Verse 1]\nIn your [Em]head, in your [C]head, zombi[G]e\n[x2] keep this tag in lyrics";
const r2 = renderChordSheet(inlineText, { name: "Zombie", artist: "The Cranberries", key: "Bb" }, 0);
const chordRows = [], lyricRows = [];
(function walk(el) {
  for (const c of el.children || []) {
    if (c.className === "cs-chords") chordRows.push(c.textContent);
    if (c.className === "cs-lyric") lyricRows.push(c.textContent);
    walk(c);
  }
})(r2);
const ch = chordRows.join("|");
const ly = lyricRows.join("|");
if (ch.includes("Em") && ch.includes("C") && ch.includes("G")) splitPass++; else { splitFail++; console.log("chord row missing chords:", JSON.stringify(ch)); }
const lyClean = ly.replace(/ /g, "");
if (!ly.includes("[Em]") && !ly.includes("[C]") && !ly.includes("[G]") && lyClean.includes("Anotherheadhangslowly,childisslowly")) splitPass++; else { splitFail++; console.log("lyric row bad:", JSON.stringify(ly)); }
if (ly.includes("[x2]")) splitPass++; else { splitFail++; console.log("non-chord tag lost:", JSON.stringify(ly)); }
console.log("inline-chord split:", splitPass + " passed, " + splitFail + " failed");
process.exit(splitFail || crashes ? 1 : 0);
