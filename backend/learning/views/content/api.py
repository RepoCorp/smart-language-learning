from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import get_request_user
from ...serializers import ContentConfirmSerializer, ContentTopicSerializer
from .core import (
    ContentCandidate,
    create_dialog_audio_file,
    create_phrase_if_missing,
    generate_conversation_with_chatgpt,
    save_dialog,
    save_phrase_dialog_occurrences,
    save_dialog_turns,
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
        conversation_details = serializer.validated_data.get("conversation_details", "").strip()
        dialog_length = serializer.validated_data.get("dialog_length", "standard")
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
        generation_kwargs = {
            "topic": topic,
            "context": context,
            "conversation_details": conversation_details,
            "source_language": source_language,
            "target_language": target_language,
        }
        if dialog_length == "short_three":
            generation_kwargs["dialog_length"] = dialog_length
        generated_conversation = generate_conversation_with_chatgpt(**generation_kwargs)
        if not generated_conversation:
            return Response({"detail": "Could not generate dialog preview"}, status=503)
        dialog_turns = [
            {
                "source_text": str(turn.get("spanish_text", "")).strip(),
                "target_text": str(turn.get("german_text", "")).strip(),
                "speaker": _normalize_speaker(turn.get("speaker", ""), index),
            }
            for index, turn in enumerate(generated_conversation)
            if str(turn.get("spanish_text", "")).strip() or str(turn.get("german_text", "")).strip()
        ]
        logger.info(
            "content.preview.completed topic=%s turns=%d",
            topic,
            len(dialog_turns),
        )
        return Response(
            {
                "topic": topic,
                "context": context,
                "source_language": source_language,
                "target_language": target_language,
                "dialog_turns": dialog_turns,
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
        dialog_turns_raw = serializer.validated_data.get("dialog_turns", [])
        selected_turn_indexes_raw = serializer.validated_data.get("selected_turn_indexes")
        create_dialog_audio = serializer.validated_data.get("create_dialog_audio", False)
        dialog_turns = _dialog_turns_for_save(dialog_turns_raw)
        if not dialog_turns:
            return Response({"detail": "dialog_turns are required"}, status=400)
        all_turn_indexes = set(range(len(dialog_turns)))
        selected_turn_indexes = (
            all_turn_indexes
            if selected_turn_indexes_raw is None
            else {index for index in selected_turn_indexes_raw if index in all_turn_indexes}
        )
        selected_turns = [
            turn for index, turn in enumerate(dialog_turns) if index in selected_turn_indexes
        ]
        logger.info(
            "content.confirm.started topic=%s turns=%d selected_turns=%d create_dialog_audio=%s",
            topic,
            len(dialog_turns),
            len(selected_turns),
            create_dialog_audio,
        )
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
        created_sentence_count = 0
        existing_sentence_count = 0
        for turn in selected_turns:
            source_text = turn.get("source_text", "").strip()
            target_text = turn.get("target_text", "").strip()
            if not source_text or not target_text:
                continue
            created_phrase = create_phrase_if_missing(
                user=user,
                candidate=ContentCandidate(
                    spanish_text=source_text,
                    german_text=target_text,
                    exists=False,
                    notes="",
                ),
                topic=topic,
                source_language=source_language,
                target_language=target_language,
            )
            if created_phrase is None:
                existing_sentence_count += 1
            else:
                created_sentence_count += 1

        phrase_occurrences = save_phrase_dialog_occurrences(
            user=user,
            dialog=saved_dialog,
            turns=[turn for turn in created_turns if turn.turn_index in selected_turn_indexes],
            source_language=source_language,
            target_language=target_language,
        )
        logger.info(
            "content.confirm.completed topic=%s dialog_id=%s turns=%d dialog_audio=%s sentences_created=%d sentences_existing=%d phrase_occurrences=%d",
            topic,
            saved_dialog.id,
            len(created_turns),
            bool(dialog_audio_url),
            created_sentence_count,
            existing_sentence_count,
            phrase_occurrences,
        )

        return Response(
            {
                "topic": topic,
                "source_language": source_language,
                "target_language": target_language,
                "saved_dialog_id": saved_dialog.id,
                "saved_dialog_turns": dialog_turns,
                "dialog_audio_url": dialog_audio_url,
                "created_sentence_count": created_sentence_count,
                "existing_sentence_count": existing_sentence_count,
            }
        )


def _dialog_turns_for_save(dialog_turns_raw: list[dict]) -> list[dict[str, str]]:
    turns: list[dict[str, str]] = []
    for index, turn in enumerate(dialog_turns_raw):
        if not isinstance(turn, dict):
            continue
        source_text = str(turn.get("source_text", "")).strip()
        target_text = str(turn.get("target_text", "")).strip()
        if not source_text and not target_text:
            continue
        turns.append(
            {
                "source_text": source_text,
                "target_text": target_text,
                "speaker": _normalize_speaker(turn.get("speaker", ""), index),
            }
        )
    return turns


def _normalize_speaker(value, index: int) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return "a" if index % 2 == 0 else "b"
