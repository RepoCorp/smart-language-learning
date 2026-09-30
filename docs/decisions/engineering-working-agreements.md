# Engineering working agreements

Status: accepted user working preferences, consolidated 2026-09-29.

## Small, understandable changes

1. Inspect the relevant code and documents before diagnosing. Take user observations
   seriously; repeated failures call for tracing the whole flow, not repeatedly
   assuming caching, a wrong click, or an incorrect environment.
2. Before altering behavior in a large file, characterize the affected behavior with
   tests and run them. Extract the relevant responsibility without changing behavior,
   run the tests again, then implement the requested change and test it.
3. Refactor one bounded piece at a time. Prefer small, clearly named files grouped
   by responsibility in understandable folders, not more loose helpers or an
   enormous generic utilities folder. Explain the boundary and what stays unchanged.
4. Keep shared orchestration language-agnostic and language-specific rules in their
   own modules. Avoid files named for one language that actually implement several.
   Dispatch/registration should connect modules, not embed their linguistic rules.
5. Preserve existing work. Review `git status` and diffs; do not reset, revert, commit,
   deploy, or change shared infrastructure as an incidental cleanup step.

The user wants to follow the changes and understand the code. Faster delivery is
not permission to drop tests, hide risk, or perform a broad unrelated refactor.

## Verification

- Cover user-visible behavior and failure paths, not only extracted helpers. Audio,
  asynchronous state, persistence, item switching, cancellation, and mobile dragging
  have regressed before and deserve focused integration tests when touched.
- Keep word/phrase and recognition/production test flows independently covered.
- Run relevant tests before and after a refactor. Run broader suites at least once
  or twice during an active development day, and after changes to shared foundations.
  This is a work routine, not an instruction to create a new scheduled automation.
- Report exactly which suites/build/typechecks were run and what was not verified.
  A successful Vite build is not a successful TypeScript check. Establish the
  baseline before calling failures pre-existing; do not silently fix unrelated ones.
- Mock external providers in automated tests. Do not spend generation credits,
  exercise production data, or claim model/audio quality from mocked responses.
- Include schema migrations when required and check the migration state. Never
  use direct production changes as a shortcut for a code or migration issue.

## Simplicity and honesty

- No new silent fallbacks, guessed successful results, or heuristic repair of model
  output presented as reliable data. Validate structured outputs and surface failure.
- Keep generation on demand and reuse persisted content. Do not change provider,
  model, quota, prompt quality, or retention policy merely to make a test pass.
- Ask before consequential tradeoffs or changing a user-supplied prompt that needs
  substantive adaptation. Do not ask the user to make routine implementation choices.
- Investigate focused slices with bounded reads/searches. Avoid repeatedly loading
  giant files, the full chat history, or unrelated parts of the repository.
- Keep progress updates informative and final answers concise, with meaningful
  file references, test results, and any remaining uncertainty.

## Infrastructure and pending ideas

The RDS instance serves other applications. Do not replace, reconfigure, or remove
it without an explicit request. Keep the original deployment documentation alongside
the lower-cost alternative. Logs must not leak credentials.

The AI cost optimization plan is deferred pending real user usage feedback, not
authorized work. Likewise, brainstorming about shared dialogs/content, article-error
practice, new pattern types, or further languages is not automatic implementation
scope. Confirm the current request and relevant accepted decisions first.
