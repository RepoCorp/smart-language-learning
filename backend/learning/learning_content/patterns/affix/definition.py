from dataclasses import dataclass
from typing import Literal, Mapping, TypedDict

from ...definition import LearningDefinition


class AffixExampleTranslation(TypedDict):
    base: str
    result: str


@dataclass(frozen=True, kw_only=True)
class AffixExample:
    base: str
    result: str
    translations: Mapping[str, AffixExampleTranslation]


@dataclass(frozen=True, kw_only=True)
class AffixPatternDefinition(LearningDefinition):
    affix: str
    position: Literal["prefix", "suffix"]
    word_types: tuple[str, ...]
    examples: tuple[AffixExample, ...]
