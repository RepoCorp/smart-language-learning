from __future__ import annotations

import secrets
from collections.abc import Callable, Sequence


MOVEMENTS = (
    "Walk like a penguin.", "Walk like a robot.", "Walk like a giant.", "Walk like a tiny mouse.",
    "Walk like you're sneaking.", "Hop on one foot.", "Walk on tiptoes.", "March like a soldier.",
    "Take giant steps.", "Take tiny baby steps.", "Swing your arms dramatically.",
    "Keep your elbows glued to your body.", "Raise one hand while walking.",
    "Walk with your hands behind your back.", "Walk as slowly as possible.", "Walk quickly for five steps.",
    "Shake your head while walking.", "Nod repeatedly while walking.", "Clap once before speaking.",
    "Spin around once before speaking.", "Walk as if the floor is sticky.",
    "Walk as if you're carrying a very heavy backpack.", "Walk with exaggerated confidence.",
    "Walk as if you're trying not to wake anyone.",
)

VOICES = (
    "Whisper the sentence.", "Say the sentence like a robot.", "Say the sentence like a pirate.",
    "Say the sentence like a movie trailer narrator.", "Say the sentence like a tiny child.",
    "Say the sentence like a very old person.", "Stretch every vowel.", "Emphasize the target word.",
    "Say every word very slowly.", "Say the sentence as fast as you comfortably can.",
    "Say it as if you're telling a huge secret.", "Say it as if you're announcing the winner of a competition.",
    "Say it as if you're explaining something to a five-year-old.", "Say it as if you're talking to an alien.",
    "Say it as if you're giving an important speech.", "Say it as if you're speaking on the phone.",
    "Say it as if you're recording a documentary.", "Say it while laughing.", "Say it as if you're shocked.",
    "Say it as if you're incredibly proud.",
)

IMAGINATIONS = (
    "Pretend you're on the Moon.", "Pretend gravity is twice as strong.", "Pretend you're underwater.",
    "Pretend you're invisible.", "Pretend you're a superhero.", "Pretend you're a secret agent.",
    "Pretend you're a detective solving a mystery.", "Pretend you're escaping from a dinosaur.",
    "Pretend you're walking through a castle.", "Pretend you're walking on clouds.", "Pretend you're walking on hot lava.",
    "Pretend you're walking through deep snow.", "Pretend you're a famous actor in a movie.",
    "Pretend you're inside a video game.", "Pretend you're walking through outer space.",
    "Pretend you're a wizard casting a spell.", "Pretend you're a king or queen.",
    "Pretend you're a circus performer.", "Pretend you're a clumsy zombie.",
    "Pretend you're an old robot running out of batteries.",
)


def generate_walk_challenge(
    *,
    choice: Callable[[Sequence[str]], str] = secrets.choice,
    movements: Sequence[str] = MOVEMENTS,
    voices: Sequence[str] = VOICES,
    imaginations: Sequence[str] = IMAGINATIONS,
) -> str | None:
    """Build one safe, memorable Walk challenge without model generation."""
    if not movements or not (voices or imaginations):
        return None

    movement = choice(movements)
    available_categories = tuple(category for category in ("voice", "imagination") if (voices if category == "voice" else imaginations))
    category = choice(available_categories)
    companion = choice(voices if category == "voice" else imaginations)
    return f"{movement} {companion}"
