from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load(name: str) -> str:
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8").strip()


CONVERSATION_GENERATION_PROMPT = _load("conversation_generation.txt")
PHRASE_KEYWORDS_PROMPT = _load("phrase_keywords.txt")
WORD_EXERCISES_FIRST_SECTION_PROMPT = _load("word_exercises_first_section.txt")
WORD_EXERCISES_SECOND_SECTION_PROMPT = _load("word_exercises_second_section.txt")
