// Netlify Function: search the full Ultimate Guitar library.
// Endpoint: /.netlify/functions/ug-search?q=wonderwall%20oasis
// Returns JSON: [{ title, artist, key, url }]
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function unescapeHtml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractResults(html) {
  const dec = unescapeHtml(html);
  const start = dec.indexOf('"results":');
  if (start < 0) return [];
  const arrStart = dec.indexOf("[", start);
  if (arrStart < 0) return [];
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = arrStart; i < dec.length; i++) {
    const ch = dec[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) return [];
  let arr;
  try {
    arr = JSON.parse(dec.slice(arrStart, end));
  } catch (e) {
    return [];
  }
  const out = [];
  const seen = {};
  for (const x of arr) {
    if (!x || typeof x.song_name !== "string" || !x.song_name) continue;
    const url = x.tab_url || x.url || "";
    if (!url.includes("ultimate-guitar.com/tab")) continue;
    const artist = x.artist_name || "";
    const key = (x.recording && x.recording.tonality_name) || x.tonality_name || "";
    const k = (x.song_name + "|" + artist).toLowerCase();
    if (seen[k]) continue;
    seen[k] = true;
    out.push({ title: x.song_name, artist: artist, key: key, url: url });
    if (out.length >= 8) break;
  }
  return out;
}

exports.handler = async function (event) {
  const q = ((event.queryStringParameters && event.queryStringParameters.q) || "").trim();
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (!q) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "missing q" }) };
  try {
    const url = "https://www.ultimate-guitar.com/search.php?search_type=title&order=my&value=" + encodeURIComponent(q);
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    const html = await res.text();
    return { statusCode: 200, headers: cors, body: JSON.stringify(extractResults(html)) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: String(e) }) };
  }
};

exports.extractResults = extractResults; // exported for unit testing
