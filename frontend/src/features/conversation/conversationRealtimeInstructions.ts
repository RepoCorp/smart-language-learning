import type {
  ConversationPhase,
  ConversationResponseLevel,
  ConversationSpeechSpeed,
} from "./conversationTransportTypes";
import { FINISH_CONVERSATION_TOOL, REALTIME_CLOSING_INSTRUCTION } from "./ending/realtimeClosingProtocol";

function phaseInstruction(phase: ConversationPhase): string {
  if (phase === "closing") {
    return "The conversation is coming to a natural close. Reply warmly and briefly to the learner's actual message, in a way that fits the topic. Do not introduce a new subtopic or ask a new question. Do not mention the goal, ending the conversation, or what the learner should say next. Only say goodbye after the learner clearly says goodbye.";
  }
  return "Respond naturally to what the learner actually says. Ask at most one relevant follow-up question when appropriate. Accept a clear goodbye or request to end without reopening the topic. The goal is a general guide, not a checklist. Do not evaluate or announce goal achievement, and do not prolong or end the conversation based on whether the goal was met.";
}

function speedInstruction(speed: ConversationSpeechSpeed): string {
  if (speed === "super_slow") {
    return "IMPORTANT: Speak really, really, really slowly from the first word to the final word. Slow down much more than a normal careful speaking pace, as if the learner is hearing the language for the first time. Use very short phrases, leave clear pauses between phrases, articulate every word separately and carefully, and never speed up. IMPORTANT: Remain exceptionally slow until the final word.";
  }
  if (speed === "slow") {
    return "Speak slowly and clearly for the entire response. Keep the same slow pace from beginning to end and do not speed up at the end.";
  }
  return "Speak at a normal, clear pace appropriate for the selected learner level.";
}

function levelInstruction(level: ConversationResponseLevel): string {
  if (level === "A0") {
    return "Use an A0 absolute beginner level, before A1. This level takes priority over any earlier language-level guidance. Use very common, concrete everyday words and basic present-time phrases. Aim for 2 to 5 words per sentence, one idea at a time, and at most two short sentences per reply. Allow a few more words only for natural wording. Avoid idioms, abstract explanations, complex clauses, and unnecessary synonyms. Repeat familiar words and sentence patterns naturally. Use adult-appropriate language, not baby talk or broken grammar. While keeping the conversation going, prefer one simple yes/no or either/or question that can be answered with a few words instead of an open-ended question. Do not ask new questions during the closing phase. Rephrase simply if the learner is stuck, and encourage them to use the language they are learning.";
  }
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
      ? `The current learner goal below replaces any earlier goal. It is a general guide, not an assessment. Do not evaluate or announce goal achievement. Do not mention, quote, or explain it. Do not give goal-specific information, hints, or leading questions intended to make the learner complete it. Respond naturally to what the learner actually says and let them choose the direction within the topic.\nCurrent learner goal: ${goal}`
      : "",
    phaseInstruction(phase),
    REALTIME_CLOSING_INSTRUCTION,
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
      tools: [FINISH_CONVERSATION_TOOL],
      tool_choice: "auto",
      audio: {
        input: { transcription: { model: transcriptionModel }, turn_detection: null },
        output: { speed: realtimeAudioSpeed(instructions.speed) },
      },
    },
  };
}
