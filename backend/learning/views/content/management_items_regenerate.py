from __future__ import annotations

from .dialog_click_resolution import resolve_dialog_click_word_pair
from .generation import WORD_EXERCISE_MODEL
from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status
from .management_items_quick_add import _lookup_german_noun_plural
from .audio import create_audio_file, create_openai_audio_file
from .core import normalize_word_pair_for_item_save
from .word_metadata import normalize_word_metadata as _normalize_word_metadata
from ...models import Item, ItemDialogOccurrence


def _helper_note(*, source_text: str) -> str:
    translation = " ".join((source_text or "").split()).strip()
    if translation:
        return (
            f'Helper word: this is a grammar/support word. In this context it is best understood as "{translation}", '
            "which may be a short phrase rather than a single standalone word."
        )[:255]
    return (
        "Helper word: this is a grammar/support word, so its meaning depends on the larger phrase and may not map to a single standalone word."
    )[:255]


def _original_item_occurrence(*, user, item: Item) -> ItemDialogOccurrence | None:
    target_occurrence = (
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item=item, side=ItemDialogOccurrence.Side.TARGET)
        .select_related("turn", "dialog")
        .order_by("created_at", "id")
        .first()
    )
    if target_occurrence:
        return target_occurrence
    return (
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item=item)
        .select_related("turn", "dialog")
        .order_by("created_at", "id")
        .first()
    )


class ContentItemRegenerateView(APIView):
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

        occurrence = _original_item_occurrence(user=user, item=item)
        if not occurrence or not occurrence.turn:
            return Response({"detail": "Original item context not found"}, status=status.HTTP_400_BAD_REQUEST)

        source_context = str(occurrence.turn.source_text or "").strip()
        target_context = str(occurrence.turn.target_text or "").strip()
        if not source_context or not target_context:
            return Response({"detail": "Original item context not found"}, status=status.HTTP_400_BAD_REQUEST)

        if item.item_type == Item.ItemType.PHRASE:
            # An occurrence points to the full dialog turn, while a saved phrase
            # can intentionally be only a selected part of that turn.
            audio_url = create_audio_file(item.german_text, "phrase", target_language=target_language)
            if not audio_url:
                return Response({"detail": "Audio generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            item.audio_url = audio_url
            item.save(update_fields=["audio_url", "updated_at"])
            return Response({"ok": True})

        source_text, target_text, word_type, note = resolve_dialog_click_word_pair(
            user=user,
            source_text=item.spanish_text,
            target_text=item.german_text,
            source_language=source_language,
            target_language=target_language,
            dialog_id_raw=occurrence.dialog_id,
            turn_index_raw=occurrence.turn_index,
            source_line=source_context,
            target_line=target_context,
            clicked_target_token=item.german_text,
            model=WORD_EXERCISE_MODEL,
        )
        source_text, target_text, word_type = _normalize_word_metadata(
            source_text=source_text,
            target_text=target_text,
            word_type=word_type,
            source_language=source_language,
            target_language=target_language,
            source_line=source_context,
            target_line=target_context,
            model=WORD_EXERCISE_MODEL,
        )
        source_text, target_text = normalize_word_pair_for_item_save(
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )
        final_notes = note.strip()
        if word_type == "helper":
            helper_note = _helper_note(source_text=source_text)
            final_notes = f"{final_notes} {helper_note}".strip() if final_notes else helper_note

        plural_german = item.plural_german or ""
        if word_type == "noun" and target_language == "german":
            plural_german = _lookup_german_noun_plural(
                target_text=target_text,
                target_line=target_context,
                model=WORD_EXERCISE_MODEL,
            ) or plural_german

        audio_text = f"{target_text}. {target_context}".strip() if target_context else target_text
        audio_url = create_openai_audio_file(audio_text, "word", target_language=target_language)
        if not audio_url:
            return Response({"detail": "Audio generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.spanish_text = source_text
        item.german_text = target_text
        item.word_type = word_type
        item.notes = final_notes
        item.plural_german = plural_german
        item.example_sentence = target_context
        item.audio_url = audio_url
        item.exercise_phrases = {}
        item.save(
            update_fields=[
                "spanish_text",
                "german_text",
                "word_type",
                "notes",
                "plural_german",
                "example_sentence",
                "audio_url",
                "exercise_phrases",
                "updated_at",
            ]
        )
        return Response({"ok": True})
