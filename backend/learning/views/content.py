from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from uuid import uuid4

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import ExcludedWordSuggestion, Item
from ..prompts import CONTENT_GENERATION_PROMPT
from ..serializers import ContentConfirmSerializer, ContentTopicSerializer

GERMAN_ARTICLES = {
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
}

logger = logging.getLogger(__name__)


class ContentPreviewView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        logger.info("content.preview.started topic=%s", topic)
        plan = build_content_plan(topic)
        logger.info(
            "content.preview.completed topic=%s phrase_exists=%s words_total=%d words_new=%d",
            topic,
            plan.phrase.exists,
            len(plan.words),
            sum(1 for word in plan.words if not word.exists),
        )
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
        logger.info(
            "content.confirm.started topic=%s selected_words=%d",
            topic,
            len(selected_words),
        )
        selected_words_normalized = {
            normalize_word_key(word)
            for word in selected_words
            if normalize_word_key(word)
        }
        plan = build_content_plan(topic)
        words_to_exclude = [
            word
            for word in plan.words
            if (not word.exists) and (normalize_word_key(word.spanish_text) not in selected_words_normalized)
        ]
        save_excluded_words(words_to_exclude)

        created_phrase = create_phrase_if_missing(plan.phrase, topic)
        created_words = [
            create_word_if_missing(word, plan.phrase.spanish_text, topic, plan.phrase.german_text)
            for word in plan.words
            if normalize_word_key(word.spanish_text) in selected_words_normalized
        ]
        created_word_items = [word for word in created_words if word is not None]
        logger.info(
            "content.confirm.completed topic=%s created_phrase=%s created_words=%d excluded_words=%d",
            topic,
            created_phrase is not None,
            len(created_word_items),
            len(words_to_exclude),
        )

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
    notes: str = ""


@dataclass(frozen=True)
class ContentPlan:
    phrase: ContentCandidate
    words: list[ContentCandidate]


def build_content_plan(topic: str) -> ContentPlan:
    normalized_topic = normalize_topic(topic)
    generated = generate_content_with_chatgpt(normalized_topic)
    if generated is None:
        logger.warning("content.generate.fallback topic=%s reason=chatgpt_unavailable_or_invalid", normalized_topic)
        phrase_es = f"Hoy estudio {normalized_topic}."
        phrase_de = f"Heute lerne ich {normalized_topic}."
        phrase_notes = ""
        generated_words: list[dict[str, str]] = []
    else:
        if len(generated) == 3:
            phrase_es, phrase_de, generated_words = generated
            phrase_notes = ""
        else:
            phrase_es, phrase_de, phrase_notes, generated_words = generated

    phrase_exists = item_exists(Item.ItemType.PHRASE, phrase_es, phrase_de)
    phrase_candidate = ContentCandidate(
        spanish_text=phrase_es,
        german_text=phrase_de,
        exists=phrase_exists,
        notes=phrase_notes,
    )

    words: list[ContentCandidate] = []
    seen: set[tuple[str, str]] = set()
    excluded_words = get_excluded_words_lookup()
    skipped_missing_fields = 0
    skipped_without_article = 0
    skipped_excluded = 0
    skipped_duplicate = 0
    for keyword in generated_words:
        spanish_word = keyword["spanish_text"].strip()
        german_word = keyword["german_text"].strip()
        if not spanish_word or not german_word:
            skipped_missing_fields += 1
            continue
        if not german_word_has_article(german_word):
            skipped_without_article += 1
            continue
        key = normalize_word_pair(spanish_word, german_word)
        if key in excluded_words:
            skipped_excluded += 1
            continue
        if key in seen:
            skipped_duplicate += 1
            continue
        seen.add(key)
        keyword_notes = str(keyword.get("notes", "")).strip()
        plural_german = str(keyword.get("plural_german", "")).strip()
        keyword_notes = enrich_notes_with_plural(keyword_notes, plural_german)
        exists = item_exists(Item.ItemType.WORD, spanish_word, german_word)
        words.append(
            ContentCandidate(
                spanish_text=spanish_word,
                german_text=german_word,
                exists=exists,
                notes=keyword_notes,
            )
        )

    logger.info(
        (
            "content.plan.built topic=%s generated=%d kept=%d "
            "skipped_missing=%d skipped_no_article=%d skipped_excluded=%d skipped_duplicate=%d"
        ),
        normalized_topic,
        len(generated_words),
        len(words),
        skipped_missing_fields,
        skipped_without_article,
        skipped_excluded,
        skipped_duplicate,
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


def german_word_has_article(german_word: str) -> bool:
    normalized = normalize_word_key(german_word)
    if not normalized:
        return False
    first_token = normalized.split(" ", 1)[0]
    return first_token in GERMAN_ARTICLES


def get_excluded_words_lookup() -> set[tuple[str, str]]:
    return {
        normalize_word_pair(spanish_word, german_word)
        for spanish_word, german_word in ExcludedWordSuggestion.objects.values_list(
            "spanish_text",
            "german_text",
        )
    }


def save_excluded_words(words: list[ContentCandidate]) -> None:
    saved_count = 0
    for word in words:
        normalized_spanish, normalized_german = normalize_word_pair(word.spanish_text, word.german_text)
        if not normalized_spanish or not normalized_german:
            continue
        _, created = ExcludedWordSuggestion.objects.get_or_create(
            spanish_text=normalized_spanish,
            german_text=normalized_german,
        )
        if created:
            saved_count += 1
    if words:
        logger.info("content.exclude.saved requested=%d created=%d", len(words), saved_count)


def generate_content_with_chatgpt(topic: str) -> tuple[str, str, str, list[dict[str, str]]] | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("content.generate.chatgpt.skipped topic=%s reason=missing_api_key", topic)
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
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("content.generate.chatgpt.request_failed topic=%s error=%s", topic, exc.__class__.__name__)
        return None

    try:
        content = payload["choices"][0]["message"]["content"]
        parsed = extract_json_from_text(content)
        spanish_text = str(parsed.get("spanish_text", "")).strip()
        german_text = str(parsed.get("german_text", "")).strip()
        notes = str(parsed.get("notes", "")).strip()
        keywords = parsed.get("keywords", [])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        logger.warning("content.generate.chatgpt.parse_failed topic=%s error=%s", topic, exc.__class__.__name__)
        return None

    if not spanish_text or not german_text or not isinstance(keywords, list):
        logger.warning("content.generate.chatgpt.invalid_payload topic=%s", topic)
        return None

    cleaned_keywords: list[dict[str, str]] = []
    for keyword in keywords:
        if not isinstance(keyword, dict):
            continue
        spanish_word = str(keyword.get("spanish_text", "")).strip()
        german_word = str(keyword.get("german_text", "")).strip()
        keyword_notes = str(keyword.get("notes", "")).strip()
        plural_german = str(keyword.get("plural_german", "")).strip()
        if not spanish_word or not german_word:
            continue
        cleaned_keywords.append(
            {
                "spanish_text": spanish_word,
                "german_text": german_word,
                "notes": keyword_notes,
                "plural_german": plural_german,
            }
        )

    logger.info(
        "content.generate.chatgpt.success topic=%s keywords=%d",
        topic,
        len(cleaned_keywords),
    )
    return spanish_text, german_text, notes, cleaned_keywords


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
        logger.info("content.create.phrase.skipped_exists topic=%s spanish=%s", topic, candidate.spanish_text)
        return None
    audio_url = create_audio_file(candidate.german_text, "phrase")
    item = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        notes=candidate.notes,
        example_sentence="",
        audio_url=audio_url,
    )
    logger.info("content.create.phrase.created topic=%s item_id=%s has_audio=%s", topic, item.id, bool(audio_url))
    return item


def enrich_notes_with_plural(notes: str, plural_german: str) -> str:
    plural = plural_german.strip()
    base_notes = notes.strip()
    if not plural:
        return base_notes
    plural_note = f"Plural: {plural}"
    if not base_notes:
        return plural_note
    if re.search(r"\bplural\b", base_notes, flags=re.IGNORECASE):
        return base_notes
    return f"{base_notes} {plural_note}"


def create_word_if_missing(candidate: ContentCandidate, sentence: str, topic: str, phrase_german: str) -> Item | None:
    if item_exists(Item.ItemType.WORD, candidate.spanish_text, candidate.german_text):
        logger.info("content.create.word.skipped_exists topic=%s spanish=%s", topic, candidate.spanish_text)
        return None
    audio_text = f"{candidate.german_text}. {phrase_german}"
    audio_url = create_audio_file(audio_text, "word")
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        notes=candidate.notes,
        example_sentence=phrase_german,
        audio_url=audio_url,
    )
    logger.info(
        "content.create.word.created topic=%s item_id=%s spanish=%s has_audio=%s",
        topic,
        item.id,
        item.spanish_text,
        bool(audio_url),
    )
    return item


def item_exists(item_type: str, spanish_text: str, german_text: str) -> bool:
    return Item.objects.filter(
        item_type=item_type,
        spanish_text__iexact=spanish_text,
        german_text__iexact=german_text,
    ).exists()


def create_audio_file(text: str, prefix: str) -> str:
    if not text.strip():
        logger.warning("content.audio.skipped prefix=%s reason=empty_text", prefix)
        return ""

    try:
        from gtts import gTTS
    except ImportError:
        logger.warning("content.audio.skipped prefix=%s reason=gtts_not_installed", prefix)
        return ""

    audio_dir = Path(settings.MEDIA_ROOT) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        slug = "audio"
    filename = f"{prefix}-{slug[:32]}-{uuid4().hex[:8]}.mp3"
    file_path = audio_dir / filename

    try:
        gTTS(text=text, lang="de", slow=False).save(str(file_path))
    except Exception:
        logger.warning("content.audio.failed prefix=%s filename=%s", prefix, filename)
        return ""

    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/audio/{filename}"
    audio_url = f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"
    logger.info("content.audio.created prefix=%s filename=%s", prefix, filename)
    return audio_url
