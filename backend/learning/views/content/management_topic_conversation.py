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
from .management import (
    APIView,
    Request,
    Response,
    _normalized_pair,
    _openai_transcribe_audio_upload,
    _parse_item_conversation_history,
    status,
)
from .core import create_audio_file
from .audio import create_audio_data_url
from .topic_conversation_models import (
    analyze_user_turn as _analyze_user_turn_with_question_model,
    evaluate_goal_achievement as _evaluate_goal_achievement_with_question_model,
    generate_conversation_help as _generate_conversation_help_with_question_model,
    generate_target_phrase_help as _generate_target_phrase_help_with_question_model,
    generate_topic_conversation_reply as _generate_topic_conversation_reply,
    generate_topic_conversation_start as _generate_topic_conversation_start,
    generate_user_correction as _generate_user_correction_with_question_model,
    literal_translate_user_text as _literal_translate_user_text_with_question_model,
)

logger = logging.getLogger(__name__)


def _analysis_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_ENABLE_ANALYSIS", True))


def _goal_evaluation_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_ENABLE_GOAL_EVALUATION", True))


def _conversation_audio_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_ENABLE_AUDIO", True))


def _conversation_inline_audio_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_RETURN_INLINE_AUDIO", False))


def _conversation_realtime_enabled() -> bool:
    return bool(getattr(settings, "DEV_CONVERSATION_USE_REALTIME", False))


def _validate_conversation_start_fields(request: Request) -> tuple[str, str, str, str, str, str]:
    source_language, target_language = _normalized_pair(request)
    topic = str(request.data.get("topic", "")).strip()
    notes = str(request.data.get("notes", "")).strip()
    role_text = str(request.data.get("role_text", "")).strip()
    goal_difficulty = str(request.data.get("goal_difficulty", "medium")).strip().lower() or "medium"
    return source_language, target_language, topic, notes, role_text, goal_difficulty


def _validate_conversation_start_payload(
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


def _build_realtime_conversation_instructions(
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
        f"Use an A2 level of {target_name}.\n"
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


def _build_realtime_safety_identifier(request: Request) -> str:
    user = get_request_user(request)
    if user is None:
        return "anonymous"
    raw_identifier = f"user:{getattr(user, 'id', '')}:{getattr(user, 'username', '')}"
    return hashlib.sha256(raw_identifier.encode("utf-8")).hexdigest()


def _create_realtime_client_secret(*, request: Request, instructions: str) -> dict[str, object]:
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
                "input": {
                    "transcription": {
                        "model": transcription_model,
                    },
                },
                "output": {
                    "voice": voice,
                },
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
            "OpenAI-Safety-Identifier": _build_realtime_safety_identifier(request),
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
        source_language, target_language, topic, notes, role_text, goal_difficulty = _validate_conversation_start_fields(request)
        validation_error = _validate_conversation_start_payload(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_difficulty=goal_difficulty,
        )
        if validation_error is not None:
            return validation_error

        try:
            start_payload = _generate_topic_conversation_start(
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
        if opening_text and _conversation_audio_enabled():
            if _conversation_inline_audio_enabled():
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
        source_language, target_language, topic, notes, role_text, goal_difficulty = _validate_conversation_start_fields(request)
        logger.info(
            "content.topic_conversation.realtime_session_requested topic=%s source_language=%s target_language=%s goal_difficulty=%s notes_length=%s role_length=%s realtime_enabled=%s",
            topic,
            source_language,
            target_language,
            goal_difficulty,
            len(notes),
            len(role_text),
            _conversation_realtime_enabled(),
        )
        validation_error = _validate_conversation_start_payload(
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
        if not _conversation_realtime_enabled():
            logger.info("content.topic_conversation.realtime_session_disabled topic=%s", topic)
            return Response({"realtime_enabled": False})

        realtime_instructions = _build_realtime_conversation_instructions(
            topic=topic,
            notes=notes,
            role_text=role_text,
            source_language=source_language,
            target_language=target_language,
        )

        try:
            client_secret_payload = _create_realtime_client_secret(
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


class ContentTopicConversationTurnView(APIView):
    def post(self, request: Request) -> Response:
        request_started_at = time.perf_counter()
        transcription_elapsed_ms = 0
        analysis_elapsed_ms = 0
        reply_elapsed_ms = 0
        goal_elapsed_ms = 0
        assistant_audio_elapsed_ms = 0
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        goal_text = str(request.data.get("goal_text", "")).strip()
        if not topic:
            return Response({"detail": "topic is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(topic) > 120:
            return Response({"detail": "topic is too long"}, status=status.HTTP_400_BAD_REQUEST)
        if len(role_text) > 240:
            return Response({"detail": "role_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        audio_file = request.FILES.get("audio")
        if audio_file is None:
            return Response({"detail": "audio file is required"}, status=status.HTTP_400_BAD_REQUEST)

        history = _parse_item_conversation_history(request.data.get("history"))
        history_count = len(history)
        audio_name = str(getattr(audio_file, "name", "") or "")
        audio_size_bytes = int(getattr(audio_file, "size", 0) or 0)
        audio_content_type = str(getattr(audio_file, "content_type", "") or "")
        analysis_enabled = _analysis_enabled()
        goal_evaluation_enabled = _goal_evaluation_enabled()
        audio_enabled = _conversation_audio_enabled()
        inline_audio_enabled = _conversation_inline_audio_enabled()

        logger.info(
            "content.topic_conversation.turn_started topic=%s source_language=%s target_language=%s history_count=%s audio_name=%s audio_size_bytes=%s audio_content_type=%s analysis_enabled=%s goal_evaluation_enabled=%s audio_enabled=%s inline_audio_enabled=%s",
            topic,
            source_language,
            target_language,
            history_count,
            audio_name,
            audio_size_bytes,
            audio_content_type,
            analysis_enabled,
            goal_evaluation_enabled,
            audio_enabled,
            inline_audio_enabled,
        )

        transcription_started_at = time.perf_counter()
        user_text = _openai_transcribe_audio_upload(audio_file, target_language=target_language)
        transcription_elapsed_ms = int((time.perf_counter() - transcription_started_at) * 1000)
        logger.info(
            "content.topic_conversation.turn_stage stage=transcription elapsed_ms=%s transcript_length=%s success=%s",
            transcription_elapsed_ms,
            len(user_text),
            bool(user_text),
        )
        if not user_text:
            total_elapsed_ms = int((time.perf_counter() - request_started_at) * 1000)
            logger.warning(
                "content.topic_conversation.turn_failed stage=transcription total_elapsed_ms=%s history_count=%s",
                total_elapsed_ms,
                history_count,
            )
            return Response({"detail": "Could not transcribe audio"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        context_label = (
            f"Conversation topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
        )
        analysis = {
            "is_grammatically_correct": True,
            "makes_sense_in_context": True,
            "needs_correction": False,
        }
        if analysis_enabled:
            try:
                analysis_started_at = time.perf_counter()
                analysis = _analyze_user_turn_with_question_model(
                    user_text=user_text,
                    history=history,
                    source_language=source_language,
                    target_language=target_language,
                    context_label=context_label,
                )
                analysis_elapsed_ms = int((time.perf_counter() - analysis_started_at) * 1000)
                logger.info(
                    "content.topic_conversation.turn_stage stage=analysis elapsed_ms=%s needs_correction=%s grammatically_correct=%s makes_sense=%s",
                    analysis_elapsed_ms,
                    bool(analysis["needs_correction"]),
                    bool(analysis["is_grammatically_correct"]),
                    bool(analysis["makes_sense_in_context"]),
                )
            except RuntimeError as exc:
                total_elapsed_ms = int((time.perf_counter() - request_started_at) * 1000)
                logger.warning(
                    "content.topic_conversation.turn_failed stage=analysis total_elapsed_ms=%s error=%s",
                    total_elapsed_ms,
                    str(exc),
                )
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        else:
            logger.info("content.topic_conversation.turn_stage stage=analysis skipped=true")

        try:
            reply_started_at = time.perf_counter()
            assistant_payload = _generate_topic_conversation_reply(
                topic=topic,
                notes=notes,
                role_text=role_text,
                user_text=user_text,
                history=history,
                source_language=source_language,
                target_language=target_language,
            )
            reply_elapsed_ms = int((time.perf_counter() - reply_started_at) * 1000)
            logger.info(
                "content.topic_conversation.turn_stage stage=reply elapsed_ms=%s reply_length=%s translation_length=%s",
                reply_elapsed_ms,
                len(str(assistant_payload.get("reply_text", "") or "")),
                len(str(assistant_payload.get("source_translation", "") or "")),
            )
        except RuntimeError as exc:
            total_elapsed_ms = int((time.perf_counter() - request_started_at) * 1000)
            logger.warning(
                "content.topic_conversation.turn_failed stage=reply total_elapsed_ms=%s error=%s",
                total_elapsed_ms,
                str(exc),
            )
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        assistant_text = assistant_payload["reply_text"]
        assistant_translation_text = assistant_payload["source_translation"]
        goal_achieved = False
        goal_achievement_message = ""
        next_goal_suggestion = ""
        if goal_text and goal_evaluation_enabled:
            try:
                goal_started_at = time.perf_counter()
                goal_achieved, goal_achievement_message, next_goal_suggestion = _evaluate_goal_achievement_with_question_model(
                    topic=topic,
                    notes=notes,
                    role_text=role_text,
                    goal_text=goal_text,
                    history=history,
                    latest_user_text=user_text,
                    source_language=source_language,
                    target_language=target_language,
                )
                goal_elapsed_ms = int((time.perf_counter() - goal_started_at) * 1000)
                logger.info(
                    "content.topic_conversation.turn_stage stage=goal_evaluation elapsed_ms=%s goal_achieved=%s next_goal_suggestion_length=%s",
                    goal_elapsed_ms,
                    goal_achieved,
                    len(next_goal_suggestion),
                )
            except RuntimeError as exc:
                total_elapsed_ms = int((time.perf_counter() - request_started_at) * 1000)
                logger.warning(
                    "content.topic_conversation.turn_failed stage=goal_evaluation total_elapsed_ms=%s error=%s",
                    total_elapsed_ms,
                    str(exc),
                )
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        elif goal_text:
            logger.info("content.topic_conversation.turn_stage stage=goal_evaluation skipped=true")
        if goal_achieved and next_goal_suggestion:
            goal_achievement_message = f"{goal_achievement_message} {next_goal_suggestion}".strip()
        assistant_audio_url = ""
        if assistant_text and audio_enabled:
            audio_started_at = time.perf_counter()
            if inline_audio_enabled:
                assistant_audio_url = create_audio_data_url(assistant_text, "conversation", target_language=target_language)
            else:
                assistant_audio_url = create_audio_file(assistant_text, "conversation", target_language=target_language)
            assistant_audio_elapsed_ms = int((time.perf_counter() - audio_started_at) * 1000)
            logger.info(
                "content.topic_conversation.turn_stage stage=assistant_audio elapsed_ms=%s has_audio=%s",
                assistant_audio_elapsed_ms,
                bool(assistant_audio_url),
            )
        elif assistant_text:
            logger.info("content.topic_conversation.turn_stage stage=assistant_audio skipped=true")

        total_elapsed_ms = int((time.perf_counter() - request_started_at) * 1000)
        logger.info(
            "content.topic_conversation.turn_finished total_elapsed_ms=%s history_count=%s transcript_length=%s reply_length=%s goal_achieved=%s has_audio=%s",
            total_elapsed_ms,
            history_count,
            len(user_text),
            len(assistant_text),
            goal_achieved,
            bool(assistant_audio_url),
        )
        logger.info(
            "content.topic_conversation.turn_timing_summary total_elapsed_ms=%s transcription_ms=%s analysis_ms=%s reply_ms=%s goal_evaluation_ms=%s assistant_audio_ms=%s history_count=%s transcript_length=%s reply_length=%s goal_present=%s goal_achieved=%s has_audio=%s analysis_enabled=%s goal_evaluation_enabled=%s audio_enabled=%s inline_audio_enabled=%s",
            total_elapsed_ms,
            transcription_elapsed_ms,
            analysis_elapsed_ms,
            reply_elapsed_ms,
            goal_elapsed_ms,
            assistant_audio_elapsed_ms,
            history_count,
            len(user_text),
            len(assistant_text),
            bool(goal_text),
            goal_achieved,
            bool(assistant_audio_url),
            analysis_enabled,
            goal_evaluation_enabled,
            audio_enabled,
            inline_audio_enabled,
        )

        return Response(
            {
                "user_text": user_text,
                "user_translation_text": "",
                "user_corrected_text": "",
                "user_corrected_translation_text": "",
                "user_correction_explanation": "",
                "user_is_grammatically_correct": bool(analysis["is_grammatically_correct"]),
                "user_makes_sense_in_context": bool(analysis["makes_sense_in_context"]),
                "user_needs_correction": bool(analysis["needs_correction"]),
                "assistant_text": assistant_text,
                "assistant_translation_text": assistant_translation_text,
                "assistant_audio_url": assistant_audio_url,
                "goal_achieved": goal_achieved,
                "goal_achievement_message": goal_achievement_message,
                "next_goal_suggestion": next_goal_suggestion,
            }
        )


class ContentTopicConversationUserTranslationView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        user_text = str(request.data.get("user_text", "")).strip()
        if not user_text:
            return Response({"detail": "user_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_translation_text = _literal_translate_user_text_with_question_model(
                user_text=user_text,
                source_language=source_language,
                target_language=target_language,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"user_translation_text": user_translation_text})


class ContentTopicConversationUserCorrectionView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        user_text = str(request.data.get("user_text", "")).strip()
        if not user_text:
            return Response({"detail": "user_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        history = _parse_item_conversation_history(request.data.get("history"))
        context_label = (
            f"Conversation topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
        )
        try:
            correction_payload = _generate_user_correction_with_question_model(
                user_text=user_text,
                history=history,
                source_language=source_language,
                target_language=target_language,
                context_label=context_label,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        explanation = str(correction_payload.get("corrected_user_explanation", "")).strip()
        if not explanation:
            explanation = "Explanation not available"
        return Response(
            {
                "user_corrected_text": str(correction_payload.get("corrected_user_text", "")).strip(),
                "user_corrected_translation_text": str(correction_payload.get("corrected_user_source_translation", "")).strip(),
                "user_correction_explanation": explanation,
            }
        )


class ContentTopicConversationHelpView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        user_help_request_text = str(request.data.get("request_text", "")).strip()
        request_kind = str(request.data.get("request_kind", "coach")).strip().lower() or "coach"
        if request_kind not in {"coach", "say"}:
            return Response({"detail": "request_kind must be coach or say"}, status=status.HTTP_400_BAD_REQUEST)
        if not user_help_request_text:
            return Response({"detail": "request_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(user_help_request_text) > 800:
            return Response({"detail": "request_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        history = _parse_item_conversation_history(request.data.get("history"))

        try:
            if request_kind == "say":
                target_text, help_text = _generate_target_phrase_help_with_question_model(
                    topic=topic,
                    notes=notes,
                    role_text=role_text,
                    user_help_request_text=user_help_request_text,
                    history=history,
                    source_language=source_language,
                    target_language=target_language,
                )
            else:
                target_text = ""
                help_text = _generate_conversation_help_with_question_model(
                    topic=topic,
                    notes=notes,
                    role_text=role_text,
                    user_help_request_text=user_help_request_text,
                    history=history,
                    source_language=source_language,
                    target_language=target_language,
                )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(
            {
                "request_kind": request_kind,
                "request_text": user_help_request_text,
                "help_text": help_text,
                "target_text": target_text,
            }
        )
