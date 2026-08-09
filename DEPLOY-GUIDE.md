# Deploy Guide — Setlist Builder App (Netlify)

Getting your app live: a permanent `https://yoursite.netlify.app` link, live audience
requests, full Ultimate Guitar search, and installable-as-an-app experience.

**Time:** ~15 minutes · **Cost:** free (Netlify free tier)

---

## 1. What you're deploying

These files (all in your project folder — keep the structure exactly as shown):

```
your-folder/
├── setlist-builder.html      <- the app (main)
├── requests.html             <- audience request page
├── manifest.webmanifest      <- app install manifest
├── sw.js                     <- offline service worker
├── icon.svg                  <- app icon
├── apple-touch-icon.png      <- iOS icon
├── firebase-config.js        <- your Firebase Web API key (see "v2 setup" below)
├── extra-songs.json          <- optional: extra catalog songs (JSON array of [title, artist, key, bpm] rows, merged automatically at load; duplicates skipped)
├── netlify.toml              <- tells Netlify where the functions are
├── package.json              <- declares @netlify/blobs dependency
└── netlify/
    └── functions/
        ├── ug-search.js      <- full Ultimate Guitar search
        └── requests.js       <- live request storage (Netlify Blobs)
```

> **Important:** Netlify Drop (drag-and-drop) does **NOT** run serverless functions.
> Use one of the two paths below. Both are free.

---

## 1b. v2 setup — enable musician accounts (optional but recommended)

Accounts, cloud sync and live requests need a Firebase project. The free
Spark plan is enough for a gigging musician.

1. [Firebase Console](https://console.firebase.google.com) → **Add project**
   (free) → **Build → Realtime Database** → **Create database** (start in
   test mode, then tighten rules — see `FIREBASE-RULES.md` in this repo).
2. **Build → Authentication → Sign-in method** → enable **Email/Password** →
   Save. (Without this, the app's sign-in/sign-up returns
   `CONFIGURATION_NOT_FOUND` and accounts won't work.)
3. **Project settings → General** → copy the **Web API key**.
4. Create `firebase-config.js` in your project folder (a template is included
   in the repo):
   ```js
   var FIREBASE_API_KEY = "YOUR_KEY_HERE";
   ```
5. In `setlist-builder.html`, set `REQUESTS_DB_URL` (near the top of the
   `<script>`) to your Firebase URL, e.g.
   `https://yourproject-default-rtdb.firebaseio.com`.
6. Deploy. No key = the app still works, but offline-only (accounts, cloud
   sync and live requests are disabled).

---

## 1c. Pro sales — free vs paid (£10 one-time)

The app has a built-in free/pro split (Free: 30-song pool; Pro: 300-song pool +
gig archive). Buyers pay once, you approve, the code is delivered to their app.

1. **Stripe** → **Payment links** → **Create payment link** → amount **£10**
   (one-time) → copy the link.
2. In `setlist-builder.html`, set:
   ```js
   var PRO_LINK = "https://buy.stripe.com/YOUR_LINK"; // the £10 payment link
   var SELLER_UID = "your-uid";                       // from your request link (?m=...)
   ```
3. Re-publish the Firebase rules (`FIREBASE-RULES.md`) — the `orders` node is new.
4. **Buyers**: pay on the link → open the app → Tools → Setlist Pro → enter the
   email they paid with → "I've paid — get my code".
5. **You**: Tools → Setlist Pro → check the payment arrived in Stripe for that
   email → tap **Approve** → the code is delivered to their app automatically
   (you can also copy it to email them if they're not in-app).

Notes: the code is stored on the buyer's device (works offline). Any client-side
unlock can be cracked by a determined user — fine for a £10 musician tool.

---

## 2. Choose a path

| Path | Tools needed | Best if… |
|------|-------------|----------|
| **A. GitHub → Netlify** | GitHub account, browser only | You don't have coding tools installed |
| **B. Netlify CLI** | Node.js on a computer | You're comfortable with a terminal |

---

## Path A — GitHub → Netlify (no local tools)

### A1. Create the repository
1. Go to [github.com](https://github.com) → sign in (free account).
2. **New repository** → name it `setlist-app` → **Public** (free) → **Create repository**.
3. In the empty repo, click **"uploading an existing file"**.
4. Drag the files from section 1 into the browser (you can upload them all at once;
   keep `netlify/` as a subfolder — create it first by uploading `netlify/functions/…`
   paths, or via **Add file → Create new file** typing `netlify/functions/requests.js`
   as the filename, then paste the code).
5. **Commit changes.**

### A2. Connect Netlify
1. Go to [app.netlify.com](https://app.netlify.com) → sign in (free, or continue with GitHub).
2. **Add new site → Import an existing project → GitHub**.
3. Pick the `setlist-app` repo.
4. Netlify auto-detects `netlify.toml` — **build command: leave empty**, **publish directory: `.`**.
5. **Deploy.** It takes ~1 minute; Netlify installs `@netlify/blobs` from `package.json`
   and deploys the two functions automatically.

You'll see: `https://<random-name>.netlify.app`

### A3. Nice site name (optional)
Netlify → **Site configuration → Change site name** → e.g. `mygigsetlists`
→ URL becomes `https://mygigsetlists.netlify.app`.

---

## Path B — Netlify CLI (terminal)

```bash
# 1. install the CLI (once)
npm install -g netlify-cli

# 2. go into your project folder
cd your-folder

# 3. log in (opens browser)
netlify login

# 4. create/link a Netlify site
netlify init

# 5. deploy
netlify deploy --prod
```

The CLI reads `netlify.toml` (functions directory) and `package.json` (blobs
dependency) automatically. Your URL is printed at the end.

---

## 3. After deploy — make the QR page work

1. Open the app at your new URL, or edit locally: in `setlist-builder.html`, find
   near the top of the `<script>`:

   ```js
   var REQUESTS_PAGE_URL = "https://YOURSITE.netlify.app/requests.html";
   ```

2. Replace `YOURSITE.netlify.app` with your real site name, e.g.:

   ```js
   var REQUESTS_PAGE_URL = "https://mygigsetlists.netlify.app/requests.html";
   ```

3. Re-deploy the updated file (Path A: re-upload/replace it in GitHub → Netlify
   auto-redeploys; Path B: `netlify deploy --prod` again).

---

## 4. Test everything

1. Open `https://yoursite.netlify.app/requests.html` on your phone → submit a song.
2. Open the app → **Requests** tab → the request appears within ~5 seconds with a
   fit badge (High = regularly on your sets, Med, Low).
3. **Requests → QR code** → the QR points to your request page. Show it on stage.
4. App → **Pool → Search Ultimate Guitar** → try a song not in the 600-song catalog.
5. Install: Chrome → **Add to Home Screen** (or **Install app** prompt);
   Safari → **Share → Add to Home Screen**. It now opens fullscreen and works offline.

---

## 5. Troubleshooting

| Problem | Fix |
|---------|-----|
| Requests tab says "Can't reach the request server" | You deployed via Netlify Drop — must use Path A or B. Check Netlify → Functions → both functions listed; if missing, redeploy with the folder structure intact. |
| Function errors in Netlify logs | Ensure `package.json` is in the repo root (declares `@netlify/blobs`). |
| QR image doesn't show | QR needs internet at the gig (uses api.qrserver.com). |
| App is an old version on the phone | Re-add to Home Screen after deploy (or clear site data once). |
| Requests from last gig still show | Netlify dashboard → **Blobs** → delete the `requests` store. |
| Want to reset setlists/songs | App → footer → **Start fresh** (device-local only). |

---

## 6. Reminders

- Your pool/setlists live in the **app on your phone** (localStorage) — they never
  leave the device and survive redeploys.
- Requests data lives in **Netlify Blobs** (free tier) — shared with the audience page.
- Chord sheets are embedded in the app file — they work fully offline.
