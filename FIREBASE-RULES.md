# Firebase Realtime Database Rules — Setlist Builder

This app talks to Firebase in two ways:

1. **Audience request page** (`requests.html`) — posts to `/requests.json` with **no login** (audience members aren't signed in).
2. **The app** (`setlist-builder.html`) — signed-in musicians read/write their own `/users/<uid>/...` paths using their auth token.

The **Web API key is public** (it ships in the page) — it is not a secret. The
**rules are the real security boundary**. The defaults below keep the request
inbox open (that's required for the audience page) but lock every musician's
private data to themselves, and stop anonymous deletion of requests.

## How to apply

1. [Firebase Console](https://console.firebase.google.com) → your project → **Build → Realtime Database**.
2. **Rules** tab → paste the JSON below → **Publish**.

## Recommended rules

```json
{
  "rules": {
    // Public request inbox: anyone can READ (the app polls it) and CREATE a
    // new request (the audience isn't signed in), but only signed-in users
    // (you) can modify or delete existing entries.
    "requests": {
      ".read": true,
      ".write": false,
      "$requestId": {
        ".write": "auth != null || !data.exists()"
      }
    },

    // No shared songbook anymore (the app only writes per-user public.json).
    "songbook": {
      ".read": true,
      ".write": false
    },

    // Each musician's data is only readable/writable by themselves,
    // except their request inbox: the audience can CREATE new requests
    // (the request link carries ?m=<uid>), but only the musician can
    // edit or delete them.
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "requests": {
          ".write": "auth != null || !data.exists()"
        }
      }
    }
  }
}
```

> The `requests` rule above keeps **create** open (audience can post) but
> requires `auth` to **update/delete** existing request IDs — so a random
> visitor can't wipe your request list mid-gig. If you also want to stop
> spam, add a per-IP rate limit in the Netlify function (or require a
> per-gig code from the audience).

## Security notes

- **Do not** use "test mode" rules in production (they allow anyone to read
  and write everything, including `/users`).
- The `?auth=` token in request URLs is the standard Firebase REST pattern;
  it's only valid for ~1 hour and refreshes automatically.
- If you move request storage to the Netlify function (`REQUESTS_DB_URL = ""`),
  the `/requests` path rules above no longer apply — the function handles
  access (see `netlify/functions/requests.js`, which already trims input).
