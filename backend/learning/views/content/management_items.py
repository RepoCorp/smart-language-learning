from __future__ import annotations

from .management_items_listing import (
    ContentItemCompareWordDetailView,
    ContentItemCompareWordsSearchView,
    ContentItemCompareWordsView,
    ContentItemExercisesView,
    ContentItemFunnyImageExerciseView,
    ContentItemDetailView,
    ContentItemMarkLearnedView,
    ContentItemsView,
    ContentWordsView,
)
from .management_items_compare_words_insights import ContentItemCompareWordsInsightsView
from .management_items_question import ContentItemQuestionView
from .management_items_quick_add import ContentPhraseQuickAddView, ContentWordQuickAddView
from .management_items_word_refresh import ContentItemRefreshWordView

__all__ = [
    "ContentItemDetailView",
    "ContentItemCompareWordsSearchView",
    "ContentItemCompareWordsView",
    "ContentItemCompareWordDetailView",
    "ContentItemCompareWordsInsightsView",
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
