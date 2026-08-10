#!/usr/bin/env node
// DOM smoke test: boot setlist-builder.html in jsdom with a seeded pool,
// click through every tab, open a song sheet and a pack detail — catch crashes.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "setlist-builder.html"), "utf8");

// seed a pool: 2 songs (one with lyrics in the book) so Songs/Sets have content
const seed = {
  songs: [
    { name: "Livin' On A Prayer", artist: "Bon Jovi", key: "Eb", capo: "", bpm: "123", energy: 5, note: "", trans: "", status: "Ready", len: "4:00", played: 0, custom: "", kind: "", addedAt: 1 },
    { name: "Wonderwall", artist: "Oasis", key: "F#m", capo: "", bpm: "87", energy: 3, note: "", trans: "", status: "Ready", len: "4:18", played: 0, custom: "", kind: "", addedAt: 2 }
  ],
  sets: {
    A: [[0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]],
    B: [[-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]]
  },
  tab: "songs", setView: "A", expanded: -1, songSort: "newest",
  wishlist: [], links: { tip: "", extra: "", review: "" },
  upNext: [], gigCheck: { items: [] }, dark: false, setLib: []
};

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "https://reganwebbmusic-rgb.github.io/fluffy-waffle/setlist-builder.html",
  beforeParse(window) {
    window.localStorage.setItem("setlist-builder-v1", JSON.stringify(seed));
    window.localStorage.setItem("sb2tutDone", "1"); // skip auto tutorial popup
    // XHR stub: serve local files for ./extra-songs.json, ./lyricbook/N.json, ./packs/*
    window.XMLHttpRequest = class {
      open(method, url) { this.url = url; }
      send() {
        const p = this.url.replace(/^\.\//, "").split("?")[0];
        const f = path.join(root, p);
        try {
          this.status = 200;
          this.responseText = fs.readFileSync(f, "utf8");
        } catch (e) {
          this.status = 404;
          this.responseText = "";
        }
        if (this.onload) this.onload();
      }
    };
    window.fetch = () => Promise.reject(new Error("fetch stubbed off"));
    // capture errors from scripts
    window.addEventListener("error", (e) => { errors.push("window error: " + (e.message || e)); });
    window.addEventListener("unhandledrejection", (e) => { errors.push("unhandled rejection: " + (e.reason && e.reason.message || e.reason)); });
  }
});
const { window } = dom;
const doc = window.document;

function clickTab(id) {
  const el = doc.getElementById(id);
  if (!el) throw new Error("tab missing: " + id);
  el.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function check(name, cond, extra) {
  console.log((cond ? "  ok   " : "  FAIL ") + name + (extra ? " — " + extra : ""));
  if (!cond) process.exitCode = 1;
}

(async () => {
  await new Promise((r) => setTimeout(r, 800)); // let init + async loads settle

  check("app boots, list rendered", doc.getElementById("list").children.length > 0);
  check("pool count shows 2", /2/.test(doc.getElementById("poolCount").textContent));

  // Songs tab: verify pool songs render
  clickTab("tabSongs");
  await new Promise((r) => setTimeout(r, 400));
  const listText = doc.getElementById("list").textContent;
  check("songs tab shows pool songs", listText.includes("Livin' On A Prayer") && listText.includes("Wonderwall"));

  // Songs tab: tapping a song card opens the editor (edit area with custom sheet)
  const cardHead = [...doc.querySelectorAll(".card .head")].find((d) => d.textContent && d.textContent.includes("Livin' On A Prayer"));
  if (cardHead) cardHead.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  check("song editor opens", doc.getElementById("list").textContent.includes("Custom chords & lyrics"));

  // Sets tab: pre-seeded slots -> tap a slot row -> lyrics sheet with lyricbook hit
  clickTab("tabSets");
  await new Promise((r) => setTimeout(r, 400));
  const listText2 = doc.getElementById("list").textContent;
  check("sets tab renders", listText2.includes("Set A"));
  const songRow = [...doc.querySelectorAll(".card.slot .head")].find((d) => d.textContent && d.textContent.includes("Livin' On A Prayer"));
  if (songRow) songRow.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500)); // lyricbook chunk load
  const modal = doc.querySelector(".modal-bg");
  const sheetText = modal ? modal.textContent : "";
  check("song sheet opens from set slot", !!modal);
  check("sheet has lyrics", sheetText.includes("Tommy used to work on the docks"), "lyric text found");
  // close
  if (modal) { modal.style.display = "none"; }

  // Requests tab
  clickTab("tabRequests");
  await new Promise((r) => setTimeout(r, 400));
  check("requests tab renders", doc.getElementById("list").textContent.length > 0);

  // Packs tab: list + open a pack detail
  clickTab("tabPacks");
  await new Promise((r) => setTimeout(r, 800)); // packs/index.json load
  let packsText = doc.getElementById("list").textContent;
  check("packs list shows 5 packs", (packsText.match(/Wedding Gig Pack|Party & Functions Pack|Country Night Pack|British Pub Gig Pack|Restaurant Gig Pack/g) || []).length === 5, "5 names found");
  const openBtn = [...doc.querySelectorAll("button")].find((b) => b.textContent === "Preview");
  if (openBtn) openBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800)); // pack detail load
  const detailText = doc.getElementById("list").textContent;
  check("pack detail opens", detailText.includes("Dinner & cocktails") || detailText.includes("Set A"), "pack sets shown");

  // Tools tab: install card present
  clickTab("tabTools");
  await new Promise((r) => setTimeout(r, 400));
  check("tools tab has install card", doc.getElementById("list").textContent.includes("Install this app"));
  check("tools tab has tuner", doc.getElementById("list").textContent.includes("Chromatic tuner"));

  // Songs tab again (regression)
  clickTab("tabSongs");
  await new Promise((r) => setTimeout(r, 300));
  check("back to songs works", doc.getElementById("list").textContent.includes("Livin' On A Prayer"));

  console.log("\nerrors captured:", errors.length ? errors.join("\n  ") : "none");
  if (errors.length) process.exitCode = 1;
  console.log(process.exitCode ? "SMOKE TEST: FAILURES" : "SMOKE TEST: ALL PASSED");
  process.exit(process.exitCode || 0); // jsdom timers keep the loop alive otherwise
})();
