from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load(name: str) -> str:
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8").strip()


CONVERSATION_GENERATION_PROMPT = _load("conversation_generation.txt")
PHRASE_KEYWORDS_PROMPT = _load("phrase_keywords.txt")
WORD_EXERCISES_ADJECTIVE_PROMPT = _load("word_exercises_adjective.txt")
WORD_EXERCISES_ADVERB_PROMPT = _load("word_exercises_adverb.txt")
WORD_EXERCISES_EXPRESSION_PROMPT = _load("word_exercises_expression.txt")
WORD_EXERCISES_NOUN_PROMPT = _load("word_exercises_noun.txt")
WORD_EXERCISES_OTHER_PROMPT = _load("word_exercises_other.txt")
WORD_EXERCISES_VERB_PROMPT = _load("word_exercises_verb.txt")
