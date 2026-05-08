from __future__ import annotations

from rest_framework import serializers

from .models import STUDY_LANGUAGE_CHOICES, Item


class SessionItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    item_type = serializers.ChoiceField(choices=Item.ItemType.choices)
    spanish_text = serializers.CharField()
    german_text = serializers.CharField()
    example_sentence = serializers.CharField(allow_blank=True, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)
    audio_url = serializers.CharField(allow_blank=True, required=False)
    exercise_phrases = serializers.DictField(required=False)
    mode = serializers.ChoiceField(choices=["new", "review"])
    direction = serializers.ChoiceField(
        choices=Item.ReviewDirection.choices,
        allow_null=True,
        required=False,
    )
    options = serializers.ListField(child=serializers.CharField(), required=False)
    related_dialogs = serializers.ListField(child=serializers.DictField(), required=False)


class SubmitReviewSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    correct = serializers.BooleanField()
    direction = serializers.ChoiceField(choices=Item.ReviewDirection.choices)


class MarkSeenSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()


class ContentTopicSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=120)
    context = serializers.CharField(
        max_length=400,
        required=False,
        allow_blank=True,
    )
    conversation_details = serializers.CharField(
        max_length=600,
        required=False,
        allow_blank=True,
    )
    source_language = serializers.ChoiceField(
        choices=STUDY_LANGUAGE_CHOICES,
        required=False,
        default="spanish",
    )
    target_language = serializers.ChoiceField(
        choices=STUDY_LANGUAGE_CHOICES,
        required=False,
        default="german",
    )

    def validate(self, attrs):
        if attrs.get("source_language") == attrs.get("target_language"):
            raise serializers.ValidationError("source_language and target_language must be different.")
        return attrs


class ContentConfirmSerializer(ContentTopicSerializer):
    create_dialog_audio = serializers.BooleanField(
        required=False,
        default=True,
    )
    dialog_turns = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        allow_empty=True,
    )
    selected_turn_indexes = serializers.ListField(
        child=serializers.IntegerField(min_value=0),
        required=False,
        allow_empty=True,
    )
