# Saved-dialog audio playback

The Dialogs page uses the selected voice mode for individual sentences, an entire
dialog, and Play all dialogs. Natural mode uses `phrase_audio_url`; OpenAI mode
uses `clear_audio_url`.

Playback requests a missing clip only when it reaches that sentence after the user
presses Play. The existing clear-audio endpoint saves the OpenAI clip on
`DialogTurn` and returns it on subsequent requests. Selecting a mode or speed does
not generate audio. Whole-dialog playback sequences these clips while keeping
the current sentence highlighted.

The OpenAI speed selector changes the browser audio element's playback rate with
pitch preservation. It affects the current clip and later clips, including
individual-sentence playback, without creating another generated version. Natural
audio plays at its normal rate. The rate is relative to the saved clip's recorded
speed. The selected rate lasts while the Dialogs page remains mounted.

Changing voice mode or study languages, leaving the page, or changing catalog
filters stops playback. Pending generation responses cannot restart cancelled
playback. Audio already generated remains saved on the server. Playback stops and
reports an error if generation or audio playback fails; it does not skip the
sentence or substitute a different provider.

Related dialogs in item views and saved-content previews currently retain their
existing playback controls; the whole-dialog speed selector is on the Dialogs page.
