from dataclasses import dataclass
from typing import Literal, Mapping

from ..definition import LearningDefinition


@dataclass(frozen=True, kw_only=True)
class WordDefinition(LearningDefinition):
    text: str
    translations: Mapping[str, str]
    word_type: str
    gender: Literal["masculine", "feminine", "neuter"] | None
