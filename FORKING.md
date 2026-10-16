# Reuse for another chapter

1. Fork the repository and enable Actions and Pages (GitHub Actions source).
2. Edit `config/chapter.json`: chapter/school, repository, Pages URL, IANA timezone, active year, Instagram handle, iCal URL, brand colors/logo, event types, hashtags, caption template, and default cadence.
3. Remove the labeled example JSON records if unwanted. Create your own events in a fresh year folder using the dashboard. Do not copy another chapter's live `results` identifiers or access tokens.
4. Complete SETUP.md with your own chapter-owned Business Instagram and GroupMe accounts. Add the required Actions secrets, including token expiry and a Secrets admin PAT.
5. Run tests, build, render, and deploy. Use doctor with `--live`, then a real test campaign in a test account/group. Live readiness depends on actual credentials, account approval, and publicly reachable images; changing chapter.json alone cannot authorize external accounts.

Flyer templates live in `templates/`; `editorial.html` reads chapter colors, logo, and content at render time. Keep values generic. To add another layout, add `templates/<name>.html`, set `defaultTemplate` or an event type’s `template` to that name in config, and validate both feed and story dimensions.
