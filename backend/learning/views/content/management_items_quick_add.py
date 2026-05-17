from __future__ import annotations

from .management import (
    APIView,
    ContentCandidate,
    Item,
    Request,
    Response,
    _link_word_to_dialog_turn,
    _normalized_pair,
    _normalize_word_metadata,
    normalize_word_pair_for_item_save,
    _resolve_dialog_click_word_pair,
    apply_user_scope,
    create_phrase_if_missing,
    create_word_if_missing,
    get_request_user,
    item_exists,
    normalize_word_type,
    status,
)


def _without_first_word(value: str) -> str:
    parts = value.split(maxsplit=1)
    return parts[1].strip() if len(parts) == 2 else ""


def _text_matches_with_missing_initial_word(existing_text: str, normalized_text: str) -> bool:
    existing = " ".join((existing_text or "").split()).strip()
    normalized = " ".join((normalized_text or "").split()).strip()
    if existing.lower() == normalized.lower():
        return True
    normalized_without_first = _without_first_word(normalized)
    return bool(normalized_without_first and existing.lower() == normalized_without_first.lower())


def _find_existing_word_item(
    *,
    user,
    source_language: str,
    target_language: str,
    source_text: str,
    target_text: str,
    word_type: str,
) -> Item | None:
    normalized_word_type = normalize_word_type(word_type)
    existing = (
        apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
            spanish_text__iexact=source_text,
            german_text__iexact=target_text,
            word_type=normalized_word_type,
        )
        .order_by("-id")
        .first()
    )
    if existing:
        return existing

    existing = (
        apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
            spanish_text__iexact=source_text,
            german_text__iexact=target_text,
            word_type="",
        )
        .order_by("-id")
        .first()
    )
    if existing:
        existing.word_type = normalized_word_type
        existing.save(update_fields=["word_type", "updated_at"])
        return existing

    if normalized_word_type != "noun":
        return None

    matching_nouns = [
        item
        for item in apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
            word_type__in=[normalized_word_type, ""],
        )
        if _text_matches_with_missing_initial_word(item.spanish_text, source_text)
        and _text_matches_with_missing_initial_word(item.german_text, target_text)
    ]
    if len(matching_nouns) != 1:
        return None

    existing = matching_nouns[0]
    update_fields = []
    if existing.spanish_text != source_text:
        existing.spanish_text = source_text
        update_fields.append("spanish_text")
    if existing.german_text != target_text:
        existing.german_text = target_text
        update_fields.append("german_text")
    if existing.word_type != normalized_word_type:
        existing.word_type = normalized_word_type
        update_fields.append("word_type")
    if update_fields:
        update_fields.append("updated_at")
        existing.save(update_fields=update_fields)
    return existing


class ContentWordQuickAddView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        source_text = str(request.data.get("source_text", "")).strip()
        target_text = str(request.data.get("target_text", "")).strip()
        source_line = str(request.data.get("source_line", "")).strip()
        target_line = str(request.data.get("target_line", "")).strip()
        clicked_target_token = str(request.data.get("clicked_target_token", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        dialog_id_raw = request.data.get("dialog_id")
        turn_index_raw = request.data.get("turn_index")
        check_only_raw = request.data.get("check_only", False)
        if isinstance(check_only_raw, str):
            check_only = check_only_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            check_only = bool(check_only_raw)

        if not source_text or not target_text:
            return Response({"detail": "source_text and target_text are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            source_text, target_text, word_type = _resolve_dialog_click_word_pair(
                user=user,
                source_text=source_text,
                target_text=target_text,
                source_language=source_language,
                target_language=target_language,
                dialog_id_raw=dialog_id_raw,
                turn_index_raw=turn_index_raw,
                source_line=source_line,
                target_line=target_line,
                clicked_target_token=clicked_target_token,
            )
            source_text, target_text, word_type = _normalize_word_metadata(
                source_text=source_text,
                target_text=target_text,
                word_type=word_type,
                source_language=source_language,
                target_language=target_language,
                source_line=source_line,
                target_line=target_line,
            )
        except RuntimeError:
            return Response({"detail": "Word metadata generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        source_text, target_text = normalize_word_pair_for_item_save(
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )

        existing = _find_existing_word_item(
            user=user,
            source_language=source_language,
            target_language=target_language,
            source_text=source_text,
            target_text=target_text,
            word_type=word_type,
        )
        if existing:
            response_word_type = existing.word_type if existing.word_type else word_type
            if existing:
                _link_word_to_dialog_turn(
                    user=user,
                    item=existing,
                    dialog_id_raw=dialog_id_raw,
                    turn_index_raw=turn_index_raw,
                )
            if check_only:
                return Response(
                    {
                        "created": False,
                        "exists": True,
                        "id": existing.id if existing else None,
                        "source_text": source_text,
                        "target_text": target_text,
                        "word_type": response_word_type,
                    }
                )
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "id": existing.id,
                    "source_text": source_text,
                    "target_text": target_text,
                    "word_type": response_word_type,
                }
            )

        if check_only:
            return Response(
                {
                    "created": False,
                    "exists": False,
                    "id": None,
                    "source_text": source_text,
                    "target_text": target_text,
                    "word_type": word_type,
                }
            )

        candidate = ContentCandidate(
            spanish_text=source_text,
            german_text=target_text,
            exists=False,
            notes=notes,
            word_type=word_type,
        )
        created = create_word_if_missing(
            user=user,
            candidate=candidate,
            topic="dialog-click",
            source_language=source_language,
            target_language=target_language,
        )
        if created is None:
            existing = _find_existing_word_item(
                user=user,
                source_language=source_language,
                target_language=target_language,
                source_text=source_text,
                target_text=target_text,
                word_type=word_type,
            )
            if existing:
                _link_word_to_dialog_turn(
                    user=user,
                    item=existing,
                    dialog_id_raw=dialog_id_raw,
                    turn_index_raw=turn_index_raw,
                )
            else:
                return Response({"detail": "Existing word lookup failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "id": existing.id,
                    "source_text": source_text,
                    "target_text": target_text,
                    "word_type": existing.word_type,
                }
            )

        _link_word_to_dialog_turn(
            user=user,
            item=created,
            dialog_id_raw=dialog_id_raw,
            turn_index_raw=turn_index_raw,
        )
        return Response(
            {
                "created": True,
                "exists": False,
                "id": created.id,
                "source_text": created.spanish_text,
                "target_text": created.german_text,
                "word_type": created.word_type,
                "audio_url": created.audio_url,
            },
            status=status.HTTP_201_CREATED,
        )


class ContentPhraseQuickAddView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        source_text = str(request.data.get("source_text", "")).strip()
        target_text = str(request.data.get("target_text", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        check_only_raw = request.data.get("check_only", False)
        if isinstance(check_only_raw, str):
            check_only = check_only_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            check_only = bool(check_only_raw)

        if not source_text or not target_text:
            return Response({"detail": "source_text and target_text are required"}, status=status.HTTP_400_BAD_REQUEST)

        exists = item_exists(
            user=user,
            item_type=Item.ItemType.PHRASE,
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )
        if exists:
            existing = (
                apply_user_scope(Item.objects, user).filter(
                    item_type=Item.ItemType.PHRASE,
                    source_language=source_language,
                    target_language=target_language,
                    spanish_text__iexact=source_text,
                    german_text__iexact=target_text,
                )
                .order_by("-id")
                .first()
            )
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "id": existing.id if existing else None,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        if check_only:
            return Response(
                {
                    "created": False,
                    "exists": False,
                    "id": None,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        candidate = ContentCandidate(
            spanish_text=source_text,
            german_text=target_text,
            exists=False,
            notes=notes,
        )
        created = create_phrase_if_missing(
            user=user,
            candidate=candidate,
            topic="conversation-click",
            source_language=source_language,
            target_language=target_language,
        )
        if created is None:
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )
        return Response(
            {
                "created": True,
                "exists": False,
                "id": created.id,
                "source_text": created.spanish_text,
                "target_text": created.german_text,
                "audio_url": created.audio_url,
            },
            status=status.HTTP_201_CREATED,
        )
