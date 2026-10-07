from dataclasses import dataclass
from typing import Mapping

from ..definition import LearningDefinition


@dataclass(frozen=True, kw_only=True)
class PhraseDefinition(LearningDefinition):
    text: str
    translations: Mapping[str, str]
