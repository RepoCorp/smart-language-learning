from __future__ import annotations

from rest_framework import serializers

from .models import STUDY_LANGUAGE_CHOICES, Item


class SessionRestoreStateSerializer(serializers.Serializer):
    repetition_count_es_to_de = serializers.IntegerField(min_value=0)
    interval_days_es_to_de = serializers.IntegerField(min_value=0)
    last_reviewed_at_es_to_de = serializers.DateTimeField(allow_null=True)
    due_at_es_to_de = serializers.DateTimeField(allow_null=True)
    repetition_count_de_to_es = serializers.IntegerField(min_value=0)
    interval_days_de_to_es = serializers.IntegerField(min_value=0)
    last_reviewed_at_de_to_es = serializers.DateTimeField(allow_null=True)
    due_at_de_to_es = serializers.DateTimeField(allow_null=True)
    is_learned = serializers.BooleanField()
    is_difficult = serializers.BooleanField()
    difficult_marked_at = serializers.DateTimeField(allow_null=True)


class SessionItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    item_type = serializers.ChoiceField(choices=Item.ItemType.choices)
    spanish_text = serializers.CharField()
    german_text = serializers.CharField()
    example_sentence = serializers.CharField(allow_blank=True, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)
    word_type = serializers.CharField(allow_blank=True, required=False)
    audio_url = serializers.CharField(allow_blank=True, required=False)
    exercise_phrases = serializers.DictField(required=False)
    mode = serializers.ChoiceField(choices=["new", "review"])
    direction = serializers.ChoiceField(
        choices=Item.ReviewDirection.choices,
        allow_null=True,
        required=False,
    )
    repeatedAfterFailure = serializers.BooleanField(required=False)
    repeatPracticeStep = serializers.ChoiceField(
        choices=["word_intro", "word_cloze", "phrase_builder"],
        required=False,
        allow_null=True,
    )
    options = serializers.ListField(child=serializers.CharField(), required=False)
    option_items = serializers.ListField(child=serializers.DictField(), required=False)
    dialog_phrase_answer = serializers.CharField(allow_blank=True, required=False)
    dialog_phrase_scene = serializers.CharField(allow_blank=True, required=False)
    dialog_phrase_scene_audio_urls = serializers.ListField(child=serializers.CharField(), required=False)
    dialog_phrase_options = serializers.ListField(child=serializers.CharField(), required=False)
    dialog_phrase_turns = serializers.ListField(child=serializers.DictField(), required=False)
    dialog_phrase_odd_index = serializers.IntegerField(required=False, allow_null=True)
    related_dialogs = serializers.ListField(child=serializers.DictField(), required=False)
    session_restore_state = SessionRestoreStateSerializer(required=False)


class SubmitReviewSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    correct = serializers.BooleanField()
    direction = serializers.ChoiceField(choices=Item.ReviewDirection.choices)


class MarkSeenSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()


class CompleteDifficultItemSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()


class RestoreSessionItemStateSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    state = SessionRestoreStateSerializer()


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
    required_words = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )
    required_words_language = serializers.ChoiceField(
        choices=["source", "target"],
        required=False,
        default="target",
    )
    dialog_length = serializers.ChoiceField(
        choices=["standard", "short_three"],
        required=False,
        default="standard",
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
