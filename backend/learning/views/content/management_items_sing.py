from __future__ import annotations

from uuid import uuid4

from ...languages import language_display_name
from ...models import Item
from .exercise_persistence import merge_item_exercise_phrases
from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status
from .management_items_listing import _generate_openai_image, _save_exercise_image
from .sing_service import create_audio, generate_lyric, retry_audio, song_payload


def _merge_song(exercise_phrases: dict, song: dict) -> dict:
    payload = exercise_phrases or {}
    history = _song_history(payload)
    previous = song_payload(payload)
    for candidate in (previous, song):
        if candidate and candidate.get("audio_url"):
            _store_song_version(history, candidate)
    return {**payload, "sing_song": song, "sing_song_history": history}


def _song_history(payload: dict) -> list[dict]:
    saved = payload.get("sing_song_history") if isinstance(payload, dict) else None
    return [entry for entry in saved if isinstance(entry, dict)] if isinstance(saved, list) else []


def _store_song_version(history: list[dict], song: dict) -> None:
    identity = str(song.get("song_id") or song.get("audio_url") or "")
    if not identity:
        return
    for index, entry in enumerate(history):
        if str(entry.get("song_id") or entry.get("audio_url") or "") == identity:
            history[index] = song
            return
    history.append(song)


def _song_image_prompt(item: Item, lyric: dict, target_language: str) -> str:
    return (
        "Create one colorful, memorable illustration for a language-learning song. "
        f"The song is in {language_display_name(target_language)} and teaches {item.german_text!r}, "
        f"meaning {item.spanish_text!r}. Faithfully illustrate: {lyric['target_text']!r}. "
        "Make the studied word the visual focus in a playful, upbeat, all-ages scene. Do not include "
        "written words, letters, numbers, captions, speech bubbles, signs, or labels."
    )


class ContentItemSingView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type__in=(Item.ItemType.WORD, Item.ItemType.PHRASE),
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        song = song_payload(item.exercise_phrases or {})
        if _flag(request, "image"):
            return self._create_image(item, song, target_language)
        if _flag(request, "retry"):
            return self._retry(item, song)
        if _flag(request, "lyrics"):
            lyric = generate_lyric(item, source_language, target_language, song)
            if not lyric:
                return Response({"detail": "Failed to generate song lyrics"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return self._save(item, lyric)
        if not song:
            return Response({"detail": "Create lyrics before creating a song"}, status=status.HTTP_409_CONFLICT)

        created = create_audio(item, song, target_language, uuid4().hex[:10], song.get("style_key", ""))
        if not created:
            return Response({"detail": "Failed to create song audio"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return self._save(item, created)

    def _create_image(self, item: Item, song: dict | None, target_language: str) -> Response:
        if not song:
            return Response({"detail": "Create lyrics before generating an image"}, status=status.HTTP_409_CONFLICT)
        image_bytes = _generate_openai_image(_song_image_prompt(item, song, target_language))
        image_url = _save_exercise_image(image_bytes) if image_bytes else ""
        if not image_url:
            return Response({"detail": "Failed to generate song image"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return self._save(item, {**song, "image_url": image_url})

    def _retry(self, item: Item, song: dict | None) -> Response:
        if not song:
            return Response({"detail": "This song has no saved plan to retry"}, status=status.HTTP_409_CONFLICT)
        created = retry_audio(item, song, uuid4().hex[:10])
        if not created:
            return Response({"detail": "Failed to retry song audio"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return self._save(item, created)

    def _save(self, item: Item, song: dict) -> Response:
        phrases = merge_item_exercise_phrases(item, lambda payload: _merge_song(payload, song))
        return Response({"exercise_phrases": phrases})


def _flag(request: Request, name: str) -> bool:
    return str(request.query_params.get(name, "")).lower() in {"1", "true", "yes"}
