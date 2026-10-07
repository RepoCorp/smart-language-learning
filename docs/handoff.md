# Working handoff

Updated: 2026-10-07. This is a snapshot, not a permanent task list.
Read `START_HERE.md` first. Verify current files and git state before acting.

## Latest addition: definition-based evaluation

The new `-keit` production and recognition evaluations are connected to ordinary sessions through
the existing pattern enrollment, directional counters, versioned review API, and
SRS. No migration or production changes. Other patterns remain
legacy. The admin playground still does not persist scores. Architecture and
verification commands: `architecture/learning-content-playground.md`.
The old `NewItem.tsx` component is now `LegacyItemView.tsx`. Shared item headers
are composed from presentation components; old type/noun decisions are isolated
in `itemView/legacy/LegacyItemViewHeader.tsx`. Earlier dated sections below remain
historical context; inspect the worktree rather than assuming their paths or
verification results are current.

The new onboarding documents and `AGENTS.md` update are also uncommitted.
For a focused change, consult `architecture/regression-map.md` rather than
rediscovering the relevant test suites or assuming coverage from their names.

## Latest work, present in the uncommitted worktree

Three completed implementation slices are still uncommitted at this handoff:

1. **Word audio includes only the saved word/expression.** Initial save, audio
   regeneration, and item regeneration no longer append the example sentence.
   Existing clips need explicit regeneration. See `architecture/item-audio.md`
   and `backend/tests/test_word_audio_text.py`.
2. **Admin weekly study minutes.** Uses existing daily active seconds rather than
   adding tracking or estimating historical activity. Conversation allowance is
   separate. See `architecture/admin-study-usage.md` and its listed tests.
3. **Live conversation automatic ending.** Explicit closing tool, final spoken
   goodbye, then finish only after the matching audio has drained. Transcript is
   retained and review remains on demand. Manual End remains. Natural-voices HTTP
   mode is unchanged; extending it was asked about but not approved/implemented.
   See `architecture/conversation-ending.md`, the frontend `ending/` folder,
   `frontend/tests/conversation/`, and the backend closing instruction test.

Do not mistake these files for abandoned edits or overwrite them. No deployment
or production migration was performed by the latest conversation-ending task.

Additional 2026-09-30 work: larger tappable dialog text and zoom-safe item modals.
See `architecture/accessibility-text-and-modals.md`. It removes forced input
zoom reset, adds visible-viewport sizing, and keeps the item's Close control
reachable while scrolling. Real-phone font preference/gesture QA remains needed.
The full frontend suite also exposed session-test failures with unmocked local
API requests; do not assume the suite is green or enable real requests to hide
those failures. Unit and Playwright test discovery are now separated.

## Last verification

Construction-session follow-up (2026-09-30) supersedes the earlier pending policy:
saved constructions now enter sessions with a localized "Do you know this pattern?"
self-check in both directions. Form versus saved explanation, reveal the other
side/example, then normal Pass/Fail/Next and independent SRS. No migration or
re-saving needed. Affix exercises unchanged. Passed 57 focused backend tests,
35 frontend tests, and production build; typecheck still has baseline errors.

Affix confirmation follow-up (2026-09-30): word confirmations now reuse the
existing word-building matcher/cards and offer Save pattern independently of
Add word. This applies to German and English catalogs, including -keit in
Möglichkeit. Already-saved words still offer unsaved matching patterns; once all
matches are enrolled they open details directly again. No model or schema change.
Passed 140 focused frontend tests, 17 backend pattern tests, eight EN/ES
desktop/mobile browser checks, and the build. Typecheck retains existing errors.

Construction-saving follow-up (2026-09-30): Save pattern now works independently
of Add word, including for an already-saved separable verb. Uses a signed preview
and the existing pattern Item, no second model request or schema migration.
Manage Content can reopen it; session practice remains deferred and blocked.
The new-item query was extracted after a green baseline, verified again, then
changed to exclude pending constructions. Focused checks passed 97 backend and
33 frontend tests; four EN/ES desktop/mobile browser checks and the production
build passed. Typechecking
still reports 80 existing errors, none in the new modules. No deployment.

On 2026-09-30, six German construction patterns were added to contextual word-click
resolution: future/conditional/passive with werden, perfect with haben/sein,
and separable verbs. This slice is detection and preview only, not pattern
enrollment or new exercises. Separable verbs still save their lexical word.
See product/construction-patterns.md. Relevant behavior was tested before/after
extracting normalization, the API function, and the shared confirmation.
Checks passed: 49 backend tests, 62 focused frontend tests, production build,
and four EN/ES desktop/mobile browser checks. The full frontend run passed 412
tests with the 17 documented SessionPage failures and an unmocked-request
rejection. Typechecking reports 80 existing errors, none in the new modules.
No deployment, migration, or paid model generation was performed. Real-model
classification remains to be checked manually.

Guide cards now adapt to small visible viewports: max 45% height, internal
scrolling, placement away from the target, and minimize/reopen without skipping.
Targets taking almost the entire screen cause an initially minimized card.
The positioning responsibility was extracted and existing tests rerun before
behavior changes. See product/starter-guide.md and the guide accessibility e2e
fixture. Native phone interface scaling remains a manual QA check.
This slice passed 29 focused unit/component tests and all 19 Playwright checks,
including enlarged guide text, emulated pinch zoom, required-action clicks,
minimize/reopen, and Spanish controls.

The 2026-09-30 phone QA follow-up narrows the text preference to tappable language
sentences only (plus its configuration preview). It is now labelled Tappable text
size. Removed the root iOS Dynamic Type opt-in that enlarged unrelated UI.
Translations, static text, and controls do not scale with this setting. Existing
preference values, browser zoom, and zoom-safe modal closing are preserved.

On 2026-09-30, goal checking was removed by explicit user request to reduce
conversation latency. Goals remain generated, visible, and regenerable, but no
longer assessed. Removed both the background frontend request and optional
backend inline check, plus their goal-translation/evaluation model functions.
The legacy evaluation endpoint returns 410. HTTP/Realtime prompts and the EN/ES
guide now describe guidance rather than goal-driven closure. Realtime final
goodbye playback and manual ending are preserved. Review preparation is unchanged.
The focused checks passed 53 frontend tests, 5 backend tests, and 4 conversation
Playwright checks (English/Spanish, mobile/desktop); the build passed.
Typechecking still fails in existing application/test areas. No paid generation,
production calls, or deployment was performed.

Conversation controls were simplified on 2026-09-30: Tips and Ask for help are
removed, as are the setup notes/role inputs. Speed and level use one shared
panel before/during practice. See `architecture/conversation-controls.md`.
This slice passed 74 focused unit/component tests, all 12 Playwright tests,
the production build, and diff checks. Typechecking still reports existing
errors, including conversation transcript objects missing proficiency_level;
the extracted controls/preferences and new tests have no reported type errors.

The cross-platform study-text preference is now in Configuration (100/125/150/200%,
per-browser persistence, independent of iOS). Its follow-up passed 32 focused
unit/component tests and all 8 Playwright tests, plus the production build and
diff check. It enlarges shared dialog language content rather than all controls.

On 2026-09-30, all 7 Playwright browser tests passed, including 6 accessibility
regressions, and the 35 focused viewport/Forms/blocks tests passed. The full
Vitest run reported 377 passed, 17 failed (all in `SessionPage.test.tsx`), and
one unhandled request rejection. The build passed; TypeScript still reported
errors elsewhere. Do not conflate focused accessibility success with a green
full suite. Native phone text settings and pinch gestures remain manual QA.

On 2026-09-28, the closing slice passed 42 focused frontend tests and 3 backend
tests; the frontend production build and `git diff --check` passed. These are
focused results, not a claim that the full application suite was run that day.

Typechecking still reported existing unrelated errors, including missing
`proficiency_level` in conversation dialog objects and other parts of the app.
The new ending modules/tests had no remaining reported type errors after their
test compatibility fix. Recheck the baseline before making a new claim.

No paid generation or real spoken conversation was used for verification.
The user's next manual conversation test should check actual tool invocation,
natural closing, speed/level adherence, complete goodbye playback, and transcript.
Do not promise that prompting guarantees the model will always signal closure.

## Follow-up context, not automatic authorization

- Continue test-backed, small-slice refactoring when requested. The user is
  prioritizing confidence and readable organization over unbounded feature speed.
- Retain the deferred AI-cost plan under `decisions/ai-cost-optimization-plan.md`.
  Collect/discuss real usage before changing quotas or models.
- Do not recreate reminders or background tasks just because an old conversation
  mentioned them. Inspect any existing automation if asked to manage one.
- This handoff does not preserve every historical wording/layout change. Read the
  relevant code/tests and ask about material ambiguity rather than inventing intent.

## Suggested opening message for a fresh chat

> Continue working on WeLearnSmart in this repository. Read AGENTS.md and
> docs/START_HERE.md, including the product philosophy, working agreements, and
> dated handoff. Preserve the current uncommitted changes. Do not start deferred
> work or make changes yet; briefly confirm the context, then wait for my next task.
