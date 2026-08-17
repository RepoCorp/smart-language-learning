from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

_current_user: ContextVar[object | None] = ContextVar("learning_ai_usage_user", default=None)
_current_feature: ContextVar[str] = ContextVar("learning_ai_usage_feature", default="")


def current_ai_usage_user():
    return _current_user.get()


def current_ai_usage_feature(default: str) -> str:
    return _current_feature.get().strip() or default


@contextmanager
def ai_usage_request_context(user) -> Iterator[None]:
    token = _current_user.set(user)
    try:
        yield
    finally:
        _current_user.reset(token)


@contextmanager
def ai_usage_feature(feature: str) -> Iterator[None]:
    token = _current_feature.set(feature)
    try:
        yield
    finally:
        _current_feature.reset(token)
