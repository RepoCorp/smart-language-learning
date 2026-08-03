from __future__ import annotations

from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status
from .management_items_listing import _target_contexts_for_word_exercises
from .management_items_word_refresh import scan_all_dialogs_for_word
from .exercise_payloads import sanitize_exercise_payload
from .exercise_persistence import merge_item_exercise_phrases, replace_forms_exercise_payload
from .generation import WORD_EXERCISE_MODEL, call_openai_json
from .generation_words import _clean_exercise_section, _exercise_generation_input
from .generation_word_noun_exercises import (
    GERMAN_NOUN_CASE_ORDER,
    GERMAN_NOUN_GENERATION_MODE,
    generate_german_noun_case_section,
    placeholder_german_noun_section,
)
from ...models import Item


def _call_word_exercise_openai_json(system_prompt: str, user_input: str, timeout_seconds: int = 10, **kwargs) -> dict | None:
    return call_openai_json(
        system_prompt,
        user_input,
        timeout_seconds=timeout_seconds,
        model=WORD_EXERCISE_MODEL,
        **kwargs,
    )


def _merge_german_noun_case_payload(*, existing_payload, new_section: dict, source_language: str) -> dict:
    existing_sections = existing_payload.get("sections") if isinstance(existing_payload, dict) else []
    section_by_key = {
        str(section.get("key", "")).strip(): section
        for section in existing_sections
        if isinstance(section, dict) and str(section.get("key", "")).strip()
    }
    section_by_key[new_section["key"]] = new_section

    ordered_sections = []
    for case_key in GERMAN_NOUN_CASE_ORDER:
        ordered_sections.append(section_by_key.get(case_key) or placeholder_german_noun_section(
            case_key=case_key,
            source_language=source_language,
        ))

    forms_payload = {
        "sections": ordered_sections,
        "phrases": [phrase for section in ordered_sections for phrase in section.get("phrases", [])],
        "generation_mode": GERMAN_NOUN_GENERATION_MODE,
    }
    return replace_forms_exercise_payload(
        existing_payload=existing_payload,
        forms_payload=sanitize_exercise_payload(forms_payload),
    )


class ContentItemNounExerciseCaseView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        case_key = (request.query_params.get("case_key", "") or "").strip().lower()
        if case_key not in {"nominative", "accusative", "dative", "genitive"}:
            return Response({"detail": "Unsupported noun case"}, status=status.HTTP_400_BAD_REQUEST)

        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        if item.item_type != Item.ItemType.WORD:
            return Response({"detail": "Exercises are only available for word items"}, status=status.HTTP_400_BAD_REQUEST)
        if (item.word_type or "").strip().lower() != "noun" or target_language != "german":
            return Response({"detail": "Case generation is only available for German noun items"}, status=status.HTTP_400_BAD_REQUEST)

        scan_all_dialogs_for_word(
            user=user,
            item=item,
            source_language=source_language,
            target_language=target_language,
        )
        target_contexts = _target_contexts_for_word_exercises(user=user, item=item)
        new_section = generate_german_noun_case_section(
            case_key=case_key,
            source_word=item.spanish_text,
            target_word=item.german_text,
            source_language=source_language,
            user_input=_exercise_generation_input(
                spanish_word=item.spanish_text,
                german_word=item.german_text,
                notes=item.notes or "",
                word_type=item.word_type or "",
                source_language=source_language,
                target_language=target_language,
                target_contexts=target_contexts,
            ),
            call_openai_json_fn=_call_word_exercise_openai_json,
            clean_exercise_section_fn=_clean_exercise_section,
        )
        if not new_section.get("phrases"):
            return Response({"detail": "Exercise generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        merged_payload = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_german_noun_case_payload(
                existing_payload=existing_payload,
                new_section=new_section,
                source_language=source_language,
            ),
        )
        return Response({"exercise_phrases": merged_payload})
