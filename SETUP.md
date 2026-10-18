# Setup

## GitHub and Pages

1. Use Node 22+. Run `npm ci`, `npm test`, and `npm run build`.
2. In repository **Settings → Pages**, select **GitHub Actions** as the source. Allow Actions to write repository contents. The render workflow deploys `docs/`.
3. Set `repository`, `siteUrl`, `timezone`, `activeYear`, chapter branding, captions, and event types in `config/chapter.json`. Calendar and Instagram handle are intentionally blank until officers supply them. All committed data, uploaded flyers, and dashboard content are public.
4. Run **Render and publish dashboard** after changing configuration or campaigns. A dashboard save with an officer PAT triggers this automatically. The issue fallback automatically renders and deploys after a successful import.
5. Connect a fine-grained PAT with access only to this repository and **Contents read/write** in dashboard Settings. Approve organization access if required. It is used only to commit campaign JSON and flyer uploads. Store it in the browser only on a trusted personal device. Clear connection on shared computers.

## Instagram Login

Use a chapter-owned Instagram **Business** account and Meta developer app with Instagram API / Instagram Login. This implementation uses `graph.instagram.com`, not the Facebook Login publishing flow; a Facebook Page is not required by that flow.

1. Configure the app redirect URI and add the chapter account and setup officer to the appropriate app/tester roles. Complete human OAuth consent in the Meta dashboard with `instagram_business_basic` and `instagram_business_content_publish`. Request the insights permission offered for Instagram Login in the current dashboard; confirm its exact scope and approval requirements using the linked official documentation in INTEGRATIONS.md.
2. Exchange the authorization code for a short-lived token, then exchange it for a long-lived token using Meta's documented server-side flow. Keep the client secret and tokens out of repository files, screenshots, logs, URLs shared with others, and this chat. Save the returned account ID and token directly as Actions secrets.
3. Test a private/test campaign with your own account. Own-account dev-mode access, App Review requirements, and insights access must be verified in the current Meta dashboard; they are not assumed to work without review.
4. Add Actions secrets `IG_USER_ID`, `IG_ACCESS_TOKEN`, and `IG_TOKEN_EXPIRES_AT` (the actual ISO expiry timestamp). Optional repository variable `IG_API_VERSION` selects the version tested by your app; the code defaults to `v25.0`.
5. Add `SECRETS_ADMIN_PAT`, a separate fine-grained token restricted to this repository with **Secrets read/write** so refresh can update the two Instagram secrets. Add Contents read access if GitHub requires it. The default workflow token cannot update Actions secrets.
6. Run **Refresh Token** only after the long-lived token is at least 24 hours old. The workflow runs twice monthly and stores the new token and expiry. A fully expired or revoked token requires OAuth consent again; repeat steps 1–4 and run doctor.

JPEGs must be publicly reachable before Instagram container creation. Render and deploy first. A custom feed/story image URL must return `image/jpeg`; uploaded PNGs and JPEGs (up to 8 MB) are placed in a generated chapter template, then rendered as JPEGs for Instagram. Uploaded PNGs retain their `.png` extension in the repository. Instagram may enforce additional image/account limits. Stories are Business-only in the current reference, contain no interactive stickers, and disappear from Instagram; saved campaign metadata remains in the archive.

Each campaign has separate feed, story, and GroupMe announcement switches. Turn off any combination, including all three, before saving; turning off an unsent step prevents its publication. Published posts remain published. The GroupMe switch is visible but unavailable while the chapter-wide integration is off. In bot mode its schedule follows the feed schedule even when the feed post itself is off.

In **Settings → Default posting channels**, save preferred starting choices for feed, story, and GroupMe announcements. These non-credential preferences persist for this repository and branch in the current browser/profile; they do not sync to other browsers/devices or change existing campaigns. New manual campaigns and calendar suggestions use them. Duplicates retain the source feed/story choices and start GroupMe off. Reset restores feed/story on and GroupMe off. A GroupMe-on preference never bypasses the chapter-wide off switch. Preferences do not change whether a GitHub token is remembered.

## GroupMe

Create a dedicated chapter account, add it to the target group, and obtain its user access token. Native calendar events use an **unofficial** endpoint, and only their creator can edit/delete them. Keep ownership with the chapter at handoff.

Set Actions secrets `GROUPME_TOKEN` and `GROUPME_GROUP_ID`. Optionally create an official GroupMe bot and set `GROUPME_BOT_ID`. To request an announcement/fallback message, set `campaign.groupme.announce: true` in a campaign record. The dispatcher records intent before sending a bot message and never blindly repeats an ambiguous send. Native failure falls back to a hosted `.ics` link when announcements are enabled; a repository issue reports automation failures. Optionally set `OFFICERS_GROUPME_BOT_ID` for a bot in a private officers group to receive new failure or token-expiry alerts. Without an enabled bot, use the dashboard and GitHub alert to share the calendar file manually.

The native API uses GroupMe's uploaded image service, at most two allowed reminders, and chapter timezone. The doctor lists upcoming events without creating anything.

## Calendar, verification, and recovery

Set a public `icalUrl` in config. Calendar refresh runs daily; suggestions exclude already-used occurrence UIDs and flag changed source events in `data/candidates.json`. Officers review source changes rather than applying them automatically. All-day events require selecting an actual meeting time before saving.

Run `node scripts/doctor.mjs --live` in an environment with the secrets. It checks account access, GroupMe event listing, Pages, calendar, and configuration without publishing. Use the Actions **Dispatch campaigns** manual run with **dry_run checked** first. Then use a test Business account/group for real feed, story, edit, cancel, and refresh tests. Those credentialed acceptance checks cannot be certified by local tests.

When a campaign reports an ambiguous publish/create outcome, inspect Instagram/GroupMe before retrying. If it succeeded, record the returned `mediaId`/`eventId`, posted/created timestamp, and `status: done`; set GroupMe `syncedRevision` to the campaign revision. If the provider confirms nothing was created, remove the corresponding `publishAttemptedAt` or `createAttemptedAt` and container ID if expired, and set the step pending. Preserve the log. A stale local `data/.dispatch-lock` can be removed only after confirming no dispatcher process is active. Actions concurrency serializes all workflow mutations; dashboard writes can still cause a Git conflict, which aborts the run safely and needs a fresh rerun.

GitHub cron is best-effort and can be late or disabled after prolonged inactivity. Keepalive writes a monthly maintenance record; check Actions schedules manually at handoff and after quiet periods. Do not rely on this app for time-critical announcements. The insights workflow runs hourly to capture short-lived story metrics and snapshots feed metrics after 1 and 7 days; unsupported metrics stay unavailable rather than becoming fabricated zeros.

## Current chapter integrations

GroupMe bot announcements are enabled (`integrations.groupme.enabled: true`, `mode: "bot"` in `config/chapter.json`). Each campaign must opt in; browser defaults can preselect that choice for new campaigns. Existing calendar suggestions and demo data do not send announcements. Set `enabled: false` to pause every GroupMe call. Instagram and newsletter calendar suggestions remain enabled.

## GroupMe bot announcements (optional)

`integrations.groupme.mode: "bot"` uses only `GROUPME_BOT_ID`. The per-campaign announcement checkbox starts unchecked unless an officer saves a browser default. Use `enabled: false` as the chapter-wide pause switch. Bot mode never creates native GroupMe events, accesses the conversation history, or uploads images using a personal account token. Leave the GroupMe bot callback blank for outbound-only use.

An opted-in campaign sends one text announcement at its feed schedule (also when Instagram feed publishing is unchecked). Messages include chapter-local event time, location, food when provided, and links to the flyer and calendar. Calendar suggestions and demo campaigns do not send messages by themselves. Inspect a dry run before enabling. Edits after a successful send do not resend or update the existing message. Cancellation stops an unsent announcement; it does not remove an existing message.

The scheduler saves a durable intent before sending. After an ambiguous failure, an officer must inspect GroupMe before reconciling state; automatic retries could duplicate a message. A saved bot credential is not a delivery test. A real test message requires chapter approval.

At officer handoff, register a replacement bot with the same name/avatar under the incoming officer, replace `GROUPME_BOT_ID` in GitHub Actions, verify delivery, then retire the old bot before the outgoing owner leaves the group. Do not hand over a personal GroupMe access token.

For private delivery testing, create a separate bot in **ASME Bot Testing** and save its ID as `GROUPME_TEST_BOT_ID`. The **Test private GroupMe bot** workflow defaults to preview only. Selecting `send_test` sends one setup message with the separate test credential; this job never receives the production bot credential. Confirm the message appears in the private group. Production announcements remain disabled until explicitly enabled.

## Optional advertising details

Expand **Event extras** when creating or editing a campaign to add food details, RSVP link and deadline, audience, cost, preparation/dress, speaker/company, attendance benefit, and accessibility contact. Blank fields are omitted. RSVP deadlines use the chapter timezone, and links must use HTTPS without embedded credentials. Use an organizational contact appropriate for public advertising; these details are saved in the public repository.

Food details appear only when Food provided is checked. Captions and announcements include completed details; flyers highlight key information and direct readers to the caption for fuller instructions. Keep copy concise: Instagram captions and GroupMe announcements have provider length limits, and excessive content produces an actionable error rather than silently losing information.

Stories are generated as one static 1080×1920 JPEG from the event fields and selected chapter template. The publisher sends the image as a Story, without a visible feed caption or interactive music, polls, or link stickers. Story artwork therefore omits references to a caption. The scheduled dispatcher runs hourly at minute 17; scheduled times are targets and GitHub Actions can run late.

## Flyer styles and maintenance feedback

Choose **Flyer style** in the campaign editor: **Refined blueprint**, **Editorial poster**, or **Assembly card**. The choice is saved per campaign and preserved when editing or duplicating. The default is Refined blueprint; legacy Blueprint and Editorial values remain supported for older records. Both feed and Story artwork use the simpler circular chapter logo configured by `brand.logoFlyer`. The dashboard corner logo and tab icon use the separate Social Hub branding.

The renderer fits long titles and optional event details before saving JPEGs. Shorten copy if it reports insufficient space. Actions caches revision markers, but missing images are always regenerated and published assets remain protected.

Settings displays a renewal warning when a known Instagram expiry is within 14 days or has passed. Unknown expiry does not invent a deadline. Each maintenance check replaces the previous status, and warnings show when their last check is stale. Issue imports now comment with validation guidance on authorized failures; success is confirmed and the issue closed after the campaign commit is pushed.

The event editor includes a collapsible **Live flyer preview** beneath Flyer style. Switch between Feed and Story to see the actual templates update with title, chapter-local date/time, location, food, and event extras. Empty required fields show labeled placeholders. Selected uploads appear in the template; a channel's direct image URL previews that override instead. Previewing never saves a campaign or publishes anything. Final JPEGs are rendered by Actions after saving, so allow small differences between browser font rendering and the final image.

**Story backgrounds** adds three optional treatments: **Color wash**, **Blueprint rings**, and **Folded paper**. Upload a PNG or JPEG, select a treatment, and review it in Story preview. Each keeps the full flyer centered without cropping. **Chapter template** retains the existing template. These choices affect Stories only. Feed posts use the uploaded flyer directly, preserving its proportions with no added text, borders, logos, or background design. Uploads are resized to 1080 pixels wide and converted to JPEG for publishing; transparent pixels become white. If no flyer is uploaded, Feed falls back to the selected chapter template.

**Use flyer colors** samples the artwork locally and shows its palette beside the choices. Turn it off to use chapter colors, or select **Resample colors** to try again. Transparent, monochrome, or unreadable remote images fall back to chapter colors with an explanatory note. The selected treatment, color source, and sampled palette are saved with the campaign and restored when editing or duplicating, so publishing uses the reviewed colors. Wait for sampling to finish before saving a new treatment. A direct Story image URL overrides these backgrounds and disables their controls until cleared.

## Social quick links

`socialLinks` in `config/chapter.json` controls the Instagram, LinkedIn, Facebook, and Linktree icon links. Use the chapter's exact public HTTPS profile URLs. Empty or invalid entries are hidden. Icons appear above the connection status in the sidebar, remain available in its collapsed rail, and are available from the header link icon and page footer on mobile. Each opens a new tab with an accessible label. Instagram and LinkedIn match the links published on the chapter website; Facebook and Linktree use the chapter URLs confirmed by the officers.
