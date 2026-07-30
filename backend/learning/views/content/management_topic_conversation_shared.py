from __future__ import annotations

from django.conf import settings

from .management import Request, Response, _normalized_pair, status


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


DEFAULT_CONVERSATION_GOALS_BY_LANGUAGE_AND_DIFFICULTY: dict[str, dict[str, list[str]]] = {
    "spanish": {
        "easy": ["Saluda.", "Haz una pregunta sencilla sobre el tema.", "Despídete con educación."],
        "medium": ["Saluda y menciona el tema.", "Haz una pregunta sencilla sobre el tema.", "Despídete con educación."],
        "hard": ["Saluda y di un detalle sobre tu situación.", "Haz una pregunta y responde algo breve sobre el tema.", "Cierra la conversación con naturalidad."],
    },
    "english": {
        "easy": ["Say hello.", "Ask one simple question about the topic.", "Say goodbye politely."],
        "medium": ["Say hello and mention the topic.", "Ask one simple question about the topic.", "Say goodbye politely."],
        "hard": ["Say hello and share one detail about your situation.", "Ask one question and give one short answer about the topic.", "Close the conversation naturally."],
    },
    "german": {
        "easy": ["Begruesse die andere Person.", "Stelle eine einfache Frage zum Thema.", "Verabschiede dich hoeflich."],
        "medium": ["Begruesse die andere Person und nenne das Thema.", "Stelle eine einfache Frage zum Thema.", "Verabschiede dich hoeflich."],
        "hard": ["Begruesse die andere Person und sage ein Detail ueber deine Situation.", "Stelle eine Frage und gib eine kurze Antwort zum Thema.", "Beende das Gespraech auf natuerliche Weise."],
    },
    "french": {
        "easy": ["Dis bonjour.", "Pose une question simple sur le sujet.", "Dis au revoir poliment."],
        "medium": ["Dis bonjour et mentionne le sujet.", "Pose une question simple sur le sujet.", "Dis au revoir poliment."],
        "hard": ["Dis bonjour et donne un detail sur ta situation.", "Pose une question et donne une reponse courte sur le sujet.", "Termine la conversation naturellement."],
    },
    "italian": {
        "easy": ["Saluta.", "Fai una domanda semplice sul tema.", "Salutati con cortesia."],
        "medium": ["Saluta e menziona il tema.", "Fai una domanda semplice sul tema.", "Salutati con cortesia."],
        "hard": ["Saluta e dai un dettaglio sulla tua situazione.", "Fai una domanda e dai una risposta breve sul tema.", "Chiudi la conversazione in modo naturale."],
    },
    "portuguese": {
        "easy": ["Cumprimente.", "Faca uma pergunta simples sobre o tema.", "Despeca-se com educacao."],
        "medium": ["Cumprimente e mencione o tema.", "Faca uma pergunta simples sobre o tema.", "Despeca-se com educacao."],
        "hard": ["Cumprimente e diga um detalhe sobre a sua situacao.", "Faca uma pergunta e de uma resposta curta sobre o tema.", "Encerre a conversa de forma natural."],
    },
    "dutch": {
        "easy": ["Zeg hallo.", "Stel een eenvoudige vraag over het onderwerp.", "Neem beleefd afscheid."],
        "medium": ["Zeg hallo en noem het onderwerp.", "Stel een eenvoudige vraag over het onderwerp.", "Neem beleefd afscheid."],
        "hard": ["Zeg hallo en noem een detail over je situatie.", "Stel een vraag en geef een kort antwoord over het onderwerp.", "Sluit het gesprek op een natuurlijke manier af."],
    },
}


def default_conversation_goals(source_language: str, goal_difficulty: str) -> list[str]:
    goals_by_difficulty = DEFAULT_CONVERSATION_GOALS_BY_LANGUAGE_AND_DIFFICULTY.get(
        source_language,
        DEFAULT_CONVERSATION_GOALS_BY_LANGUAGE_AND_DIFFICULTY["english"],
    )
    return list(goals_by_difficulty.get(goal_difficulty, goals_by_difficulty["medium"]))
