from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys


MODULE_PATH = Path(__file__).resolve().parents[1] / "learning" / "views" / "content" / "word_friends.py"
SPEC = spec_from_file_location("word_friends_module", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

COMMON_WORD_FRIEND_DESCRIPTION = MODULE.COMMON_WORD_FRIEND_DESCRIPTION
WORD_FRIENDS = MODULE.WORD_FRIENDS
build_word_friend_prompt_notes = MODULE.build_word_friend_prompt_notes
find_word_friend = MODULE.find_word_friend


def test_find_word_friend_matches_longer_prefix_first():
    friend = find_word_friend("verstehen")

    assert friend is not None
    assert friend.name == "Lupi"
    assert friend.prefix == "ver"


def test_find_word_friend_is_case_insensitive():
    friend = find_word_friend("EriNNERN")

    assert friend is not None
    assert friend.name == "Eri"


def test_find_word_friend_ignores_leading_article():
    friend = find_word_friend("das Bett")

    assert friend is not None
    assert friend.name == "Bebo"
    assert friend.prefix == "be"


def test_find_word_friend_returns_none_when_no_prefix_matches():
    assert find_word_friend("hund") is None


def test_word_friends_registry_has_shared_style_description():
    assert "cute cartoon style" in COMMON_WORD_FRIEND_DESCRIPTION
    assert "thick purple border" in COMMON_WORD_FRIEND_DESCRIPTION
    assert len(WORD_FRIENDS) == 5


def test_build_word_friend_prompt_notes_only_returns_text_for_matching_prefix():
    matching_notes = build_word_friend_prompt_notes("verstehen")
    article_notes = build_word_friend_prompt_notes("das Bett")
    missing_notes = build_word_friend_prompt_notes("hund")

    assert "Lupi" in matching_notes
    assert "starts with 'ver'" in matching_notes
    assert "thick purple border" in matching_notes
    assert "Bebo" in article_notes
    assert missing_notes == ""
