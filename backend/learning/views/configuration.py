from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..languages import language_display_name
from ..models import DisabledElevenLabsVoice
from .content.audio import configured_elevenlabs_voice_ids, create_elevenlabs_audio_file, fetch_elevenlabs_voices

ELEVENLABS_PREVIEW_TEXT_BY_LANGUAGE = {
    "spanish": "Hola. Esta es una prueba de voz.",
    "english": "Hello. This is a voice preview.",
    "german": "Hallo. Das ist eine Stimmprobe.",
    "french": "Bonjour. Ceci est un apercu de la voix.",
    "italian": "Ciao. Questa e una prova della voce.",
    "portuguese": "Ola. Esta e uma demonstracao de voz.",
}


def _require_admin(request: Request):
    user = get_request_user(request)
    if user is None or not user.is_superuser:
        return None
    return user


def _voice_payload(voice: dict[str, object], disabled_voice_ids: set[str]) -> dict[str, object]:
    voice_id = str(voice.get("voice_id", "")).strip()
    labels = voice.get("labels")
    category = str(voice.get("category", "")).strip()
    return {
        "voice_id": voice_id,
        "name": str(voice.get("name", "")).strip() or voice_id,
        "category": category,
        "description": str(voice.get("description", "")).strip(),
        "preview_url": str(voice.get("preview_url", "")).strip(),
        "labels": labels if isinstance(labels, dict) else {},
        "disabled": voice_id in disabled_voice_ids,
    }


class ElevenLabsVoicesView(APIView):
    def get(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        target_language = str(request.query_params.get("target_language", "german")).strip().lower() or "german"
        disabled_voice_ids = set(DisabledElevenLabsVoice.objects.values_list("voice_id", flat=True))
        fetched_voices = fetch_elevenlabs_voices()
        voices = [
            _voice_payload(voice, disabled_voice_ids)
            for voice in fetched_voices
            if str(voice.get("voice_id", "")).strip()
        ]
        if not voices:
            voices = [
                {
                    "voice_id": voice_id,
                    "name": voice_id,
                    "category": "configured",
                    "description": "",
                    "preview_url": "",
                    "labels": {},
                    "disabled": voice_id in disabled_voice_ids,
                }
                for voice_id in configured_elevenlabs_voice_ids(target_language)
            ]
        voices.sort(key=lambda voice: (voice["disabled"], str(voice["name"]).lower(), str(voice["voice_id"]).lower()))
        return Response(
            {
                "voices": voices,
                "target_language": target_language,
                "target_language_label": language_display_name(target_language),
                "preview_text": ELEVENLABS_PREVIEW_TEXT_BY_LANGUAGE.get(target_language, ELEVENLABS_PREVIEW_TEXT_BY_LANGUAGE["german"]),
            }
        )


class ElevenLabsVoiceDisableView(APIView):
    def post(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        voice_id = str(request.data.get("voice_id", "")).strip()
        voice_name = str(request.data.get("voice_name", "")).strip()
        disabled = bool(request.data.get("disabled"))
        if not voice_id:
            return Response({"detail": "voice_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        if disabled:
            disabled_voice, created = DisabledElevenLabsVoice.objects.get_or_create(
                voice_id=voice_id,
                defaults={"voice_name": voice_name},
            )
            if not created and voice_name and disabled_voice.voice_name != voice_name:
                disabled_voice.voice_name = voice_name
                disabled_voice.save(update_fields=["voice_name", "updated_at"])
        else:
            DisabledElevenLabsVoice.objects.filter(voice_id=voice_id).delete()

        return Response({"ok": True, "voice_id": voice_id, "disabled": disabled})


class ElevenLabsVoicePreviewView(APIView):
    def post(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        voice_id = str(request.data.get("voice_id", "")).strip()
        target_language = str(request.data.get("target_language", "german")).strip().lower() or "german"
        text = str(request.data.get("text", "")).strip() or ELEVENLABS_PREVIEW_TEXT_BY_LANGUAGE.get(
            target_language,
            ELEVENLABS_PREVIEW_TEXT_BY_LANGUAGE["german"],
        )
        if not voice_id:
            return Response({"detail": "voice_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        audio_url = create_elevenlabs_audio_file(
            text=text,
            prefix="elevenlabs-preview",
            target_language=target_language,
            voice_id=voice_id,
        )
        if not audio_url:
            return Response({"detail": "Failed to generate preview audio"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"audio_url": audio_url, "voice_id": voice_id, "text": text})
