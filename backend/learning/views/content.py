from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import ExcludedWordSuggestion, Item
from ..prompts import CONTENT_GENERATION_PROMPT
from ..serializers import ContentConfirmSerializer, ContentTopicSerializer


class ContentPreviewView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        plan = build_content_plan(topic)
        return Response(
            {
                "topic": topic,
                "phrase": serialize_candidate(plan.phrase),
                "words": [serialize_candidate(word) for word in plan.words],
                "new_items_count": count_new_items(plan),
            }
        )


class ContentConfirmView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        selected_words = serializer.validated_data.get("selected_words", [])
        selected_words_normalized = {
            normalize_word_key(word)
            for word in selected_words
            if normalize_word_key(word)
        }
        plan = build_content_plan(topic)
        save_excluded_words(
            [
                word
                for word in plan.words
                if (not word.exists) and (normalize_word_key(word.spanish_text) not in selected_words_normalized)
            ]
        )

        created_phrase = create_phrase_if_missing(plan.phrase, topic)
        created_words = [
            create_word_if_missing(word, plan.phrase.spanish_text, topic)
            for word in plan.words
            if normalize_word_key(word.spanish_text) in selected_words_normalized
        ]
        created_word_items = [word for word in created_words if word is not None]

        return Response(
            {
                "topic": topic,
                "created_phrase": created_phrase is not None,
                "created_words_count": len(created_word_items),
                "created_words": [item.spanish_text for item in created_word_items],
            }
        )


@dataclass(frozen=True)
class ContentCandidate:
    spanish_text: str
    german_text: str
    exists: bool


@dataclass(frozen=True)
class ContentPlan:
    phrase: ContentCandidate
    words: list[ContentCandidate]


def build_content_plan(topic: str) -> ContentPlan:
    normalized_topic = normalize_topic(topic)
    generated = generate_content_with_chatgpt(normalized_topic)
    if generated is None:
        phrase_es = f"Hoy estudio {normalized_topic}."
        phrase_de = f"Heute lerne ich {normalized_topic}."
        generated_words: list[dict[str, str]] = []
    else:
        phrase_es, phrase_de, generated_words = generated

    phrase_exists = item_exists(Item.ItemType.PHRASE, phrase_es, phrase_de)
    phrase_candidate = ContentCandidate(spanish_text=phrase_es, german_text=phrase_de, exists=phrase_exists)

    words: list[ContentCandidate] = []
    seen: set[tuple[str, str]] = set()
    excluded_words = get_excluded_words_lookup()
    for keyword in generated_words:
        spanish_word = keyword["spanish_text"].strip()
        german_word = keyword["german_text"].strip()
        if not spanish_word or not german_word:
            continue
        key = normalize_word_pair(spanish_word, german_word)
        if key in excluded_words:
            continue
        if key in seen:
            continue
        seen.add(key)
        exists = item_exists(Item.ItemType.WORD, spanish_word, german_word)
        words.append(
            ContentCandidate(
                spanish_text=spanish_word,
                german_text=german_word,
                exists=exists,
            )
        )

    return ContentPlan(phrase=phrase_candidate, words=words)


def normalize_topic(topic: str) -> str:
    cleaned = " ".join(topic.split()).strip()
    if not cleaned:
        return "un tema"
    return cleaned


def normalize_word_key(word: str) -> str:
    return " ".join(word.split()).strip().lower()


def normalize_word_pair(spanish_word: str, german_word: str) -> tuple[str, str]:
    return normalize_word_key(spanish_word), normalize_word_key(german_word)


def get_excluded_words_lookup() -> set[tuple[str, str]]:
    return {
        normalize_word_pair(spanish_word, german_word)
        for spanish_word, german_word in ExcludedWordSuggestion.objects.values_list(
            "spanish_text",
            "german_text",
        )
    }


def save_excluded_words(words: list[ContentCandidate]) -> None:
    for word in words:
        normalized_spanish, normalized_german = normalize_word_pair(word.spanish_text, word.german_text)
        if not normalized_spanish or not normalized_german:
            continue
        ExcludedWordSuggestion.objects.get_or_create(
            spanish_text=normalized_spanish,
            german_text=normalized_german,
        )


def generate_content_with_chatgpt(topic: str) -> tuple[str, str, list[dict[str, str]]] | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return None

    user_input = f"Topic: {topic}"
    body = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": CONTENT_GENERATION_PROMPT},
            {"role": "user", "content": user_input},
        ],
        "temperature": 0.2,
    }

    request = UrlRequest(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None

    try:
        content = payload["choices"][0]["message"]["content"]
        parsed = extract_json_from_text(content)
        spanish_text = str(parsed.get("spanish_text", "")).strip()
        german_text = str(parsed.get("german_text", "")).strip()
        keywords = parsed.get("keywords", [])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None

    if not spanish_text or not german_text or not isinstance(keywords, list):
        return None

    cleaned_keywords: list[dict[str, str]] = []
    for keyword in keywords:
        if not isinstance(keyword, dict):
            continue
        spanish_word = str(keyword.get("spanish_text", "")).strip()
        german_word = str(keyword.get("german_text", "")).strip()
        if not spanish_word or not german_word:
            continue
        cleaned_keywords.append({"spanish_text": spanish_word, "german_text": german_word})

    return spanish_text, german_text, cleaned_keywords


def extract_json_from_text(content: str) -> dict:
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return json.loads(stripped)

    match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
    if not match:
        raise json.JSONDecodeError("No JSON object found", content, 0)
    return json.loads(match.group(0))


def serialize_candidate(candidate: ContentCandidate) -> dict:
    return {
        "spanish_text": candidate.spanish_text,
        "german_text": candidate.german_text,
        "exists": candidate.exists,
    }


def count_new_items(plan: ContentPlan) -> int:
    count = 0
    if not plan.phrase.exists:
        count += 1
    count += sum(1 for word in plan.words if not word.exists)
    return count


def create_phrase_if_missing(candidate: ContentCandidate, topic: str) -> Item | None:
    if item_exists(Item.ItemType.PHRASE, candidate.spanish_text, candidate.german_text):
        return None
    return Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        notes=f"Auto-created from topic: {topic}",
        example_sentence=candidate.spanish_text,
    )


def create_word_if_missing(candidate: ContentCandidate, sentence: str, topic: str) -> Item | None:
    if item_exists(Item.ItemType.WORD, candidate.spanish_text, candidate.german_text):
        return None
    return Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        notes=f"Auto-created from topic: {topic}",
        example_sentence=sentence,
    )


def item_exists(item_type: str, spanish_text: str, german_text: str) -> bool:
    return Item.objects.filter(
        item_type=item_type,
        spanish_text__iexact=spanish_text,
        german_text__iexact=german_text,
    ).exists()
