from __future__ import annotations

from .conversation_goal_phase import conversation_phase_instruction


def response_level_instruction(level: str) -> str:
    normalized_level = str(level).strip().upper() or "A2"
    if normalized_level == "A1":
        return "Use an A1 level. Use very simple words, very short sentences, and very basic grammar."
    if normalized_level == "B1":
        return "Use a B1 level. You can use somewhat more natural and varied vocabulary, but keep it learner-friendly."
    return "Use an A2 level. Use simple vocabulary and simple grammar."


def speech_speed_instruction(speed: str) -> str:
    normalized_speed = str(speed).strip().lower() or "normal"
    if normalized_speed == "super_slow":
        return "Speak extremely slowly, with very short sentences and very clear wording that stays slow from beginning to end."
    if normalized_speed == "slow":
        return "Speak slowly and clearly, using short sentences and easy wording."
    return ""


def effective_notes(*, notes: str, goal_text: str, response_level: str, speech_speed: str, conversation_phase: str) -> str:
    return "\n".join(
        part for part in [
            notes.strip(),
            (
                f"Learner's conversation goal (private guidance): {goal_text.strip()}\n"
                "Use it only as subtle background guidance. Do not mention, quote, or explain it.\n"
                "Do not give goal-specific information, hints, or leading questions intended to make the learner complete it.\n"
                "Respond naturally to what the learner actually says and let them choose the direction within the topic."
                if goal_text.strip() else ""
            ),
            conversation_phase_instruction(conversation_phase),
            response_level_instruction(response_level),
            speech_speed_instruction(speech_speed),
        ] if part
    )
