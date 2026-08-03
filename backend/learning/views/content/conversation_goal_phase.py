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
        "The learner has not achieved the conversation goal yet. Keep the exchange going naturally when it is socially appropriate. "
        "Respond to what the learner actually says, then use at most one relevant, open follow-up question or gentle invitation that encourages them to continue talking. "
        "Do not reveal the goal or give goal-specific hints. Do not force a question, prolong an already complete exchange, or continue after a clear goodbye, refusal, or situation where continuing would be rude."
    )
