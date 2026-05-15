from __future__ import annotations

from .management import (
    APIView,
    Item,
    Q,
    Request,
    Response,
    _item_question_history,
    _next_review_days,
    _normalized_pair,
    _related_dialogs_by_item_ids,
    apply_user_scope,
    create_audio_file,
    get_request_user,
    status,
    timezone,
)
from .core import generate_word_exercise_phrases_with_chatgpt

MAX_EXERCISE_PHRASES = 30


class ContentItemsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        now = timezone.now()
        rows = list(
            apply_user_scope(Item.objects, user).filter(source_language=source_language, target_language=target_language)
            .order_by("-created_at", "-id")[:200]
        )
        items = [
            {
                "id": item.id,
                "item_type": item.item_type,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "created_at": item.created_at,
                "next_review_days": _next_review_days(item, now),
                "audio_url": item.audio_url,
                "is_learned": item.is_learned,
            }
            for item in rows
        ]
        return Response({"items": items})


class ContentWordsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        query = (request.query_params.get("q", "") or "").strip()

        words_queryset = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        )
        if query:
            words_queryset = words_queryset.filter(Q(spanish_text__icontains=query) | Q(german_text__icontains=query))

        words = list(
            words_queryset.order_by("-created_at", "-id").values(
                "id",
                "item_type",
                "spanish_text",
                "german_text",
                "example_sentence",
                "notes",
                "word_type",
                "audio_url",
                "created_at",
            )[:1000]
        )
        item_ids = [word["id"] for word in words]
        related_dialogs_map = _related_dialogs_by_item_ids(item_ids, user=user)
        for word in words:
            word["related_dialogs"] = related_dialogs_map.get(word["id"], [])
        return Response({"words": words})


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

        related_dialogs_map = _related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
        return Response(
            {
                "id": item.id,
                "item_type": item.item_type,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "example_sentence": item.example_sentence,
                "notes": item.notes,
                "word_type": item.word_type,
                "audio_url": item.audio_url,
                "exercise_phrases": item.exercise_phrases or {},
                "created_at": item.created_at,
                "related_dialogs": related_dialogs_map.get(item.id, []),
                "item_questions": _item_question_history(item),
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

        audio_url = create_audio_file(audio_text, audio_prefix, target_language=target_language)
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


class ContentItemMarkLearnedView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        is_learned_raw = request.data.get("is_learned", True)
        if isinstance(is_learned_raw, str):
            is_learned = is_learned_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            is_learned = bool(is_learned_raw)
        updated = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).update(is_learned=is_learned)
        if updated == 0:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True, "is_learned": is_learned})


def _sanitize_exercise_entries(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    entries: list[dict[str, str]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        source_text = str(entry.get("source_text", "")).strip()
        target_text = str(entry.get("target_text", "")).strip()
        label = str(entry.get("label", "")).strip()
        if not source_text or not target_text:
            continue
        entries.append({"label": label, "source_text": source_text, "target_text": target_text})
        if len(entries) >= MAX_EXERCISE_PHRASES:
            break
    return entries


def _sanitize_exercise_payload(payload) -> dict:
    if not isinstance(payload, dict):
        return {"phrases": []}
    phrases = _sanitize_exercise_entries(payload.get("phrases"))
    if not phrases:
        phrases = [
            *_sanitize_exercise_entries(payload.get("first_section")),
            *_sanitize_exercise_entries(payload.get("second_section")),
        ]
    cleaned = {"phrases": phrases[:MAX_EXERCISE_PHRASES]}
    generation_mode = str(payload.get("generation_mode", "")).strip()
    if generation_mode:
        cleaned["generation_mode"] = generation_mode
    return cleaned


class ContentItemExercisesView(APIView):
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
        if item.item_type != Item.ItemType.WORD:
            return Response({"detail": "Exercises are only available for word items"}, status=status.HTTP_400_BAD_REQUEST)

        generated = generate_word_exercise_phrases_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
        )
        cleaned = _sanitize_exercise_payload(generated)
        if not cleaned["phrases"]:
            return Response({"detail": "Exercise generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.exercise_phrases = cleaned
        item.save(update_fields=["exercise_phrases", "updated_at"])
        return Response({"exercise_phrases": cleaned})
