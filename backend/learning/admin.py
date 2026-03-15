from django.contrib import admin

from .models import DialogTurn, ExcludedWordSuggestion, Item, ItemDialogOccurrence, SavedDialog, SavedTopic, SavedTopicContext


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("id", "item_type", "spanish_text", "german_text", "due_at", "repetition_count")
    list_filter = ("item_type",)
    search_fields = ("spanish_text", "german_text")


@admin.register(ExcludedWordSuggestion)
class ExcludedWordSuggestionAdmin(admin.ModelAdmin):
    list_display = ("id", "spanish_text", "german_text", "created_at")
    search_fields = ("spanish_text", "german_text")


@admin.register(SavedTopic)
class SavedTopicAdmin(admin.ModelAdmin):
    list_display = ("id", "topic", "used_count", "last_used_at", "created_at")
    search_fields = ("topic",)


@admin.register(SavedTopicContext)
class SavedTopicContextAdmin(admin.ModelAdmin):
    list_display = ("id", "topic", "context", "used_count", "last_used_at", "created_at")
    search_fields = ("topic__topic", "context")


@admin.register(SavedDialog)
class SavedDialogAdmin(admin.ModelAdmin):
    list_display = ("id", "topic", "source_language", "target_language", "created_at")
    search_fields = ("topic", "context")


@admin.register(DialogTurn)
class DialogTurnAdmin(admin.ModelAdmin):
    list_display = ("id", "dialog", "turn_index")
    search_fields = ("dialog__topic", "source_text", "target_text")


@admin.register(ItemDialogOccurrence)
class ItemDialogOccurrenceAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "dialog", "turn_index", "side", "match_score", "created_at")
    list_filter = ("side",)
