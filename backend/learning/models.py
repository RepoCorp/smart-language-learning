from django.db import models


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
    example_sentence = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    audio_url = models.URLField(blank=True)

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
    topic = models.CharField(max_length=120, unique=True)
    used_count = models.PositiveIntegerField(default=1)
    last_used_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.topic


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
