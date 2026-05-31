# Security handoff → Antigravity (worker lane)

From: Claude Code (frontend lane). I can't edit `worker/**` per `STRATEGY.md`
ownership, so this is a writeup for you to action. One HIGH finding, flagged by
an automated security review of the merged backend.

---

## [HIGH] Unauthenticated admin endpoint leaks moderation queue + funnel stats

**File:** `worker/src/index.ts` (route at ~line 234)
**Route:** `GET /api/admin/stats`

### What's wrong
The route is reachable by anyone with no authentication. It returns:
- 7-day conversion funnel (`stats:started:*` / `stats:completed:*`), and
- the **full list of reported duel IDs with report counts** (it `list({ prefix: "reports:" })`s the whole KV namespace).

The reported-IDs list is effectively your moderation queue — leaking it lets
anyone enumerate every duel a user flagged, plus scrape your private growth
metrics. Made worse by the global `corsHeaders` with
`Access-Control-Allow-Origin: *` (line 6), so any web page can read it
cross-origin from a visitor's browser.

This is the only route that needs gating. `/api/save-duel`, `/api/vote`,
`/api/telemetry/start`, `/api/report` are intentionally public (the frontend
calls them anonymously) — leave those open.

### Fix (required): require an admin token
1. Add the secret + binding:
   ```bash
   cd worker
   npx wrangler secret put ADMIN_TOKEN
   ```
   ```ts
   // worker/src/index.ts
   export interface Env {
     DUELS_KV: KVNamespace;
     ADMIN_TOKEN: string; // <-- add
   }
   ```
2. Gate the handler with a constant-time compare, before any KV reads:
   ```ts
   if (path === "/api/admin/stats" && request.method === "GET") {
     const auth = request.headers.get("Authorization") || "";
     const expected = `Bearer ${env.ADMIN_TOKEN}`;
     let diff = auth.length ^ expected.length;
     for (let i = 0; i < auth.length && i < expected.length; i++) {
       diff |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
     }
     if (diff !== 0) return jsonResponse({ error: "Unauthorized" }, 401);
     // ... existing stats logic ...
   }
   ```
   Apply the same gate to any other `/api/admin/*` routes (the "admin dashboard"
   from commit `ae09375`) if more exist.

### Fix (secondary, defense-in-depth): don't send `*` CORS on admin
Token auth is the real protection (it covers non-browser clients too). But also
avoid returning `Access-Control-Allow-Origin: *` for the admin route so it can't
be probed cross-origin from a browser — return it without the wildcard CORS
headers, or restrict to a trusted origin.

### Worth considering (not blocking)
- Rate-limit `/api/report` (currently anyone can inflate a duel's report count
  with repeat POSTs — consider per-IP/day dedupe in KV).

---

*Once addressed, this file can be deleted. Frontend (`app/**`) is unaffected — no
frontend code calls `/api/admin/stats`.*
