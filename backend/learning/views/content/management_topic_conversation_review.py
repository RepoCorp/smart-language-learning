from __future__ import annotations

from ...auth import get_request_user
from .audio import select_dialog_speaker_voice_ids
from .dialog_item_context import dialog_turns_with_phrase_audio
from .management import APIView, Request, Response, status
from .management_topic_conversation_shared import (
    conversation_context_label,
    conversation_review_context,
    validate_conversation_start_fields,
    validate_conversation_start_payload,
)
from .persistence import save_dialog, save_dialog_turns
from .topic_conversation_models import (
    generate_user_correction as generate_user_correction_with_question_model,
    literal_translate_user_text as literal_translate_user_text_with_question_model,
)
from .topics import save_topic


class ContentTopicConversationReviewView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language, topic, notes, role_text, _goal_difficulty = validate_conversation_start_fields(request)
        validation_error = validate_conversation_start_payload(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_difficulty="medium",
        )
        if validation_error is not None:
            return validation_error

        turns_raw = request.data.get("turns", [])
        if not isinstance(turns_raw, list) or not turns_raw:
            return Response({"detail": "turns are required"}, status=status.HTTP_400_BAD_REQUEST)

        save_topic(
            user=user,
            topic=topic,
            context=conversation_review_context(notes=notes, role_text=role_text),
            source_language=source_language,
            target_language=target_language,
        )

        review_turns: list[dict[str, str]] = []
        history_so_far: list[dict[str, str]] = []
        goal_text = str(request.data.get("goal_text", "")).strip()
        for raw_turn in turns_raw:
            if not isinstance(raw_turn, dict):
                continue
            user_text = str(raw_turn.get("user_text", "")).strip()
            assistant_text = str(raw_turn.get("assistant_text", "")).strip()
            user_corrected_text = str(raw_turn.get("user_corrected_text", "")).strip()
            user_corrected_translation_text = str(raw_turn.get("user_corrected_translation_text", "")).strip()
            assistant_translation_text = str(raw_turn.get("assistant_translation_text", "")).strip()

            corrected_user_text = user_corrected_text
            corrected_user_translation = user_corrected_translation_text
            if user_text and (not corrected_user_text or not corrected_user_translation):
                try:
                    correction_payload = generate_user_correction_with_question_model(
                        user_text=user_text,
                        history=history_so_far,
                        source_language=source_language,
                        target_language=target_language,
                        context_label=conversation_context_label(
                            topic=topic,
                            notes=notes,
                            role_text=role_text,
                        ),
                    )
                    corrected_user_text = str(correction_payload.get("corrected_user_text", "")).strip() or corrected_user_text or user_text
                    corrected_user_translation = str(correction_payload.get("corrected_user_source_translation", "")).strip() or corrected_user_translation
                except RuntimeError:
                    corrected_user_text = corrected_user_text or user_text

            if corrected_user_text and not corrected_user_translation:
                try:
                    corrected_user_translation = literal_translate_user_text_with_question_model(
                        user_text=corrected_user_text,
                        source_language=source_language,
                        target_language=target_language,
                    ).strip()
                except RuntimeError:
                    corrected_user_translation = ""

            if assistant_text and not assistant_translation_text:
                try:
                    assistant_translation_text = literal_translate_user_text_with_question_model(
                        user_text=assistant_text,
                        source_language=source_language,
                        target_language=target_language,
                    ).strip()
                except RuntimeError:
                    assistant_translation_text = ""

            if corrected_user_text:
                review_turns.append(
                    {
                        "source_text": corrected_user_translation,
                        "target_text": corrected_user_text,
                        "speaker": "a",
                    }
                )
            if assistant_text:
                review_turns.append(
                    {
                        "source_text": assistant_translation_text,
                        "target_text": assistant_text,
                        "speaker": "b",
                    }
                )
            if user_text or assistant_text:
                history_so_far.append({"user_text": user_text, "assistant_text": assistant_text})

        if not review_turns:
            return Response({"detail": "No review turns available"}, status=status.HTTP_400_BAD_REQUEST)

        context = conversation_review_context(notes=notes, role_text=role_text)
        saved_dialog = save_dialog(
            user=user,
            topic=topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
            turns=review_turns,
            audio_url="",
        )
        speaker_voice_ids = select_dialog_speaker_voice_ids(target_language, seed=f"dialog:{saved_dialog.id}")
        save_dialog_turns(saved_dialog, review_turns, speaker_voice_ids=speaker_voice_ids)
        saved_dialog = saved_dialog.__class__.objects.prefetch_related("dialog_turns").get(id=saved_dialog.id)
        return Response(
            {
                "dialog_id": saved_dialog.id,
                "topic": saved_dialog.topic,
                "context": saved_dialog.context,
                "audio_url": saved_dialog.audio_url,
                "created_at": saved_dialog.created_at,
                "turn_count": len(review_turns),
                "turns": dialog_turns_with_phrase_audio(saved_dialog, user=user),
            }
        )
