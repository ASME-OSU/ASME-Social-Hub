# LinkedIn publishing setup

LinkedIn is implemented but paused in `config/chapter.json`. Existing campaigns are not opted in. Officers can prepare schedules and captions while approval is pending. No live LinkedIn publishing or authorization has been tested.

## Chapter applications

Verified in Chrome on October 31, 2026:

| Purpose | Application | App ID | Client ID | Product status |
| --- | --- | --- | --- | --- |
| Chapter Page publishing | ASME Ohio State Social Hub 2 | 264214085 | 863xwuy43av292 | Community Management Development Tier: review in progress |
| Personal sharing / sign-in | ASME Ohio State Social Hub | 264200072 | 86zp8znmf5qs6w | Share on LinkedIn and OpenID Connect added |

These are public application identifiers. Page publishing uses the Community Management app. Tokens and permissions from the two apps cannot be combined; the sign-in/sharing app is not needed by the dispatcher.

Chapter Page: <https://www.linkedin.com/company/asme-osu/>. Its matched organization URN is `urn:li:organization:116454259`. Confirm that the authorizing officer administers this exact Page before activation.

## While approval is pending

Keep `integrations.linkedin.enabled` set to `false`. Officers can opt a campaign into **Schedule → LinkedIn Page post**, choose its own days-before/time, and enter an optional caption. Blank captions use the shared event caption. **Preview LinkedIn post** shows copy and flyer images. LinkedIn uses the same ordered feed flyers even if Instagram feed posting is off. Duplicating a campaign starts LinkedIn off.

Review the privacy disclosure at `privacy.html`. After deployment, its URL is `https://asme-osu.github.io/ASME-Social-Hub/privacy.html`. Confirm the chapter's contact route and handling practices before entering it in either developer application. The original app's privacy-policy field was blank when inspected; the pending app's field has not been checked.

## After approval

1. In the publishing app's **Auth** tab, check for `w_organization_social`. Obtain an access token for this app using LinkedIn's [OAuth Token Tools](https://www.linkedin.com/developers/tools/oauth/token-generator) and an officer with an eligible chapter Page role. Authorize the approved Community Management scopes needed for Page posting and image processing. Product approval alone does not authorize a member or issue a token. Do not substitute a token from the other app.
2. In the repository's **Settings → Secrets and variables → Actions**, configure:

   | Kind | Name | Value |
   | --- | --- | --- |
   | Secret | `LINKEDIN_ACCESS_TOKEN` | Token issued to the Community Management app |
   | Secret | `LINKEDIN_TOKEN_EXPIRES_AT` | Actual expiry in ISO UTC, from the OAuth response's `expires_in` |
   | Variable | `LINKEDIN_ORGANIZATION_URN` | `urn:li:organization:116454259` |
   | Variable | `LINKEDIN_API_VERSION` | `202610`; pinned implementation version, verify support before activation |

   Never put tokens, client secrets, authorization codes, refresh tokens, or signed upload URLs in campaign JSON, configuration, chat, or committed files. The dispatcher needs no client secret. The earlier `LINKEDIN_ORGANIZATION_ID` secret remains supported as an alternative to the organization URN variable. A known token expiry is now also required.
3. Run `npm run check` and `npm test`. With credentials available locally, `npm run doctor` checks configuration and expiry without publishing. `doctor --live` performs a read-only organization lookup when enabled; a successful lookup does not prove publishing authorization.
4. Review all opted-in campaigns and prepare a future controlled test. Chapter-wide activation may send any opted-in campaign already due within its catch-up window. Enable the integration only when ready, and run **Preview dispatcher** first. Preview makes no API calls and cannot validate credentials or access.
5. Authorize one controlled live publish. Verify the chapter Page identity, rendered text, image order, saved post ID/permalink, and duplicate suppression on a later pass before enabling other campaigns. Delivery remains unverified until this succeeds.

The Hub checks due campaigns using its existing GitHub scheduler and recovery mechanisms. These are best-effort schedules. Posts are eligible for up to 24 hours after their due time and only before the event starts. No additional LinkedIn scheduling service is needed.

## Tokens and handoff

The adapter refuses to publish with missing credentials or an unknown/expired expiry. Scheduled maintenance records a redacted warning and alerts when enabled credentials are missing, unknown, near expiry, or expired. The dashboard checks the warning against the current date.

Automatic refresh is not implemented. LinkedIn provides programmatic refresh tokens only to eligible applications; do not assume Development Tier includes them. Reauthorize before expiry and replace both Actions secrets. At handoff, ensure an incoming officer has eligible application and Page administration access.

## Recovery and limits

`results.linkedin` retains the Page author, prepared revision, public image URLs, uploaded image URNs, caption, intent timestamp, post ID, permalink, and posting timestamp. Tokens and signed upload URLs are never persisted. Production publishing checkpoints image progress and write intent to GitHub before sending.

If `publishAttemptedAt` exists without a post ID, publication stops, including after the catch-up window. Inspect the chapter Page first. If the post exists, reconcile its actual receipt and mark the channel done. Clear the attempt only after establishing that no post was created and explicitly deciding to retry. Never clear uncertainty merely to unblock the scheduler.

Definite HTTP rejections (400, 401, 403, 404, 422, 429) allow a later retry. Network failures, timeouts, server errors, and missing post IDs retain the intent. Asset uploads can retry because they do not publish posts. Edits discard prepared copy and images only before a publication attempt. Author mismatches block publishing.

Opt-out, cancellation, deletion, and archiving stop future sends. Published posts remain recorded and are not remotely edited or deleted. This integration supports up to ten ordered flyer images, an independent caption and schedule, status, and receipts. LinkedIn insights, videos, documents, comments, and advanced mentions are not implemented. Caption text is escaped for LinkedIn's little text format.

## Primary references

- [Community Management approval](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview)
- [Posts API and permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api)
- [Little text format](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format)
- [Refresh tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens)
