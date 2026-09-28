import pytest

from learning import prompts
from learning.views.content.management import _render_prompt


@pytest.mark.parametrize("source_name,target_name", [
    ("Spanish", "German"), ("English", "Spanish"), ("German", "English"),
])
@pytest.mark.parametrize("prompt_name,fields", [
    ("STRATEGY_COMPARE_WORDS_PROMPT", ["difference", "mistake"]),
    ("STRATEGY_DECODE_ANALYSIS_PROMPT", ["linguistic.explanation", "memory.explanation", "related[].why"]),
    ("STRATEGY_ENCOUNTER_SITUATIONS_PROMPT", ["title", "description"]),
    ("STRATEGY_ACT_EXERCISE_PROMPT", ["actions"]),
])
def test_strategy_explanations_have_explicit_source_language(prompt_name, fields, source_name, target_name):
    prompt = _render_prompt(
        getattr(prompts, prompt_name), source_name=source_name, target_name=target_name,
        source_text="meaning", target_text="word", word_type="noun", notes="",
    )
    assert f"Write all explanations and instructions in {source_name}" in prompt
    for field in fields:
        assert f"`{field}`" in prompt
    assert f"Keep study words and example sentences in {target_name}" in prompt
    assert "Do not translate the JSON field names" in prompt
    assert "{source_name}" not in prompt
    assert "{target_name}" not in prompt
    assert f"{{{source_name}}}" not in prompt
    assert f"{{{target_name}}}" not in prompt
