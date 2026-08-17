from __future__ import annotations

import secrets

from django.conf import settings
from django.db import models


def _generate_auth_token_key() -> str:
    return secrets.token_urlsafe(32)


class UserAuthToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_auth_tokens",
    )
    key = models.CharField(max_length=128, unique=True, default=_generate_auth_token_key)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return f"Token for user {self.user_id}"


class PinSetupToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_pin_setup_tokens",
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")


class UserOnboarding(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_onboarding",
    )
    getting_started_seen_at = models.DateTimeField(null=True, blank=True)


class RegistrationRequest(models.Model):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return f"Registration request: {self.username}"


class DisabledElevenLabsVoice(models.Model):
    voice_id = models.CharField(max_length=120, unique=True)
    voice_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("voice_name", "voice_id")

    def __str__(self) -> str:
        return self.voice_name or self.voice_id
