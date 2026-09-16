# Academic homepage maintenance

## Source and scope

- This is the existing `picapica2025/sociologist.github.io` GitHub Pages site at `https://ghwsocio.social/`.
- `index.html` owns the visible profile, CSS, and interaction code. This is a static site with no production JavaScript dependencies.
- Confirm `git status`, `git log -1`, and the remote main baseline before editing. Do not use the GitHub Contents API to bypass the local Git history.
- The September 2026 upgrade branch is `upgrade/maintenance-20260913`, based on remote main `61abdf1b62ffb8d310950676594a746de7914134`. The older sibling working directory was preserved with its original uncommitted page; do not treat it as the upgraded source.

## Content rules

- Research interests are qualitative sociological research, sociology of ideology, social change, and gender studies. Public writing, translation, and migration-related experience are not additional research fields.
- Preserve education, research entries, GPA values, awards, scholarship percentages, dates, and institutional names unless the user supplies a verified correction or new CV.
- Display languages in this order: Chinese, English, Korean, Japanese. Do not infer proficiency levels.
- Keep the header compact, contact links at the bottom, and the two section headings on one line at supported widths. Do not reintroduce a WG badge, GitHub contact button, or duplicate degree statement.
- Keep metadata and the share card consistent with visible, verified information. Do not add personal data from unrelated local files.

## Verification and publication

- Current release topology (2026-09-14): remote `upgrade/editorial-20260914` holds full source; local `source/editorial-20260914` tracks it. `main` holds only the six public files and still triggers legacy Pages. Do not merge the full-source draft PR into main. Follow the current-state section of README; manual Actions publishing is not enabled.

- Use Node 24.8 or later and `npm ci --ignore-scripts`. Dependencies are development-only and locked.
- Run `npm run check:html`, `npm run build`, and the browser tests against `dist` as described in README.md.
- Check actual printed body visibility, not only bounding boxes or `display`. Retain the original disclosure state after print.
- Preserve the native no-JavaScript fallback, reduced-motion handling, keyboard access, all seven disclosures, and rapid animation reversal.
- Keep `scripts/public-files.mjs` as the explicit publication allowlist. Do not deploy test reports, source CV files, package files, or the entire repository root.
- The heading-role exception in `.htmlvalidate.json` preserves the phrasing-content structure inside each summary; other recommended HTML checks remain enabled.
- Follow the user's publication authorization. Local tests are not proof of a successful remote workflow or deployment. After publishing, compare local, remote, and live content and verify both domain routes.

## Mandatory visual acceptance (user request, 2026-09-16)

- Passing automated tests is not visual approval. Inspect actual rendered screenshots before claiming that the interface has been checked.
- Before every release, inspect the initial screen and all seven sections collapsed and expanded at desktop (1280 px), mobile (390 px), and narrow mobile (320 px) widths. Pay particular attention to the first section and long academic entries.
- Review hierarchy, font sizes, line wrapping, spacing, alignment, and consistency, not just overflow or element visibility. Verify disclosure transitions and keyboard/reduced-motion behavior separately.
- Keep the seven section headers compact and consistent. The full undergraduate thesis title belongs in the expanded academic-work content, not an oversized collapsed summary, unless the user explicitly requests otherwise. Preserve full research, award, and grade details.
- After deployment, reload the real public website and inspect desktop/mobile collapsed and expanded states again. Record what was actually viewed, test outcomes, and any remaining unverified browser coverage. Never substitute a test list, health response, or deployment status for visual acceptance.
