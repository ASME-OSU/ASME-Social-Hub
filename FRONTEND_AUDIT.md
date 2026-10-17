# Frontend audit — October 17, 2026

Reviewed and implemented with an Astra sub-agent, followed by local browser and visual verification.

## Changes

| Finding | Implemented improvement |
| --- | --- |
| Posting choices were unclear and GroupMe was hidden while disabled | Explicit feed, story, and GroupMe On/Off controls; visible chapter-wide GroupMe status; all-off draft guidance |
| Uploads accepted only JPEG and offered little feedback | PNG/JPEG selection, matching format signatures/extensions, image preview, filename/size feedback, and clear-selection action |
| Dialogs and view changes lacked reliable accessible context | Named dialogs, heading focus, contextual action/input names, current navigation state, and focused errors |
| Saves and connection checks gave insufficient progress feedback | Busy states, duplicate-submission protection, and staged verification that preserves the active connection until a replacement is verified |
| Archive filters could leave users in an unexplained empty view | Result counts, clear-filters action, and distinct loading, empty, and error states |
| Mobile archive titles compressed into narrow columns | Explicit phone grid placement for title, metadata, metrics, and actions |
| Phone scheduling controls were cramped | Larger input text, full-row channel controls, two-column cadence fields, and a sticky save footer |
| Detail information was difficult to scan | Labeled flyer previews, missing-image explanations, readable insight metrics, and expandable raw snapshots |
| Disabled schedule fields could retain invalid cleared values | Inactive invalid cadence values fall back to chapter defaults when saving a draft |

## Verification

- Unit tests cover every combination of the three publishing channels and verify unchecked channels make no publishing calls.
- Browser fixtures verify PNG uploads preserve bytes and extension, reject mismatched signatures, display/clear previews, and render PNG sources into Instagram-compatible JPEGs.
- Browser checks cover edit restoration, re-enabling an unsent channel, scheduler-state preservation, conflicts, focused errors, accessible dialog names, connection feedback, and archive filter reset.
- Visual checks cover dashboard, editor, posting controls, campaign details, archive, and settings at 1280, 820, and 390 pixels.

## Operational behavior

The audit preserved the chapter-wide GroupMe pause. GroupMe bot announcements were subsequently enabled at the chapter’s request, with per-campaign opt-in and browser defaults. No social posts or GroupMe messages were sent during the audit. Turning a channel off prevents an unsent step; it does not remove a published post.

Uploaded PNGs and JPEGs serve as source artwork for the chapter template. Generated publishing assets remain JPEG. Direct feed/story URL overrides still require publicly reachable JPEGs.

This was a focused usability and accessibility audit, not a formal accessibility certification.
