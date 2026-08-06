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
        return (
            "IMPORTANT: Speak really, really, really slowly from the first word to the final word. "
            "Slow down much more than a normal careful speaking pace, as if the learner is hearing the language for the first time. "
            "Use very short phrases, leave clear pauses between phrases, articulate every word separately and carefully, and never speed up. "
            "IMPORTANT: Remain exceptionally slow until the final word."
        )
    if normalized_speed == "slow":
        return "Speak slowly and clearly, using short sentences and easy wording."
    return ""


def effective_notes(*, notes: str, goal_text: str, response_level: str, speech_speed: str, conversation_phase: str) -> str:
    speed_guidance = speech_speed_instruction(speech_speed)
    repeat_super_slow_guidance = str(speech_speed).strip().lower() == "super_slow"
    return "\n".join(
        part for part in [
            speed_guidance if repeat_super_slow_guidance else "",
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
            speed_guidance,
            "IMPORTANT: Keep speaking exceptionally slowly until the final word." if repeat_super_slow_guidance else "",
        ] if part
    )
