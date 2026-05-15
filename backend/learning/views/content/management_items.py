from __future__ import annotations

from .management_items_listing import (
    ContentItemExercisesView,
    ContentItemFunnyImageExerciseView,
    ContentItemDetailView,
    ContentItemMarkLearnedView,
    ContentItemsView,
    ContentWordsView,
)
from .management_items_question import ContentItemQuestionView
from .management_items_quick_add import ContentPhraseQuickAddView, ContentWordQuickAddView

__all__ = [
    "ContentItemDetailView",
    "ContentItemExercisesView",
    "ContentItemFunnyImageExerciseView",
    "ContentItemMarkLearnedView",
    "ContentItemQuestionView",
    "ContentItemsView",
    "ContentPhraseQuickAddView",
    "ContentWordQuickAddView",
    "ContentWordsView",
]
