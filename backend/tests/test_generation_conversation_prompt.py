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


def test_absolute_beginner_prompt_is_simpler_than_a1():
    prompt = build_prompt("A0")
    assert "absolute beginner" in prompt
    assert "4 to 6" in prompt
    assert "2 to 5 words" in prompt
    assert "one idea" in prompt
    assert "Repeat" in prompt
    assert "avoid reusing" not in prompt
    assert "Exactly 3" in build_prompt("A0", dialog_length="short_three")


def test_system_prompt_respects_selected_level():
    from learning.prompts import CONVERSATION_GENERATION_PROMPT
    assert "requested proficiency level" in CONVERSATION_GENERATION_PROMPT
    assert "(A1-A2)" not in CONVERSATION_GENERATION_PROMPT


def test_absolute_beginner_conversation_guidance():
    from learning.views.content.conversation_turn_guidance import effective_notes
    notes = effective_notes(notes="", goal_text="Buy bread", response_level="A0", speech_speed="slow", conversation_phase="active")
    assert "absolute beginner" in notes
    assert "2 to 5 words" in notes
    assert "yes/no" in notes
    assert "Do not give goal-specific" in notes
    assert "Speak slowly" in notes


def test_absolute_beginner_level_is_valid_without_changing_default():
    from learning.serializers import ContentTopicSerializer
    serializer = ContentTopicSerializer(data={"topic": "shopping", "proficiency_level": "A0"})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["proficiency_level"] == "A0"
    default = ContentTopicSerializer(data={"topic": "shopping"})
    assert default.is_valid()
    assert default.validated_data["proficiency_level"] == "A2"


def test_absolute_beginner_scenario_and_dialog_both_receive_level():
    from learning.views.content.generation_conversation import generate_conversation_with_chatgpt
    calls = []

    def model(system, user_input, **kwargs):
        calls.append(user_input)
        if len(calls) == 1:
            return {"scenarios": ["Buy bread", "Buy milk", "Buy fruit", "Buy rice", "Buy water"]}
        return {"conversation": [{"speaker": "a", "source_text": "Un pan, por favor.", "target_text": "Ein Brot, bitte."}]}

    result = generate_conversation_with_chatgpt(
        topic="shopping", proficiency_level="A0", call_openai_json_fn=model, choice_fn=lambda options: options[0],
    )
    assert result
    assert len(calls) == 2
    assert "absolute beginner" in calls[0]
    assert "absolute beginner" in calls[1]
