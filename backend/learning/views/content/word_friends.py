from __future__ import annotations

from dataclasses import dataclass

LEADING_ARTICLES = {
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
}


COMMON_WORD_FRIEND_DESCRIPTION = (
    "All Word Friends are drawn in a cute cartoon style, "
    "have large expressive eyes, "
    "are outlined with a thick purple border, "
    "and have a visible purple halo around them."
)


@dataclass(frozen=True)
class WordFriend:
    prefix: str
    name: str
    character_description: str


WORD_FRIENDS: tuple[WordFriend, ...] = (
    WordFriend(
        prefix="be",
        name="Bebo",
        character_description=(
            "A cheerful one-year-old baby with a small tuft of blond hair, "
            "big blue eyes, rosy cheeks, and a joyful smile. "
            "Bebo wears blue overalls over a yellow shirt and is always full of curiosity."
        ),
    ),
    WordFriend(
        prefix="ver",
        name="Lupi",
        character_description=(
            "A friendly magnifying glass with a shiny silver frame, "
            "a slightly blue-tinted lens, large expressive blue eyes, and a warm smile. "
            "Lupi looks curious and intelligent."
        ),
    ),
    WordFriend(
        prefix="ent",
        name="Enti",
        character_description=(
            "A welcoming wooden entrance door with a brass doorknob, "
            "large expressive brown eyes, and a friendly smile. "
            "The door is slightly open as if inviting someone to come in."
        ),
    ),
    WordFriend(
        prefix="eri",
        name="Eri",
        character_description=(
            "A cute little hedgehog with soft brown spines, a cream-colored face and belly, "
            "big expressive black eyes, tiny paws, and a happy smile."
        ),
    ),
    WordFriend(
        prefix="ge",
        name="Gemi",
        character_description=(
            "A bright emerald-green gemstone with sparkling facets, "
            "large expressive eyes, and a friendly smile. "
            "Gemi emits a soft magical glow."
        ),
    ),
)


def find_word_friend(target_text: str) -> WordFriend | None:
    normalized = str(target_text or "").strip().casefold()
    parts = normalized.split()
    if len(parts) > 1 and parts[0] in LEADING_ARTICLES:
        normalized = parts[1]
    for friend in WORD_FRIENDS:
        if normalized.startswith(friend.prefix.casefold()):
            return friend
    return None


def build_word_friend_prompt_notes(target_text: str) -> str:
    friend = find_word_friend(target_text)
    if friend is None:
        return ""
    return (
        f"Word Friend for this word:\n"
        f"- Include {friend.name} in the scene because the target word starts with '{friend.prefix}'.\n"
        f"- {friend.character_description}\n"
        f"- {COMMON_WORD_FRIEND_DESCRIPTION}"
    )
