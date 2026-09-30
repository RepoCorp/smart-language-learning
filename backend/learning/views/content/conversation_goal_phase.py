from __future__ import annotations


def conversation_phase_instruction(phase: str) -> str:
    if str(phase).strip().lower() == "closing":
        return (
            "The conversation is coming to a natural close. "
            "Let the exchange settle naturally over the next 1 or 2 turns. "
            "Reply warmly and briefly to the learner's actual message, in a way that fits the topic. "
            "Do not introduce a new subtopic or ask a new question. "
            "Do not mention the goal, ending the conversation, or what the learner should say next. "
            "Only say goodbye after the learner clearly says goodbye."
        )
    return (
        "Respond naturally to what the learner actually says. Ask at most one relevant follow-up question when appropriate. "
        "Accept a clear goodbye or request to end without reopening the topic. "
        "The goal is a general guide, not a checklist. Do not evaluate or announce goal achievement, "
        "and do not prolong or end the conversation based on whether the goal was met."
    )
