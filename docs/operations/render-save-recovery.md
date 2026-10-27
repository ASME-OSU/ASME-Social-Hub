# Recovery from concurrent campaign saves

Render jobs can overlap browser edits even though Actions tasks share the
`campaign-repository` concurrency lock. Browser uploads and campaign saves write
straight to `main`; they do not acquire that lock. A render based on an older tip
therefore receives a non-fast-forward push rejection and cannot deploy.

The render caller now uses a separate `dashboard-render-requests` concurrency
group with `cancel-in-progress: false` and the default single pending request.
This preserves the running render and replaces redundant pending render requests
with the latest one. Each admitted render still acquires the shared repository
lock and checks out `main`. Publishing jobs retain their durable queue.

`node scripts/render-site.mjs` owns the render-only generation and persistence
sequence in an initially clean, disposable Actions checkout. It renders flyers,
refreshes token-warning metadata, builds the archive and Pages files, then commits
and pushes normally. Even a no-op render pushes to check for a newer remote tip.

When a rejected push coincides with remote data edits, the script fetches `main`,
checks that history advanced normally and only data/upload/generated paths
changed, discards its generated commit, clears ignored flyer revision markers,
and rebuilds from the fetched tip. Clearing markers matters because reset can
restore old tracked images while leaving markers for discarded artwork. It
makes at most three attempts. Continuous edits, rewritten history, source changes,
and push failures without a newer remote tip fail the job and prevent deployment.
A subsequent render can process the latest state. No stale campaign merge or
force push is used.

The retry path never runs dispatch, insights, token refresh, or alert messaging.
Other tasks retain their original persistence and publishing safeguards. This
change does not add retry behavior to social publishing. Edits after a successful
push are handled by the next render request; this is not an atomic lock over
browser writes and Pages deployment.

Validation uses temporary local Git repositories and simulated concurrent editor
pushes, including no-op builds, deleted campaigns and existing receipts, stale
artwork markers, bounded retries, rejected writes, source edits, and dirty local
workspaces. Workflow guard checks keep render retries separate from publishers.
The fix must reach the default branch to change production behavior.
