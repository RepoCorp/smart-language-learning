from learning.views.content.realtime_conversation_instructions import build_realtime_conversation_instructions


def test_realtime_instructions_allow_explicit_closing_without_claiming_goal_completion():
    prompt = build_realtime_conversation_instructions(
        topic="Shopping", notes="", role_text="Customer", goal_text="Buy bread",
        source_language="spanish", target_language="german",
    )
    assert "finish_conversation" in prompt
    assert "before speaking the final goodbye" in prompt
    assert "Ending never implies that the goal was achieved" in prompt
    assert "Do not end or close the session on your own" not in prompt
    assert "Do not evaluate or announce goal achievement" in prompt
    assert "Accept a clear goodbye or request to end" in prompt
    assert "invite the learner to say the same thing in German" in prompt
