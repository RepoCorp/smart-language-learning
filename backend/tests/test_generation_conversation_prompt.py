from learning.views.content.generation_conversation_prompt import build_conversation_prompt


def build_prompt(level: str, dialog_length: str = "standard") -> str:
    return build_conversation_prompt(
        topic="shopping",
        context="at the market",
        conversation_details="",
        required_words_instruction="Required target-language words/phrases: none.",
        dialog_length=dialog_length,
        proficiency_level=level,
        scenario_description="Buying fruit.",
        source_language_name="Spanish",
        target_language_name="German",
        style_seed="casual",
        creativity_seed="test",
    )


def test_b1_prompt_allows_longer_natural_turns():
    prompt = build_prompt("B1")

    assert "Allow naturally longer turns" in prompt
    assert "Turns may be longer than beginner turns" in prompt
    assert "problem to solve" in prompt


def test_b2_prompt_allows_multi_sentence_turns():
    prompt = build_prompt("B2")

    assert "Allow naturally longer turns" in prompt
    assert "Turns may be multi-sentence when natural" in prompt
    assert "trade-offs" in prompt


def test_short_dialog_stays_concise_at_b2():
    prompt = build_prompt("B2", dialog_length="short_three")

    assert "Exactly 3 very short dialogue turns/phrases total." in prompt
