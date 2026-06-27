from __future__ import annotations

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

class ContentTopicConversationStartView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        goal_difficulty = str(request.data.get("goal_difficulty", "medium")).strip().lower() or "medium"
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
        if opening_text:
            opening_audio_url = create_audio_file(opening_text, "conversation", target_language=target_language)

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


class ContentTopicConversationTurnView(APIView):
    def post(self, request: Request) -> Response:
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
        user_text = _openai_transcribe_audio_upload(audio_file, target_language=target_language)
        if not user_text:
            return Response({"detail": "Could not transcribe audio"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        context_label = (
            f"Conversation topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
        )
        try:
            analysis = _analyze_user_turn_with_question_model(
                user_text=user_text,
                history=history,
                source_language=source_language,
                target_language=target_language,
                context_label=context_label,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            assistant_payload = _generate_topic_conversation_reply(
                topic=topic,
                notes=notes,
                role_text=role_text,
                user_text=user_text,
                history=history,
                source_language=source_language,
                target_language=target_language,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        assistant_text = assistant_payload["reply_text"]
        assistant_translation_text = assistant_payload["source_translation"]
        goal_achieved = False
        goal_achievement_message = ""
        next_goal_suggestion = ""
        if goal_text:
            try:
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
            except RuntimeError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if goal_achieved and next_goal_suggestion:
            goal_achievement_message = f"{goal_achievement_message} {next_goal_suggestion}".strip()
        assistant_audio_url = ""
        if assistant_text:
            assistant_audio_url = create_audio_file(assistant_text, "conversation", target_language=target_language)

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
