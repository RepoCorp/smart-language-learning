from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_DECODE_ANALYSIS_PROMPT
from .generation import WORD_EXERCISE_MODEL
from .management import (
    APIView,
    Request,
    Response,
    _call_openai_json_logged,
    _normalized_pair,
    _render_prompt,
    apply_user_scope,
    get_request_user,
    status,
)
from .exercise_persistence import merge_item_exercise_phrases


def _clean_text(value: object, *, limit: int = 400) -> str:
    return str(value or "").strip()[:limit]


def _clean_memory(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    decomposition = _clean_text(value.get("decomposition"))
    explanation = _clean_text(value.get("explanation"), limit=600)
    if not decomposition and not explanation:
        return None
    return {
        "decomposition": decomposition,
        "explanation": explanation,
    }


def _clean_linguistic(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    cleaned = {
        "prefix": _clean_text(value.get("prefix"), limit=120),
        "root": _clean_text(value.get("root"), limit=120),
        "suffix": _clean_text(value.get("suffix"), limit=120),
        "lemma": _clean_text(value.get("lemma"), limit=120),
        "explanation": _clean_text(value.get("explanation"), limit=600),
    }
    if not any(cleaned.values()):
        return None
    return cleaned


def _clean_related(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    cleaned: list[dict] = []
    for entry in value[:5]:
        if not isinstance(entry, dict):
            continue
        target = _clean_text(entry.get("target"), limit=255)
        source = _clean_text(entry.get("source"), limit=255)
        why = _clean_text(entry.get("why"), limit=500)
        sentence = _clean_text(entry.get("sentence"), limit=400)
        translation = _clean_text(entry.get("translation"), limit=400)
        if not (target and source and why and sentence and translation):
            continue
        cleaned.append(
            {
                "target": target,
                "source": source,
                "why": why,
                "sentence": sentence,
                "translation": translation,
            }
        )
    return cleaned


def _merge_decode_analysis(*, exercise_phrases: dict, linguistic: dict | None, memory: dict | None, related: list[dict]) -> dict:
    payload = dict(exercise_phrases or {})
    payload["decode_analysis"] = {
        "linguistic": linguistic,
        "memory": memory,
        "related": related,
    }
    return payload


class ContentItemDecodeView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        source_name = language_display_name(source_language)
        target_name = language_display_name(target_language)
        parsed = _call_openai_json_logged(
            label="content_item_decode",
            system_prompt=_render_prompt(
                STRATEGY_DECODE_ANALYSIS_PROMPT,
                source_name=source_name,
                target_name=target_name,
                source_text=item.spanish_text,
                target_text=item.german_text,
                word_type=item.word_type or "",
                notes=item.notes or "",
            ),
            user_input=(
                f"Item source text: {item.spanish_text}\n"
                f"Item target text: {item.german_text}\n"
                f"Item word type: {item.word_type or ''}\n"
                f"Item notes: {item.notes or ''}\n"
            ),
            timeout_seconds=12,
            model=WORD_EXERCISE_MODEL,
            temperature=1.0,
            top_p=1.0,
            presence_penalty=0.0,
        )
        if not isinstance(parsed, dict):
            return Response({"detail": "Failed to generate decode analysis"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        linguistic = _clean_linguistic(parsed.get("linguistic"))
        memory = _clean_memory(parsed.get("memory"))
        related = _clean_related(parsed.get("related"))
        if linguistic is None and memory is None and not related:
            return Response({"detail": "Failed to generate decode analysis"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_decode_analysis(
                exercise_phrases=existing_payload,
                linguistic=linguistic,
                memory=memory,
                related=related,
            ),
        )
        return Response({"exercise_phrases": exercise_phrases})
