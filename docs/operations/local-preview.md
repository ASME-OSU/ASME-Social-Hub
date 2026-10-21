# Local campaign editor review

Run `PORT=4275 node scripts/preview-local.mjs`, then open http://127.0.0.1:4275/.

The main review now uses the familiar campaign form. Event, Schedule, Flyer, GroupMe, and Notes remain in one form, with persistent section navigation. The preview fits the complete artwork by default; captions and 100% zoom are optional. GroupMe shares the right-hand preview pane.

The member event page is retained separately, with flyer, event details, RSVP, Google Calendar, and an ICS download. The GroupMe section offers an opt-in single event link. Builds generate public event pages when a public site URL is configured. Existing announcements retain their original calendar/flyer links unless explicitly changed.

Local mode ignores stored repository credentials, blocks repository API calls, and saves drafts in browser storage and server memory only. It does not publish, edit production campaigns, or send messages. New campaigns without a generated or uploaded image display an artwork placeholder on the local member page.

Verification: `npm test`, `npm run check`, `npm run check:browser`, and (with port 4275 running) `node scripts/check-restored-local.mjs`. The focused local check covers five viewports, complete Feed/Story fit, caption controls, event-page opening, and local draft persistence.
