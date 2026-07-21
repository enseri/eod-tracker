# VIP Implementation Tracker — Project Log

A running record of client prompts and the changes made in response. **Updated after each meaningful batch of work** (new features, bug fixes, deploys).

---

## Phase 1 — Product Definition & EOD Tracker Core

### Prompt
Summarize the offer ladder for a financial astrology / implementation coaching business mapped to Whop, then build an **End of Day (EOD) implementation tracker** for the VIP Implementation Club.

### Requirements Captured
- EOD form: date, action + completion count, KPI + count, reflection, sales, income, publish-to-channel with privacy toggles
- History tab with all days; missed days grayed out
- Same-day resubmission replaces existing entry
- EOD reflection must not wrap in history view

### Changes Made
- Built interactive EOD tracker with form + history tabs
- Initial persistence via sandbox storage; later migrated to **localStorage** for standalone browser use

---

## Phase 2 — Options, Settings & UX Refinements

### Prompts
- Style dropdowns better; show “add option” when no actions/KPIs exist; allow renaming action/KPI options without changing past history labels
- Fix non-working dropdowns
- Add **Create** button next to new action/KPI name fields
- Hide dropdown when no options; show input + create only until first option exists
- Add **visit-based streak** (not consecutive EOD submissions)
- Fix layout shift between tabs; add **settings** for 1–3 action/KPI pairs
- Fix save failures on submission

### Changes Made
- Card-based layout with explicit render-driven dropdown visibility
- Create button commits options immediately
- Separate `eod_visits` log for streak counting
- Fixed-height tab container (720px) to prevent layout jump
- Settings panel: 1–3 action/KPI pairs
- Rebuilt pair logic to fix save bug caused by `display` style checks on hidden selects

---

## Phase 3 — Multi-Outcome & Income Streams

### Prompts
- Label pairs as “Today's 1st/2nd/3rd action” (or “Today's 1 action” when only one)
- Settings copy: “for tracking multiple outcomes”
- Income streams: 1–3 configurable in settings; side-by-side on form; all streams deletable; default name “Sales and income”
- Settings is source of truth for stream count; form mirrors settings
- Style income stream settings rows like action/KPI cards

### Changes Made
- Dynamic pair labels and settings copy
- Income streams managed entirely in settings (0–3)
- Form layout: full-width (1 stream), half (2), third (3)
- Card-styled income stream settings rows

---

## Phase 4 — Standalone Artifact & Visual Polish

### Prompts
- Fix saving for real publishable file
- Fix broken icons (squares) — use inline SVGs, no CDN fonts blocking local files
- Restore pre-artifact styling; clear form on submit
- Fix dollar icon; edit modal for rename + daily targets linked to each option
- Move targets into edit modal (not on daily form)
- Style to match implementation-precall-checklist (dark purple/navy, gold accents, Inter font)

### Changes Made
- Single self-contained `eod-tracker.html` with localStorage
- All icons as inline SVGs
- Form clears on successful submit
- Edit modal: rename options + set per-option daily targets; goal hints on form; history shows actual/target
- Full dark purple + gold theme matching reference site

---

## Phase 5 — Whop Deployment

### Prompts
- Recreate site for embedding in Whop
- Step-by-step setup from fresh Whop account
- Deploy end-to-end with minimal manual steps

### Changes Made
- Iframe-friendly layout; experience path rewrite `/experiences/[experienceId]`
- Deployed to Vercel (`eod-tracker-ecru.vercel.app`)
- `vercel.json`, `deploy.ps1`, lowercase project name fix (`eod-tracker`)
- Whop hosting instructions: Base URL + experience path

---

## Phase 6 — Basic vs Pro Tiers

### Prompt
Split app into **Basic** and **Pro**:
- **Basic:** no income/sales tracking; single action/KPI only
- **Pro:** sales/income + multiple action/KPI pairs in settings

### Changes Made
- Tier badge on member app
- Basic: locks pair count to 1, hides income streams and related settings
- Pro: full feature set
- Tier resolved via URL param (dev), Whop plan IDs (env), or admin Pro list

---

## Phase 7 — Admin Panel

### Prompt
Start admin panel for business admins to track student/user progress.

### Changes Made
- `admin.html` — stats, member table, filters, member detail with EOD history
- API routes: `/api/me`, `/api/entries`, `/api/admin/users`, `/api/admin/user`
- Server sync on EOD submit; analytics: streaks, missed days, income totals
- Dashboard path: `/dashboard/[companyId]` → admin
- Dev access: `?admin=1`

---

## Phase 8 — Admin Tier Control

### Prompt
Set members to Pro or Basic in admin panel; Pro users added to server-side Pro list.

### Changes Made
- Membership tier dropdown + Save in member detail panel
- `proUserIds` array in server store
- Admin override takes priority over Whop plan mapping
- `adminTier` field blocks unwanted auto-upgrades

---

## Phase 9 — Admin Sync, History UX & Project Log

### Prompts
- Test submissions not appearing in admin panel
- History tab boring; text overlapping; cannot read full reflection
- Summarize whole chat (prompts + changes) professionally for ongoing reference

### Changes Made
- **Admin sync fixes (initial):** unique anonymous user ID per browser; full state sync on load; bulk entry sync API; Redis/Blob/file storage layers (Redis or Blob required on Vercel for persistence)
- **History redesign:** card-based daily entries with metric tiles; missed days styled distinctly; reflection preview with “Read full reflection” modal
- **This document:** `PROJECT_LOG.md` for ongoing project tracking

---

## Phase 10 — Production Storage & Admin Data Sync (Critical Fix)

### Prompt
Submissions via Whop and direct project URL still not appearing in admin panel.

### Root Causes Found
1. **Blob writes failing silently** — Vercel Blob store is **private**, but code used `access: 'public'` on `put()` / `get()`
2. **POST bodies not parsed on Vercel** — `req.body` often empty in serverless handlers; entries returned `ok: true` but were never saved
3. **Shared `dev_user` ID** — direct-URL visitors synced under one default ID before local anonymous ID was resolved

### Changes Made
- **`lib/parse-body.js`** — robust JSON body parsing for all POST/PATCH API handlers
- **`lib/store.js`** — Blob read via `get()` by pathname; writes use `access: 'private'`; failed blob writes throw instead of silently falling back to memory; `getUserRecord({ createIfMissing })` option; upgraded `@vercel/blob` to `^2.5.0` for OIDC (`BLOB_STORE_ID`)
- **`api/entries.js`** — parse body before save; return `entryCount` + `userId` in response; bulk `entries` sync on submit
- **`api/admin/user.js`** — parse body on PATCH; 404 when member not in store (no auto-create on read)
- **`api/storage-status.js`** — `userCount`, `blobWriteOk`, `blobWriteError` for production debugging
- **`eod-tracker.html`** — resolve local `userId` before `/api/me`; Whop JWT ID overrides when embedded; submit sends full `entries` object; save status shows synced day count

### Verified
- Blob health check: `blobWriteOk: true`
- Admin `/api/admin/users` returns members after first synced submission

---

## Phase 11 — Missed-Day Logic & Admin History Polish

### Prompts
- “Missed” jumped to 6 after a single EOD entry — is that intended?
- Admin panel EOD history bland; reflection difficult to read (same issue member history had earlier)

### Changes Made
- **`lib/analytics.js` — `countMissedDays`:** only counts missed days from when the member **started tracking** (earliest entry or visit date) within the 7-day window — not all 7 calendar days before their first submission. Example: one entry today → 0 missed; one entry yesterday only → 1 missed (today)
- **`admin.html` — history redesign:** replaced cramped table with same card layout as member app — metric tiles for all action/KPI pairs, Pro income streams, reflection preview + “Read full reflection” modal, privacy respect for hidden publish fields

---

## Phase 12 — Deck-of-Cards History UI

### Prompt
Stack history like a deck of cards: only date on hover, full card on click, newest on top and oldest on bottom.

### Changes Made
- **Member (`eod-tracker.html`) and admin (`admin.html`):**
  - Cards overlap in a vertical stack (`--deck-peek` / `--deck-collapsed-h`); newest card on top via `--stack-i` z-index
  - **Collapsed:** thin visible strip per card; date hidden until hover (lift + shadow on hover)
  - **Click:** expands full card (metrics, income, reflection); click again or open another card to collapse
  - Hint line: “Hover a card for the date · Click to open”
  - Touch devices (`hover: none`): dates shown at reduced opacity since hover unavailable
  - **`bindHistoryDeck()`** — click toggle + reflection button stops propagation
- **Follow-up:** uppermost (newest) card **expanded by default** on load

---

## Phase 13 — Admin Delete & Pro Progress Tab

### Prompts
- Admin panel should be able to delete member data
- Add a 3rd tab for Pro members with graphs showing progress

### Changes Made
- **`lib/store.js` — `deleteUser()`:** removes member from `store.users` and `proUserIds`, persists to Blob
- **`api/admin/user.js` — `DELETE`:** admin-only endpoint; accepts `userId` via query or body
- **`admin.html`:** “Danger zone” with double-confirm **Delete all member data** button; refreshes member list after delete
- **`eod-tracker.html` — Progress tab (Pro only):** third tab with SVG line charts for actions, KPIs, and income/sales

---

## Phase 14 — Progress Charts: Projections & Confidence (Experimental)

### Prompts
- Graphs should show projections with clear trend lines
- Use pure statistics (tracking span, OLS regression) — no arbitrary damping
- Account for weak days; add confidence %; projections only after 5 entries
- Fix haywire charts when sparse data (e.g. KPI 1 → 10)

### Changes Made (later revised in Phase 15)
- Y-axis grid with labeled tick marks; hover tooltips on data points
- OLS linear / log-linear regression; model picked by adjusted R²
- Confidence % badge from sample size, fit quality, forecast error, spikes, weak-day count
- 5-entry minimum before projection curve shown
- Exponential model gated on 5+ positive points and plausible daily growth factor

---

## Phase 15 — Progress Charts: Actuals Only

### Prompt
Remove confidence labels, projections, and the long intro paragraph on the Progress tab.

### Changes Made
- **Removed:** dashed projection curves, projected hover points, confidence % badges, statistical intro copy
- **Kept:** gold actual line, purple daily target line, Y-axis ticks, hover tooltips, per-metric 2-entry minimum
- Deleted unused projection/regression helpers from `eod-tracker.html`

---

## Phase 16 — Progress Metric Dropdowns (Action & KPI)

### Prompt
Graphs only showed the first action/KPI pair; add dropdowns to swap options; minimum 2 entries.

### Changes Made
- **Action** and **KPI** cards each have a header dropdown
- Options collected from all EOD history **and** saved settings options
- Series matched **by action/KPI name** across any pair slot (not by pair index)
- Default selection: option with the most logged days
- Chart requires **2+ days** with that name selected

---

## Phase 17 — Income Stream Dropdown & View All

### Prompt
Income stream graphs should use the same dropdown pattern — select a stream or **View all** (total income + sales per day).

### Changes Made
- Replaced separate per-stream chart cards with one **Income streams** card
- Dropdown: **View all** (default) + each stream name from history and Pro settings
- **View all:** sums income and sales across all streams for each day
- Single stream: that stream’s income and sales only
- Two charts in one card: **Daily income** ($) and **Daily sales** (count); both update when dropdown changes

---

## Phase 18 — Background Scroll Seam Fix

### Prompt
Member dashboard scrolls past the background; gradient loops with a visible divide.

### Root Cause
`html { height: 100% }` locked to viewport while content grew taller; body gradient painted over full scroll height caused a seam/repeat effect.

### Changes Made
- **`eod-tracker.html` and `admin.html`:** fixed `html::before` layer with purple radial gradients pinned to viewport (`position: fixed; inset: 0; z-index: -1`)
- Solid `background-color: var(--bg)` on `html`; transparent `body` — seamless background while scrolling long History/Progress content

---

## Phase 19 — Admin Delete Fix, Responsiveness & Post-Update Checklist

### Prompts
- Deleting selected users doesn’t work; admin should update more responsively
- Remove “Updated: …” timestamp; add back multi-select near member rows
- Create a reusable post-update document; always increment version and update `PROJECT_LOG.md`

### Changes Made
- **`lib/store.js`:** stopped re-merging legacy per-company blobs on every read (deleted users were reappearing); `deleteUser()` verifies removal after write
- **`api/admin/users.js`:** bulk delete via `POST { action: 'delete', userIds }` (reliable on Vercel); `DELETE` also accepts `?userIds=a,b`
- **`admin.html`:** per-row delete + checkbox multi-select in table; bulk bar above table (visible when rows selected); 6s auto-refresh; removed “Updated” timestamp
- **`POST_UPDATE_CHECKLIST.md`:** step-by-step checklist after every update (version bump, `PROJECT_LOG.md`, deploy, verify)

### Verified
- Deployed to production (`eod-tracker-ecru.vercel.app`)

---

## Phase 20 — Delete Verify / Blob Cache Fix

### Prompt
Got “Store verify failed after write” when deleting users in admin.

### Root Cause
Post-delete verification re-read Blob immediately after write, but Blob responses were cached (`cacheControlMaxAge: 60`), so the read still contained deleted users and verification failed.

### Changes Made
- **`lib/store.js`:** Blob writes use `cacheControlMaxAge: 0`; reads always use `Cache-Control: no-cache`
- **`deleteUser()`:** no longer fails on stale post-write reads; trusts successful persist + in-memory merged state
- **`mutateStore()`:** verify step tolerates stale remote reads when local merged state is correct

### Verified
- Deployed to production

---

## Phase 21 — Batch Bulk Delete & Test Data Seeding

### Prompt
Bulk “delete selected” only removed one member and was slow. Need a seed script with months of realistic EOD data (goals, multiple pairs, income streams).

### Root Cause
`deleteMany` called `deleteUser` in a loop — each delete was a separate Blob read/write. Stale reads between passes could resurrect users, so only one deletion appeared to stick.

### Changes Made
- **`lib/store.js` — `deleteUsers()`:** deletes all IDs in a single `mutateStore` (one read + one write)
- **`api/admin/users.js`:** uses `deleteUsers` for bulk delete
- **`admin.html`:** bulk delete button shows “Deleting…” while in flight
- **`lib/seed-test-data.js`**, **`lib/seed-test-apply.js`**, **`api/admin/seed.js`:** 5 named test members + bulk-test users; ~3 months EOD history with targets, 1–3 pairs, income streams
- **`scripts/seed-test-users.js`:** `npm run seed` (local) or `--api` for production
- **`scripts/test-bulk-delete.js`:** `npm run test:bulk-delete` / `test:bulk-delete:api`

### Verified
- Local bulk delete test passes (3 users, single operation)
- Production API bulk delete test after deploy

---

## Phase 22 — Deleted User Dashboard Crash

### Prompt
`Cannot read properties of undefined (reading 'adminTier')` on user dashboard after admin deletes the member.

### Root Cause
After deletion, `/api/me` recreated the user via `getUserRecord`, then re-read Blob for the record. Stale cache could return `undefined`, and `record.adminTier` threw.

### Changes Made
- **`lib/store.js`:** `getUserRecord` uses `updateUser` return value instead of a follow-up read; `updateUser` falls back to merged default user; export `defaultUser`
- **`api/me.js`:** guard with `defaultUser()` if record is still missing
- **`api/entries.js`:** optional chaining on `existing?.adminTier`

### Verified
- Deployed to production

---

## Phase 23 — Whop Username Display

### Prompt
Admin member list shows `user_…` instead of real Whop username; upper line should be handle, lower line user id, and refresh when user changes name on Whop.

### Root Cause
Whop JWT only includes user id (`sub`), not username. `fetchWhopUserProfile` was called with invalid `company_id: "global"`, and usernames were not re-synced when members opened the app.

### Changes Made
- **`lib/whop.js`:** valid `biz_` company id from env; improved profile fetch fallback; `whopDisplayName` prefers `username` then `name`
- **`lib/whop-username-sync.js`:** resolve + persist Whop username; detect stale `user_*` stored names
- **`api/me.js` / `api/entries.js`:** sync username from Whop on each app open / submit
- **`lib/whop-usernames.js`:** admin list fetches live Whop names and persists updates to store
- Requires **`WHOP_API_KEY`** + **`WHOP_APP_ID`** in Vercel; optional **`WHOP_COMPANY_ID`** (`biz_…`) for company-specific display names

### Verified
- Deployed to production

---

## Phase 24 — Whop Env Crash Fix (FUNCTION_INVOCATION_FAILED)

### Prompt
After adding Whop env vars, server returned `FUNCTION_INVOCATION_FAILED`.

### Root Causes
1. `hasWhopConfig` was accidentally removed from `lib/whop.js` → `ReferenceError`
2. With env vars set, `@whop/sdk` `require()` pulled in ESM-only `jose` → crash on Vercel serverless

### Changes Made
- Restored `hasWhopConfig()`
- Whop user profile + access checks now use REST `fetch` to `api.whop.com/api/v1` (no SDK load on admin/user routes)
- SDK only loaded async when explicitly needed (`getWhopClientAsync`)

### Verified
- `/api/admin/users?admin=1` returns 200; Whop usernames resolve (e.g. `sourcanteenbb`)

---

## Phase 25 — Shared History UI, Collapsed Previews & Submit Guards

### Prompts
- History cards should show compact previews when collapsed (bars, income, date)
- Fix cross-device identity and pull server data on load
- Submit button validation and double-tap guard

### Changes Made
- **`history-ui.js`:** shared deck controls, collapsed bar previews, lazy-expanded body, deck pagination — used by member + admin
- **`eod-tracker.html`:** pull from server on init; submit cooldown + validation; date-entry notices
- **`streak-ui.js`:** client-side streak milestone helpers (later aligned with server streak logic)

---

## Phase 26 — Business Lock & Role-Based Routing

### Prompt
App must only work for the brother’s Whop business; fix admin/member routing when previewing or opening from different businesses.

### Changes Made
- **`lib/business-access.js`:** `WHOP_COMPANY_ID` required; resolve session business from experience URL/referer/JWT (no env fallback for session detection); deny if session business ≠ configured business
- **`lib/company-resolve.js`:** `resolveIncomingResourceIds()` vs `resolveResourceIds()` split
- **`lib/member-routing.js`:** team roles via `authorized_users` + `checkAccess`; `?view=member` for admins to use tracker; dashboard vs tracker paths
- **`lib/whop-roles.js`:** team access resolution
- **`eod-tracker.html` / `admin.html`:** Admin panel ↔ Member tracker nav buttons; access gate for wrong business

### Verified
- Deployed v2.2.6

---

## Phase 27 — EOD Submission Streaks, Milestones & Channel Publish (v2.2.7)

### Prompt
When “Publish to channel” is checked, post compact EOD markdown to Whop accountability chat; track EOD submission streak with milestones to 1000.

### Changes Made
- **`lib/eod-submission-streak.js`**, **`lib/streak-milestones.js`:** consecutive-day submission streak + milestone table
- **`lib/eod-channel-format.js`:** markdown EOD post (pairs, reflection, income, streak, milestone)
- **`lib/eod-channel-publish.js`:** initial Messages API publish path
- **`api/entries.js`:** publish on submit when `entry.publish`; return `submissionStreak` + `channel` result
- **`streak-ui.js`:** header badge, next-milestone hint, milestone toast
- **`eod-tracker.html`:** streak UI wired to submission streak (replaced visit-only display for EOD context)

### Verified
- Deployed v2.2.7

---

## Phase 28 — Delete EOD from History

### Prompt
Add delete button on expanded history cards with confirmation.

### Changes Made
- **`eod-tracker.html`:** “Delete EOD” on expanded history body; `confirm()` dialog; local delete + `deleteEntryDates` sync to server; refresh history + streak + form if same date
- **`history-ui.js`:** delete button click handler (stops deck toggle propagation)
- **`api/entries.js`:** accept `deleteEntryDates[]` in POST body
- **`lib/store.js`:** `deleteEntryDates` in `mergeUserRecords` + verify callback on delete

### Verified
- Deployed v2.2.8+

---

## Phase 29 — Accountability Chat via Webhook (v2.3.0)

### Prompt
Chat is a **separate Whop Chat app** on the business — not inside the EOD tracker. Use webhooks to post messages when publish + streak are set. Remove in-app chat setup UI.

### Changes Made
- **`lib/eod-channel-publish.js`:** rewritten to POST `{ username, content }` to `WHOP_ACCOUNTABILITY_WEBHOOK_URL` (or `WHOP_CHAT_WEBHOOK_URL`)
- **Removed:** in-app accountability chat setup panel, channel list API, Messages API channel ID discovery
- **`eod-tracker.html`:** error hint points to Vercel webhook env var

### Setup (operator)
1. Whop **Chat** app → Settings → Webhooks → create webhook → copy URL
2. Vercel: `WHOP_ACCOUNTABILITY_WEBHOOK_URL=https://…`
3. Redeploy; test with “Publish to channel” checked on submit

### Verified
- User confirmed webhook chat post working

---

## Phase 30 — Layout Fix, Version API & Deploy (v2.3.1)

### Prompt
App filled full Whop iframe width after a bad edit; version label stuck on old deploys.

### Root Cause
Broken `</div>` nesting in `eod-tracker.html` closed `#app-root` after the topbar only — tabs/form rendered **outside** the `max-width: 680px` container.

### Changes Made
- **`eod-tracker.html`:** fixed topbar HTML structure; `#app-root` / `.eod-app` width rules
- **`api/version.js`**, **`version.js`:** single source of truth for version
- **`eod-tracker.html` / `admin.html`:** version label loads from `/api/version` at runtime
- **`vercel.json`:** stronger no-cache headers for `/experiences/*` and `/api/version`
- **Deploy note:** `vercel --prod` from project folder uploads local files; dashboard “Redeploy” alone does not

### Verified
- Production `/api/version` → `2.3.1`; narrow centered layout restored in Whop iframe

---

## Phase 31 — GitHub Repository

### Prompt
Create GitHub repo and commit/push everything.

### Changes Made
- **`.gitignore`:** `node_modules/`, `.vercel/`, `data/`, all `.env*` except `.env.example`
- **Git:** initial commit on `main` (49 files)
- **Remote:** `https://github.com/enseri/eod-tracker` (private)

### Verified
- Repo created and pushed

---

## Phase 32 — Pro-Gated Saved Action/KPI Options

### Prompt
Only Pro members can add action/KPI options to their saved list. Basic members should still see “+ Add new option” but get a Pro gate (like multiple pairs). Basic members type names per entry instead of saving options.

### Changes Made
- **`eod-tracker.html`:** `showProFeatureGate()` modal + upgrade banner pulse; gate on “+ Add new option”, Create, and submit auto-save; pair buttons 2/3 show same modal instead of silent disable
- **`lib/tiers.js`:** `savedOptions` in `PRO_FEATURES`
- **`version.js`:** v2.3.2

### Verified
- Pro: save options via Create, dropdown, and submit. Basic: gate on add; type per entry when list empty

---

## Phase 33 — Admin Tier Downgrade & Basic Option Enforcement

### Prompt
Admin could not set a member back to Basic from Pro (save appeared to do nothing). Basic members could still add saved options because Whop Pro plan IDs overrode `adminTier`.

### Root Cause
- **`api/me.js`:** `tierToSave` preferred Whop `plan_id` over `adminTier === 'basic'`
- **`api/entries.js`:** entry sync upgraded `tier` to `pro` whenever `resolvedTier === 'pro'`, even after admin downgrade

### Changes Made
- **`api/me.js`:** tier from `resolveTierFromContext` only (admin `basic` wins over plan IDs)
- **`api/entries.js`:** sync uses `resolvedTier` directly; server rejects `options` patch for non-Pro
- **`eod-tracker.html`:** `canSaveOptions()` helper; hide Create/Edit for Basic; Basic empty-list dropdown shows “+ Add new option” with gate; fix field read when select value empty
- **`lib/analytics.js`:** `onProList` follows effective tier
- **`version.js`:** v2.3.3

### Verified
- Admin downgrade to Basic persists; member app shows Basic and blocks saving options

---

## Phase 34 — Basic Member UX Refinements (v2.3.4)

### Prompt
Polish Basic tier UX: hide “+ Add new option” but keep Edit; remove upgrade banner; replace browser confirm on same-day resubmit with press-again on submit button; plain accountability chat text (no markdown); omit hidden reflection/income instead of showing “hidden”.

### Changes Made
- **`eod-tracker.html`:** `submitReplacePending` — first submit on existing date shows “Press again to replace entry”; Basic hides add-new in dropdown, keeps Edit; removed upgrade banner; submit no longer auto-saves options for Basic
- **`lib/eod-channel-format.js`:** streak milestone messages without `**` / `_` markdown
- **`admin.html`:** admin history omits hidden reflection/income rows instead of “hidden” label

---

## Phase 35 — Admin Tier Save Performance (v2.3.4)

### Prompt
Admin tier save felt slow and sometimes appeared to revert after save.

### Changes Made
- **`api/admin/user.js`:** tier PATCH returns `summary` without bulk `enrichUsersWithWhopNames` on every save
- **`admin.html`:** `tierSaveInFlight` guard; optimistic `patchUserInList` + `updateTierDetailPanel` instead of full dashboard reload
- **`lib/store.js`:** `setAdminTier` verify callback waits for persisted `adminTier` + Pro list

### Verified
- Tier save updates table and detail panel immediately without long wait

---

## Phase 36 — Splash Screen & Mobile Date Bar (v2.3.5)

### Prompt
Loading screen should say **VIP** (gold) above **EOD TRACKER**; date field overflowed on mobile.

### Changes Made
- **`eod-tracker.html`:** splash title VIP + EOD TRACKER; `.date-field-wrap` + WebKit date input rules for mobile overflow

### Verified
- Deployed v2.3.5

---

## Phase 37 — Personal Bests (v2.3.6–2.3.8)

### Prompt
Detect new records on action/KPI/sales/income; celebrate in app and accountability chat; show all-time bests table on Progress tab. Chat PB messages should not include numbers.

### Changes Made
- **`lib/personal-bests.js`:** `detectPersonalBests`, `buildPersonalBestsRows`, `formatPersonalBestsMessage`, `scanPriorBests`
- **`personal-bests-ui.js`:** client mirror for Progress table + submit-time toast
- **`lib/eod-channel-publish.js`:** second webhook post (`— Record`) when PBs detected; only when `entry.publish`
- **`eod-tracker.html`:** PB celebration toast animation; Progress tab PB table at bottom
- **`api/entries.js`:** passes full `entries` map into publish for PB comparison

### Verified
- Deployed through v2.3.8

---

## Phase 38 — Entry Override / Replace Fix (v2.3.9)

### Prompt
Override flow broken: warning showed and chat posted, but history did not update and personal bests were not detected on replace.

### Root Cause
- History not re-rendered after save; `submitReplacePending` cleared before validation; PB detection excluded same-day date without folding in the **previous** same-day entry as baseline

### Changes Made
- **`eod-tracker.html`:** `renderHistory()` (+ Progress refresh) after save; capture `previousEntry` before overwrite; defer clearing `submitReplacePending` until validation passes
- **`lib/personal-bests.js`:** `foldEntryIntoBests` + `previousEntry` param on `detectPersonalBests`
- **`personal-bests-ui.js`:** client `detectNewRecords` mirrors server baseline logic
- **`api/entries.js` / `lib/eod-channel-publish.js`:** pass `previousEntry` from pre-merge store into publish

### Verified
- Deployed v2.3.9; committed `73b273f`

---

## Phase 39 — Chat Format & Press-Again Delete (v2.3.10)

### Prompt
Chat labels: colon after Reflection and Income; remove bullet points on sales/income lines. History delete should confirm via second press (like override), not `confirm()`.

### Changes Made
- **`lib/eod-channel-format.js`:** `Reflection:` and `Income:` section headers on own lines; reflection text on following line; income stream lines without `•` prefix
- **`eod-tracker.html`:** `deleteConfirmPending` + “Press again to delete” on history card; inline `#history-status` for delete/sync messages (replaces `confirm` + `alert` on delete)

### Remaining browser popups (member app)
- `alert` — Edit options modal: “No saved options to edit yet.” / “Each name must be unique.”
- **Admin (`admin.html`):** `confirm` on bulk + single member delete; `alert` on errors

### Verified
- Deployed v2.3.10; committed `d2196cd`

---

## Phase 40 — Settings Persistence & Admin Due Column (v2.5.0)

### Prompt
Fix Pro settings (pair count / income streams) being clobbered on server pull. Admin dashboard: show who has not submitted EOD today with orange countdown to Central midnight.

### Changes Made
- **`eod-tracker.html`:** `applyServerSettings()` merges server settings without overwriting local `pairCount` / `incomeStreams` when server omits them; `syncSettingsToServer()` on pair-count and income-stream changes
- **`lib/central-time.js` / `central-time.js`:** `hoursUntilCentralMidnight()` for US Central calendar day boundary
- **`lib/analytics.js`:** `submittedToday`, `hoursUntilReset`, `atRisk` on member summaries
- **`admin.html`:** sortable **Due** column (green Done / orange `~Xh`); detail panel EOD-today line; filter labels clarified
- **`scripts/verify-app.js`:** smoke tests for due fields and CT midnight helper

### Verified
- `node scripts/verify-app.js` passes

---

## Phase 41 — Manager Review: Streak Fix, Income Ranks, Verification & Chat Rewrite (v2.6.0)

### Prompt
Manager feedback after weeks of use: (1) can't see missing entries at a glance in admin; (2) member overview streak shows 0 at midnight until they submit; (3) flip history Action bar left / KPI bar right; (4) optional broadcast of total-income milestones + always-on monthly income records (MTD); (5) monthly income rank tags with colored names, earned only after 2 consecutive months, never downgraded; (6) admin "Income verified" checkbox (manual, green check, doesn't reset on every entry); (7) verification gates the rank grant + record broadcast, and a new record resets the checkbox; admin can also change ranks manually; (8) human-readable EOD chat message with per-option verb + "(s)" toggle; (9) simpler streak announcement; (10) native rank tag next to name in Whop chat if possible.

### Decisions (with Emmanuel)
- Overview streak stays **visit-based**; only the midnight reset-to-0 bug is fixed.
- Ranks are **permanent once earned** (achievement model) — never downgraded.
- Rank names use a wealth ladder (military names were just an example): Starter → Closer → **Earner** → **Heavyweight** → Rainmaker → Mogul → Titan → Magnate → Empire.
- Chat rank tag: research first → **not supported** by Whop API → inline message prefix + always-on admin-panel tag.

### Root cause (streak bug)
`calcStreakFromDates` started counting at *today* and returned 0 the moment today wasn't present, so every member read 0 from Central midnight until they submitted.

### Changes Made
- **`lib/central-time.js`:** `calcStreakFromDates` now holds the streak from **yesterday** when today has no entry yet — streak only reads 0 after a full day is truly missed. Lets admin spot who's about to lose a streak all day.
- **`lib/income-ranks.js` (new):** MTD monthly income, rank tiers (9, colored), monthly ($100→$5M/mo) + total ($1K→$100M) milestone ladders, `qualifiedRank` (2-consecutive-month rule), record detection, and broadcast message formatters.
- **`lib/income-verify.js` (new):** per-user income state (`incomeVerified`, `incomeGrantedRank`, `incomeRankOverride`, `incomeGrantedTotal/MonthlyMilestone`, `incomePending`). New record → holds (verified=false); admin verify → advances granted rank + fires broadcasts; new record resets and re-holds. `displayRank` = override ?? granted.
- **`lib/eod-channel-format.js`:** rewritten to human-readable adlib ("@user is on fire today 🔥 … 5/5 Calls were completed and 2/2 Leads were reached. They made 1 sale today and $X in income. 💰 … Reflection: …"), zero-actions fallback ("showed up today 🙏"), praise based on actions/KPIs not money, per-option verb + "(s)" plural, inline rank tag prefix.
- **`lib/eod-channel-publish.js`:** simplified streak post ("@user just hit a X-day streak! 🔥\ncatchphrase"); `publishIncomeRecords` for gated income broadcasts; passes rank into EOD post.
- **`lib/analytics.js`:** member summary adds `recentDays` (14-day strip), `incomeThisMonth` (MTD), and income/rank/verified fields.
- **`api/entries.js`:** detects income records on submit (holds verification) and passes display rank into the chat post.
- **`api/admin/user.js`:** PATCH accepts `incomeVerified` (fires broadcasts + grants rank on verify) and `rankOverride` (manual rank). **`api/admin/users.js`:** exposes the rank ladder.
- **`admin.html`:** "Last 14d" dot strip (green submitted / red missed / dim pre-signup), "Income Verified" column (click to toggle, green check / ⏳ pending), colored member name + rank badge, and Income & rank controls (verify checkbox + rank override dropdown) in the detail panel.
- **`eod-tracker.html`:** Pro settings checkbox to broadcast total-income milestones (monthly always on); edit modal gains a chat-wording verb picker + "(s)" toggle per option, carried onto each pair at submit.
- **`history-ui.js`:** Action bar now renders left, KPI bar right (member + admin).
- **Local test harness:** `scripts/dev-server.js` (`npm run dev`) — zero-dep server running the real API handlers against file storage with `DEV_ADMIN=1`, plus a captured accountability-chat feed at `/__feed` so every EOD/streak/income message is viewable without a live webhook. `npm test` runs `scripts/verify-app.js` (extended with streak, income-rank, and verification-gate unit tests).

### Whop native chat tag (item 10) — findings
Whop's Create Message API takes Markdown `content` + author `user` only; no per-message badge/role field. Native badges are tied to Whop roles/access levels, not arbitrary tags. Decision: inline prefix in the message (`[Earner · $10K/mo]`) + colored name/tag in the admin panel. A true native badge would require managing Whop roles per rank tier — deferred.

### Verified
- `node scripts/verify-app.js` passes (streak hold, MTD, 2-month rank rule, milestone detection, verification gate, override).
- End-to-end via dev server: member submit → EOD + streak posts; income record held until admin verify → total/monthly/rank broadcasts fired; rank override works.
- Not yet committed/pushed — left for local review, then deploy per `POST_UPDATE_CHECKLIST.md`.

### Open follow-ups
- Verb/"(s)" wording is offered on both action and KPI options; confirm the exact defaults with the manager.
- Consider whether the new gated income broadcasts should replace or coexist with existing per-metric personal-best posts (currently coexist).

---

## Phase 42 — Review Round 2: Streak-in-EOD, Inline PBs, Selector Bug, Dev Seed (v2.6.1)

### Prompts (manager voice notes + chat)
- Total-income-milestone broadcast checkbox belongs in **member settings** (privacy for people who don't want to reveal earnings) — confirmed, already there.
- Monthly income is fine to broadcast for everyone; broadcast the **first time** they hit a monthly tier (e.g. $10K/mo). Rank/tag only after **2 months in a row** (broadcast first hit, grant tag on the second) — confirmed matches build.
- **Verification reset:** only a new **total** or **monthly** income record resets `incomeVerified`; **daily** income records do **not** (they happen too often). Decision confirmed — the gate ignores daily PBs.
- **Remove the separate streak-milestone chat message.** Put the streak back **inside** the daily EOD post with an emoji that grows with the number.
- **Remove the separate "new personal best" chat message.** Annotate PBs **inline** as `(new best)` in the EOD post.
- **Member-portal streak**: make it a big, bold, **orange** number + "streak" + fire emoji (drop the mixed music/✨ emojis).
- **Bug:** action/KPI selectors don't stay on the last-used option — always load the last option in the list.
- **Bug:** `@heydedriak` — second EOD not recorded; admin shows Entries 1 while Streak 2 / "expiring soon".

### Changes Made
- **`lib/streak-milestones.js` + `streak-ui.js`:** `streakEmoji` now tiers by number — 🌱 (<30) → 🔥 (30) → 🌋 (90) → ☄️ (180) → 🗿 (365).
- **`lib/eod-channel-format.js`:** streak line re-added to the EOD post (`N-day streak <emoji>`); personal bests annotated inline as `(new best)` on the matching action/KPI/income segment; plural toggle now emits literal `"(s)"` (avoids "sents"/"memberss").
- **`lib/eod-channel-publish.js` + `api/entries.js`:** removed the separate streak-milestone post and the separate personal-best post; PBs are detected and passed into the single EOD message. Trimmed now-unused helpers/imports.
- **`eod-tracker.html`:** last-used action/KPI selection persisted per pair (`eod_last_sel`) and restored on load (was defaulting to the last list item); streak badge restyled to a big orange number + "streak" + 🔥; edit-modal "(s)" label updated.
- **`scripts/seed-dev.js` (`npm run seed:dev`):** writes 5 rich sample members to the local file store — a pending-verification Earner, a verified Mogul, an at-risk-but-streak-held member (streak-fix demo), a gap-heavy member for the strip, and a done-today member.

### `@heydedriak` lost-entry — investigation
Symptom: EOD posted to chat on Jul 19 but admin shows Last EOD Jul 18, Entries 1, Streak 2, "expiring soon". Since the chat post only fires **after** the entry save succeeds, the Jul 19 entry **was** saved, then disappeared. The state (entry gone, visit kept → streak 2, entries 1) is exactly what happens when an **EOD is deleted from history** (the entry is removed but the visit is not). Most likely an accidental "press again to delete" on mobile; a Blob write failure would have thrown before the chat post, so that's ruled out. Root of the confusion is that **Streak is visit-based** (days the app was opened) while **Entries** counts submissions — so they can legitimately differ. **Recommend deciding with the manager:** (a) switch the overview streak to **submission-based** so it can't outrun entries, and/or (b) make history-delete also drop that day's visit. Not changed yet — needs his call. Reproduce locally: seed a member, submit an EOD, then delete it from History and watch streak vs entries in the admin panel.

### Verified
- `node scripts/verify-app.js` passes (adds streak-emoji tiers, streak line, inline `(new best)`).
- Live dev-server run against seeded data: admin rows correct (pending ⏳, Mogul ✅, at-risk streak held); verifying a member fires exactly the total+monthly+rank broadcasts; a member submit posts **one** EOD message with the streak line + inline `(new best)` and **no** separate streak/PB messages.
- Not committed/pushed — local testing only.

---

## Phase 43 — Admin QOL Polish + Mobile (Whop app) + Streak Clarity (v2.6.2)

### Prompts
- The Last-14D strip looked misaligned; make it look as intended.
- QOL pass on the admin dashboard; ensure it looks good in the **Whop mobile app**.
- Clearer distinction between the streak **number of days** and the **fire symbol** on the member dashboard.

### Changes Made
- **`admin.html` — 14-day strip:** every cell now has a faint visible border so all 14 slots read as one aligned track (the near-invisible pre-signup cells were what made rows look ragged). Submitted = **green** (`--ok`), missed = red, before-signup = dim, today = a `box-shadow` ring (no more `outline-offset` wobble). Added a small legend under the table.
- **`admin.html` — QOL:** streak cell colored by health (green if done today, orange if at risk) with a fire icon; `⏳ pending` cue next to the member name when income awaits verification; relative "Last EOD" dates ("Today / Yesterday / N days ago"); summary chips now include **At risk** and **Pending verify** (replaced the less-actionable Missed-7d card).
- **`admin.html` — mobile:** at ≤640px the members table collapses into stacked **cards** (labels via `data-label`, no horizontal scroll) so it's usable inside the Whop mobile iframe.
- **`eod-tracker.html` — streak indicator:** fire moved into its own circular chip on the left, clearly separated from the big orange day count + "DAY STREAK" label — so the number and the symbol no longer blur together.

### Follow-up (v2.6.3) — streak emoji always fire
- **Bug:** the tiered streak emoji only ran in the chat message; the admin cell and member badge both **hardcoded 🔥**, so every UI streak looked identical. Compounded by seed data where all streaks were <30 (all seedlings anyway).
- **Fix:** admin `fmtStreakCell` and member `updateVisitStreakUI` now use the tiered emoji (🌱 <30 → 🔥 30 → 🌋 90 → ☄️ 180 → 🗿 365). `scripts/seed-dev.js` rewritten with 7 members whose streaks span every tier (5/2/0/35/95/210/400) so the icons are visibly different in the dashboard.
- Note: this overrides the manager's earlier "member portal always fire" aside in favor of his detailed evolving-emoji spec — one-line revert if he prefers always-fire on the portal.

### Follow-up (v2.7.1) — realistic income scale
- **Prompt:** nobody on this app makes over $1M/mo — shift the ladder down so the top rank is $5K/mo.
- **`lib/income-ranks.js`:** `MONTHLY_RANKS` rescaled to Starter $100 → Closer $250 → Earner $500 → Heavyweight $1K → Rainmaker $1.5K → Mogul $2K → Titan $3K → Magnate $4K → **Empire $5K/mo** (top). Monthly broadcast milestones now $100→$5K; all-time total milestones trimmed to $1K→$1M (accrues over time). Tests + `seed-dev.js` incomes updated to match.
- **Version:** `version.js` → `2.7.1`.

### Verified
- `node scripts/verify-app.js` passes; inline-script syntax check clean for both HTML files.
- Live dev-server render against seeded data: admin returns 200 with legend + mobile CSS present; member app has the new streak markup.
- `heydedriak` note: re-examined — **not confidently a bug**; most likely an accidental history-delete (entry removed, visit kept → streak > entries). Root confusion is Streak (visits) vs Entries (submissions). Recommend deciding: submission-based streak and/or delete-drops-visit. Not changed pending manager's call.

---

## Current Architecture

| Layer | Files |
|-------|-------|
| Member app | `eod-tracker.html`, `history-ui.js`, `streak-ui.js`, `personal-bests-ui.js` |
| Admin app | `admin.html`, `history-ui.js` |
| API | `api/me.js`, `api/entries.js`, `api/version.js`, `api/config.js`, `api/storage-status.js`, `api/admin/users.js`, `api/admin/user.js`, `api/admin/seed.js`, `api/admin/reset-user.js` |
| Server logic | `lib/store.js`, `lib/auth.js`, `lib/business-access.js`, `lib/company-resolve.js`, `lib/member-routing.js`, `lib/whop-roles.js`, `lib/tiers.js`, `lib/tier-resolve.js`, `lib/analytics.js`, `lib/parse-body.js`, `lib/eod-channel-publish.js`, `lib/eod-channel-format.js`, `lib/eod-submission-streak.js`, `lib/streak-milestones.js`, `lib/personal-bests.js`, `lib/income-ranks.js`, `lib/income-verify.js`, `lib/whop-username-sync.js`, `lib/whop-usernames.js` |
| Deploy | `vercel.json`, `deploy.ps1` |
| Version | `version.js` → `lib/version.js` → `/api/version` (UI label loads from API) |
| Post-update steps | `POST_UPDATE_CHECKLIST.md` |
| Project history | `PROJECT_LOG.md` |
| Local testing | `scripts/dev-server.js` (`npm run dev` → localhost + captured chat feed), `scripts/seed-dev.js` (`npm run seed:dev` → sample members), `scripts/verify-app.js` (`npm test`) |
| Test data seed | `scripts/seed-test-users.js`, `scripts/test-bulk-delete.js`, `scripts/reset-user-to-seed.js` |

## Storage (Production)

| Mode | Status |
|------|--------|
| Vercel Blob (private, OIDC via `BLOB_STORE_ID`) | Connected |
| Redis/KV | Not configured (Blob is primary) |
| Fallback | In-memory on Vercel only if Blob unavailable |

Debug: `GET /api/storage-status?test=1`

## Production URLs

| Purpose | URL |
|---------|-----|
| Member app (Whop iframe) | `https://eod-tracker-ecru.vercel.app/experiences/[experienceId]` |
| Member (direct) | `https://eod-tracker-ecru.vercel.app/` |
| Admin dashboard | `https://eod-tracker-ecru.vercel.app/dashboard/[companyId]` |
| API version | `https://eod-tracker-ecru.vercel.app/api/version` |
| Storage debug | `https://eod-tracker-ecru.vercel.app/api/storage-status?test=1` |
| GitHub | `https://github.com/enseri/eod-tracker` |

## Current Version

**v2.7.1** (July 2026) — Phases 41–43 (income ranks + verification, human-readable chat, streak fix, admin QOL, mobile) + realistic income scale (top rank $5K/mo)

## Pro vs Basic (Member Features)

| Feature | Basic | Pro |
|---------|-------|-----|
| EOD form (1 action/KPI pair) | Yes | Yes |
| Multiple action/KPI pairs | No | Yes (up to 3) |
| Income streams | No | Yes (up to 3) |
| Progress charts | No | Yes |
| **Personal bests table** | No | Yes (Progress tab) |
| **Saved action/KPI options** | No — type per entry | Yes — dropdown + targets |
| Admin tier override | `adminTier` on server wins over Whop plan IDs |

## Key Environment Variables (Vercel Production)

| Variable | Purpose |
|----------|---------|
| `WHOP_API_KEY` | Whop REST API |
| `WHOP_APP_ID` | App JWT audience (`app_…`) |
| `WHOP_COMPANY_ID` | **Required** — locks app to one business (`biz_…`) |
| `WHOP_EXPERIENCE_ID` | Optional — EOD tracker experience routing |
| `WHOP_ACCOUNTABILITY_WEBHOOK_URL` | Chat publish — webhook URL from Whop **Chat** app settings |
| `WHOP_PRO_PLAN_IDS` | Comma-separated `plan_…` IDs that grant Pro tier |
| `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN` | Persistent member data |

Do **not** set `DEV_ADMIN=1` in production.

## Progress Tab (Pro Only)

| Chart | Selector | Data shown |
|-------|----------|------------|
| Action | Dropdown of all action names | Daily completion counts vs target |
| KPI | Dropdown of all KPI names | Daily KPI counts vs target |
| Income streams | **View all** or per-stream | Daily income ($) + daily sales (count) |

- Tab requires **2+ EOD submissions** overall; each selected metric needs **2+ logged days**
- Hover chart points for exact values; purple line = daily target when set

## Streaks (Current Behavior)

- **EOD submission streak** — consecutive calendar days with at least one EOD entry (not visit-based)
- Milestones at: 1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 75, 90, 100, 150, 200, 250, 300, 365, 500, 750, 1000
- UI: streak badge in header, next-milestone hint, toast on milestone hit
- Included in accountability chat webhook post when publish is enabled

## Personal Bests (Pro metrics + Basic actions/KPIs)

- Detected on submit when a value strictly exceeds the member’s prior all-time best (same-day replace folds in the **previous** entry for that date)
- **In-app:** celebration toast on new records; all-time bests table at bottom of Progress tab (Pro)
- **Chat:** second webhook message (`— Record`) with “new personal best” lines (no numbers); only when publish is enabled
- Override/replace only counts as a PB when the new value beats the true all-time high

## Open Items

- **`WHOP_PRO_PLAN_IDS` + product access API check** — JWT `plan_id` alone may not cover all membership types; add `WHOP_PRO_PRODUCT_ID` + `checkAccess` on `/api/me` for instant Pro after purchase
- **Upgrade banner checkout link** — embed or link Whop Pro checkout in member UI
- **CSV export** from admin (optional)
- **Webhook for membership events** — auto-upgrade Pro tier on `membership.valid` (belt-and-suspenders with plan IDs)

## Completed (formerly open)

- ~~Wire Whop JWT + `WHOP_PRO_PLAN_IDS`~~ — code in `lib/tier-resolve.js`; needs env + plan IDs configured
- ~~Publish to channel~~ — posts to separate Whop **Chat** app via `WHOP_ACCOUNTABILITY_WEBHOOK_URL` (not Messages API)
- ~~Cross-device sync~~ — server Blob storage + pull on load when Whop session present
- ~~Saved action/KPI options (Pro only)~~ — client gate + server `options` patch blocked for Basic
- ~~Admin tier downgrade~~ — `adminTier === 'basic'` respected in `/api/me` and `/api/entries`
- ~~Entry override / replace~~ — history refresh + PB baseline with `previousEntry` (v2.3.9)
- ~~Press-again delete in history~~ — replaces `confirm()` dialog (v2.3.10)

---

*Last updated: Phase 43 — July 2026 (released v2.7.1)*
