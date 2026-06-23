from __future__ import annotations

from .management import (
    APIView,
    ContentCandidate,
    Item,
    Request,
    Response,
    _call_openai_json_logged,
    _ensure_audio_for_dialog_turn,
    _language_display_name,
    _link_phrase_to_dialog_turn,
    _link_word_to_dialog_turn,
    _normalized_pair,
    _normalize_word_metadata,
    normalize_word_pair_for_item_save,
    _resolve_dialog_click_word_pair,
    apply_user_scope,
    create_phrase_if_missing,
    create_word_if_missing,
    DialogTurn,
    get_request_user,
    item_exists,
    normalize_word_type,
    status,
    SavedDialog,
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


def _unpack_word_resolution(value) -> tuple[str, str, str, str]:
    source_text, target_text, word_type, *rest = value
    note = str(rest[0] if rest else "").strip()
    return source_text, target_text, word_type, note


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


def _normalized_dialog_text(value: str) -> str:
    return " ".join((value or "").split()).strip().casefold()


def _whole_turn_audio_url_for_phrase(
    *,
    user,
    source_text: str,
    target_text: str,
    dialog_id_raw,
    turn_index_raw,
) -> str:
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        return ""

    dialog = apply_user_scope(SavedDialog.objects, user).filter(id=dialog_id).first()
    if not dialog:
        return ""
    turn = DialogTurn.objects.filter(dialog=dialog, turn_index=turn_index).first()
    if not turn:
        return ""
    if _normalized_dialog_text(turn.source_text) != _normalized_dialog_text(source_text):
        return ""
    if _normalized_dialog_text(turn.target_text) != _normalized_dialog_text(target_text):
        return ""
    return turn.audio_url or _ensure_audio_for_dialog_turn(
        user=user,
        dialog_id_raw=dialog_id,
        turn_index_raw=turn_index,
    )


def _phrase_quick_add_response(
    *,
    user,
    source_language: str,
    target_language: str,
    source_text: str,
    target_text: str,
    notes: str,
    word_type: str = "",
    dialog_id_raw,
    turn_index_raw,
    check_only: bool,
) -> Response:
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
        if existing:
            _link_phrase_to_dialog_turn(
                user=user,
                item=existing,
                dialog_id_raw=dialog_id_raw,
                turn_index_raw=turn_index_raw,
            )
        return Response(
            {
                "created": False,
                "exists": True,
                "id": existing.id if existing else None,
                "source_text": source_text,
                "target_text": target_text,
                "word_type": word_type,
                "notes": existing.notes or notes,
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
                "notes": notes,
            }
        )

    candidate = ContentCandidate(
        spanish_text=source_text,
        german_text=target_text,
        exists=False,
        notes=notes,
    )
    audio_url_override = _whole_turn_audio_url_for_phrase(
        user=user,
        source_text=source_text,
        target_text=target_text,
        dialog_id_raw=dialog_id_raw,
        turn_index_raw=turn_index_raw,
    )
    created = create_phrase_if_missing(
        user=user,
        candidate=candidate,
        topic="conversation-click",
        source_language=source_language,
        target_language=target_language,
        audio_url_override=audio_url_override,
    )
    if created is None:
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
        if existing:
            _link_phrase_to_dialog_turn(
                user=user,
                item=existing,
                dialog_id_raw=dialog_id_raw,
                turn_index_raw=turn_index_raw,
            )
        return Response(
            {
                "created": False,
                    "exists": True,
                    "id": existing.id if existing else None,
                    "source_text": source_text,
                    "target_text": target_text,
                    "word_type": word_type,
                    "notes": existing.notes or notes,
                }
            )

    _link_phrase_to_dialog_turn(
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
            "word_type": word_type,
            "notes": created.notes,
            "audio_url": created.audio_url,
        },
        status=status.HTTP_201_CREATED,
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

        try:
            source_text, target_text, word_type, model_note = _unpack_word_resolution(
                _resolve_dialog_click_word_pair(
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
        except (RuntimeError, TypeError, ValueError):
            return Response({"detail": "Word metadata generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        final_notes = model_note or notes
        if word_type == "expression":
            try:
                source_text, target_text = _resolve_dialog_phrase_selection(
                    selected_target_text=target_text,
                    source_line=source_line,
                    target_line=target_line,
                    source_language=source_language,
                    target_language=target_language,
                )
            except ValueError:
                return Response({"detail": "Selected words do not form a complete expression."}, status=status.HTTP_400_BAD_REQUEST)
            except RuntimeError:
                return Response({"detail": "Phrase translation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return _phrase_quick_add_response(
                user=user,
                source_language=source_language,
                target_language=target_language,
                source_text=source_text,
                target_text=target_text,
                notes=final_notes,
                word_type=word_type,
                dialog_id_raw=dialog_id_raw,
                turn_index_raw=turn_index_raw,
                check_only=check_only,
            )
        source_text, target_text = normalize_word_pair_for_item_save(
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )
        if word_type == "helper":
            helper_note = _helper_note(source_text=source_text)
            final_notes = f"{final_notes} {helper_note}".strip() if final_notes else helper_note

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
                        "notes": existing.notes or final_notes,
                    }
                )
            _ensure_audio_for_dialog_turn(
                user=user,
                dialog_id_raw=dialog_id_raw,
                turn_index_raw=turn_index_raw,
            )
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "id": existing.id,
                    "source_text": source_text,
                    "target_text": target_text,
                    "word_type": response_word_type,
                    "notes": existing.notes or final_notes,
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
                    "notes": final_notes,
                }
            )

        candidate = ContentCandidate(
            spanish_text=source_text,
            german_text=target_text,
            exists=False,
            notes=final_notes,
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
                _ensure_audio_for_dialog_turn(
                    user=user,
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
                    "notes": existing.notes or final_notes,
                }
            )

        _link_word_to_dialog_turn(
            user=user,
            item=created,
            dialog_id_raw=dialog_id_raw,
            turn_index_raw=turn_index_raw,
        )
        _ensure_audio_for_dialog_turn(
            user=user,
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
                "notes": created.notes,
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
        source_line = str(request.data.get("source_line", "")).strip()
        target_line = str(request.data.get("target_line", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        dialog_id_raw = request.data.get("dialog_id")
        turn_index_raw = request.data.get("turn_index")
        check_only_raw = request.data.get("check_only", False)
        if isinstance(check_only_raw, str):
            check_only = check_only_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            check_only = bool(check_only_raw)

        if not target_text:
            return Response({"detail": "target_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not source_text:
            try:
                source_text, target_text = _resolve_dialog_phrase_selection(
                    selected_target_text=target_text,
                    source_line=source_line,
                    target_line=target_line,
                    source_language=source_language,
                    target_language=target_language,
                )
            except ValueError:
                return Response({"detail": "Selected words do not form a complete expression."}, status=status.HTTP_400_BAD_REQUEST)
            except RuntimeError:
                return Response({"detail": "Phrase translation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not source_text:
            return Response({"detail": "source_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        return _phrase_quick_add_response(
            user=user,
            source_language=source_language,
            target_language=target_language,
            source_text=source_text,
            target_text=target_text,
            notes=notes,
            dialog_id_raw=dialog_id_raw,
            turn_index_raw=turn_index_raw,
            check_only=check_only,
        )


def _resolve_dialog_phrase_selection(
    *,
    selected_target_text: str,
    source_line: str,
    target_line: str,
    source_language: str,
    target_language: str,
) -> tuple[str, str]:
    selected = " ".join(selected_target_text.split()).strip()
    if not selected:
        raise RuntimeError("Phrase translation failed")
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    validated_target = _validate_dialog_phrase_selection(
        selected_target_text=selected,
        target_name=target_name,
    )
    translated_source = _translate_valid_dialog_phrase_selection(
        selected_target_text=validated_target,
        source_line=source_line,
        target_line=target_line,
        source_name=source_name,
        target_name=target_name,
    )
    return translated_source, validated_target


def _validate_dialog_phrase_selection(
    *,
    selected_target_text: str,
    target_name: str,
) -> str:
    parsed = _call_openai_json_logged(
        label="dialog_phrase_selection_validation",
        system_prompt=f"""
Validate a selected {target_name} expression from a saved dialog.

Return strict JSON:
{{
  "is_valid": true,
  "target_text": "string",
  "reason": "string"
}}

Rules:
- The selected text must make sense on its own as a useful expression, collocation, or sub-sentence.
- Allow only tiny cleanup within the selected words: punctuation, capitalization, spacing, or natural inflection.
- Do not infer missing words or unstated context.
- Do not complete the meaning using words that were not selected.
- If the selection needs surrounding words to be grammatically or semantically clear, set is_valid=false.
- target_text must be empty when is_valid=false.
- JSON only.
""".strip(),
        user_input=(
            f"Selected target text: {selected_target_text}\n"
        ),
        timeout_seconds=8,
        temperature=0.0,
        top_p=1.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Phrase validation failed")
    if not bool(parsed.get("is_valid")):
        reason = str(parsed.get("reason", "")).strip()
        raise ValueError(reason or "It needs surrounding words to make sense or translate correctly.")
    target_text = str(parsed.get("target_text", "")).strip()
    if not target_text:
        raise RuntimeError("Phrase validation failed")
    return target_text[:255]


def _translate_valid_dialog_phrase_selection(
    *,
    selected_target_text: str,
    source_line: str,
    target_line: str,
    source_name: str,
    target_name: str,
) -> str:
    parsed = _call_openai_json_logged(
        label="dialog_phrase_selection_translation",
        system_prompt=f"""
Translate a selected target-language phrase from a saved dialog.

Return strict JSON:
{{
  "can_translate_without_non_selected_words": true,
  "source_text": "string"
}}

Rules:
- The selected text is in {target_name}; source_text must be its natural {source_name} translation.
- Translate only the selected text, not the whole sentence.
- Use the source and target sentence context only to resolve meaning.
- Do not complete the expression with non-selected words from context.
- If a faithful translation would require non-selected words, set can_translate_without_non_selected_words=false and return an empty source_text.
- If source_text includes meaning from words outside the selected target text, set can_translate_without_non_selected_words=false and return an empty source_text.
- Keep source_text concise and suitable as a phrase study item.
- Do not return markdown, quotes, explanations, or extra fields.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Selected target text: {selected_target_text}\n"
            f"Source sentence context: {source_line or 'not provided'}\n"
            f"Target sentence context: {target_line or 'not provided'}\n"
        ),
        timeout_seconds=8,
        temperature=0.0,
        top_p=1.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Phrase translation failed")
    if not bool(parsed.get("can_translate_without_non_selected_words", True)):
        raise ValueError("Phrase translation needs surrounding words")
    source_text = str(parsed.get("source_text", "")).strip()
    if not source_text:
        raise RuntimeError("Phrase translation failed")
    return source_text[:255]
