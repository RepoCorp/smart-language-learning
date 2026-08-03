from learning.views.content.conversation_goal_phase import conversation_phase_instruction


def test_active_goal_phase_gently_keeps_the_conversation_going():
    instruction = conversation_phase_instruction("active")

    assert "at most one relevant, open follow-up question" in instruction
    assert "clear goodbye" in instruction
    assert "reveal the goal" in instruction


def test_closing_goal_phase_does_not_start_a_new_topic():
    instruction = conversation_phase_instruction("closing")

    assert "Do not introduce a new subtopic" in instruction
    assert "Only say goodbye after the learner clearly says goodbye" in instruction
