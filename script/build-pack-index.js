#!/usr/bin/env node
// Generate the deployable packs/ folder from gig-packs/*.json:
//   packs/index.json  — metadata list (name, tagline, price, buyUrl, set summaries)
//   packs/{id}.json   — full pack content (same shape as gig-packs)
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "packs");
fs.mkdirSync(outDir, { recursive: true });

const ids = ["wedding", "party", "country", "british-pub", "restaurant"];
const index = [];
for (const id of ids) {
  const src = path.join(root, "gig-packs", id + ".json");
  const pack = JSON.parse(fs.readFileSync(src, "utf8"));
  // full copy
  fs.writeFileSync(path.join(outDir, id + ".json"), JSON.stringify(pack), "utf8");
  // metadata for the list view
  index.push({
    id: pack.id,
    name: pack.name,
    tagline: pack.tagline,
    price: pack.price,
    buyUrl: "", // paste your PayPal/Lemon Squeezy checkout link here
    total: pack.stats.total,
    sets: pack.sets.map((s) => ({ name: s.name, vibe: s.vibe, count: s.songs.length }))
  });
  console.log("pack:", id, pack.stats.total + " songs");
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 1), "utf8");
console.log("packs/index.json written:", index.length, "packs");
