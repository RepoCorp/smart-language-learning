from __future__ import annotations

from django.conf import settings

from .management import Request, Response, _normalized_pair, status

DEFAULT_CONVERSATION_GOAL_BY_LANGUAGE = {
    "spanish": "Saluda.",
    "english": "Say hello.",
    "german": "Begruesse die andere Person.",
    "french": "Dis bonjour.",
    "italian": "Saluta.",
    "portuguese": "Cumprimente.",
}


def analysis_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_ENABLE_ANALYSIS", True))


def goal_evaluation_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_ENABLE_GOAL_EVALUATION", True))


def conversation_audio_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_ENABLE_AUDIO", True))


def conversation_inline_audio_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_RETURN_INLINE_AUDIO", False))


def conversation_realtime_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_USE_REALTIME", False))


def conversation_review_context(*, notes: str, role_text: str) -> str:
    parts: list[str] = []
    if role_text.strip():
        parts.append(f"Role: {role_text.strip()}")
    if notes.strip():
        parts.append(f"Notes: {notes.strip()}")
    return " | ".join(parts)


def validate_conversation_start_fields(request: Request) -> tuple[str, str, str, str, str, str]:
    source_language, target_language = _normalized_pair(request)
    topic = str(request.data.get("topic", "")).strip()
    notes = str(request.data.get("notes", "")).strip()
    role_text = str(request.data.get("role_text", "")).strip()
    goal_difficulty = str(request.data.get("goal_difficulty", "medium")).strip().lower() or "medium"
    return source_language, target_language, topic, notes, role_text, goal_difficulty


def validate_conversation_start_payload(
    *,
    topic: str,
    notes: str,
    role_text: str,
    goal_difficulty: str,
) -> Response | None:
    if not topic:
        return Response({"detail": "topic is required"}, status=status.HTTP_400_BAD_REQUEST)
    if len(topic) > 120:
        return Response({"detail": "topic is too long"}, status=status.HTTP_400_BAD_REQUEST)
    if len(notes) > 1000:
        return Response({"detail": "notes is too long"}, status=status.HTTP_400_BAD_REQUEST)
    if len(role_text) > 240:
        return Response({"detail": "role_text is too long"}, status=status.HTTP_400_BAD_REQUEST)
    if goal_difficulty not in {"easy", "medium", "hard"}:
        return Response({"detail": "goal_difficulty must be easy, medium, or hard"}, status=status.HTTP_400_BAD_REQUEST)
    return None


def conversation_context_label(*, topic: str, notes: str, role_text: str) -> str:
    return (
        f"Conversation topic: {topic}\n"
        f"Temporary notes: {notes}\n"
        f"Learner role: {role_text}\n"
    )


def default_conversation_goal(source_language: str) -> str:
    return DEFAULT_CONVERSATION_GOAL_BY_LANGUAGE.get(
        source_language,
        "Say hello.",
    )
