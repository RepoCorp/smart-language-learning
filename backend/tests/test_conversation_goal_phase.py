from learning.views.content.conversation_goal_phase import conversation_phase_instruction


def test_active_phase_uses_goal_as_guidance_and_accepts_natural_endings():
    instruction = conversation_phase_instruction("active")

    assert "Ask at most one relevant follow-up question" in instruction
    assert "Accept a clear goodbye or request to end" in instruction
    assert "Do not evaluate or announce goal achievement" in instruction
    assert "has not achieved" not in instruction


def test_closing_goal_phase_does_not_start_a_new_topic():
    instruction = conversation_phase_instruction("closing")

    assert "has already achieved" not in instruction
    assert "Do not introduce a new subtopic" in instruction
    assert "Only say goodbye after the learner clearly says goodbye" in instruction
