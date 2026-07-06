from __future__ import annotations

from .management_items_listing import (
    ContentItemCompareWordDetailView,
    ContentItemCompareWordsSearchView,
    ContentItemCompareWordsView,
    ContentItemExercisesView,
    ContentItemFunnyImageExerciseView,
    ContentItemDetailView,
    ContentItemMarkLearnedView,
    ContentItemRefreshWordView,
    ContentItemsView,
    ContentWordsView,
)
from .management_items_question import ContentItemQuestionView
from .management_items_quick_add import ContentPhraseQuickAddView, ContentWordQuickAddView

__all__ = [
    "ContentItemDetailView",
    "ContentItemCompareWordsSearchView",
    "ContentItemCompareWordsView",
    "ContentItemCompareWordDetailView",
    "ContentItemExercisesView",
    "ContentItemFunnyImageExerciseView",
    "ContentItemMarkLearnedView",
    "ContentItemRefreshWordView",
    "ContentItemQuestionView",
    "ContentItemsView",
    "ContentPhraseQuickAddView",
    "ContentWordQuickAddView",
    "ContentWordsView",
]
