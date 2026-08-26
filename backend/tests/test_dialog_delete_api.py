import pytest
from rest_framework.test import APIClient

from learning.models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog


@pytest.mark.django_db
def test_deleting_dialog_keeps_saved_item_and_removes_dialog_links():
    dialog = SavedDialog.objects.create(
        topic="At the cafe",
        source_language="spanish",
        target_language="german",
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Quiero cafe.",
        target_text="Ich mochte Kaffee.",
    )
    item = Item.objects.create(
        item_type="word",
        spanish_text="cafe",
        german_text="Kaffee",
    )
    ItemDialogOccurrence.objects.create(item=item, dialog=dialog, turn=turn, turn_index=0, side="target")

    response = APIClient().delete(
        f"/api/content/dialogs/{dialog.id}?source_language=spanish&target_language=german",
    )

    assert response.status_code == 204
    assert not SavedDialog.objects.filter(id=dialog.id).exists()
    assert not DialogTurn.objects.filter(id=turn.id).exists()
    assert not ItemDialogOccurrence.objects.filter(item=item).exists()
    assert Item.objects.filter(id=item.id).exists()
