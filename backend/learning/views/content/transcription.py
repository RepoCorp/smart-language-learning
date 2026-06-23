from __future__ import annotations

import json
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings


def openai_transcribe_audio_upload(uploaded_file, *, target_language: str) -> str:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return ""

    try:
        file_bytes = uploaded_file.read()
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
    except Exception:
        return ""
    if not file_bytes:
        return ""

    model_name = str(getattr(settings, "OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe")).strip() or "gpt-4o-mini-transcribe"
    content_type = str(getattr(uploaded_file, "content_type", "")).strip() or "application/octet-stream"
    content_type_main = content_type.split(";", 1)[0].strip().lower()
    extension_by_content_type = {
        "audio/webm": ".webm",
        "audio/mp4": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/m4a": ".m4a",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/ogg": ".ogg",
    }
    extension = extension_by_content_type.get(content_type_main, ".webm")
    raw_filename = str(getattr(uploaded_file, "name", "")).strip()
    if raw_filename:
        filename = raw_filename
        if "." not in filename:
            filename = f"{filename}{extension}"
    else:
        filename = f"speech-{uuid4().hex[:8]}{extension}"
    language_hint = {
        "spanish": "es",
        "english": "en",
        "german": "de",
        "french": "fr",
        "italian": "it",
        "portuguese": "pt",
    }.get(target_language, "")

    boundary = f"----smartlang-{uuid4().hex}"
    body = bytearray()

    def append_field(name: str, value: str) -> None:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")

    append_field("model", model_name)
    if language_hint:
        append_field("language", language_hint)
    append_field(
        "prompt",
        (
            "Transcribe exactly what the speaker says in the original spoken language. "
            "Do not correct grammar, wording, or mistakes. Keep the utterance as spoken."
        ),
    )
    append_field("temperature", "0")
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    request = UrlRequest(
        "https://api.openai.com/v1/audio/transcriptions",
        data=bytes(body),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    timeout_seconds = int(getattr(settings, "OPENAI_REQUEST_TIMEOUT_SECONDS", 30))
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return ""
    return str(payload.get("text", "")).strip()[:1000]
