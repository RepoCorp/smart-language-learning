# Conversation controls

The conversation page no longer offers Tips (the limited assistant-text reveal)
or an Ask for help modal. Learners ask for repetition or clarification within
the spoken conversation. The transcript and post-conversation review remain.
The separate Conversation setup notes/role section is also removed. Existing
API contracts still accept those fields, but new setup sends empty values;
server-provided roles remain available to the conversation and its review.

Topic, goal difficulty, and voice mode are selected before starting. A single
shared `ConversationMoreControls` component provides assistant speed and
response level, first inside setup and then inside the sticky active controls.
Only one instance is mounted at a time. Pre-start sections form an accordion;
opening settings during practice pauses the conversation and never resumes it
automatically on collapse. Loading/connecting disables changes. Completed
conversations expose review actions, not ineffective configuration controls.

`useConversationPreferences` owns speed/level state and browser persistence.
Changing level retains the existing level-based speed default; the learner can
then override speed. The same state is passed to the active transport. No new
provider calls are introduced by these controls.

Goals remain visible and regenerable, but are now general guides only. There is
no per-turn goal checking or achievement-driven closing. See conversation-ending.md.

Regression tests: `ConversationControls.test.tsx`,
`ConversationSettingsPage.test.tsx`, and the existing conversation ending tests.
`e2e/conversation-settings.spec.ts` checks the real pre-start page in English
and Spanish at mobile and desktop widths with mocked API responses. No paid
generation, microphone recording, or live-model quality is tested.
