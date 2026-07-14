from __future__ import annotations

from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status
from .dialog_item_context import related_dialogs_by_item_ids
from .types import ContentCandidate
from ...models import DialogTurn, Item, SavedDialog
from .core import save_word_dialog_occurrences


def scan_all_dialogs_for_word(
    *,
    user,
    item: Item,
    source_language: str,
    target_language: str,
) -> int:
    candidate = ContentCandidate(
        spanish_text=item.spanish_text,
        german_text=item.german_text,
        exists=True,
        word_type=item.word_type or "",
    )
    created = 0
    dialogs = apply_user_scope(SavedDialog.objects, user).filter(
        source_language=source_language,
        target_language=target_language,
    )
    for dialog in dialogs.order_by("id"):
        turns = list(DialogTurn.objects.filter(dialog=dialog).order_by("turn_index", "id"))
        if not turns:
            continue
        created += save_word_dialog_occurrences(
            user=user,
            dialog=dialog,
            turns=turns,
            word_candidates=[candidate],
            source_language=source_language,
            target_language=target_language,
        )
    return created


class ContentItemRefreshWordView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        if item.item_type != Item.ItemType.WORD:
            return Response({"detail": "Refresh is only available for word items"}, status=status.HTTP_400_BAD_REQUEST)

        # TODO: Bring back metadata regeneration here only after we redesign it.
        # The previous model-based refresh frequently made word metadata worse.
        dialog_occurrences_created = scan_all_dialogs_for_word(
            user=user,
            item=item,
            source_language=source_language,
            target_language=target_language,
        )
        related_dialogs_map = related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
        return Response(
            {
                "ok": True,
                "dialog_occurrences_created": dialog_occurrences_created,
                "related_dialogs": related_dialogs_map.get(item.id, []),
            }
        )
