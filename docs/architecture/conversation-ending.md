# Conversation ending

Live (Realtime) conversations can end automatically. Natural-voices HTTP
conversations currently retain manual ending.

The Realtime session registers a `finish_conversation` function. The assistant
is instructed to call it without speech when the learner clearly says goodbye
or asks to end. Goal completion is not evaluated or required. Saying thanks,
or practicing a goodbye expression is not an ending signal. Ending never
marks the learning goal as achieved.

As of 2026-09-30, goals are guidance only. Both the frontend's per-turn evaluator
and the optional inline backend evaluator are removed, including the repeated
goal translation request. The legacy evaluation endpoint returns HTTP 410 without
calling a model. Goal generation, display, and regeneration remain available.
The client retains skip_goal_evaluation for older backends during deployment.
Review preparation is unchanged and may still make background requests.

The client acknowledges the function call and requests a short final spoken
goodbye, using the latest difficulty and speed instructions. That response
disables tools and has identifying metadata. If the tool response itself
contained audio, the client waits for it to drain before requesting the goodbye.
This adds a final response at closure, not a separate evaluator on every turn.

Automatic completion requires both a successful final `response.done` with
spoken content and `output_audio_buffer.stopped` for that same response ID.
Generation completion is not playback completion. There are no keyword
heuristics, duration estimates, or timed audio cutoffs. The microphone must not
restart during closing. Duplicate, unrelated, and disconnected-session events
cannot finish the conversation.

The completed turn is appended before the existing end actions disconnect
the transport and show the transcript. Automatic ending bypasses manual-end
confirmation but does not generate a review automatically. Interrupted,
cancelled, failed, or silent final responses show an error and leave manual
recovery available rather than pretending that the goodbye completed.

The implementation is grouped under `features/conversation/ending`. Tests
cover the protocol, event ordering, real transport wiring with mocked WebRTC,
and the page's shared end lifecycle. They do not make paid model calls; actual
model adherence to the closing instruction still needs manual evaluation.
