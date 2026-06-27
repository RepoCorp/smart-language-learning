from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load(name: str) -> str:
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8").strip()


CONVERSATION_GENERATION_PROMPT = _load("conversation_generation.txt")
DIALOG_CLICK_SPECIAL_REFINEMENT_PROMPT = _load("dialog_click_special_refinement.txt")
DIALOG_CLICK_WORD_RESOLUTION_PROMPT = _load("dialog_click_word_resolution.txt")
ITEM_CONVERSATION_REPLY_PROMPT = _load("item_conversation_reply.txt")
ITEM_QUESTION_DECISION_PROMPT = _load("item_question_decision.txt")
MISTAKE_EXPLANATION_PROMPT = _load("mistake_explanation.txt")
NEXT_GOAL_SUGGESTION_PROMPT = _load("next_goal_suggestion.txt")
PHRASE_KEYWORDS_PROMPT = _load("phrase_keywords.txt")
WORD_EXERCISES_ADJECTIVE_PROMPT = _load("word_exercises_adjective.txt")
WORD_EXERCISES_ADVERB_PROMPT = _load("word_exercises_adverb.txt")
WORD_EXERCISES_EXPRESSION_PROMPT = _load("word_exercises_expression.txt")
WORD_EXERCISES_HELPER_PROMPT = _load("word_exercises_helper.txt")
WORD_EXERCISES_NOUN_PROMPT = _load("word_exercises_noun.txt")
WORD_EXERCISES_OTHER_PROMPT = _load("word_exercises_other.txt")
WORD_EXERCISES_VERB_PROMPT = _load("word_exercises_verb.txt")
WORD_METADATA_CONTEXTUAL_PROMPT = _load("word_metadata_contextual.txt")
WORD_METADATA_NORMALIZATION_PROMPT = _load("word_metadata_normalization.txt")
WORD_METADATA_RULE_PROMPTS = {
    "adjective": _load("word_metadata_rules_adjective.txt"),
    "adverb": _load("word_metadata_rules_adverb.txt"),
    "expression": _load("word_metadata_rules_expression.txt"),
    "helper": _load("word_metadata_rules_helper.txt"),
    "noun": _load("word_metadata_rules_noun.txt"),
    "other": _load("word_metadata_rules_other.txt"),
    "verb": _load("word_metadata_rules_verb.txt"),
}
TOPIC_CONVERSATION_ANALYZE_USER_TURN_PROMPT = _load("topic_conversation_analyze_user_turn.txt")
TOPIC_CONVERSATION_GOAL_EVALUATION_PROMPT = _load("topic_conversation_goal_evaluation.txt")
TOPIC_CONVERSATION_GOAL_TRANSLATION_PROMPT = _load("topic_conversation_goal_translation.txt")
TOPIC_CONVERSATION_HELP_PROMPT = _load("topic_conversation_help.txt")
TOPIC_CONVERSATION_LITERAL_TRANSLATION_PROMPT = _load("topic_conversation_literal_translation.txt")
TOPIC_CONVERSATION_REPLY_PROMPT = _load("topic_conversation_reply.txt")
TOPIC_CONVERSATION_START_PROMPT = _load("topic_conversation_start.txt")
TOPIC_CONVERSATION_TARGET_PHRASE_HELP_PROMPT = _load("topic_conversation_target_phrase_help.txt")
TOPIC_CONVERSATION_USER_CORRECTION_PROMPT = _load("topic_conversation_user_correction.txt")
