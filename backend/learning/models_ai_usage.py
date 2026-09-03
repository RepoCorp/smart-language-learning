from __future__ import annotations

from django.conf import settings
from django.db import models


class UserAIUsageLimit(models.Model):
    """Optional per-user overrides. Zero means use the application default."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_ai_usage_limit",
    )
    is_blocked = models.BooleanField(default=False)
    weekly_generation_credits = models.PositiveIntegerField(default=0)
    weekly_elevenlabs_characters = models.PositiveIntegerField(default=0)
    weekly_elevenlabs_music_seconds = models.PositiveIntegerField(default=0)
    weekly_realtime_minutes = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)


class DailyAIUsage(models.Model):
    class Category(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"
        AUDIO = "audio", "Audio"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_ai_usage",
    )
    date = models.DateField()
    provider = models.CharField(max_length=20)
    feature = models.CharField(max_length=80)
    model = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=10, choices=Category.choices)
    request_count = models.PositiveIntegerField(default=0)
    usage_units = models.PositiveIntegerField(default=0)
    quota_credits = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    failed_request_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "date", "provider", "feature", "model", "category"),
                name="learning_daily_ai_usage_uniq",
            )
        ]
        indexes = [
            models.Index(fields=("user", "date", "category"), name="learning_ai_usage_user_day_idx"),
            models.Index(fields=("date", "provider"), name="lrn_ai_usage_day_provider_idx"),
        ]
