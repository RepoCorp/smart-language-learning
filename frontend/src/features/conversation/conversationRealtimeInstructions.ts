import type {
  ConversationPhase,
  ConversationResponseLevel,
  ConversationSpeechSpeed,
} from "./conversationTransportTypes";

function phaseInstruction(phase: ConversationPhase): string {
  if (phase === "closing") {
    return "The learner has already achieved the conversation goal. Let the exchange settle naturally over the next 1 or 2 turns. Reply warmly and briefly to the learner's actual message, in a way that fits the topic. Do not introduce a new subtopic or ask a new question. Do not mention the goal, ending the conversation, or what the learner should say next. Only say goodbye after the learner clearly says goodbye.";
  }
  return "The learner has not achieved the conversation goal yet. Do not let the conversation end yet. Respond to what the learner actually says, then actively use one relevant, open follow-up question or invitation to keep them talking. If the learner starts to close the conversation, politely reopen it with a topic-relevant question or invitation and prioritize one more turn, even if that is slightly less natural. Do not reveal the goal or give goal-specific hints. Only allow the exchange to end after a clear refusal or when continuing would genuinely be inappropriate or rude.";
}

function speedInstruction(speed: ConversationSpeechSpeed): string {
  if (speed === "super_slow") {
    return "IMPORTANT: Speak really, really, really slowly from the first word to the final word. Slow down much more than a normal careful speaking pace, as if the learner is hearing the language for the first time. Use very short phrases, leave clear pauses between phrases, articulate every word separately and carefully, and never speed up. IMPORTANT: Remain exceptionally slow until the final word.";
  }
  if (speed === "slow") {
    return "Speak slowly and clearly for the entire response. Keep the same slow pace from beginning to end and do not speed up at the end.";
  }
  return "Speak at a normal pace for an A2 learner.";
}

function levelInstruction(level: ConversationResponseLevel): string {
  if (level === "A1") {
    return "Use an A1 level. Use very simple words, very short sentences, and very basic grammar.";
  }
  if (level === "B1") {
    return "Use a B1 level. You can use somewhat more natural and varied vocabulary, but keep it learner-friendly.";
  }
  return "Use an A2 level. Use simple vocabulary and simple grammar.";
}

type Args = {
  baseInstructions: string;
  goal: string;
  phase: ConversationPhase;
  speed: ConversationSpeechSpeed;
  level: ConversationResponseLevel;
};

export function buildRealtimeInstructions({
  baseInstructions,
  goal,
  phase,
  speed,
  level,
}: Args): string {
  const speedGuidance = speedInstruction(speed);
  return [
    speed === "super_slow" ? speedGuidance : "",
    baseInstructions.trim(),
    goal
      ? `The current learner goal below replaces any earlier goal. It is private guidance only. Do not mention, quote, or explain it. Do not give goal-specific information, hints, or leading questions intended to make the learner complete it. Respond naturally to what the learner actually says and let them choose the direction within the topic.\nCurrent learner goal: ${goal}`
      : "",
    phaseInstruction(phase),
    levelInstruction(level),
    speedGuidance,
    speed === "super_slow" ? "IMPORTANT: Keep speaking exceptionally slowly until the final word." : "",
  ].filter(Boolean).join("\n");
}

export function realtimeAudioSpeed(speed: ConversationSpeechSpeed): number {
  if (speed === "super_slow") {
    return 0.75;
  }
  if (speed === "slow") {
    return 0.75;
  }
  return 1;
}

type SessionUpdateArgs = Args & {
  transcriptionModel: string;
};

export function buildRealtimeSessionUpdate({ transcriptionModel, ...instructions }: SessionUpdateArgs) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      instructions: buildRealtimeInstructions(instructions),
      output_modalities: ["audio"],
      audio: {
        input: { transcription: { model: transcriptionModel }, turn_detection: null },
        output: { speed: realtimeAudioSpeed(instructions.speed) },
      },
    },
  };
}
