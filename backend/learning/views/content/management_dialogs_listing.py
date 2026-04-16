from __future__ import annotations

from .management import APIView, Request, Response, SavedDialog, _normalized_pair, apply_user_scope, get_request_user


class ContentDialogsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        rows = list(
            apply_user_scope(SavedDialog.objects, user)
            .filter(source_language=source_language, target_language=target_language)
            .prefetch_related("dialog_turns")
            .order_by("-created_at", "-id")[:300]
        )
        dialogs = [
            {
                "dialog_id": dialog.id,
                "topic": dialog.topic,
                "context": dialog.context,
                "audio_url": dialog.audio_url,
                "created_at": dialog.created_at,
                "turns": [
                    {
                        "source_text": turn.source_text,
                        "target_text": turn.target_text,
                        "speaker": _speaker_for_index(dialog, turn.turn_index),
                    }
                    for turn in dialog.dialog_turns.all()
                ],
            }
            for dialog in rows
        ]
        return Response({"dialogs": dialogs})


def _speaker_for_index(dialog: SavedDialog, turn_index: int) -> str:
    raw_turns = dialog.turns if isinstance(dialog.turns, list) else []
    if 0 <= turn_index < len(raw_turns):
        raw_turn = raw_turns[turn_index]
        if isinstance(raw_turn, dict):
            raw_speaker = str(raw_turn.get("speaker", "")).strip().lower()
            if raw_speaker in {"a", "speaker_a", "person_a", "1", "first"}:
                return "a"
            if raw_speaker in {"b", "speaker_b", "person_b", "2", "second"}:
                return "b"
    return "a" if turn_index % 2 == 0 else "b"
