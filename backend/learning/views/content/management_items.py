from __future__ import annotations

from .management_items_act import ContentItemActView
from .management_items_listing import (
    ContentItemCompareWordDetailView,
    ContentItemCompareWordsSearchView,
    ContentItemCompareWordsView,
    ContentItemExercisesView,
    ContentItemFunnyImageExerciseView,
    ContentItemMarkLearnedView,
    ContentItemsView,
    ContentWordsView,
)
from .management_items_detail import ContentItemDetailView
from .management_items_compare_words_insights import ContentItemCompareWordsInsightsView
from .management_items_compare_strategy import ContentItemCompareStrategyView
from .management_items_related import ContentItemRelatedView
from .management_items_decode import ContentItemDecodeView
from .management_items_encounter import ContentItemEncounterView
from .management_items_grammar import ContentItemGrammarExamplesView
from .management_items_phrase_grammar import ContentItemPhraseGrammarFeaturesView
from .management_items_noun_exercise_cases import ContentItemNounExerciseCaseView
from .management_items_personalize import ContentItemPersonalizeView
from .management_items_practice import ContentItemPracticeView
from .management_items_question import ContentItemQuestionView
from .management_items_quick_add import ContentPhraseQuickAddView, ContentWordQuickAddView
from .management_items_regenerate import ContentItemRegenerateView
from .management_items_visualize import ContentItemVisualizeView
from .management_items_walk import ContentItemWalkView
from .management_items_sing import ContentItemSingView
from .management_items_word_refresh import ContentItemRefreshWordView

__all__ = [
    "ContentItemDetailView",
    "ContentItemCompareWordsSearchView",
    "ContentItemCompareWordsView",
    "ContentItemCompareWordDetailView",
    "ContentItemCompareWordsInsightsView",
    "ContentItemCompareStrategyView",
    "ContentItemActView",
    "ContentItemRelatedView",
    "ContentItemDecodeView",
    "ContentItemEncounterView",
    "ContentItemGrammarExamplesView",
    "ContentItemPhraseGrammarFeaturesView",
    "ContentItemExercisesView",
    "ContentItemNounExerciseCaseView",
    "ContentItemPersonalizeView",
    "ContentItemPracticeView",
    "ContentItemVisualizeView",
    "ContentItemWalkView",
    "ContentItemSingView",
    "ContentItemFunnyImageExerciseView",
    "ContentItemMarkLearnedView",
    "ContentItemRefreshWordView",
    "ContentItemQuestionView",
    "ContentItemRegenerateView",
    "ContentItemsView",
    "ContentPhraseQuickAddView",
    "ContentWordQuickAddView",
    "ContentWordsView",
]
