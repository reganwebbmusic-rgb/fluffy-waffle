#!/usr/bin/env node
// Patch build-packs.js: top up each pack's song list with more candidates.
"use strict";
const fs = require("fs");
const path = require("path");
const f = path.join(__dirname, "build-packs.js");
let s = fs.readFileSync(f, "utf8");

const weddingAdd = [
  ["I'm Yours", "Jason Mraz"], ["Just the Way You Are", "Bruno Mars"], ["What a Wonderful World", "Louis Armstrong"],
  ["Over the Rainbow", "Israel Kamakawiwo'ole"], ["Photograph", "Ed Sheeran"], ["Galway Girl", "Ed Sheeran"],
  ["Say You Won't Let Go", "James Arthur"], ["Shallow", "Lady Gaga"], ["Someone Like You", "Adele"],
  ["Budapest", "George Ezra"], ["Count on Me", "Bruno Mars"], ["Rolling in the Deep", "Adele"]
].map((x) => JSON.stringify(x)).join(",\n      ");

const partyAdd = [
  ["Hotline Bling", "Drake"], ["One Dance", "Drake"], ["God's Plan", "Drake"],
  ["Don't Start Now", "Dua Lipa"], ["Physical", "Dua Lipa"], ["Cold Heart", "Elton John"],
  ["The Middle", "Zedd"], ["Closer", "The Chainsmokers"], ["Roar", "Katy Perry"],
  ["Firework", "Katy Perry"], ["Dynamite", "BTS"], ["Butter", "BTS"], ["DDU-DU DDU-DU", "BLACKPINK"]
].map((x) => JSON.stringify(x)).join(",\n      ");

const countryAdd = [
  ["Rain Is a Good Thing", "Luke Bryan"], ["Kick the Dust Up", "Luke Bryan"], ["Crash My Party", "Luke Bryan"],
  ["Drink a Beer", "Luke Bryan"], ["Smoke a Little Smoke", "Eric Church"], ["Like a Wrecking Ball", "Eric Church"],
  ["Talladega", "Eric Church"], ["Record Year", "Eric Church"], ["Beachin'", "Jake Owen"],
  ["Day Drinking", "Little Big Town"], ["Girl Crush", "Little Big Town"], ["Tornado", "Little Big Town"],
  ["Something Like That", "Tim McGraw"], ["Just to See You Smile", "Tim McGraw"], ["Shotgun Rider", "Tim McGraw"],
  ["All My Ex's Live in Texas", "George Strait"], ["The Fireman", "George Strait"], ["Livin' on Love", "Alan Jackson"],
  ["Gone Country", "Alan Jackson"], ["Mud on the Tires", "Brad Paisley"], ["Ticks", "Brad Paisley"],
  ["She's Everything", "Brad Paisley"], ["Blown Away", "Carrie Underwood"], ["Good Girl", "Carrie Underwood"],
  ["Mama's Broken Heart", "Miranda Lambert"], ["White Liar", "Miranda Lambert"], ["Automatic", "Miranda Lambert"],
  ["5-1-5-0", "Dierks Bentley"], ["Am I the Only One", "Dierks Bentley"], ["Riser", "Dierks Bentley"],
  ["H.O.L.Y.", "Florida Georgia Line"], ["Sippin' on Fire", "Florida Georgia Line"],
  ["Goodbye in Her Eyes", "Zac Brown Band"], ["Jump Right In", "Zac Brown Band"], ["Castaway", "Zac Brown Band"],
  ["On the Road Again", "Willie Nelson"], ["Don't Take the Girl", "Tim McGraw"], ["The Devil Went Down to Georgia", "Charlie Daniels Band"],
  ["Fishin' in the Dark", "Nitty Gritty Dirt Band"], ["Guitars, Cadillacs", "Dwight Yoakam"], ["I'm Gonna Miss Her", "Brad Paisley"],
  ["Alcohol", "Brad Paisley"], ["Two Black Cadillacs", "Carrie Underwood"], ["Undo It", "Carrie Underwood"],
  ["Last Name", "Carrie Underwood"], ["Mammas Don't Let Your Babies Grow Up to Be Cowboys", "Willie Nelson"]
].map((x) => JSON.stringify(x)).join(",\n      ");

// --- wedding: insert before the closing "]" of the wedding list ---
// the wedding list currently ends with ["Gangnam Style (강남스타일)", "PSY"]
let m = s.indexOf('"Gangnam Style (강남스타일)", "PSY"]');
if (m < 0) { console.error("wedding anchor not found"); process.exit(1); }
let endOfRow = s.indexOf("\n", m);
s = s.slice(0, endOfRow) + ",\n      " + weddingAdd + s.slice(endOfRow);

// --- party: insert before the closing "]" after "DJ Got Us Fallin' in Love" ---
m = s.indexOf('"DJ Got Us Fallin\' in Love", "Usher"]');
if (m < 0) { console.error("party anchor not found"); process.exit(1); }
endOfRow = s.indexOf("\n", m);
s = s.slice(0, endOfRow) + ",\n      " + partyAdd + s.slice(endOfRow);

// --- country: insert before the closing "]" after "Online" ---
m = s.indexOf('"Online", "Brad Paisley"]');
if (m < 0) { console.error("country anchor not found"); process.exit(1); }
endOfRow = s.indexOf("\n", m);
s = s.slice(0, endOfRow) + ",\n      " + countryAdd + s.slice(endOfRow);

fs.writeFileSync(f, s, "utf8");
console.log("patched OK");
