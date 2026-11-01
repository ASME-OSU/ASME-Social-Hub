# Hub audit implementation — November 1, 2026

## Changes

- Validate the complete Instagram caption before uploads or saving. Show a live 2,200-character budget, including event extras and hashtags. Explicit drafts with Instagram disabled remain supported.
- Protect unsaved edits on Close, Escape, and leaving the page. The confirmation offers Keep editing and Discard. Dirty detection includes carousel order/removals and custom Story palettes; selecting a preview alone is not an edit.
- Apply event-type defaults only to untouched fields, preserving restored campaign settings and officer changes.
- Refresh campaigns every minute and when returning to the tab, with a manual refresh control and sync feedback. Connected refresh reads current repository records. Automatic refresh waits while dialogs are open; connection/save races cannot overwrite newly saved records. Failed loads preserve the previous copy and show recovery guidance.
- Add an actionable attention queue above campaigns, including failed, missed, and delayed publishing steps on older events. The review statistic opens the same queue.
- Raise channel status/date text to 12px, use sentence case, stack phone receipts, retain mobile connection instructions, and replace ghosted artwork headers with clean chapter headers.
- Use canonical pre-rendered member URLs with event-specific Open Graph metadata. Local previews, static pages, and legacy query links share the richer member layout and model.
- Add Retry and chapter/contact recovery for member-page failures, plus a generated static 404 recovery page. Builds remove deleted campaigns' generated pages.

## Readability and contrast

Inspected light desktop and dark phone layouts and tested both appearances across desktop, tablet, and phone widths down to 320px. Representative text and controls meet **4.5:1 or better**, including headings, secondary text, channel receipts, status badges, warnings, onboarding copy, settings/editor controls, attention/sync content, caption errors, the discard dialog, and member-page content/actions. This is focused visual and browser verification rather than a formal accessibility certification.

## Verification

- Unit tests: **253 passed, 0 failed**.
- Configuration, campaign data, and JavaScript syntax checks passed.
- Production build completed; generated member pages and the service-worker content version were refreshed.
- PWA browser checks passed at both root and GitHub Pages project paths: installation metadata, offline reopening, public data snapshots, reconnect, and network-only authenticated requests/writes.
- New workflow browser checks passed for caption limits, draft export, preserved defaults, editor protection, carousel preview versus reordering, attention on past events, fresh repository receipts, initial-load recovery, and light/dark contrast.
- All browser regression groups and final JPEG rendering checks passed, including campaign modals, academic years, GroupMe/LinkedIn previews, editor layouts, Story designs, saves/exports, conflict handling, and receipt preservation. Checks were completed in resumed runs after updating obsolete fixture expectations; test API writes remain mocked.

Visual examples: [light desktop](test-results/ui-refinement/after-dashboard-light.png), [dark phone campaign cards](test-results/campaign-cards/390-dark.png), and [dark member page](test-results/member-event/dark-mobile.png).

Changes are in the local workspace. No social posts, announcements, or deployment requests were sent.
