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

Open the printed local URL. Without a repository connection, the form exports campaign JSON. To save directly, connect a fine-grained PAT scoped to this repository with Contents read/write in Settings. The token stays in memory unless you explicitly choose browser persistence. Uploading a flyer requires a repository connection. Publishing credentials belong only in Actions secrets.

- `config/chapter.json`: chapter, branding, timezone, event types, captions, calendar feed, repository, and active year.
- `data/campaigns/<year>/<id>.json`: source records, revisions, statuses, published IDs, insights, and officer notes.
- `docs/`: GitHub Pages dashboard and generated public data, JPEGs, and calendar files.
- `templates/`: configurable flyer layout; feed 1080×1350 and story 1080×1920 JPEGs.
- `scripts/`: dispatcher, API adapters, iCal parser, renderer, doctor, and maintenance.

`npm run dry-run` prints currently due actions without network calls or writes. `npm run doctor` reports setup gaps; `node scripts/doctor.mjs --live` also performs read-only service checks. Missing credentials intentionally fail production readiness checks while the local dashboard remains usable.

The hourly dispatcher uses chapter-local calendar dates across DST. It skips feed/story windows missed by more than 24 hours. It checkpoints intent to GitHub before publishing; ambiguous network outcomes stop for officer reconciliation instead of risking duplicate posts. An edit updates future content and the existing GroupMe event; published Instagram posts remain recorded. Cancellation stops pending posts and removes the native GroupMe event on the next dispatcher run. No retroactive Instagram deletion is performed.

See [SETUP.md](SETUP.md), [HANDOFF.md](HANDOFF.md), [FORKING.md](FORKING.md), and [INTEGRATIONS.md](INTEGRATIONS.md). Calendar recurrence parsing was extracted from the neighboring ASME Newsletter Builder and uses `node-ical@0.26.1`.
