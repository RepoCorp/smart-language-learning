from __future__ import annotations

from dataclasses import dataclass

from .word_friends import build_word_friend_prompt_notes


@dataclass(frozen=True)
class VisualizeImagePromptContext:
    notes: str
    word_friend_requirement_block: str
    word_friend_guideline_block: str
    image_generation_cue: str


def build_visualize_image_prompt_context(
    *,
    target_text: str,
    target_language: str,
    word_type: str,
    notes: str,
) -> VisualizeImagePromptContext:
    word_friend_notes = build_word_friend_prompt_notes(target_text)
    combined_notes = str(notes or "").strip()
    if word_friend_notes:
        combined_notes = f"{combined_notes}\n\n{word_friend_notes}".strip()

    gender_cue = _german_noun_gender_cue(
        target_text=target_text,
        target_language=target_language,
        word_type=word_type,
    )
    return VisualizeImagePromptContext(
        notes=combined_notes,
        word_friend_requirement_block=(
            "\nIf a Word Friend is provided in the additional notes, it MUST appear in the scene.\n"
            if word_friend_notes
            else "\n"
        ),
        word_friend_guideline_block=(
            "- The Word Friend should blend naturally into the scene."
            if word_friend_notes
            else ""
        ),
        image_generation_cue=gender_cue,
    )


def add_visual_memory_cue(image_prompt: str, context: VisualizeImagePromptContext) -> str:
    if not context.image_generation_cue:
        return image_prompt.strip()
    return f"{image_prompt.strip()}\n\n{context.image_generation_cue}".strip()


def merge_visualize_phrase(
    *,
    exercise_phrases: dict,
    source_text: str,
    target_text: str,
    image_prompt: str = "",
    image_url: str = "",
) -> dict:
    payload = dict(exercise_phrases or {})
    payload["visualize_phrase"] = {
        "label": "visualize",
        "source_text": source_text[:400],
        "target_text": target_text[:400],
        "image_prompt": image_prompt[:4000],
        "image_url": image_url,
    }
    return payload


def _german_noun_gender_cue(*, target_text: str, target_language: str, word_type: str) -> str:
    if target_language != "german" or str(word_type or "").strip().lower() != "noun":
        return ""

    target_parts = str(target_text or "").strip().split(maxsplit=1)
    article = target_parts[0].casefold() if target_parts else ""
    gender_by_article = {
        "der": ("masculine", "soft blue"),
        "die": ("feminine", "soft pink"),
        "das": ("neuter", "warm yellow"),
    }
    gender = gender_by_article.get(article)
    if gender is None:
        return ""

    gender_name, color = gender
    return (
        f"Gender memory cue: This German noun has {gender_name} gender. "
        f"Place a clearly visible but subtle {color} oval spotlight or halo behind or beneath "
        "the main object representing the target word. This is a visual memory cue, not the literal "
        "color of the object. Do not add written words, articles, letters, or labels. "
        "If a Word Friend is present, keep its purple outline and halo; the gender cue belongs to the target object."
    )
