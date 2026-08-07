from __future__ import annotations

from .audio import create_openai_audio_file
from .dialog_item_context import related_dialogs_by_item_ids
from .item_compare_payloads import compare_words_payload
from .item_questions import item_question_history
from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status
from ..dialog_phrase_match import build_dialog_phrase_match_payload
from ...models import Item


class ContentItemDetailView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        related_dialogs_map = related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
        dialog_phrase_payload = build_dialog_phrase_match_payload(item, user=user)
        return Response(
            {
                "id": item.id,
                "item_type": item.item_type,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "example_sentence": item.example_sentence,
                "notes": item.notes,
                "word_type": item.word_type,
                "plural_german": item.plural_german,
                "audio_url": item.audio_url,
                "exercise_phrases": item.exercise_phrases or {},
                "created_at": item.created_at,
                "dialog_phrase_answer": dialog_phrase_payload["answer"],
                "dialog_phrase_scene": dialog_phrase_payload["scene"],
                "dialog_phrase_scene_audio_urls": dialog_phrase_payload["scene_audio_urls"],
                "dialog_phrase_options": dialog_phrase_payload["options"],
                "dialog_phrase_turns": dialog_phrase_payload["turns"],
                "dialog_phrase_odd_index": dialog_phrase_payload["odd_index"],
                "related_dialogs": related_dialogs_map.get(item.id, []),
                "compare_words": compare_words_payload(item),
                "compare_words_insights": item.compare_words_insights or "",
                "item_questions": item_question_history(item),
            }
        )

    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        if item.item_type == Item.ItemType.WORD:
            phrase_part = item.example_sentence.strip()
            audio_text = f"{item.german_text}. {phrase_part}".strip() if phrase_part else item.german_text
            audio_prefix = "word"
        else:
            audio_text = item.german_text
            audio_prefix = "phrase"

        # Saved items always use the fixed OpenAI voice, independently from dialog audio.
        audio_url = create_openai_audio_file(audio_text, audio_prefix, target_language=target_language)
        if not audio_url:
            return Response({"detail": "Audio generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.audio_url = audio_url
        item.save(update_fields=["audio_url", "updated_at"])
        return Response({"audio_url": audio_url})

    def delete(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        deleted, _ = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).delete()
        if deleted == 0:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
