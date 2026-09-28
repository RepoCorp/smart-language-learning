# Interface localization

The interface supports English and Spanish through `useI18n()` and the catalogs
in `frontend/src/i18n*.ts*`. Use message keys for visible labels, loading states,
accessible names, confirmations, and locally generated error messages. Keep a
complete entry in each language, including matching interpolation variables.
Sing's catalog is separate in `i18nSing.ts`; configuration and debug controls
use `i18nConfig.ts`.

App language and study languages are independent. Localize instructions and
use "the language you speak" / "the language you're learning" (Spanish:
"el idioma que hablas" / "el idioma que estás aprendiendo") in user-facing text,
rather than source/target or origen/objetivo. Internal API fields and prompt
variables retain their technical names. Localize
grammar labels, but leave the words, lyrics, and example sentences in the
language being learned. Their saved translations remain in the learner's source
language. Static grammar examples with interface labels render those labels
through components using `useI18n()`.

The API still returns some English error strings rather than stable error codes.
Known quota reasons are translated by `AIQuotaNotice`, retaining the distinction
between blocked accounts and weekly credit, voice, music, or conversation limits.
Some features translate their known generic API failure messages as well.
Unknown server details are preserved rather than replaced with an inaccurate
explanation; arbitrary backend messages are not yet fully localized.

Regression coverage lives in `frontend/tests/localization.test.tsx`. Test both
translated controls and unchanged study content, including loading/error states
and switching app language without resetting user selections.
