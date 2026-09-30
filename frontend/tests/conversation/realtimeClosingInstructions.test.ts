import { expect, it } from "vitest";
import { buildRealtimeInstructions, buildRealtimeSessionUpdate } from "../../src/features/conversation/conversationRealtimeInstructions";
import { finalGoodbyeRequest } from "../../src/features/conversation/ending/realtimeClosingProtocol";

const settings = { baseInstructions: "Speak German.", goal: "Buy bread", phase: "active", speed: "super_slow", level: "A0" } as const;

it("registers the explicit tool and preserves slow beginner guidance", () => {
  const { session } = buildRealtimeSessionUpdate({ ...settings, transcriptionModel: "test-transcriber" });
  expect(session.tools[0].name).toBe("finish_conversation");
  expect(session.tool_choice).toBe("auto");
  expect(session.audio.output.speed).toBe(0.75);
  expect(session.instructions).toContain("A0 absolute beginner");
  expect(session.instructions).toContain("Accept a clear goodbye or request to end");
  expect(session.instructions).toContain("Do not evaluate or announce goal achievement");
  expect(session.instructions).not.toContain("has not achieved");
  expect(session.instructions).not.toContain("While the goal is unmet");
  expect(session.instructions).toContain("before speaking your final goodbye");
  expect(session.instructions).toContain("Do not call it merely because the goal was reached");
});

it("keeps the natural closing phase separate from the final goodbye response", () => {
  const instructions = buildRealtimeInstructions({ ...settings, phase: "closing" });
  expect(instructions).toContain("Only say goodbye after the learner clearly says goodbye");
  const { response } = finalGoodbyeRequest(instructions);
  expect(response.tools).toEqual([]);
  expect(response.tool_choice).toBe("none");
  expect(response.instructions).toContain("one short, natural goodbye");
  expect(response.instructions).toContain("Do not ask a question");
});
