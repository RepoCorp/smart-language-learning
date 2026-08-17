from __future__ import annotations

import logging
import time

from django.conf import settings

from ...ai_usage import realtime_seconds_remaining
from ...auth import get_request_user
from .management import APIView, Request, Response, status
from .conversation_goal_phase import conversation_phase_instruction as build_realtime_phase_instruction
from .management_topic_conversation_shared import (
    conversation_realtime_enabled,
    validate_conversation_start_fields,
    validate_conversation_start_payload,
)
from .realtime_conversation_instructions import build_realtime_conversation_instructions
from .realtime_client_secret import create_realtime_client_secret
from .topic_pool import resolve_topic_choice

logger = logging.getLogger(__name__)


class ContentTopicConversationStartView(APIView):
    def post(self, request: Request) -> Response:
        request_started_at = time.perf_counter()
        source_language, target_language, topic, notes, role_text, goal_difficulty = validate_conversation_start_fields(request)
        topic = resolve_topic_choice(
            user=get_request_user(request),
            topic=topic,
            source_language=source_language,
            target_language=target_language,
        )
        validation_error = validate_conversation_start_payload(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_difficulty=goal_difficulty,
        )
        if validation_error is not None:
            return validation_error

        goal_text = str(request.data.get("goal_text", "")).strip()
        if not goal_text:
            return Response({"detail": "goal_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(goal_text) > 1000:
            return Response({"detail": "goal_text is too long"}, status=status.HTTP_400_BAD_REQUEST)
        goals = [goal_text]

        total_elapsed_ms = int((time.perf_counter() - request_started_at) * 1000)
        logger.info(
            "content.topic_conversation.start_finished total_elapsed_ms=%s topic=%s goal_length=%s",
            total_elapsed_ms,
            topic,
            len(goal_text),
        )
        logger.info(
            "content.topic_conversation.start_timing_summary total_elapsed_ms=%s topic=%s goal_difficulty=%s goal_length=%s",
            total_elapsed_ms,
            topic,
            goal_difficulty,
            len(goal_text),
        )

        return Response(
            {
                "topic": topic,
                "notes": notes,
                "role_text": role_text,
                "goal_difficulty": goal_difficulty,
                "goals": goals,
                "goal_text": goal_text,
                "opening_text": "",
                "opening_translation_text": "",
                "opening_audio_url": "",
            }
        )


class ContentTopicConversationRealtimeSessionView(APIView):
    def post(self, request: Request) -> Response:
        request_started_at = time.perf_counter()
        source_language, target_language, topic, notes, role_text, goal_difficulty = validate_conversation_start_fields(request)
        conversation_phase = str(request.data.get("conversation_phase", "active")).strip().lower() or "active"
        goal_text = str(request.data.get("goal_text", "")).strip()
        topic = resolve_topic_choice(
            user=get_request_user(request),
            topic=topic,
            source_language=source_language,
            target_language=target_language,
        )
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
            goal_text=goal_text,
            source_language=source_language,
            target_language=target_language,
        ) + build_realtime_phase_instruction(conversation_phase)

        try:
            client_secret_started_at = time.perf_counter()
            client_secret_payload = create_realtime_client_secret(
                request=request,
                instructions=realtime_instructions,
            )
            client_secret_elapsed_ms = int((time.perf_counter() - client_secret_started_at) * 1000)
            logger.info(
                "content.topic_conversation.realtime_session_stage stage=client_secret elapsed_ms=%s topic=%s",
                client_secret_elapsed_ms,
                topic,
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
        logger.info(
            "content.topic_conversation.realtime_session_finished total_elapsed_ms=%s client_secret_ms=%s topic=%s instructions_length=%s",
            int((time.perf_counter() - request_started_at) * 1000),
            client_secret_elapsed_ms,
            topic,
            len(realtime_instructions),
        )
        logger.info(
            "content.topic_conversation.realtime_session_timing_summary total_elapsed_ms=%s client_secret_ms=%s topic=%s goal_difficulty=%s instructions_length=%s has_client_secret=%s",
            int((time.perf_counter() - request_started_at) * 1000),
            client_secret_elapsed_ms,
            topic,
            goal_difficulty,
            len(realtime_instructions),
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
                "realtime_remaining_seconds": realtime_seconds_remaining(get_request_user(request)),
            }
        )
