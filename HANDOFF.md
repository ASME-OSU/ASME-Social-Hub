# Annual officer handoff

1. Invite incoming officers to the repository/organization and verify access before removing outgoing officers. Use chapter-owned Meta and GroupMe accounts; transfer app administration and account recovery methods.
2. Rotate the GroupMe user token and optional bot token, then the chapter Meta credentials and long-lived Instagram token. Update `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IG_TOKEN_EXPIRES_AT`, `GROUPME_TOKEN`, `GROUPME_GROUP_ID`, `GROUPME_BOT_ID`, and `SECRETS_ADMIN_PAT` in Actions secrets. Replace personal browser PATs and clear saved connections on old/shared devices. Never commit credentials.
3. Keep the original GroupMe event creator account. New accounts cannot edit its old native events. If replacing it is unavoidable, reconcile upcoming events before switching tokens.
4. Change `activeYear` in `config/chapter.json`; new campaigns use a new year folder automatically. Keep prior-year data and media. Duplicate successful archived campaigns, clear dates, and record new officer notes.
5. Review branding, event types, captions, calendar feed, schedules, and timezone. Confirm Pages and Actions are enabled, token-expiry alerts work, and the Secrets admin PAT has not expired.
6. Run `npm ci`, `npm test`, `npm run build`, `npm run dry-run`, and `node scripts/doctor.mjs --live` with secrets available. Verify a real test campaign and cancellation using a test account/group. Check one saved prior-year record and its links.
7. Record the date and incoming responsible officers in your chapter's private transition documentation. Keep personal recovery information out of this public repository.
