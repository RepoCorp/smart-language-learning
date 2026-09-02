from django.conf import settings
from django.db import models
from .languages import STUDY_LANGUAGE_CHOICES
from .models_ai_usage import DailyAIUsage, UserAIUsageLimit
from .models_auth import (
    DisabledElevenLabsVoice,
    PinSetupToken,
    RegistrationRequest,
    UserAuthToken,
    UserOnboarding,
    UserTimezonePreference,
    _generate_auth_token_key,
)


class Item(models.Model):
    class ItemType(models.TextChoices):
        WORD = "word", "Word"
        PHRASE = "phrase", "Phrase"

    class ReviewDirection(models.TextChoices):
        SPANISH_TO_GERMAN = "es_to_de", "Spanish to German"
        GERMAN_TO_SPANISH = "de_to_es", "German to Spanish"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_items",
        null=True,
        blank=True,
    )
    item_type = models.CharField(max_length=10, choices=ItemType.choices)
    spanish_text = models.CharField(max_length=255)
    german_text = models.CharField(max_length=255)
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
    example_sentence = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    word_type = models.CharField(max_length=30, blank=True)
    plural_german = models.CharField(max_length=255, blank=True)
    audio_url = models.URLField(blank=True)
    exercise_phrases = models.JSONField(default=dict, blank=True)
    confusing_with = models.ManyToManyField("self", blank=True, symmetrical=True)
    compare_words_insights = models.TextField(blank=True)
    phrase_grammar_checked_at = models.DateTimeField(null=True, blank=True)
    is_learned = models.BooleanField(default=False)
    is_difficult = models.BooleanField(default=False)
    difficult_marked_at = models.DateTimeField(null=True, blank=True)

    repetition_count = models.PositiveIntegerField(default=0)
    interval_days = models.PositiveIntegerField(default=1)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)

    repetition_count_es_to_de = models.PositiveIntegerField(default=0)
    interval_days_es_to_de = models.PositiveIntegerField(default=1)
    last_reviewed_at_es_to_de = models.DateTimeField(null=True, blank=True)
    due_at_es_to_de = models.DateTimeField(null=True, blank=True)

    repetition_count_de_to_es = models.PositiveIntegerField(default=0)
    interval_days_de_to_es = models.PositiveIntegerField(default=1)
    last_reviewed_at_de_to_es = models.DateTimeField(null=True, blank=True)
    due_at_de_to_es = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.item_type}: {self.spanish_text} -> {self.german_text}"


class ItemGrammarFeature(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="grammar_features")
    feature_key = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("item", "feature_key"),
                name="learning_item_grammar_feature_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.item_id}: {self.feature_key}"


class SavedTopic(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_saved_topics",
        null=True,
        blank=True,
    )
    topic = models.CharField(max_length=120)
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
    used_count = models.PositiveIntegerField(default=1)
    last_used_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "topic", "source_language", "target_language"),
                name="learning_savedtopic_user_topic_langpair_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.topic} ({self.source_language}->{self.target_language})"


class SavedTopicContext(models.Model):
    topic = models.ForeignKey(SavedTopic, on_delete=models.CASCADE, related_name="contexts")
    context = models.CharField(max_length=400)
    used_count = models.PositiveIntegerField(default=1)
    last_used_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("topic", "context"),
                name="learning_savedtopiccontext_topic_context_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.topic.topic}: {self.context}"


class SavedDialog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_saved_dialogs",
        null=True,
        blank=True,
    )
    topic = models.CharField(max_length=120)
    context = models.CharField(max_length=400, blank=True)
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
    proficiency_level = models.CharField(max_length=2, default="A2")
    turns = models.JSONField(default=list, blank=True)
    audio_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.topic} ({self.source_language}->{self.target_language})"


class DialogTurn(models.Model):
    dialog = models.ForeignKey(SavedDialog, on_delete=models.CASCADE, related_name="dialog_turns")
    turn_index = models.PositiveIntegerField()
    source_text = models.TextField(blank=True)
    target_text = models.TextField(blank=True)
    audio_url = models.URLField(blank=True, default="")
    clear_audio_url = models.URLField(blank=True, default="")

    class Meta:
        ordering = ("turn_index", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("dialog", "turn_index"),
                name="lrn_dturn_dialog_turn_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"Dialog {self.dialog_id} turn {self.turn_index}"


class ItemDialogOccurrence(models.Model):
    class Side(models.TextChoices):
        SOURCE = "source", "Source"
        TARGET = "target", "Target"

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="dialog_occurrences")
    dialog = models.ForeignKey(SavedDialog, on_delete=models.CASCADE, related_name="item_occurrences")
    turn = models.ForeignKey(DialogTurn, on_delete=models.CASCADE, related_name="item_occurrences")
    turn_index = models.PositiveIntegerField()
    side = models.CharField(max_length=10, choices=Side.choices)
    match_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("item", "dialog", "turn_index", "side"),
                name="lrn_iocc_item_dlg_turn_side_uq",
            )
        ]
        indexes = [
            models.Index(fields=("item", "created_at"), name="lrn_iocc_item_created_idx"),
            models.Index(fields=("dialog",), name="lrn_iocc_dialog_idx"),
        ]

    def __str__(self) -> str:
        return f"Item {self.item_id} in dialog {self.dialog_id} turn {self.turn_index}"


class ItemQuestionExchange(models.Model):
    class QuestionType(models.TextChoices):
        GRAMMAR_EXPLANATION = "grammar_explanation", "Grammar explanation"
        MORE_EXAMPLES = "more_examples", "More examples"
        COMMON_MISTAKES = "common_mistakes", "Common mistakes"
        CUSTOM_RELATED = "custom_related", "Custom related question"

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="question_exchanges")
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
    question_type = models.CharField(max_length=40, choices=QuestionType.choices)
    question_text = models.CharField(max_length=255)
    answer_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
        indexes = [
            models.Index(fields=("item", "created_at"), name="lrn_iq_item_created_idx"),
        ]

    def __str__(self) -> str:
        return f"Item {self.item_id} {self.question_type}"


class LearningStreakProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_streak_profile",
    )
    tracking_started_on = models.DateField()
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    flex_days = models.PositiveSmallIntegerField(default=0)
    qualifying_days_toward_flex = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)


class DailyLearningProgress(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        STUDIED = "studied", "Studied"
        FLEX = "flex", "Flex"
        PAUSED = "paused", "Paused"
        MISSED = "missed", "Missed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_learning_progress",
    )
    date = models.DateField()
    active_seconds = models.PositiveIntegerField(default=0)
    active_seconds_by_language = models.JSONField(default=dict, blank=True)
    completed_entry_keys = models.JSONField(default=list, blank=True)
    completed_daily_pool = models.BooleanField(default=False)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "date"),
                name="learning_dailyprogress_user_date_uniq",
            )
        ]
        ordering = ("-date",)


class LearningStreakPause(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_streak_pauses",
    )
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-end_date", "-id")
