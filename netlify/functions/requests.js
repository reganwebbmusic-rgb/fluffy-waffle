// Netlify Function: live audience song requests (store: Netlify Blobs).
// GET  /.netlify/functions/requests        -> list of requests (JSON array)
// POST /.netlify/functions/requests        -> add { song, artist, note }
const { getStore } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  try {
    const store = getStore({ name: "requests" });
    const jsonHeaders = { ...cors, "Content-Type": "application/json" };

    if (event.httpMethod === "GET") {
      const raw = await store.get("requests");
      return { statusCode: 200, headers: jsonHeaders, body: raw || "[]" };
    }

    if (event.httpMethod === "POST") {
      let body = {};
      try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
      const song = String(body.song || "").trim().slice(0, 80);
      const artist = String(body.artist || "").trim().slice(0, 80);
      const note = String(body.note || "").trim().slice(0, 200);
      if (!song) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "song required" }) };
      const raw = await store.get("requests");
      const list = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      list.push({
        id: now + "-" + Math.random().toString(36).slice(2, 7),
        song: song,
        artist: artist,
        note: note,
        ts: now
      });
      const trimmed = list.slice(-100);
      await store.set("requests", JSON.stringify(trimmed));
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(trimmed) };
    }

    return { statusCode: 405, headers: cors, body: "method not allowed" };
  } catch (e) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
