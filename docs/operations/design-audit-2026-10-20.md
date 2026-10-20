# Dashboard design audit — October 20, 2026

Requested by Matthew, reviewed through the existing [Claude design-review chat](https://claude.ai/chat/ae4442dc-2ab9-4b09-85b7-0eccd47d6723). Claude reviewed a screenshot of the live connected dashboard plus a local render of an older repository ZIP; the screenshot was authoritative for the current dispatcher panel. The older ZIP did not include the preview polish in PR #8.

## Changes accepted

- Show dispatcher health as a clear heading, last successful live run, and visible warning. Keep manual controls in a disclosure and present request errors above it with an alert treatment.
- Mark the repository connection as limited after an observed dispatcher 401/403. Keep actual last-run health separate from Actions write access; a publishing request denial does not prove a run was late.
- Put campaigns before the compact summary strip. Use a wider card when only one campaign exists.
- Distinguish posted, pending, off, and genuinely missed steps. Reuse the dispatch-aligned warning logic for missed campaign badges and review counts.
- Default calendar suggestions to five chronological timed events, with explicit filters and Show all / Show fewer. Keep every all-day date reachable.
- Render all-day calendar dates in their source UTC calendar day. Require an explicit event time in the campaign editor instead of inventing a time for an all-day date.
- Raise header controls and related navigation targets to at least 44 pixels. Keep calendar event text in a readable grid column on phones.

## Recommendations adapted

Claude proposed categorizing suggestions as ASME or University events. The source contains no reliable category field, so the UI accurately labels Timed events and All-day dates instead of guessing from titles. Intentionally disabled channels remain Off; they do not become missed-window alerts. The summary is labeled Campaigns to review and counts campaigns with a failed or missed step, while dispatcher health remains a separate visible status.

No publisher, dispatch timing, real campaign data, publishing receipts, or live social announcements were changed by this design work. Browser verification uses isolated synthetic data and mocked GitHub responses.

## Evaluation

A frozen pre-change source render and the updated branch used the same synthetic fixture (two campaigns, 24 calendar dates), with no GitHub writes or real announcements. At 390 × 844, page height fell from 12,227 to 4,147 pixels, while event text width grew from 29.75 to 262 pixels. The default calendar view fell from 24 rows to 5. At 1440 pixels wide, the first campaign moved from y=920 to y=637. The connected single-campaign case keeps its title above the 778-pixel fold, including a visible mocked 403 error.

The focused browser matrix covers 320 × 740, 390 × 844, 1440 × 778, and 1440 × 900 in both themes with healthy and stale dispatcher data. It verifies no horizontal overflow, 44-pixel targets, calendar filtering and keyboard disclosure controls, exact all-day source dates, an explicit-time requirement for new all-day suggestions, preservation of existing all-day campaign times, and a visible 403 alert outside collapsed controls. Screenshots and measurements are generated under `test-results/dashboard-design/`.

Unit tests: 148 passed. Configuration and JavaScript checks passed. The full browser regression suite passed, including preview swipes, campaign deletion/save controls, GroupMe, themes, editor layout, Story designs, and rendered artwork.

Claude evaluated four after screenshots and concluded that the major audit findings were resolved, with no visible blocker. Its follow-up identified ambiguous manual-denial copy, a green limited-access dot, a persistent connection success banner, a large disconnected mobile banner, and singular/plural wording. These were addressed: errors name the manual preview/live request, successful live-run evidence remains separate, limited access uses amber in both locations, successful connection no longer inserts an explanatory dashboard banner, and the mobile connection row is compact. Bottom-of-page reachability and unscrolled error-state screenshots are included in the focused browser checks. Claude's screenshot review does not independently verify automated test counts or unseen states; those are supported by the test logs and fixtures.
