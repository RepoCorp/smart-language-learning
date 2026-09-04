from __future__ import annotations

import json
import logging
import re
from math import ceil
from random import choice
from uuid import uuid4

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_SING_LYRIC_PROMPT, STRATEGY_SING_PHRASE_LYRIC_PROMPT
from .audio import _store_audio_bytes
from .audio_music import elevenlabs_music_generation
from .audio_processing import audio_duration_seconds, remove_audio_window, remove_audio_window_before_end
from .generation import WORD_EXERCISE_MODEL
from .management import _call_openai_json_logged, _render_prompt


logger = logging.getLogger(__name__)

MUSIC_STYLES = (
    ("acoustic-pop", "bright acoustic pop with strummed guitar, handclaps, light drums, and warm bass"),
    ("synth-pop", "playful synth-pop with soft electronic drums, bouncy bass, and bright keyboard hooks"),
    ("ukulele", "cheerful ukulele pop with hand percussion, gentle bass, and light claps"),
    ("funk", "light upbeat funk with clean rhythm guitar, a bouncy bassline, and crisp drums"),
    ("marimba", "playful marimba and piano pop with light percussion, soft bass, and a bright groove"),
    ("indie-rock", "bright indie rock with jangly electric guitar, driving bass, and energetic live drums"),
    ("hard-rock", "upbeat hard rock with crunchy electric guitar, punchy bass, and powerful clean drums"),
    ("blues", "upbeat electric blues with expressive guitar riffs, walking bass, and a swinging drum groove"),
    ("jazz", "lively jazz combo with piano, upright bass, brushed drums, and playful brass accents"),
    ("reggae", "sunny reggae with offbeat guitar chops, round bass, light percussion, and a relaxed bounce"),
    ("folk", "warm folk with acoustic guitar, hand percussion, simple bass, and an intimate campfire groove"),
    ("electronic", "bright electronic dance pop with a pulsing synth bass, crisp drum machine, and sparkling arpeggios"),
)
VOWEL_GROUP_PATTERN = re.compile(r"[aeiouyáéíóúàèìòùâêîôûäëïöüøåæœ]+", re.IGNORECASE)
PICKUP_SECONDS = 3
OUTRO_SECONDS = 3


def song_payload(exercise_phrases: dict) -> dict | None:
    value = exercise_phrases.get("sing_song") if isinstance(exercise_phrases, dict) else None
    if not isinstance(value, dict):
        return None
    target = str(value.get("target_text", "")).strip()
    source = str(value.get("source_text", "")).strip()
    if not target or not source:
        return None
    plan = value.get("composition_plan")
    return {
        "song_id": str(value.get("song_id", "")).strip(),
        "target_text": target, "source_text": source,
        "audio_url": str(value.get("audio_url", "")).strip(),
        "image_url": str(value.get("image_url", "")).strip(),
        "duration_seconds": float(value.get("duration_seconds", 0) or 0),
        "loop_duration_seconds": float(value.get("loop_duration_seconds", 0) or 0),
        "style_key": str(value.get("style_key", "")).strip(),
        "composition_plan": plan if isinstance(plan, dict) else None,
        "lyrics_locked": bool(value.get("lyrics_locked", False)),
        "lyric_focus": str(value.get("lyric_focus", "")).strip(),
    }


def generate_lyric(item: Item, source_language: str, target_language: str, previous: dict | None) -> dict | None:
    if item.item_type == Item.ItemType.PHRASE and _sentence_count(item.german_text) > 2:
        logger.info("content.sing.lyric_uses_study_phrase item_id=%s", item.id)
        return {
            "target_text": item.german_text,
            "source_text": item.spanish_text,
            "audio_url": "",
            "lyrics_locked": True,
            "lyric_focus": "study_phrase",
        }
    lyric_focus = _next_lyric_focus(previous)
    previous_instruction = (
        f"\nPrevious lyric: {previous['target_text']}\nCreate a noticeably different lyric. "
        "Do not reuse the same wording or rhythm." if previous else ""
    )
    focus_instruction = (
        "Create a playful memory lyric. Include one gentle, believable comic twist, while keeping the "
        "supporting vocabulary simple." if lyric_focus == "funny" else
        "Create an A2 clarity lyric. Prioritize very common A1-A2 vocabulary, a straightforward everyday "
        "scene, and the clearest possible meaning. Do not force humor or an unusual situation."
    )
    result = _call_openai_json_logged(
        label="content_item_sing_lyric",
        system_prompt=_render_prompt(
            STRATEGY_SING_PHRASE_LYRIC_PROMPT if item.item_type == Item.ItemType.PHRASE else STRATEGY_SING_LYRIC_PROMPT,
            source_name=language_display_name(source_language), target_name=language_display_name(target_language),
            source_text=item.spanish_text, target_text=item.german_text, word_type=item.word_type or "", notes=item.notes or "",
        ),
        user_input=(f"Target word: {item.german_text}\nMeaning: {item.spanish_text}\n"
                    f"Creative direction: {focus_instruction}{previous_instruction}"),
        timeout_seconds=12, model=WORD_EXERCISE_MODEL, temperature=1.0, top_p=1.0,
    )
    if not isinstance(result, dict):
        return None
    target = str(result.get("target", "")).strip()
    source = str(result.get("source", "")).strip()
    return {
        "target_text": target, "source_text": source, "audio_url": "", "lyric_focus": lyric_focus,
    } if target and source else None


def _next_lyric_focus(previous: dict | None) -> str:
    return "a2_clarity" if previous and previous.get("lyric_focus") == "funny" else "funny"


def create_audio(item: Item, lyric: dict, target_language: str, generation_id: str, previous_style_key: str = "") -> dict | None:
    lyric_seconds = _lyric_duration(lyric["target_text"])
    total_seconds = PICKUP_SECONDS + lyric_seconds + OUTRO_SECONDS
    style_key, style = _select_style(previous_style_key)
    base_styles = ["120 BPM", "C major key", style, "steady repetitive groove", "warm organic production"]
    plan = {"chunks": [
        _chunk("[Instrumental pickup]", PICKUP_SECONDS, [*base_styles, "instrumental pickup"], ["fade-in", "fade-out", "silence", "ending cadence"]),
        _chunk(f"[Verse]\n{lyric['target_text']}", lyric_seconds, [*base_styles, "clear neutral lead vocals", "gentle conversational vocals", "continuous vocals across the verse", "full vocal energy through the final lyric"], ["instrumental-only section", "instrumental breaks between lyric phrases", "vocal fade before or during the final lyric", "fade-out", "silence", "ending cadence"]),
        _chunk("[Instrumental continuation]", OUTRO_SECONDS, [*base_styles, "steady instrumental continuation after vocals"], ["fade-out", "silence", "ending cadence"]),
    ]}
    context = f"sing:{generation_id}:item:{item.id}"
    logger.info("content.sing.final_plan context=%s plan=%s", context, json.dumps(plan, ensure_ascii=False))
    result = elevenlabs_music_generation(composition_plan=plan, quota_seconds=total_seconds, log_context=context)
    return _save_audio(lyric, result.audio_bytes, plan, style_key, total_seconds, context) if result else None


def retry_audio(item: Item, song: dict, generation_id: str) -> dict | None:
    plan = song.get("composition_plan")
    total_seconds = _plan_duration(plan)
    if not isinstance(plan, dict) or not total_seconds:
        return None
    context = f"sing:{generation_id}:item:{item.id}:retry"
    result = elevenlabs_music_generation(composition_plan=plan, quota_seconds=total_seconds, log_context=context)
    return _save_audio(song, result.audio_bytes, plan, song.get("style_key", ""), total_seconds, context) if result else None


def _lyric_duration(lyric: str) -> int:
    syllables = sum(max(1, len(VOWEL_GROUP_PATTERN.findall(word))) for word in re.findall(r"[^\W\d_]+", lyric, flags=re.UNICODE))
    return min(10, ceil(max(5, min(10, ceil(syllables / 3 + 0.5))) / 2) * 2)


def _sentence_count(text: str) -> int:
    return sum(1 for part in re.split(r"[.!?]+", text) if part.strip())


def _select_style(previous: str) -> tuple[str, str]:
    candidates = [style for style in MUSIC_STYLES if style[0] != previous]
    return choice(candidates or list(MUSIC_STYLES))


def _plan_duration(plan: dict | None) -> int:
    chunks = plan.get("chunks") if isinstance(plan, dict) else None
    milliseconds = sum(chunk.get("duration_ms", 0) for chunk in chunks if isinstance(chunk, dict)) if isinstance(chunks, list) else 0
    try:
        return max(3, min(600, ceil(float(milliseconds) / 1000)))
    except (TypeError, ValueError):
        return 0


def _chunk(text: str, seconds: int, positive: list[str], negative: list[str]) -> dict:
    return {"text": text, "duration_ms": seconds * 1000, "positive_styles": positive, "negative_styles": negative, "context_adherence": "high", "conditioning_ref": None, "condition_strength": None}


def _save_audio(song: dict, audio: bytes, plan: dict, style_key: str, planned_seconds: int, context: str) -> dict | None:
    audio = remove_audio_window(audio, 1, 2)
    audio = remove_audio_window_before_end(audio, 1, 2)
    url = _store_audio_bytes(f"sing-{uuid4().hex[:12]}.mp3", audio, "audio/mpeg")
    if not url:
        return None
    duration = audio_duration_seconds(audio) or 0
    logger.info("content.sing.saved context=%s audio_url=%s measured_duration_seconds=%s", context, url, duration)
    return {
        **song,
        "song_id": uuid4().hex,
        "audio_url": url,
        "style_key": style_key,
        "duration_seconds": duration,
        "loop_duration_seconds": duration or planned_seconds,
        "composition_plan": plan,
    }
