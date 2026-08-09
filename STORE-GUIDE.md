# App Store Guide — Setlist Builder on iOS & Android

Yes, the app can go on the Apple App Store and Google Play. It's a real but
bounded job: wrap the web app with **Capacitor** (free, industry standard),
build it in Xcode / Android Studio, and submit. This guide has everything.

---

## 1. The honest picture

| | Apple App Store | Google Play |
|---|---|---|
| Developer account | $99 / year | $25 one-time |
| Build tool | Xcode (macOS only) | Android Studio (Windows/Mac/Linux) |
| A Mac required | Yes | No |
| Review time | ~1–2 days typical, up to a week | usually hours–1 day |
| Extra asks | Privacy policy URL, app screenshots | Content rating questionnaire |

You also need the app **hosted on Netlify first** (see DEPLOY-GUIDE.md) — the
native app talks to your live functions for requests and UG search.

**What I cannot do for you:** create Apple/Google accounts, pay fees, sign
certificates, or click through Xcode/Android Studio — those need your identity
and a computer. Everything I *can* prepare is done: the Capacitor scaffold
(`capacitor/` folder) and this guide.

---

## 2. Prepare once (any computer)

```bash
# in the capacitor/ folder
npm install
```

Then copy the app's web files into `capacitor/www/`:

```
capacitor/www/
├── setlist-builder.html
├── requests.html            (optional — the audience page can stay on Netlify)
├── manifest.webmanifest
├── sw.js
├── icon.svg
└── apple-touch-icon.png
```

In `capacitor/www/setlist-builder.html`, set the two constants near the top of
the script:

```js
var REQUESTS_PAGE_URL = "https://YOURSITE.netlify.app/requests.html";
var API_BASE = "https://YOURSITE.netlify.app";   // native app: absolute URL
```

`API_BASE` is what makes requests/search work from inside the native app.

---

## 3. iOS — Apple App Store

Prereqs: a Mac, Xcode (free from the App Store), Apple Developer account ($99/yr).

```bash
cd capacitor
npx cap add ios          # creates the Xcode project once
npx cap sync             # copies www/ into the project
npx cap open ios         # opens Xcode
```

In Xcode:
1. **Signing & Capabilities** → select your Apple team (Sign in to your account).
2. Set **Bundle Identifier** to your `appId` (e.g. `com.yourname.setlistbuilder`).
3. Set app icon/name under **App Icon** / **Display Name** (use icon.svg → export
   a 1024×1024 PNG).
4. Device: **Any iOS Device** → **Product → Archive**.
5. Organizer → **Distribute App → App Store Connect**.

Then:
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps →
   + → New App** (bundle ID must match).
2. Fill the store listing: name, description, screenshots, category (Music),
   **Privacy Policy URL** (a simple page — you can put a privacy text on your
   Netlify site, e.g. `privacy.html`).
3. Upload the archive (Xcode does this during Distribute), submit for review.

**Apple review tips:**
- The app works offline — good. They may still test the online features; make
  sure requests + UG search work when hosted.
- Don't claim content you don't own: the description should say chord charts
  are for personal performance use, linked from Ultimate Guitar.
- First submission can take a few days; minor rejections (missing privacy URL)
  are common and fixable.

---

## 4. Android — Google Play

Prereqs: Android Studio (free), Google Play Developer account ($25 one-time).

```bash
cd capacitor
npx cap add android      # creates the Android project once
npx cap sync
npx cap open android     # opens Android Studio
```

In Android Studio:
1. **Build → Generate Signed Bundle/APK** → **Android App Bundle (AAB)**.
2. Create a keystore (you'll be prompted) — **keep the keystore file safe**;
   you need it for every future update.
3. Set the app icon in `android/app/src/main/res/` (use your 512×512 PNG as
   `ic_launcher`).

Then:
1. [play.google.com/console](https://play.google.com/console) → **Create app**.
2. Fill the listing, upload the AAB in **Production → Release**.
3. Complete the content rating questionnaire (Music category → mostly "No").
4. Submit. Play usually approves within a day.

---

## 5. After release

- Every app update = change the version number, rebuild, re-upload.
- The web app stays the source of truth: edit `setlist-builder.html`, redeploy
  to Netlify for web users, and re-bundle (`npx cap sync`) for store users.
- Store users get updates from the stores; web/PWA users get them instantly.

---

## 6. Cheaper alternative first

Before paying for the stores, use the **PWA route** (already built): open the
hosted app on your phone → **Add to Home Screen**. It runs fullscreen, offline,
and updates automatically — zero fees, zero review. It's what most solo gigging
musicians actually use. Stores are worth it when you want wider reach or
Apple/Google branding trust.

---

## 7. Checklist before you start

- [ ] App deployed to Netlify (DEPLOY-GUIDE.md done)
- [ ] `REQUESTS_PAGE_URL` and `API_BASE` set to your real URL
- [ ] Apple Developer ($99) and/or Google Play ($25) account
- [ ] Mac + Xcode (iOS only)
- [ ] Privacy policy page hosted (Apple)
- [ ] capacitor/ scaffold + www/ copy ready
