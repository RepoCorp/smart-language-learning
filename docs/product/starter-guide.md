# Starter guide

After the language settings, the guide highlights **Tappable text size** and its
preview in Configuration. It explains that only tappable language text grows,
not the rest of the interface. The learner may change the size or keep the current
value, then use Next; changing size does not automatically advance the guide.
This step is localized in English and Spanish.

The personal-topic step can be completed by explicitly selecting a saved topic
from the dropdown, or by entering a nonempty new topic and confirming with Enter.
Both actions emit `topic-chosen`. Opening the section, selecting Create new topic
without confirming text, or leaving/selecting Random does not advance the guide.
There is no Next button to bypass this action-based step.

The English and Spanish guide instructions describe both paths and retain the
explanation of why personally useful topics help learning. Random topics remain
available outside this guided step.

After choosing a topic, the guide opens Options and highlights the dialog level
selection (Absolute beginner, then A1 through B2). It briefly explains the levels and lets the learner
change the level or keep the current selection, then continue with Next. Choosing
a radio option does not automatically advance the guide or generate a dialog.

On desktop, the Create dialog guide card uses its measured height to sit below
Generate preview when it fits, or above it when there is more room there. If
neither side fits, it stays below with enough guide scroll space to read it rather
than being clamped over the button.

On small visible viewports (including phone zoom and short landscape layouts),
cards use the larger free area above or below the highlighted target, with a
maximum height of 45% of the visible viewport. Long instructions and additional
information scroll inside the card; enlarged text is not shrunk to fit.
The title has a bounded, scrollable area so it cannot consume the whole card.

Every card can be minimized and reopened without advancing or dismissing the
tutorial. If the target leaves less than 120px for a readable card, it starts
minimized. A learner can explicitly reopen it to read, then minimize it to act.
The small reopen control and the card follow visual-viewport resize/pan events.
The guide is non-modal: highlighted application controls remain interactive.
Existing save-word/save-phrase automatic collapse events and action-required
progression remain in place.

Positioning is isolated in `frontend/src/guides/guidedTourPosition.ts`, with
viewport tracking in `useGuideViewport.ts`. Tests cover the existing desktop
positions, compact placement, and real cards at 200% text and emulated pinch zoom.
Browser coverage uses Chromium; native phone interface scaling still needs QA.
