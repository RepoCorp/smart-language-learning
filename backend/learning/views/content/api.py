from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import get_request_user
from ...serializers import ContentConfirmSerializer, ContentTopicSerializer
from .core import (
    ContentCandidate,
    build_content_plan,
    count_new_items,
    create_dialog_audio_file,
    create_phrase_if_missing,
    create_word_if_missing,
    generate_word_exercise_phrases_with_chatgpt,
    is_candidate_selected,
    is_word_selected,
    save_dialog,
    save_dialog_turns,
    save_phrase_dialog_occurrences,
    save_word_dialog_occurrences,
    save_excluded_words,
    serialize_candidate,
    item_exists,
    word_selection_id,
)
from .topics import save_topic

logger = logging.getLogger(__name__)


class ContentPreviewView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        context = serializer.validated_data.get("context", "").strip()
        source_language = serializer.validated_data.get("source_language", "spanish")
        target_language = serializer.validated_data.get("target_language", "german")
        save_topic(
            user=user,
            topic=topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
        )
        logger.info("content.preview.started topic=%s", topic)
        plan = build_content_plan(
            user=user,
            topic=topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
        )
        logger.info(
            "content.preview.completed topic=%s phrases_total=%d phrases_new=%d words_total=%d words_new=%d",
            topic,
            len(plan.phrases),
            sum(1 for phrase in plan.phrases if not phrase.exists),
            len(plan.words),
            sum(1 for word in plan.words if not word.exists),
        )
        return Response(
            {
                "topic": topic,
                "context": context,
                "source_language": source_language,
                "target_language": target_language,
                "phrases": [serialize_candidate(phrase) for phrase in plan.phrases],
                "words": [serialize_candidate(word) for word in plan.words],
                "new_items_count": count_new_items(plan),
            }
        )


class ContentConfirmView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = ContentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        context = serializer.validated_data.get("context", "").strip()
        source_language = serializer.validated_data.get("source_language", "spanish")
        target_language = serializer.validated_data.get("target_language", "german")
        save_topic(
            user=user,
            topic=topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
        )
        selected_phrases = serializer.validated_data.get("selected_phrases")
        selected_words = serializer.validated_data.get("selected_words", [])
        preview_phrases = serializer.validated_data.get("preview_phrases", [])
        preview_words = serializer.validated_data.get("preview_words", [])
        create_dialog_audio = serializer.validated_data.get("create_dialog_audio", False)
        logger.info(
            "content.confirm.started topic=%s selected_phrases=%s selected_words=%d create_dialog_audio=%s",
            topic,
            "all" if selected_phrases is None else len(selected_phrases),
            len(selected_words),
            create_dialog_audio,
        )
        selected_phrases_normalized = (
            None
            if selected_phrases is None
            else {value.strip().lower() for value in selected_phrases if value.strip()}
        )
        selected_words_normalized = {
            word.strip().lower()
            for word in selected_words
            if word.strip()
        }
        plan = build_content_plan(
            user=user,
            topic=topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
        )
        selected_word_candidates = (
            _selected_preview_word_candidates(
                user=user,
                preview_words=preview_words,
                source_language=source_language,
                target_language=target_language,
            )
            if preview_words
            else plan.words
        )
        words_to_exclude = [
            word
            for word in selected_word_candidates
            if (not word.exists) and (not is_word_selected(word, selected_words_normalized))
        ]
        save_excluded_words(words_to_exclude)

        created_phrases = [
            create_phrase_if_missing(
                user=user,
                candidate=phrase,
                topic=topic,
                source_language=source_language,
                target_language=target_language,
            )
            for phrase in (
                _selected_preview_phrase_candidates(
                    user=user,
                    preview_phrases=preview_phrases,
                    selected_phrases_normalized=selected_phrases_normalized,
                    source_language=source_language,
                    target_language=target_language,
                )
                if selected_phrases_normalized is not None and preview_phrases
                else [
                    phrase
                    for phrase in plan.phrases
                    if selected_phrases_normalized is None or is_candidate_selected(phrase, selected_phrases_normalized)
                ]
            )
        ]
        created_phrase_items = [phrase for phrase in created_phrases if phrase is not None]
        created_words = []
        for word in selected_word_candidates:
            if not is_word_selected(word, selected_words_normalized):
                continue
            exercise_phrases = generate_word_exercise_phrases_with_chatgpt(
                word.spanish_text,
                word.german_text,
                notes=word.notes,
                source_language=source_language,
                target_language=target_language,
            )
            created_words.append(
                create_word_if_missing(
                    user=user,
                    candidate=word,
                    topic=topic,
                    source_language=source_language,
                    target_language=target_language,
                    exercise_phrases=exercise_phrases,
                )
            )
        created_word_items = [word for word in created_words if word is not None]
        dialog_turns = _dialog_turns_for_save(preview_phrases=preview_phrases, fallback_phrases=plan.phrases)
        dialog_audio_url = ""
        if create_dialog_audio:
            dialog_lines = [turn["target_text"] for turn in dialog_turns if turn.get("target_text", "").strip()]
            dialog_audio_url = create_dialog_audio_file(dialog_lines, target_language=target_language)
        saved_dialog = save_dialog(
            user=user,
            topic=topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
            turns=dialog_turns,
            audio_url=dialog_audio_url,
        )
        created_turns = save_dialog_turns(saved_dialog, dialog_turns)
        phrase_occurrences = save_phrase_dialog_occurrences(
            user=user,
            dialog=saved_dialog,
            turns=created_turns,
            source_language=source_language,
            target_language=target_language,
        )
        word_occurrences = save_word_dialog_occurrences(
            user=user,
            dialog=saved_dialog,
            turns=created_turns,
            word_candidates=selected_word_candidates,
            source_language=source_language,
            target_language=target_language,
        )
        logger.info(
            "content.confirm.completed topic=%s created_phrases=%d created_words=%d excluded_words=%d dialog_id=%s turns=%d phrase_occ=%d word_occ=%d dialog_audio=%s",
            topic,
            len(created_phrase_items),
            len(created_word_items),
            len(words_to_exclude),
            saved_dialog.id,
            len(created_turns),
            phrase_occurrences,
            word_occurrences,
            bool(dialog_audio_url),
        )

        return Response(
            {
                "topic": topic,
                "source_language": source_language,
                "target_language": target_language,
                "created_phrase": bool(created_phrase_items),
                "created_phrases_count": len(created_phrase_items),
                "created_words_count": len(created_word_items),
                "created_words": [item.spanish_text for item in created_word_items],
                "saved_dialog_id": saved_dialog.id,
                "saved_dialog_turns": dialog_turns,
                "dialog_audio_url": dialog_audio_url,
            }
        )


def _selected_preview_phrase_candidates(
    *,
    user,
    preview_phrases: list[dict],
    selected_phrases_normalized: set[str] | None,
    source_language: str,
    target_language: str,
) -> list[ContentCandidate]:
    if selected_phrases_normalized is None:
        return []

    candidates: list[ContentCandidate] = []
    seen_keys: set[str] = set()
    for phrase in preview_phrases:
        if not isinstance(phrase, dict):
            continue
        spanish_text = str(phrase.get("spanish_text", "")).strip()
        german_text = str(phrase.get("german_text", "")).strip()
        notes = str(phrase.get("notes", "")).strip()
        if not spanish_text or not german_text:
            continue
        candidate = ContentCandidate(
            spanish_text=spanish_text,
            german_text=german_text,
            exists=item_exists(
                user=user,
                item_type="phrase",
                spanish_text=spanish_text,
                german_text=german_text,
                source_language=source_language,
                target_language=target_language,
            ),
            notes=notes,
        )
        selection_key = word_selection_id(candidate)
        if selection_key in seen_keys:
            continue
        if not is_candidate_selected(candidate, selected_phrases_normalized):
            continue
        seen_keys.add(selection_key)
        candidates.append(candidate)
    return candidates


def _selected_preview_word_candidates(
    *,
    user,
    preview_words: list[dict],
    source_language: str,
    target_language: str,
) -> list[ContentCandidate]:
    candidates: list[ContentCandidate] = []
    seen_keys: set[str] = set()
    for word in preview_words:
        if not isinstance(word, dict):
            continue
        spanish_text = str(word.get("spanish_text", "")).strip()
        german_text = str(word.get("german_text", "")).strip()
        notes = str(word.get("notes", "")).strip()
        if not spanish_text or not german_text:
            continue
        candidate = ContentCandidate(
            spanish_text=spanish_text,
            german_text=german_text,
            exists=item_exists(
                user=user,
                item_type="word",
                spanish_text=spanish_text,
                german_text=german_text,
                source_language=source_language,
                target_language=target_language,
            ),
            notes=notes,
        )
        selection_key = word_selection_id(candidate)
        if selection_key in seen_keys:
            continue
        seen_keys.add(selection_key)
        candidates.append(candidate)
    return candidates


def _dialog_turns_for_save(*, preview_phrases: list[dict], fallback_phrases: list[ContentCandidate]) -> list[dict[str, str]]:
    if preview_phrases:
        turns: list[dict[str, str]] = []
        for phrase in preview_phrases:
            if not isinstance(phrase, dict):
                continue
            source_text = str(phrase.get("spanish_text", "")).strip()
            target_text = str(phrase.get("german_text", "")).strip()
            if not source_text and not target_text:
                continue
            turns.append({"source_text": source_text, "target_text": target_text})
        return turns
    return [
        {"source_text": phrase.spanish_text.strip(), "target_text": phrase.german_text.strip()}
        for phrase in fallback_phrases
        if phrase.spanish_text.strip() or phrase.german_text.strip()
    ]
