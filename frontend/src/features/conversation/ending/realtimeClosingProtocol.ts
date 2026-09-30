export const FINISH_CONVERSATION_TOOL = {
  type: "function",
  name: "finish_conversation",
  description: "Request a final spoken goodbye when the conversation is genuinely ending. This does not mark the learning goal as achieved.",
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
};

export const REALTIME_CLOSING_INSTRUCTION =
  "When the learner clearly says goodbye or asks to end the conversation, call finish_conversation before speaking your final goodbye. " +
  "Make the tool call without accompanying speech; the application will ask you for the spoken goodbye next. " +
  "Do not call it merely because the goal was reached, the learner says thanks, or either person mentions or practices a goodbye expression. " +
  "Accept a genuine ending regardless of the goal; do not evaluate its completion or pressure the learner to continue. " +
  "Never mention the tool or application controls to the learner.";

export function finalGoodbyeRequest(instructions: string) {
  return {
    type: "response.create",
    response: {
      output_modalities: ["audio"], tools: [], tool_choice: "none",
      metadata: { conversation_closing: "true" },
      instructions: `${instructions}\nFor this final reply only, closure has been accepted. This overrides earlier instructions to keep the conversation going. Say one short, natural goodbye in the language being learned, respecting the selected speaking speed and level. Do not ask a question, add a new topic, mention the goal, or announce that the app will close.`,
    },
  };
}
