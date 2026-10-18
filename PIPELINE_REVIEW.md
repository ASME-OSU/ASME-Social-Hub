# Review of Anti-Gravity feedback — October 17, 2026

The findings identify useful reliability and usability fixes. All reported areas were addressed, with three adjustments described below.

| Finding | Implemented response |
| --- | --- |
| Calendar location disappears when stored as a string | ICS export now accepts string and object locations. |
| Caption paragraphs collapse | Intentional paragraph breaks survive; empty optional placeholders and excessive blank lines are removed. |
| Insights fail on loose files | Insights use the shared validated campaign reader and atomic JSON writer. |
| Verification workflows hardcode chapter identity | Instagram identity and private GroupMe test wording read chapter configuration. |
| Issue requests lack feedback | Authorized invalid imports get a sanitized correction message. Successful requests are confirmed and closed only after the repository push succeeds. |
| Expiry data becomes stale or invisible | Every expiry check writes a fresh healthy, unknown, warning, or expired record. Settings shows known expiry warnings and identifies stale checks. |
| Disabled issue-import channels show pending | Imported disabled steps are skipped; bot mode still requires explicit announcement opt-in. |
| Render markers disappear between Actions runs | Only render markers are cached. A matching marker skips rendering only when a nonempty JPEG also exists. Campaign, configuration, template, and bundled asset changes invalidate the marker. |
| Finder/iCloud duplicate files clutter the checkout | Eight identical copies were moved to a local backup. Two differing copies were preserved separately for review. Targeted ignore rules prevent these conflict copies from returning to generated/test trees. |

## Adjustments to the suggestions

- Caching markers alone is insufficient: a missing output image must be regenerated. Published or ambiguous publishing assets remain immutable.
- Import errors are summarized without echoing raw issue content or error payloads into public comments. This avoids accidentally disclosing pasted credentials. Unauthorized authors receive no validation feedback.
- Duplicate cleanup is reversible. Backups and the manifest live under `.local/conflict-backups/2026-10-17/`; differing copies were not discarded.

## Flyer updates

The simpler chapter logo was found at `Downloads/Logos/asme_osu_logo_transparent_background.png` and matched against the chapter Instagram profile. It is bundled as `docs/assets/logos/chapter-simple.png`. The Social Hub corner logo and favicon retain the previously requested Social Hub branding.

Each campaign can select Refined blueprint, Editorial poster, or Assembly card. Refined blueprint is the default. Existing legacy template values remain supported. Assembly artwork is centered within its SVG viewBox, and its navy header remains readable with uploaded artwork. Both feed and Story variants fit titles and event extras within the publishing area; decoration shrinks before text.

## Validation scope

Local unit checks cover calendar locations, caption paragraphs, loose files, imported disabled steps, template validation, and expiry-state transitions. Browser checks cover style selection and persistence, warning visibility, 30 layout combinations (five supported templates, two formats, three content variants), PNG artwork, and render caching with deleted-output recovery. Screenshots were inspected for all three new styles. These checks use mock content and isolated fixtures; they do not publish social posts or send messages.
