from __future__ import annotations

import logging
import time

from .audio import create_audio_data_url, select_dialog_speaker_voice_ids
from .core import create_audio_file
from .management import (
    APIView,
    Request,
    Response,
    _normalized_pair,
    _openai_transcribe_audio_upload,
    _parse_item_conversation_history,
    status,
)
from .management_topic_conversation_shared import (
    analysis_enabled,
    conversation_audio_enabled,
    conversation_context_label,
    conversation_inline_audio_enabled,
    goal_evaluation_enabled,
)
from .topic_conversation_models import (
    analyze_user_turn as analyze_user_turn_with_question_model,
    evaluate_goal_achievement as evaluate_goal_achievement_with_question_model,
    generate_topic_conversation_reply as generate_topic_conversation_reply_with_question_model,
)

logger = logging.getLogger(__name__)


def _conversation_assistant_voice_id(*, topic: str, notes: str, role_text: str, target_language: str) -> str:
    speaker_voice_ids = select_dialog_speaker_voice_ids(
        target_language,
        seed=f"conversation:{target_language}:{topic}:{notes}:{role_text}",
    )
    if not speaker_voice_ids:
        return ""
    return speaker_voice_ids[1]


def _response_level_instruction(level: str) -> str:
    normalized_level = str(level).strip().upper() or "A2"
    if normalized_level == "A1":
        return "Use an A1 level. Use very simple words, very short sentences, and very basic grammar."
    if normalized_level == "B1":
        return "Use a B1 level. You can use somewhat more natural and varied vocabulary, but keep it learner-friendly."
    return "Use an A2 level. Use simple vocabulary and simple grammar."


def _speech_speed_instruction(speed: str) -> str:
    normalized_speed = str(speed).strip().lower() or "normal"
    if normalized_speed == "super_slow":
        return "Speak extremely slowly, with very short sentences and very clear wording that stays slow from beginning to end."
    if normalized_speed == "slow":
        return "Speak slowly and clearly, using short sentences and easy wording."
    return ""


def _effective_notes(*, notes: str, response_level: str, speech_speed: str) -> str:
    return "\n".join(
        part for part in [
            notes.strip(),
            _response_level_instruction(response_level),
            _speech_speed_instruction(speech_speed),
        ] if part
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
        skip_goal_evaluation = str(request.data.get("skip_goal_evaluation", "")).strip().lower() in {"1", "true", "yes", "on"}
        response_level = str(request.data.get("response_level", "A2")).strip().upper() or "A2"
        speech_speed = str(request.data.get("speech_speed", "normal")).strip().lower() or "normal"
        effective_notes = _effective_notes(
            notes=notes,
            response_level=response_level,
            speech_speed=speech_speed,
        )
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
        analysis_is_enabled = analysis_enabled()
        goal_evaluation_is_enabled = goal_evaluation_enabled()
        audio_is_enabled = conversation_audio_enabled()
        inline_audio_is_enabled = conversation_inline_audio_enabled()

        logger.info(
            "content.topic_conversation.turn_started topic=%s source_language=%s target_language=%s history_count=%s audio_name=%s audio_size_bytes=%s audio_content_type=%s analysis_enabled=%s goal_evaluation_enabled=%s audio_enabled=%s inline_audio_enabled=%s",
            topic,
            source_language,
            target_language,
            history_count,
            audio_name,
            audio_size_bytes,
            audio_content_type,
            analysis_is_enabled,
            goal_evaluation_is_enabled,
            audio_is_enabled,
            inline_audio_is_enabled,
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

        analysis = {
            "is_grammatically_correct": True,
            "makes_sense_in_context": True,
            "needs_correction": False,
        }
        if analysis_is_enabled:
            try:
                analysis_started_at = time.perf_counter()
                analysis = analyze_user_turn_with_question_model(
                    user_text=user_text,
                    history=history,
                    source_language=source_language,
                    target_language=target_language,
                    context_label=conversation_context_label(topic=topic, notes=effective_notes, role_text=role_text),
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
            assistant_payload = generate_topic_conversation_reply_with_question_model(
                topic=topic,
                notes=effective_notes,
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
        if goal_text and goal_evaluation_is_enabled and not skip_goal_evaluation:
            try:
                goal_started_at = time.perf_counter()
                goal_achieved, goal_achievement_message, next_goal_suggestion = evaluate_goal_achievement_with_question_model(
                    topic=topic,
                    notes=effective_notes,
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
        if assistant_text and audio_is_enabled:
            audio_started_at = time.perf_counter()
            assistant_voice_id = _conversation_assistant_voice_id(
                topic=topic,
                notes=notes,
                role_text=role_text,
                target_language=target_language,
            )
            if inline_audio_is_enabled:
                assistant_audio_url = create_audio_data_url(
                    assistant_text,
                    "conversation",
                    target_language=target_language,
                    voice_id=assistant_voice_id,
                )
            else:
                assistant_audio_url = create_audio_file(
                    assistant_text,
                    "conversation",
                    target_language=target_language,
                    voice_id=assistant_voice_id,
                )
            assistant_audio_elapsed_ms = int((time.perf_counter() - audio_started_at) * 1000)
            logger.info(
                "content.topic_conversation.turn_stage stage=assistant_audio elapsed_ms=%s has_audio=%s assistant_voice_id=%s",
                assistant_audio_elapsed_ms,
                bool(assistant_audio_url),
                assistant_voice_id,
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
            analysis_is_enabled,
            goal_evaluation_is_enabled,
            audio_is_enabled,
            inline_audio_is_enabled,
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
