from __future__ import annotations

import hashlib
import json
import logging
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...auth import get_request_user
from ...languages import language_display_name
from .audio import create_audio_data_url, select_dialog_speaker_voice_ids
from .core import create_audio_file
from .management import APIView, Request, Response, status
from .management_topic_conversation_shared import (
    conversation_audio_enabled,
    conversation_inline_audio_enabled,
    conversation_realtime_enabled,
    validate_conversation_start_fields,
    validate_conversation_start_payload,
)
from .topic_conversation_models import generate_topic_conversation_start as generate_topic_conversation_start_with_question_model

logger = logging.getLogger(__name__)


def build_realtime_conversation_instructions(
    *,
    topic: str,
    notes: str,
    role_text: str,
    source_language: str,
    target_language: str,
) -> str:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    role_line = role_text or "No specific learner role"
    notes_line = notes or "No temporary notes"
    return (
        "You are a patient spoken language tutor.\n"
        f"The learner speaks {source_name} and is practicing {target_name}.\n"
        f"Conversation topic: {topic}\n"
        f"Learner role: {role_line}\n"
        f"Temporary notes: {notes_line}\n"
        f"Always reply in natural {target_name}.\n"
        "Use simple vocabulary and simple grammar.\n"
        "Prefer common everyday words.\n"
        "Avoid long explanations, idioms, slang, and advanced words.\n"
        f"Keep replies very short, conversational, and appropriate for a learner of {target_name}.\n"
        "Use 1 or 2 short sentences maximum.\n"
        f"Do not switch to {source_name} unless the learner explicitly asks for it.\n"
        "Do not explain grammar unless asked.\n"
        "Ask at most one short follow-up question when it helps keep the conversation moving.\n"
        "If the audio is unclear or empty, briefly ask the learner to repeat it.\n"
    )


def build_realtime_safety_identifier(request: Request) -> str:
    user = get_request_user(request)
    if user is None:
        return "anonymous"
    raw_identifier = f"user:{getattr(user, 'id', '')}:{getattr(user, 'username', '')}"
    return hashlib.sha256(raw_identifier.encode("utf-8")).hexdigest()


def create_realtime_client_secret(*, request: Request, instructions: str) -> dict[str, object]:
    api_key = str(getattr(settings, "OPENAI_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    model = str(getattr(settings, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1")).strip() or "gpt-realtime-2.1"
    voice = str(getattr(settings, "OPENAI_REALTIME_VOICE", "marin")).strip() or "marin"
    transcription_model = (
        str(getattr(settings, "OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")).strip()
        or "gpt-4o-mini-transcribe"
    )
    payload = {
        "session": {
            "type": "realtime",
            "model": model,
            "instructions": instructions,
            "audio": {
                "input": {"transcription": {"model": transcription_model}},
                "output": {"voice": voice},
            },
        }
    }
    logger.info(
        "content.topic_conversation.realtime_client_secret_started model=%s voice=%s transcription_model=%s instructions_length=%s",
        model,
        voice,
        transcription_model,
        len(instructions),
    )
    body = json.dumps(payload).encode("utf-8")
    url_request = UrlRequest(
        "https://api.openai.com/v1/realtime/client_secrets",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "OpenAI-Safety-Identifier": build_realtime_safety_identifier(request),
        },
        method="POST",
    )
    timeout_seconds = int(getattr(settings, "OPENAI_REQUEST_TIMEOUT_SECONDS", 30))
    started_at = time.perf_counter()
    try:
        with urlopen(url_request, timeout=timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        response_body = ""
        response_detail = ""
        try:
            response_body = exc.read().decode("utf-8", errors="replace")
            parsed_body = json.loads(response_body)
            response_detail = str(parsed_body.get("error", {}).get("message", "")).strip()
        except Exception:
            response_body = ""
            response_detail = ""
        logger.warning(
            "content.topic_conversation.realtime_client_secret_failed error_class=%s status=%s elapsed_ms=%s body=%s",
            exc.__class__.__name__,
            getattr(exc, "code", ""),
            int((time.perf_counter() - started_at) * 1000),
            response_body[:1000],
        )
        error_message = "Could not create Realtime session"
        if response_detail:
            error_message = f"{error_message}: {response_detail}"
        raise RuntimeError(error_message) from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning(
            "content.topic_conversation.realtime_client_secret_failed error_class=%s elapsed_ms=%s",
            exc.__class__.__name__,
            int((time.perf_counter() - started_at) * 1000),
        )
        raise RuntimeError("Could not create Realtime session") from exc

    logger.info(
        "content.topic_conversation.realtime_client_secret_succeeded model=%s voice=%s elapsed_ms=%s",
        model,
        voice,
        int((time.perf_counter() - started_at) * 1000),
    )
    return response_payload


class ContentTopicConversationStartView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language, topic, notes, role_text, goal_difficulty = validate_conversation_start_fields(request)
        validation_error = validate_conversation_start_payload(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_difficulty=goal_difficulty,
        )
        if validation_error is not None:
            return validation_error

        try:
            start_payload = generate_topic_conversation_start_with_question_model(
                topic=topic,
                notes=notes,
                role_text=role_text,
                goal_difficulty=goal_difficulty,
                source_language=source_language,
                target_language=target_language,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        opening_text = start_payload["opening_text"]
        opening_translation_text = start_payload["opening_translation_text"]
        goal_text = start_payload["goal_text"]
        selected_goal_difficulty = start_payload["goal_difficulty"]
        opening_audio_url = ""
        if opening_text and conversation_audio_enabled():
            if conversation_inline_audio_enabled():
                opening_audio_url = create_audio_data_url(opening_text, "conversation", target_language=target_language)
            else:
                opening_audio_url = create_audio_file(opening_text, "conversation", target_language=target_language)
        elif opening_text:
            logger.info("content.topic_conversation.start_stage stage=opening_audio skipped=true")

        return Response(
            {
                "topic": topic,
                "notes": notes,
                "role_text": role_text,
                "goal_difficulty": selected_goal_difficulty,
                "goal_text": goal_text,
                "opening_text": opening_text,
                "opening_translation_text": opening_translation_text,
                "opening_audio_url": opening_audio_url,
            }
        )


class ContentTopicConversationRealtimeSessionView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language, topic, notes, role_text, goal_difficulty = validate_conversation_start_fields(request)
        logger.info(
            "content.topic_conversation.realtime_session_requested topic=%s source_language=%s target_language=%s goal_difficulty=%s notes_length=%s role_length=%s realtime_enabled=%s",
            topic,
            source_language,
            target_language,
            goal_difficulty,
            len(notes),
            len(role_text),
            conversation_realtime_enabled(),
        )
        validation_error = validate_conversation_start_payload(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_difficulty=goal_difficulty,
        )
        if validation_error is not None:
            logger.warning(
                "content.topic_conversation.realtime_session_rejected topic=%s detail=%s",
                topic,
                getattr(getattr(validation_error, "data", {}), "get", lambda *_: "")("detail"),
            )
            return validation_error
        if not conversation_realtime_enabled():
            logger.info("content.topic_conversation.realtime_session_disabled topic=%s", topic)
            return Response({"realtime_enabled": False})

        realtime_instructions = build_realtime_conversation_instructions(
            topic=topic,
            notes=notes,
            role_text=role_text,
            source_language=source_language,
            target_language=target_language,
        )

        try:
            client_secret_payload = create_realtime_client_secret(
                request=request,
                instructions=realtime_instructions,
            )
        except RuntimeError as exc:
            logger.warning(
                "content.topic_conversation.realtime_session_failed topic=%s error=%s",
                topic,
                str(exc),
            )
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        normalized_client_secret = {
            "value": str(client_secret_payload.get("value", "")).strip(),
            "expires_at": client_secret_payload.get("expires_at"),
        }
        if not normalized_client_secret["value"]:
            client_secret = client_secret_payload.get("client_secret")
            if isinstance(client_secret, dict):
                normalized_client_secret = {
                    "value": str(client_secret.get("value", "")).strip(),
                    "expires_at": client_secret.get("expires_at"),
                }
        if not normalized_client_secret["value"]:
            logger.warning("content.topic_conversation.realtime_session_failed topic=%s error=missing_client_secret", topic)
            return Response({"detail": "Could not create Realtime session"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        logger.info(
            "content.topic_conversation.realtime_session_succeeded topic=%s model=%s voice=%s has_client_secret=%s",
            topic,
            str(getattr(settings, "OPENAI_REALTIME_MODEL", "gpt-realtime-1.5")).strip() or "gpt-realtime-1.5",
            str(getattr(settings, "OPENAI_REALTIME_VOICE", "marin")).strip() or "marin",
            bool(normalized_client_secret["value"]),
        )
        return Response(
            {
                "realtime_enabled": True,
                "client_secret": normalized_client_secret,
                "model": str(getattr(settings, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1")).strip() or "gpt-realtime-2.1",
                "voice": str(getattr(settings, "OPENAI_REALTIME_VOICE", "marin")).strip() or "marin",
                "transcription_model": (
                    str(getattr(settings, "OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")).strip()
                    or "gpt-4o-mini-transcribe"
                ),
                "instructions": realtime_instructions,
            }
        )
