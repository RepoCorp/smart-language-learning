from __future__ import annotations

from .management import (
    APIView,
    ContentCandidate,
    Item,
    Request,
    Response,
    _link_word_to_dialog_turn,
    _normalized_pair,
    normalize_word_pair_for_item_save,
    _resolve_dialog_click_word_pair,
    apply_user_scope,
    create_phrase_if_missing,
    create_word_if_missing,
    get_request_user,
    item_exists,
    status,
)


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

        source_text, target_text = _resolve_dialog_click_word_pair(
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
        source_text, target_text = normalize_word_pair_for_item_save(
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )

        exists = item_exists(
            user=user,
            item_type="word",
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )
        if exists:
            existing = (
                apply_user_scope(Item.objects, user).filter(
                    item_type=Item.ItemType.WORD,
                    source_language=source_language,
                    target_language=target_language,
                    spanish_text__iexact=source_text,
                    german_text__iexact=target_text,
                )
                .order_by("-id")
                .first()
            )
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
                    }
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
        created = create_word_if_missing(
            user=user,
            candidate=candidate,
            topic="dialog-click",
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
