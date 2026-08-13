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
  upNext: [], gigCheck: { items: [] }, dark: false,
  setLib: [{ name: "Gig Set", songs: ["Livin' On A Prayer", "Wonderwall"] }]
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

  // Sets tab: opens the sidebar, picking Set A shows the songs
  clickTab("tabSets");
  await new Promise((r) => setTimeout(r, 400));
  const drawer = doc.querySelector(".drawer");
  check("sets tap opens sidebar", !!drawer && drawer.textContent.includes("Set A") && drawer.textContent.includes("Set library"));
  const setAItem = drawer && [...drawer.querySelectorAll("button")].find((b) => b.textContent.indexOf("Set A") === 0);
  if (setAItem) setAItem.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const listText2 = doc.getElementById("list").textContent;
  check("picking Set A shows the songs", listText2.includes("Set A") && listText2.includes("Livin' On A Prayer"));
  // saved sets are viewable right in the sidebar
  clickTab("tabSets");
  await new Promise((r) => setTimeout(r, 400));
  const drawer2 = doc.querySelector(".drawer");
  check("saved sets listed in sidebar", !!drawer2 && drawer2.textContent.includes("Gig Set (2 songs)"));
  const gsItem = drawer2 && [...drawer2.querySelectorAll("button")].find((b) => b.textContent.indexOf("Gig Set") === 0);
  if (gsItem) gsItem.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const libModal2 = [...doc.querySelectorAll(".modal-bg")].filter((m) => m.style.display !== "none").pop();
  check("sidebar set opens its songs", !!libModal2 && libModal2.textContent.includes("Livin' On A Prayer"));
  doc.querySelectorAll(".modal-bg").forEach((m) => { m.style.display = "none"; });
  const songRow = [...doc.querySelectorAll(".card.slot .head")].find((d) => d.textContent && d.textContent.includes("Livin' On A Prayer"));
  if (songRow) songRow.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500)); // lyricbook chunk load
  const modal = doc.querySelector(".modal-bg");
  const sheetText = modal ? modal.textContent : "";
  check("song sheet opens from set slot", !!modal);
  check("sheet has lyrics", sheetText.includes("Tommy used to work on the docks"), "lyric text found");
  // tapping a nav tab closes the open sheet and navigates
  clickTab("tabRequests");
  await new Promise((r) => setTimeout(r, 400));
  const modalAfter = doc.querySelector(".modal-bg");
  check("nav tap closes the open sheet", !modalAfter || modalAfter.style.display === "none");
  check("nav tap navigates after closing", doc.getElementById("tabRequests").classList.contains("active"));
  // back to Sets for the next tests
  clickTab("tabSets");
  await new Promise((r) => setTimeout(r, 400));

  // Set library: view imported set -> tap a song -> lyrics sheet
  const libBtn = [...doc.querySelectorAll("button")].find((b) => b.textContent === "Set library");
  if (libBtn) libBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const libRow = [...doc.querySelectorAll("div")].find((d) => d.style && d.style.cursor === "pointer" && d.textContent.includes("Gig Set"));
  check("set library lists imported set", !!libRow);
  if (libRow) libRow.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const libModal = [...doc.querySelectorAll(".modal-bg")].filter((m) => m.style.display !== "none").pop();
  const libText = libModal ? libModal.textContent : "";
  check("set view opens with songs", libText.includes("Livin' On A Prayer") && libText.includes("Wonderwall"));
  const songInLib = libModal && [...libModal.querySelectorAll(".song-box")].find((d) => d.textContent.includes("Livin' On A Prayer"));
  if (songInLib) songInLib.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));
  const sheet2 = [...doc.querySelectorAll(".modal-bg")].filter((m) => m.style.display !== "none").pop();
  check("lyrics open from set view song", !!sheet2 && sheet2.textContent.includes("Tommy used to work on the docks"));
  doc.querySelectorAll(".modal-bg").forEach((m) => { m.style.display = "none"; });

  // Community sets: free British Pub pack section
  const setsTab = doc.getElementById("tabSets");
  if (setsTab) setsTab.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const commBtn = [...doc.querySelectorAll("button")].find((b) => b.textContent === "Community sets");
  if (commBtn) commBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900)); // pack load
  const commText = doc.getElementById("list").textContent;
  check("community sets shows free pub pack", commText.includes("British Pub Gig Pack — free for everyone") && commText.includes("Pub Night — Set A") && commText.includes("FREE"));
  check("pub pack sets all render", (commText.match(/Pub Night — Set /g) || []).length === 3);

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

  // Tools tab: install card + Get More Gigs course card present
  clickTab("tabTools");
  await new Promise((r) => setTimeout(r, 400));
  check("tools tab has install card", doc.getElementById("list").textContent.includes("Install this app"));
  check("tools tab has tuner", doc.getElementById("list").textContent.includes("Chromatic tuner"));
  const toolsText = doc.getElementById("list").textContent;
  check("Get More Gigs card present", toolsText.includes("Get More Gigs") && toolsText.includes("50 extra gigs"));

  // unlock the course with the dev code -> guide opens
  const haveBtn = [...doc.querySelectorAll("button")].find((b) => b.textContent === "I've paid / have a code" && b.style.marginLeft);
  if (haveBtn) haveBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const codeInp = [...doc.querySelectorAll("input")].find((i) => i.placeholder === "Or paste your code");
  if (codeInp) {
    codeInp.value = "GRATIS-GIGS-2026";
    // the gigs modal button lives inside .sheet (the Pro card's same-named button is in #list)
    const unlockBtn = [...doc.querySelectorAll("button")].find((b) => b.textContent === "Unlock with code" && b.parentElement && String(b.parentElement.className).includes("sheet"));
    if (unlockBtn) unlockBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 400));
  // close the unlock modal, re-render tools, open the guide
  doc.querySelectorAll(".modal-bg").forEach((m) => { m.style.display = "none"; });
  clickTab("tabSongs");
  await new Promise((r) => setTimeout(r, 200));
  clickTab("tabTools");
  await new Promise((r) => setTimeout(r, 400));
  const toolsText2 = doc.getElementById("list").textContent;
  check("course shows unlocked state", toolsText2.includes("Get More Gigs — unlocked"));
  const openGuide = [...doc.querySelectorAll("button")].find((b) => b.textContent === "Open the 9-step guide");
  if (openGuide) openGuide.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const guideText = [...doc.querySelectorAll(".modal-bg")].map((m) => m.textContent).join(" ");
  check("guide opens with 9 steps", guideText.includes("Step 1") && guideText.includes("Step 9"));
  check("guide has core advice", guideText.includes("Business cards") && guideText.includes("open mic"));
  doc.querySelectorAll(".modal-bg").forEach((m) => { m.style.display = "none"; });

  // Songs tab again (regression)
  clickTab("tabSongs");
  await new Promise((r) => setTimeout(r, 300));
  check("back to songs works", doc.getElementById("list").textContent.includes("Livin' On A Prayer"));

  // ---- Admin gating + invite link (owner session) ----
  const OWNER = "Vw7HD41oxoSCpPUDnl5i825QZ3K2";
  const authSeed = JSON.stringify({ uid: OWNER, email: "owner@toolgig.com", stage: "Owner", offline: false, exp: Date.now() + 3600000 });
  const dom2 = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://reganwebbmusic-rgb.github.io/fluffy-waffle/setlist-builder.html?invite=1",
    beforeParse(w2) {
      w2.localStorage.setItem("setlist-builder-v1", JSON.stringify(Object.assign({}, seed, { tab: "tools" })));
      w2.localStorage.setItem("sb2tutDone", "1");
      w2.localStorage.setItem("sb2auth", authSeed);
      w2.XMLHttpRequest = class {
        open(m, u) { this.url = u; }
        send() {
          const p = this.url.replace(/^\.\//, "").split("?")[0];
          const f = path.join(root, p);
          try { this.status = 200; this.responseText = fs.readFileSync(f, "utf8"); }
          catch (e) { this.status = 404; this.responseText = ""; }
          if (this.onload) this.onload();
        }
      };
      w2.fetch = () => Promise.reject(new Error("off"));
    }
  });
  const doc2 = dom2.window.document;
  const click2 = (el) => el.dispatchEvent(new dom2.window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));
  const tabAdmin = doc2.getElementById("tabAdmin");
  check("Admin tab visible for owner", tabAdmin && tabAdmin.style.display !== "none");
  // Tools invite card: link carries the owner uid
  const invInput = [...doc2.querySelectorAll("input")].find((i) => i.readOnly && i.value && i.value.indexOf("invite=1") >= 0);
  check("invite link carries referrer uid", !!invInput && invInput.value.indexOf("r=" + OWNER) >= 0, invInput && invInput.value.slice(0, 80));
  // Admin tab renders without crashing
  if (tabAdmin) click2(tabAdmin);
  await new Promise((r) => setTimeout(r, 500));
  const adminText = doc2.getElementById("list").textContent;
  check("admin tab renders", adminText.length > 0 && (adminText.includes("User stats") || adminText.includes("Couldn't load user data")));
  // non-owner: admin hidden
  const dom3 = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://reganwebbmusic-rgb.github.io/fluffy-waffle/setlist-builder.html",
    beforeParse(w3) {
      w3.localStorage.setItem("setlist-builder-v1", JSON.stringify(seed));
      w3.localStorage.setItem("sb2tutDone", "1");
      w3.localStorage.setItem("sb2auth", JSON.stringify({ uid: "someone-else", email: "x@x.com", stage: "X", offline: false, exp: Date.now() + 3600000 }));
      w3.XMLHttpRequest = class { open(m, u) { this.url = u; } send() { if (this.onload) this.onload(); } };
      w3.fetch = () => Promise.reject(new Error("off"));
    }
  });
  const doc3 = dom3.window.document;
  await new Promise((r) => setTimeout(r, 800));
  const tabAdmin3 = doc3.getElementById("tabAdmin");
  check("Admin tab hidden for non-owner", tabAdmin3 && tabAdmin3.style.display === "none");

  // ---- first-run UX: no saved state -> land on Sets, empty-state CTA, tab order ----
  const dom4 = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://reganwebbmusic-rgb.github.io/fluffy-waffle/setlist-builder.html",
    beforeParse(w4) {
      w4.localStorage.clear();
      w4.localStorage.setItem("sb2tutDone", "1"); // skip the tour modal so nav taps work
      w4.XMLHttpRequest = class { open(m, u) { this.url = u; } send() { if (this.onload) this.onload(); } };
      w4.fetch = () => Promise.reject(new Error("off"));
    }
  });
  const doc4 = dom4.window.document;
  await new Promise((r) => setTimeout(r, 800));
  const tabs4 = [...doc4.querySelectorAll(".tabs .tab")].map((b) => b.id);
  check("tab order: Sets and Requests first", tabs4[0] === "tabSets" && tabs4[1] === "tabRequests", tabs4.join(","));
  check("first-run lands on Sets tab", doc4.getElementById("tabSets").classList.contains("active"));
  const list4 = doc4.getElementById("list").textContent;
  check("Sets empty-state CTA shows", list4.includes("Your setlist is empty") && list4.includes("Add songs"));
  doc4.getElementById("tabRequests").dispatchEvent(new dom4.window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  check("Requests empty-state has QR button", !![...doc4.querySelectorAll("button")].find((b) => b.textContent === "Show request QR"));

  console.log("\nerrors captured:", errors.length ? errors.join("\n  ") : "none");
  if (errors.length) process.exitCode = 1;
  console.log(process.exitCode ? "SMOKE TEST: FAILURES" : "SMOKE TEST: ALL PASSED");
  process.exit(process.exitCode || 0); // jsdom timers keep the loop alive otherwise
})();
