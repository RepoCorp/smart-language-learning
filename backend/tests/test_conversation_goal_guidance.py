from types import SimpleNamespace
from unittest.mock import Mock

from django.test import override_settings

from learning.views.content import management_topic_conversation_turn_processing as turns
from learning.views.content.management_topic_conversation_goal import ContentTopicConversationGoalEvaluationView
from learning.views.content import topic_conversation_goals as goals


def test_retired_evaluation_endpoint_never_calls_a_model(monkeypatch):
    model = Mock(side_effect=AssertionError("No goal model request is allowed"))
    monkeypatch.setattr(goals, "call_openai_json_logged", model)
    request = SimpleNamespace(data={}, query_params={})

    response = ContentTopicConversationGoalEvaluationView().post(request)

    assert response.status_code == 410
    model.assert_not_called()


@override_settings(DEV_CONVERSATION_ENABLE_GOAL_EVALUATION=True)
def test_natural_voice_turn_does_not_evaluate_even_with_legacy_flag(monkeypatch):
    model = Mock(side_effect=AssertionError("No goal model request is allowed"))
    monkeypatch.setattr(goals, "call_openai_json_logged", model)
    monkeypatch.setattr(turns, "_normalized_pair", lambda request: ("spanish", "german"))
    monkeypatch.setattr(turns, "_parse_item_conversation_history", lambda history: [])
    monkeypatch.setattr(turns, "analysis_enabled", lambda: False)
    monkeypatch.setattr(turns, "conversation_audio_enabled", lambda: True)
    monkeypatch.setattr(turns, "conversation_inline_audio_enabled", lambda: True)
    monkeypatch.setattr(turns, "_openai_transcribe_audio_upload", lambda *a, **kw: "Ich kaufe Brot.")
    reply = Mock(return_value={"reply_text": "Gern!", "source_translation": "Claro!"})
    monkeypatch.setattr(turns, "generate_topic_conversation_reply_with_question_model", reply)
    monkeypatch.setattr(turns, "_conversation_assistant_voice_id", lambda **kw: "voice-id")
    audio = Mock(return_value="data:audio/mpeg;base64,test")
    monkeypatch.setattr(turns, "create_audio_data_url", audio)
    request = SimpleNamespace(
        data={"topic": "Shopping", "goal_text": "Compra pan", "skip_goal_evaluation": "false"},
        FILES={"audio": SimpleNamespace(name="audio.webm", size=10, content_type="audio/webm")},
    )

    response = turns.ContentTopicConversationTurnView().post(request)

    assert response.status_code == 200
    assert response.data["assistant_text"] == "Gern!"
    assert response.data["assistant_audio_url"] == "data:audio/mpeg;base64,test"
    assert "goal_achieved" not in response.data
    assert "Do not evaluate or announce goal achievement" in reply.call_args.kwargs["notes"]
    model.assert_not_called()
    reply.assert_called_once()
    audio.assert_called_once()
