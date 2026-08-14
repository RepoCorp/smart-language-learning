import json


def test_call_openai_json_requests_json_mode(settings):
    from learning.views.content.openai_json import call_openai_json

    settings.OPENAI_API_KEY = "test-key"
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return b'{"choices":[{"message":{"content":"{\\"ok\\": true}"}}]}'

    def fake_urlopen(request, timeout=0):
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return FakeResponse()

    parsed = call_openai_json("system", "user", json_mode=True, urlopen_fn=fake_urlopen)

    assert parsed == {"ok": True}
    assert captured["body"]["response_format"] == {"type": "json_object"}
