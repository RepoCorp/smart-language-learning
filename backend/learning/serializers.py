from __future__ import annotations

from rest_framework import serializers

from .models import Item


class SessionItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    item_type = serializers.ChoiceField(choices=Item.ItemType.choices)
    spanish_text = serializers.CharField()
    german_text = serializers.CharField()
    example_sentence = serializers.CharField(allow_blank=True, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)
    audio_url = serializers.CharField(allow_blank=True, required=False)
    mode = serializers.ChoiceField(choices=["new", "review"])
    direction = serializers.ChoiceField(
        choices=Item.ReviewDirection.choices,
        allow_null=True,
        required=False,
    )
    options = serializers.ListField(child=serializers.CharField(), required=False)


class SubmitReviewSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    correct = serializers.BooleanField()
    direction = serializers.ChoiceField(choices=Item.ReviewDirection.choices)


class MarkSeenSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
