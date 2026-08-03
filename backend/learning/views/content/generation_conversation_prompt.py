from __future__ import annotations


def build_conversation_prompt(
    *,
    topic: str,
    context: str,
    conversation_details: str,
    required_words_instruction: str,
    dialog_length: str,
    proficiency_level: str,
    scenario_description: str,
    source_language_name: str,
    target_language_name: str,
    style_seed: str,
    creativity_seed: str,
) -> str:
    normalized_context = " ".join(context.split()).strip()
    normalized_details = " ".join(conversation_details.split()).strip()
    length_requirement = _length_requirement(dialog_length, proficiency_level)
    parts = [
        f"Topic: {topic}",
        f"Context: {normalized_context or 'not provided'}",
        f"Selected scenario: {scenario_description}",
        f"Situation detail: {normalized_context or 'not provided'}",
        f"Length requirement: {length_requirement}",
        _level_instruction(proficiency_level),
        required_words_instruction,
        f"Extra user details (temporary, do not treat as saved context): {normalized_details or 'not provided'}",
        f"Language mapping: use 'source_text' for {source_language_name} and 'target_text' for {target_language_name}.",
        f"Style seed: {style_seed}",
        f"Variation seed: {creativity_seed}",
        "Conversation style: practical, common real-life wording first; add light variation without unusual twists.",
        "If extra user details are provided, they must be clearly reflected in at least two turns.",
        "Variety constraints: avoid overused templates and avoid reusing the same key verb/noun in consecutive turns unless necessary.",
    ]
    return "\n".join(parts)


def _length_requirement(dialog_length: str, proficiency_level: str) -> str:
    if dialog_length == "short_three":
        return "Exactly 3 very short dialogue turns/phrases total."
    if proficiency_level in {"B1", "B2"}:
        return "6 to 12 dialogue turns total. Allow naturally longer turns when the situation benefits from detail or a follow-up."
    return "6 to 12 concise dialogue turns total."


def _level_instruction(proficiency_level: str) -> str:
    if proficiency_level == "B2":
        return (
            "Learner proficiency level: B2. Use natural, nuanced vocabulary and varied sentence structures. "
            "Turns may be multi-sentence when natural. Explore a specific, more complex aspect of the topic, "
            "such as motivations, constraints, trade-offs, opinions, or consequences; do not stay at a surface introduction."
        )
    if proficiency_level == "B1":
        return (
            "Learner proficiency level: B1. Use everyday, varied vocabulary and natural connected sentences. "
            "Turns may be longer than beginner turns when useful. Explore a concrete, less obvious aspect of the topic, "
            "such as a problem to solve, a choice to make, a reason, a preference, or a follow-up plan; do not stay at a surface introduction."
        )
    if proficiency_level == "A1":
        return "Learner proficiency level: A1. Use very basic vocabulary, simple grammar, and short turns."
    return "Learner proficiency level: A2. Use common vocabulary, simple grammar, and mostly short turns."
