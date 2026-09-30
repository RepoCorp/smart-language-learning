# Larger study text and zoom-safe item modals

The priority is readable language content, especially tappable dialog words.
This change is not a redesign that enlarges every interface label.

`frontend/src/accessibility/studyText.css` owns shared dialog text sizing. Word
buttons inherit their sentence's font rather than the browser's smaller default
button font. Dialog text and translations use rem units and words wrap rather
than forcing a wider page. The earlier root-level iOS Dynamic Type opt-in was
removed after phone testing showed that it enlarged unrelated interface elements.
The app no longer changes root typography for this feature. Native browser font
preferences and deliberate zoom remain available.

Configuration provides a platform-independent **Tappable text size** preference:
Normal (100%), Large (125%), Extra large (150%), and Largest (200%). It scales
only sentences containing tappable word buttons (including interactive revealed
answers), relative to the browser's root font size. Translations, read-only
sentences, audio-only hints, and surrounding controls keep their normal size.
The preview in Configuration also scales to demonstrate the selected size.
`StudyTextSizeProvider.tsx` stores this choice per browser in `study_text_scale`;
it is not account-synced. Reset defaults restores Normal. If storage is blocked,
the setting still works during the current visit. `StudyTextSizeSetting.tsx`
provides localized labels and a live preview. This does not depend on iOS APIs.

The viewport meta tag must allow zoom. The former focusout handler that briefly
set `maximum-scale=1.0` has been removed: leaving an input must not undo the
learner's deliberate zoom.

`visualViewport.ts` publishes the visible viewport's size and offsets as CSS
variables, including pinch zoom, panning, and keyboard resize. It never changes
zoom scale or cancels native gestures. Without that API, CSS viewport dimensions
remain available. Shared modal styles constrain overlays/panels to the visible
area and allow scrolling and pinch zoom. The item view's Close control is sticky
inside its scrollable content and at least 44 CSS pixels square. Exercise drag
tokens retain their deliberate gesture handling; ordinary scrolling surfaces
do not globally disable zoom.

Tests: `frontend/tests/visualViewport.test.ts` and
`frontend/e2e/item-modal-accessibility.spec.ts`. The browser fixture renders the
real DialogTurnText, item-saving modal, and NewItem components with mocked API
responses, so it does not generate content or modify learning data. Chromium
checks cover tappable-only scaling, 320px screens, 200% emulated pinch zoom, zoom changes,
scrolling and dismissal. These do not replace a real-phone check of Safari/iOS
Dynamic Type, Android text preferences, native pinch gestures, or the keyboard.
`frontend/tests/studyTextSize.test.tsx` covers preference persistence, invalid
stored values, localization, and resetting through Configuration.

Vitest discovers unit/component tests under `tests/`; Playwright runs `e2e/`
separately. A passing Vite build does not imply a passing TypeScript check.

References: [WebKit Dynamic Type](https://webkit.org/blog/3709/using-the-system-font-in-web-content/),
[VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport),
[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).
