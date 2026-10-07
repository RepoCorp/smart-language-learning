from dataclasses import dataclass
from typing import Literal, Mapping, TypedDict


ReviewDirection = Literal["source_to_target", "target_to_source"]


class DisplayText(TypedDict):
    title: str
    explanation: str


@dataclass(frozen=True, kw_only=True)
class LearningDefinition:
    key: str
    language: str
    display: Mapping[str, DisplayText]
    item_view: str
    strategies: tuple[str, ...]
    exercises: tuple[str, ...]
    evaluations: Mapping[ReviewDirection, str]
