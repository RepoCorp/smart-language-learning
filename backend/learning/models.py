from django.db import models

STUDY_LANGUAGE_CHOICES = (
    ("spanish", "Spanish"),
    ("english", "English"),
    ("german", "German"),
    ("french", "French"),
    ("italian", "Italian"),
    ("portuguese", "Portuguese"),
)


class Item(models.Model):
    class ItemType(models.TextChoices):
        WORD = "word", "Word"
        PHRASE = "phrase", "Phrase"

    class ReviewDirection(models.TextChoices):
        SPANISH_TO_GERMAN = "es_to_de", "Spanish to German"
        GERMAN_TO_SPANISH = "de_to_es", "German to Spanish"

    item_type = models.CharField(max_length=10, choices=ItemType.choices)
    spanish_text = models.CharField(max_length=255)
    german_text = models.CharField(max_length=255)
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
    example_sentence = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    audio_url = models.URLField(blank=True)
    is_learned = models.BooleanField(default=False)

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


class ExcludedWordSuggestion(models.Model):
    spanish_text = models.CharField(max_length=255)
    german_text = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("spanish_text", "german_text"),
                name="learning_excludedwordsuggestion_es_de_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.spanish_text} -> {self.german_text}"


class SavedTopic(models.Model):
    topic = models.CharField(max_length=120)
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
    used_count = models.PositiveIntegerField(default=1)
    last_used_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("topic", "source_language", "target_language"),
                name="learning_savedtopic_topic_langpair_uniq",
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


class ConversationFingerprint(models.Model):
    first_line = models.CharField(max_length=255)
    keywords = models.CharField(max_length=500, blank=True)
    fingerprint = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.first_line


class SavedDialog(models.Model):
    topic = models.CharField(max_length=120)
    context = models.CharField(max_length=400, blank=True)
    source_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="spanish")
    target_language = models.CharField(max_length=20, choices=STUDY_LANGUAGE_CHOICES, default="german")
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
