from __future__ import annotations

from ...models import Item
from .exercise_persistence import merge_item_exercise_phrases
from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status
from .walk_challenges import generate_walk_challenge


def _walk_sentence(exercise_phrases: dict) -> dict[str, str] | None:
    entries = exercise_phrases.get("phrases") if isinstance(exercise_phrases, dict) else []
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        source_text = str(entry.get("source_text", "")).strip()
        target_text = str(entry.get("target_text", "")).strip()
        if source_text and target_text:
            return {"source_text": source_text[:400], "target_text": target_text[:400]}
    return None


def _valid_walk_challenge(exercise_phrases: dict) -> dict[str, str] | None:
    challenge = exercise_phrases.get("walk_challenge") if isinstance(exercise_phrases, dict) else None
    if not isinstance(challenge, dict):
        return None
    instruction = str(challenge.get("instruction", "")).strip()
    source_text = str(challenge.get("source_text", "")).strip()
    target_text = str(challenge.get("target_text", "")).strip()
    if not (instruction and source_text and target_text):
        return None
    return {"instruction": instruction[:500], "source_text": source_text[:400], "target_text": target_text[:400]}


def _merge_walk_challenge(*, exercise_phrases: dict, instruction: str, regenerate: bool) -> dict:
    payload = dict(exercise_phrases or {})
    existing = _valid_walk_challenge(payload)
    if existing and not regenerate:
        return payload

    sentence = _walk_sentence(payload)
    if not sentence:
        return payload
    payload["walk_challenge"] = {"label": "walk", "instruction": instruction, **sentence}
    payload.pop("walk_sentences", None)
    return payload


class ContentItemWalkView(APIView):
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

        existing = _valid_walk_challenge(item.exercise_phrases or {})
        if not _walk_sentence(item.exercise_phrases or {}):
            return Response({"detail": "Generate Forms before creating a Walk challenge"}, status=status.HTTP_400_BAD_REQUEST)

        instruction = generate_walk_challenge()
        if not instruction:
            return Response({"detail": "Walk challenges are not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_walk_challenge(
                exercise_phrases=existing_payload,
                instruction=instruction,
                regenerate=bool(existing),
            ),
        )
        if not _valid_walk_challenge(exercise_phrases):
            return Response({"detail": "Generate Forms before creating a Walk challenge"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"exercise_phrases": exercise_phrases})
