from __future__ import annotations

from .topic_conversation_models import generate_topic_conversation_start


def generate_conversation_goal(
    *,
    topic: str,
    notes: str,
    role_text: str,
    goal_difficulty: str,
    source_language: str,
    target_language: str,
) -> tuple[str, str]:
    generated = generate_topic_conversation_start(
        topic=topic,
        notes=notes,
        role_text=role_text,
        goal_difficulty=goal_difficulty,
        source_language=source_language,
        target_language=target_language,
    )
    goal_text = str(generated.get("goal_text", "")).strip()
    if not goal_text:
        raise RuntimeError("Could not create a conversation goal")
    selected_difficulty = str(generated.get("goal_difficulty", goal_difficulty)).strip() or goal_difficulty
    return goal_text, selected_difficulty
