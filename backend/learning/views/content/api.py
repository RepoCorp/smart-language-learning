from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...serializers import ContentConfirmSerializer, ContentTopicSerializer
from .core import (
    build_content_plan,
    count_new_items,
    create_phrase_if_missing,
    create_word_if_missing,
    is_candidate_selected,
    is_word_selected,
    save_excluded_words,
    serialize_candidate,
)
from .topics import save_topic

logger = logging.getLogger(__name__)


class ContentPreviewView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        context = serializer.validated_data.get("context", "").strip()
        save_topic(topic, context)
        logger.info("content.preview.started topic=%s", topic)
        plan = build_content_plan(topic, context=context)
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
                "phrases": [serialize_candidate(phrase) for phrase in plan.phrases],
                "words": [serialize_candidate(word) for word in plan.words],
                "new_items_count": count_new_items(plan),
            }
        )


class ContentConfirmView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        context = serializer.validated_data.get("context", "").strip()
        save_topic(topic, context)
        selected_phrases = serializer.validated_data.get("selected_phrases")
        selected_words = serializer.validated_data.get("selected_words", [])
        logger.info(
            "content.confirm.started topic=%s selected_phrases=%s selected_words=%d",
            topic,
            "all" if selected_phrases is None else len(selected_phrases),
            len(selected_words),
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
        plan = build_content_plan(topic, context=context)
        words_to_exclude = [
            word
            for word in plan.words
            if (not word.exists) and (not is_word_selected(word, selected_words_normalized))
        ]
        save_excluded_words(words_to_exclude)

        created_phrases = [
            create_phrase_if_missing(phrase, topic)
            for phrase in plan.phrases
            if selected_phrases_normalized is None or is_candidate_selected(phrase, selected_phrases_normalized)
        ]
        created_phrase_items = [phrase for phrase in created_phrases if phrase is not None]
        created_words = [
            create_word_if_missing(word, topic)
            for word in plan.words
            if is_word_selected(word, selected_words_normalized)
        ]
        created_word_items = [word for word in created_words if word is not None]
        logger.info(
            "content.confirm.completed topic=%s created_phrases=%d created_words=%d excluded_words=%d",
            topic,
            len(created_phrase_items),
            len(created_word_items),
            len(words_to_exclude),
        )

        return Response(
            {
                "topic": topic,
                "created_phrase": bool(created_phrase_items),
                "created_phrases_count": len(created_phrase_items),
                "created_words_count": len(created_word_items),
                "created_words": [item.spanish_text for item in created_word_items],
            }
        )
