import pytest
from django.contrib.auth import get_user_model

from learning.ai_usage import AIUsageLimitExceeded, record_realtime_active_seconds, reserve_ai_usage
from learning.ai_usage_context import ai_usage_request_context
from learning.models import UserAIUsageLimit


@pytest.mark.django_db
def test_elevenlabs_uses_its_own_weekly_character_limit(settings):
    settings.AI_USAGE_WEEKLY_GENERATION_CREDITS = 1
    settings.AI_USAGE_WEEKLY_ELEVENLABS_CHARACTERS = 10
    user = get_user_model().objects.create_user(username="audio-user", password="pin")

    with ai_usage_request_context(user):
        reserve_ai_usage(provider="elevenlabs", category="audio", units=10, model="eleven_multilingual_v2", feature="audio")
        with pytest.raises(AIUsageLimitExceeded, match="ElevenLabs character limit"):
            reserve_ai_usage(provider="elevenlabs", category="audio", units=1, model="eleven_multilingual_v2", feature="audio")


@pytest.mark.django_db
def test_elevenlabs_usage_does_not_consume_openai_generation_credits(settings):
    settings.AI_USAGE_WEEKLY_GENERATION_CREDITS = 1
    settings.AI_USAGE_WEEKLY_ELEVENLABS_CHARACTERS = 100
    user = get_user_model().objects.create_user(username="separate-user", password="pin")
    UserAIUsageLimit.objects.create(user=user)

    with ai_usage_request_context(user):
        reserve_ai_usage(provider="elevenlabs", category="audio", units=25, model="eleven_multilingual_v2", feature="audio")
        reserve_ai_usage(provider="openai", category="text", units=1, model="gpt-5.6-sol", feature="content")
        with pytest.raises(AIUsageLimitExceeded, match="weekly AI usage limit"):
            reserve_ai_usage(provider="openai", category="text", units=1, model="gpt-5.6-sol", feature="content")


@pytest.mark.django_db
def test_superusers_are_exempt_from_numeric_quotas_but_usage_is_recorded(settings):
    settings.AI_USAGE_WEEKLY_GENERATION_CREDITS = 1
    settings.AI_USAGE_WEEKLY_ELEVENLABS_CHARACTERS = 1
    user = get_user_model().objects.create_superuser(username="developer", password="pin", email="developer@example.com")

    with ai_usage_request_context(user):
        reserve_ai_usage(provider="openai", category="text", units=1, model="gpt-5.6-sol", feature="content")
        reserve_ai_usage(provider="openai", category="text", units=1, model="gpt-5.6-sol", feature="content")
        reserve_ai_usage(provider="elevenlabs", category="audio", units=2, model="eleven_multilingual_v2", feature="audio")

    assert record_realtime_active_seconds(user=user, active_seconds=3600) == 3600
