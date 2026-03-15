from django.contrib import admin

from .models import Item


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("id", "item_type", "spanish_text", "german_text", "due_at", "repetition_count")
    list_filter = ("item_type",)
    search_fields = ("spanish_text", "german_text")
