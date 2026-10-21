# ASME Social Hub

Create an event once, schedule Instagram feed and story posts, sync a native GroupMe event, and leave an archive for the next officer team. The dashboard is plain HTML, CSS, and JavaScript; GitHub Actions runs the scheduler and stores public campaign records in this repository.

**Dashboard:** https://asme-osu.github.io/ASME-Social-Hub/

The repository includes clearly labeled example campaigns. They never publish. Duplicate an example and choose new dates to create a real campaign. Instagram and GroupMe publishing require the account setup in [SETUP.md](SETUP.md).

```sh
npm ci
npm test
npm run build
npm run dev
```

Open the printed local URL. Without a repository connection, the form exports campaign JSON. To save directly, connect a fine-grained PAT scoped to this repository with Contents read/write in Settings. Add Actions read/write to use Preview dispatcher and Run live; a successful connection checks repository reading only. If a workflow request returns 403, update those Actions permissions, obtain organization approval if required, and reconnect. The token stays in memory unless you explicitly choose browser persistence. Uploading a flyer requires a repository connection. Publishing credentials belong only in Actions secrets.

- `config/chapter.json`: chapter, branding, timezone, event types, captions, calendar feed, repository, and active year.
- `data/campaigns/<year>/<id>.json`: source records, revisions, statuses, published IDs, insights, and officer notes.
- `docs/`: GitHub Pages dashboard and generated public data, JPEGs, and calendar files.
- `templates/`: configurable flyer layout; feed 1080×1350 and story 1080×1920 JPEGs.
- `scripts/`: dispatcher, API adapters, iCal parser, renderer, doctor, and maintenance.

`npm run dry-run` prints currently due actions without network calls or writes. `npm run doctor` reports setup gaps; `node scripts/doctor.mjs --live` also performs read-only service checks. Missing credentials intentionally fail production readiness checks while the local dashboard remains usable.

The dispatcher is scheduled every 15 minutes and uses chapter-local calendar dates across DST. GitHub can delay scheduled starts; the dashboard distinguishes a delayed completion from a failed run or an extended gap. It skips feed/story windows missed by more than 24 hours. It checkpoints intent to GitHub before publishing; ambiguous network outcomes stop for officer reconciliation instead of risking duplicate posts. An edit updates future content and the existing GroupMe event; published Instagram posts remain recorded. Cancellation stops pending posts and removes the native GroupMe event on the next dispatcher run. No retroactive Instagram deletion is performed.

Campaign details group **Cancel campaign** (stop pending posts and retain the archive record) beside **Delete from hub** (hide the campaign from the dashboard and archive while retaining publishing receipts). Click a feed or story image to open a centered preview; close it with X, Escape, or the backdrop.

GroupMe bot announcements include one member event link instead of separate calendar and flyer links. `event.html?year=<year>&id=<campaign-id>` displays public event details, RSVP, the flyer, and separate Google Calendar and Apple Calendar actions. Dates use Columbus time with the correct EDT/EST abbreviation. It follows the device’s light/dark appearance automatically, including changes while the page is open. Campaign details include a link to this member view.

See [SETUP.md](SETUP.md), [HANDOFF.md](HANDOFF.md), [FORKING.md](FORKING.md), and [INTEGRATIONS.md](INTEGRATIONS.md). Calendar recurrence parsing was extracted from the neighboring ASME Newsletter Builder and uses `node-ical@0.26.1`.


Every build generates `docs/data/posting-health.json` for the Officer Hub. Its version 1 schema includes the build timestamp, active year, chapter timezone/default cadence, resolved GroupMe mode, the calendar-candidate heartbeat and identities, and current campaign posting status. Campaign records come directly from `data/campaigns`, including dispatcher receipts newer than the archive index. The feed explicitly selects public identities, schedules, flags, revisions, receipt IDs/timestamps and unresolved-attempt timestamps; it excludes notes, descriptions, errors, logs, captions and credentials.

Feed/story and bot deadlines use the dispatcher's `fireAt` calculation, including daylight-saving behavior. A bad schedule produces `dueAt: null` and `scheduleInvalid: true` for that channel. Native GroupMe creation/update is immediate (`immediate: true`, `dueAt: null`); the feed does not invent a creation deadline. Explicitly disabled channels remain disabled. `calendar.generatedAt` reports the last candidate refresh independently of the build's `generatedAt`; a newly built feed does not imply a fresh calendar fetch. Building this feed does not dispatch posts or messages.
