#!/usr/bin/env node
// Logic test for the Gig Packs unlock flow: state persistence, dev code,
// order-matching rules (type pack:<id>), and orderLabel display.
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

// minimal localStorage shim
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
global.PACKS = [
  { id: "wedding", name: "Wedding Gig Pack", price: 9.99 },
  { id: "party", name: "Party & Functions Pack", price: 9.99 },
  { id: "country", name: "Country Night Pack", price: 9.99 },
  { id: "british-pub", name: "British Pub Gig Pack", price: 9.99 },
  { id: "restaurant", name: "Restaurant Gig Pack", price: 9.99 }
];
global.PACKS_KEY = "sb2packs";
global.PACK_DEV_CODE = "GRATIS-PACKS-2026";

const fns = ["packRecord", "isPackUnlocked", "setPackUnlocked", "unlockAllPacks", "orderLabel"];
(0, eval)(fns.map(grab).join("\n"));

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; console.log("  ok:", name); } else { fail++; console.log("  FAIL:", name); } }

// 1. initially locked
t("initially locked", !isPackUnlocked("wedding"));
// 2. unlock one pack
setPackUnlocked("wedding", "ABC12345", "buyer@test.com");
t("wedding unlocked", isPackUnlocked("wedding"));
t("party still locked", !isPackUnlocked("party"));
const rec = packRecord();
t("record stores code+email", rec.unlocked.wedding.code === "ABC12345" && rec.unlocked.wedding.email === "buyer@test.com");
// 3. dev code unlocks all
unlockAllPacks("dev", "");
t("all unlocked after dev code", PACKS.every((p) => isPackUnlocked(p.id)));
// 4. orderLabel mapping
t("orderLabel pro", orderLabel("pro") === "Pro");
t("orderLabel ul", orderLabel("ul") === "Unlimited");
t("orderLabel pack known", orderLabel("pack:wedding") === "Wedding Gig Pack");
t("orderLabel pack unknown", orderLabel("pack:zzz") === "zzz");
t("orderLabel empty", orderLabel("") === "Pro");
// 5. simulate the buyer email-match rule used in the unlock modal
const orders = {
  o1: { email: "buyer@test.com", status: "pending", type: "pack:country", ts: 1 },
  o2: { email: "buyer@test.com", status: "approved", type: "pack:party", code: "PACK1234" }
};
function findApproved(type, email) {
  let o = null;
  for (const k in orders) {
    const d = orders[k];
    if (d && d.type === type && d.email && String(d.email).toLowerCase() === email && d.status === "approved" && d.code) { o = d; break; }
  }
  return o;
}
t("approved match by type+email", !!findApproved("pack:party", "buyer@test.com"));
t("no match wrong type", !findApproved("pack:country", "buyer@test.com"));
// 6. code lookup rule (any approved code)
function findByCode(c) { let f = null; for (const k in orders) { const d = orders[k]; if (d && d.status === "approved" && d.code === c) { f = d; break; } } return f; }
t("code lookup", findByCode("PACK1234") && findByCode("PACK1234").type === "pack:party");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
