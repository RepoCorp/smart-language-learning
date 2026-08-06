from __future__ import annotations


def conversation_phase_instruction(phase: str) -> str:
    if str(phase).strip().lower() == "closing":
        return (
            "The learner has already achieved the conversation goal. "
            "Let the exchange settle naturally over the next 1 or 2 turns. "
            "Reply warmly and briefly to the learner's actual message, in a way that fits the topic. "
            "Do not introduce a new subtopic or ask a new question. "
            "Do not mention the goal, ending the conversation, or what the learner should say next. "
            "Only say goodbye after the learner clearly says goodbye."
        )
    return (
        "The learner has not achieved the conversation goal yet. Do not let the conversation end yet. "
        "Respond to what the learner actually says, then actively use one relevant, open follow-up question or invitation to keep them talking. "
        "If the learner starts to close the conversation, politely reopen it with a topic-relevant question or invitation and prioritize one more turn, even if that is slightly less natural. "
        "Do not reveal the goal or give goal-specific hints. Only allow the exchange to end after a clear refusal or when continuing would genuinely be inappropriate or rude."
    )
