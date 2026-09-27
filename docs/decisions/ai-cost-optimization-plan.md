# AI cost optimization: deferred evaluation plan

Date: 2026-09-22

## Status

Implementation deferred at the user's request pending real usage feedback from
learners. Preserve this plan for a future discussion. The steps below are a
proposal, not authorization to change models, prompts, quotas, or infrastructure.
No scheduled reminder or automatic resumption is requested.

## Context and constraints

Optimize cost per useful learning action rather than discourage practice.
Earlier weekly cost estimates were illustrative planning estimates, not measured
production spending or guaranteed ceilings. Recheck provider prices and production
configuration before resuming; do not use those estimates as a billing baseline.

- Keep generation credits at 200, music at 60 generated seconds, and live
  conversation at 45 minutes per week. Proposed cuts to 60 credits, 30 music
  seconds, and 15 live minutes were rejected as too restrictive.
- The user agreed in principle to reducing ElevenLabs speech from 10,000 to
  5,000 characters weekly. This has NOT been implemented; all changes are paused.
- Preserve the unlimited development/superuser allowance.
- Protect high-quality initial item processing, including contextual meaning,
  word/expression resolution, normalization, and metadata. Do not downgrade it
  merely to save money.
- Expect most users to play the whole dialog. Do not prioritize moving audio
  generation to first playback: this may only shift cost and add waiting.
- Preserve saved audio reuse and explicit regeneration. Browser playback-speed
  changes should continue reusing audio.
- No silent provider/model fallback or saving incomplete generated content.
- Output limits are supported in principle, but require task-specific validation
  and clear handling of truncation, including allowance for reasoning tokens.

## Feedback to gather

Learn how often users create dialogs, add words/phrases, open strategies, generate
images or songs, regenerate results, and use live conversation. Identify which
limits they reach and whether quality issues lead to extra requests. Playback of
saved audio is not another generation. Separate ordinary users from unlimited
development usage when assessing costs.

## Proposed sequence

1. Establish a baseline without changing models. Track action, model, prompt
   version, input/output and cached token usage where available, latency, and
   failures. Group calls belonging to one user action, such as saving a word.
   Reconcile estimated costs with provider billing, including subscription and
   voice-specific pricing. Keep telemetry minimal and avoid unnecessary storage
   of learner content.
2. Introduce a small per-action configuration registry for model, reasoning effort,
   and output limit, initially preserving behavior. At the time of discussion,
   several strategies hardcode the same model and many text calls share a generic
   `text-generation` usage label, limiting actionable cost attribution.
3. Build representative evaluation cases before changing an action. Include
   German, English, Spanish, different learner levels, and previous failures.
   Automated tests check structure, persistence, limits, and integration; human
   review checks language quality and audio. Passing mocked tests alone does not
   establish model quality.
4. For each action, compare the current baseline, a prompt-only revision, a cheaper
   model, and reasoning/output tuning separately. Change one variable at a time.
   Retain instructions added to fix real failures. Remove duplication and unused
   output fields; structure reusable prompt prefixes for caching where useful.
5. Adopt only demonstrated improvements, with easy rollback and no automatic
   fallback. Measure cost per acceptable result, including failures and user
   regenerations, rather than cost per request alone.

## Candidate evaluation order

| Action group | Approach |
| --- | --- |
| Initial item addition and resolution | Keep the high-quality model; characterize behavior first. |
| Examples, Act, Encounter, Visualize sentence/image prompt | First cheaper-text-model candidates; start with Examples. |
| Create translations and Sing lyrics | Check intent, required word, learner level, rhyme, and humor constraints. |
| Forms, Related, Compare, Decode, grammar detection | Stricter linguistic checks, including false-positive grammar detection. |
| Grammar questions, corrections, natural alternatives | Protect intent and explanation quality; switch only with evidence. |
| Dialog creation, goals, goal evaluation, help, conversation review | Evaluate each action independently. |
| Live voice, transcription, saved speech, images, music | Separate audio/visual evaluations from text-model changes. |

## Specific experiments to revisit

- Compare a cheaper text model against the current model for tightly defined
  tasks. GPT-5 Mini was a candidate, not an accepted replacement. Reassess current
  models, compatibility, availability, and prices when work resumes.
- Compare GPT-Realtime-2.1 Mini against the current live model. Test hesitant and
  accented speech, incorrect grammar, preservation of intent, sustained slow
  speech, context retention, help without taking over, native-language handling,
  goal adherence, and natural closing. Smaller does not automatically mean worse
  pronunciation; quality differences must be observed, not assumed.
- Compare ElevenLabs Flash/Turbo with Multilingual v2 on the same text and voices.
  Verify supported languages, pronunciation, clarity, expressiveness, actual
  subscription costs, and voice multipliers before switching.
- Audit unnecessary audio regeneration and reuse before changing generation
  timing. Keep the existing distinction between natural and clear audio.
- Evaluate image model/quality choices and music cost per usable song separately.
  Preserve the carefully tuned music/loop behavior unless explicitly testing it.
- Measure prompt optimization rather than promise a percentage. A shorter input
  only reduces the input portion of cost; output/reasoning can dominate. Cache
  savings depend on real hits and write charges. Limits prevent extremes but are
  not substitutes for measurement or complete-response validation.

## Resumption point

Discuss learner feedback first. Then begin baseline instrumentation and per-action
configuration, followed by an Examples strategy pilot. No implementation or model
switch should happen simply because this document exists.
