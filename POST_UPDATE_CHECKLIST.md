# Post-Update Checklist

**Always follow this checklist after completing a meaningful update** (bug fix, feature, or deploy-worthy change). Agents should read this file before finishing any task that touches the app.

---

## 1. Increment the version

Bump the patch version (e.g. `2.1.11` → `2.1.12`) in **all** of these places:

| File | What to update |
|------|----------------|
| `version.js` | `window.EOD_APP_VERSION = 'x.y.z';` (source of truth for API) |
| `lib/version.js` | Fallback string in `readAppVersion()` if parse fails |
| `eod-tracker.html` | `<div class="version-label">vx.y.z</div>` |
| `admin.html` | `<div class="version-label">vx.y.z</div>` |

Use semantic-ish patch bumps for each deploy batch. Do not skip version bumps when deploying.

---

## 2. Update `PROJECT_LOG.md`

Add a new **Phase** section at the end (before the footer) with:

- **Prompt** — what the user asked for (short summary)
- **Changes Made** — files touched and what changed
- **Verified** (optional) — how it was tested or confirmed in production

Update the footer line: `*Last updated: Phase N — Month Year*`

---

## 3. Review changed files

- [ ] No secrets committed (`.env`, API keys, tokens)
- [ ] API handlers that accept JSON bodies use `lib/parse-body.js`
- [ ] Admin-only routes still require `?admin=1` (or Whop admin when re-enabled)
- [ ] Storage writes go through `lib/store.js` (Blob on Vercel)

---

## 4. Smoke-test locally (when possible)

```powershell
cd "c:\Users\biome\Desktop\Projects\Ayrtons Projects"
npm run test:bulk-delete          # local store bulk delete
npm run seed                      # seed local test members (~3 months EOD data)
npm run seed:remote -- --wipe     # seed production via admin API
```

---

## 5. Deploy to production

```powershell
cd "c:\Users\biome\Desktop\Projects\Ayrtons Projects"
vercel --prod --yes
```

Production URL: **https://eod-tracker-ecru.vercel.app**

---

## 6. Verify after deploy

- [ ] Hard-refresh admin and member pages (`Ctrl+Shift+R`) — corner version label matches new version
- [ ] `GET /api/admin/users?admin=1` returns the new `version`
- [ ] Core path for this update works (e.g. delete, submit EOD, tier save)
- [ ] No regression on Blob persistence (`storageMode: "blob"` in admin API)

---

## 7. Tell the user

Summarize:

1. What changed
2. New version number
3. Production URL to test
4. Any manual step they still need (Whop env vars, etc.)

---

## Quick reference

| Item | Location |
|------|----------|
| Member UI | `eod-tracker.html` |
| Admin UI | `admin.html` |
| Shared history UI | `history-ui.js` |
| Store / delete / sync | `lib/store.js` |
| Version (API) | `version.js` → `lib/version.js` |
| Project history | `PROJECT_LOG.md` |
| Deploy config | `vercel.json`, `deploy.ps1` |

---

*This checklist exists so every update is versioned, logged, deployed, and verified consistently.*
