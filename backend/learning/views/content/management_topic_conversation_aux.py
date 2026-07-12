from __future__ import annotations

from .management import APIView, Request, Response, _normalized_pair, _parse_item_conversation_history, status
from .management_topic_conversation_shared import conversation_context_label
from .topic_conversation_models import (
    generate_conversation_help as generate_conversation_help_with_question_model,
    generate_target_phrase_help as generate_target_phrase_help_with_question_model,
    generate_user_correction as generate_user_correction_with_question_model,
    literal_translate_user_text as literal_translate_user_text_with_question_model,
)


class ContentTopicConversationUserTranslationView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        user_text = str(request.data.get("user_text", "")).strip()
        if not user_text:
            return Response({"detail": "user_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_translation_text = literal_translate_user_text_with_question_model(
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
        try:
            correction_payload = generate_user_correction_with_question_model(
                user_text=user_text,
                history=history,
                source_language=source_language,
                target_language=target_language,
                context_label=conversation_context_label(topic=topic, notes=notes, role_text=role_text),
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        explanation = str(correction_payload.get("corrected_user_explanation", "")).strip() or "Explanation not available"
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
                target_text, help_text = generate_target_phrase_help_with_question_model(
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
                help_text = generate_conversation_help_with_question_model(
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
