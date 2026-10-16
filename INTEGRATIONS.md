# Integration evidence and operational limits

No live publish, message, event mutation, or token rotation was performed during implementation. Mocked integration tests exercise response handling, credential redaction, expiry boundaries, recurrence, and conservative retry behavior. Credentialed acceptance checks remain necessary before enabling automatic publishing.

## Instagram Login

Use an Instagram professional account and a Meta application configured for Instagram Login. Request `instagram_business_basic` and `instagram_business_content_publish`. Configure the additional insights permission available to the application in Meta's dashboard before enabling metrics. The code uses `graph.instagram.com`, bearer authorization for publishing, and a configurable `IG_API_VERSION` (default `v25.0`; this is a pinned version, not a claim about the latest release).

The implementation creates a media container, polls its processing status, then publishes it. Public flyers must return a successful response with `image/jpeg`. The scheduler checks publishing quota. Container IDs and write intent are persisted so ambiguous network failures require reconciliation rather than blind reposting. Story publishing should be validated with a Business account; account permissions and supported media capabilities can differ.

An app tester must have the appropriate application/account roles and grant the requested scopes. Whether a particular development-mode application can publish to its own account without further review must be verified in that application's dashboard and with a controlled test; it was not independently established here. Never treat a successful local dry run as proof of Meta authorization.

`refresh-token.mjs` uses the long-lived-token refresh endpoint and saves both `IG_ACCESS_TOKEN` and `IG_TOKEN_EXPIRES_AT` through `gh secret set` stdin using `SECRETS_ADMIN_PAT`. Token rotation and expiry writes are separate GitHub API operations: if the second write fails, the token may already have rotated; check the workflow failure and repair the expiry secret. The opaque access token cannot reveal its expiry locally. `assessTokenExpiry` flags unknown, expired, and fewer-than-14-days values; `doctor` reports the configured expiry. Refresh requires an unexpired eligible token; reauthorization remains a human OAuth step. The refresh endpoint necessarily receives the token in its query string; neither that URL nor provider error bodies are logged.

Insights store only allowlisted numeric values and the source media ID. Feed snapshots are taken after day 1 and day 7. Story snapshots are attempted once while the story is less than 24 hours old. This is a conservative collection policy, not a guarantee of Meta's retention window. Run collection more often than daily to reduce missed story windows. A first run after day 7 records only the day-7 snapshot. Unsupported metrics, missing permissions, or expired media produce a safe log entry rather than fabricated zero values. Story data can be partial and metrics may change across API versions.

Primary references checked during implementation:

- [Meta's official Instagram API Postman collection](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00): Instagram Login, current scope naming, account/app tester requirements, and absence of a Facebook Page requirement for this login mode.
- [Meta's official Instagram API collection, publishing material](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-23eacf45-3728-4e41-bcc7-6d164959327c): container and media-publish flow. Some collection examples are for Facebook Login; this implementation deliberately uses the Instagram Login host/scopes.
- [Meta Instagram Login content publishing documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing), [business login/token documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login), and [insights documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights): canonical pages to check during setup. Direct retrieval returned rate-limit/inaccessible responses during implementation; do not interpret those pages as fully verified evidence for account review or metric retention details.

## GroupMe

Native calendar events use a community-documented API rather than a supported official calendar contract. Use a chapter-owned user account that remains in the group. Only the creating user can update/delete its events. Credentials and group ID come from environment variables. Flyers upload to GroupMe's image service before being attached.

Create/update response handling accepts the documented envelope containing `event`, and preserves the authentic short event URL from the accompanying creation message when present. Listing supplies `end_at` and `limit`; cancellation uses `DELETE`. Reminders are restricted to the documented set and a maximum of two. Optional bot announcements are separate from native calendar writes; operators must reconcile uncertain writes before retrying. The hosted ICS file remains available even when native event creation fails.

References:

- [OpenGM community Calendar Events documentation](https://groupme-js.github.io/GroupMeCommunityDocs/api/conversations/calendar/): create/update/delete, envelope, creator restriction, image requirement, reminder values, list parameters, and creation-message event URL. This reference is community-maintained and may lag server changes.
- [Official GroupMe API documentation](https://dev.groupme.com/docs/v3): official API context and bots; it does not turn the community calendar endpoint into an official supported contract.
- [Official GroupMe image service documentation](https://dev.groupme.com/docs/image_service): image upload service.

## Calendar import

`ical.mjs` extracts the existing newsletter builder's `node-ical` recurrence expansion and serialization. It handles recurring instances, overrides, excluded dates, and cancellations. It removes chapter-specific calendar IDs and uses `config.icalUrl`. Recurrence occurrence IDs combine calendar UID and start timestamp, so weekly occurrences are distinct. Changes to a source occurrence's start timestamp create a new suggestion and require officer review rather than guessing that two occurrences are identical. Candidate changes are surfaced for review; existing published campaigns are not silently modified.

The pinned `node-ical` version must provide `async.parseICS` and `expandRecurringEvent`. Tests exercise those actual APIs, including recurrence exclusions. Calendar URLs must be public feeds; calendar fetching does not carry officer credentials.
