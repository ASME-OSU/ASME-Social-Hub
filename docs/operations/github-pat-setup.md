# Officer access and first-time guide

The header’s ⓘ Guide button opens the campaign walkthrough, GitHub setup instructions, and visibility explanation. Settings also has a dedicated Step-by-step PAT setup guide and an expandable inline copy. Both PAT views use `docs/hub-guide.mjs` so their steps stay identical.

For ASME-OSU/ASME-Social-Hub, connect to main. Each officer needs their own GitHub account with repository write access. The guide walks through profile Settings, Developer settings, Fine-grained tokens, organization ownership, Only select repositories, the selected repository, token generation, and Connect & verify. It also covers GitHub’s Confirm access prompt and organization approval.

| Permission | Selection | Purpose |
| --- | --- | --- |
| Contents | Read and write | Campaign saves, flyer uploads, cancellations, deletion |
| Actions | Read and write | Optional manual Preview / Run live dispatcher controls |
| Metadata | Read-only, automatic | Basic repository information |

The shortcut pre-fills the resource owner, requested permissions, and a 90-day lifetime. Users still review it and select the repository on GitHub. Organization policy may require a shorter lifetime or approval. Workflows permission is unnecessary because the app does not edit workflow definitions.

The hub remains publicly viewable. Without credentials, form edits are previews or JSON exports; they do not write to the repository. A token must have the account’s underlying repository permissions and the relevant token permission for writes. Connect & verify currently verifies reading chapter configuration; it does not prove the token can write or bypass branch protections.

A shared password implemented entirely in the public frontend would not protect campaign JSON, artwork, or static HTML. Actual confidentiality requires authentication at the hosting layer and private/protected data access. Public campaign descriptions and officer notes should be appropriate for public viewing.

Browser token storage remains opt-in. Unremembered tokens stay in memory and are lost on reload/close. Clear connection removes the browser connection; GitHub token revocation is separate. Publishing credentials remain in Actions secrets.

Checked October 20, 2026: GitHub’s token entry point displayed Confirm access with Use passkey / Send a code via email. No credential was created or changed. The remaining creation steps were checked against [GitHub’s official token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Contents API permissions](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents), and [workflow dispatch permissions](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).
