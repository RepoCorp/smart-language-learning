from __future__ import annotations

from .management import (
    APIView,
    Request,
    Response,
    SavedDialog,
    _dialog_turns_with_phrase_audio,
    _ensure_audio_for_dialog_turn,
    _normalized_pair,
    apply_user_scope,
    get_request_user,
)

DEFAULT_DIALOGS_PAGE_SIZE = 20
MAX_DIALOGS_PAGE_SIZE = 50


def _dialog_turn_count(dialog: SavedDialog) -> int:
    related_turns = getattr(dialog, "dialog_turns", None)
    if related_turns is not None:
        return related_turns.count()
    return len(dialog.turns) if isinstance(dialog.turns, list) else 0


class ContentDialogsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        try:
            page = max(1, int(request.query_params.get("page", "1") or "1"))
        except ValueError:
            page = 1
        try:
            page_size = int(request.query_params.get("page_size", str(DEFAULT_DIALOGS_PAGE_SIZE)) or DEFAULT_DIALOGS_PAGE_SIZE)
        except ValueError:
            page_size = DEFAULT_DIALOGS_PAGE_SIZE
        page_size = min(MAX_DIALOGS_PAGE_SIZE, max(1, page_size))
        offset = (page - 1) * page_size
        topic_query = (request.query_params.get("topic", "") or "").strip()
        queryset = apply_user_scope(SavedDialog.objects, user).filter(
            source_language=source_language,
            target_language=target_language,
        )
        if topic_query:
            queryset = queryset.filter(topic__icontains=topic_query)
        rows = list(
            queryset
            .prefetch_related("dialog_turns")
            .order_by("-created_at", "-id")[offset : offset + page_size + 1]
        )
        has_more = len(rows) > page_size
        rows = rows[:page_size]
        dialogs = [
            {
                "dialog_id": dialog.id,
                "topic": dialog.topic,
                "context": dialog.context,
                "audio_url": dialog.audio_url,
                "created_at": dialog.created_at,
                "turn_count": _dialog_turn_count(dialog),
                "turns": [],
            }
            for dialog in rows
        ]
        return Response(
            {
                "dialogs": dialogs,
                "page": page,
                "page_size": page_size,
                "has_more": has_more,
                "next_page": page + 1 if has_more else None,
            }
        )


class ContentDialogDetailView(APIView):
    def get(self, request: Request, dialog_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        dialog = (
            apply_user_scope(SavedDialog.objects, user)
            .filter(id=dialog_id, source_language=source_language, target_language=target_language)
            .prefetch_related("dialog_turns")
            .first()
        )
        if not dialog:
            return Response({"detail": "Dialog not found"}, status=404)
        return Response(
            {
                "dialog_id": dialog.id,
                "topic": dialog.topic,
                "context": dialog.context,
                "audio_url": dialog.audio_url,
                "created_at": dialog.created_at,
                "turn_count": _dialog_turn_count(dialog),
                "turns": _dialog_turns_with_phrase_audio(dialog, user=user),
            }
        )


class ContentDialogTurnAudioView(APIView):
    def post(self, request: Request, dialog_id: int, turn_index: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        dialog = (
            apply_user_scope(SavedDialog.objects, user)
            .filter(id=dialog_id, source_language=source_language, target_language=target_language)
            .first()
        )
        if not dialog:
            return Response({"detail": "Dialog not found"}, status=404)
        audio_url = _ensure_audio_for_dialog_turn(user=user, dialog_id_raw=dialog_id, turn_index_raw=turn_index)
        if not audio_url:
            return Response({"detail": "Audio generation failed"}, status=503)
        return Response({"audio_url": audio_url})


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
