from django.contrib import admin

from .models import ExcludedWordSuggestion, Item, SavedTopic, SavedTopicContext


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
