from __future__ import annotations

from datetime import timedelta
from typing import TypedDict

from django.core.management.base import BaseCommand
from django.utils import timezone

from learning.models import Item


class SeedItem(TypedDict):
    item_type: str
    spanish_text: str
    german_text: str
    example_sentence: str
    notes: str
    audio_url: str
    is_due_review: bool


SEED_ITEMS: list[SeedItem] = [
    {
        "item_type": Item.ItemType.WORD,
        "spanish_text": "hola",
        "german_text": "hallo",
        "example_sentence": "Hola, ¿cómo estás?",
        "notes": "Saludo informal.",
        "audio_url": "https://example.com/audio/hola.mp3",
        "is_due_review": True,
    },
    {
        "item_type": Item.ItemType.WORD,
        "spanish_text": "gracias",
        "german_text": "danke",
        "example_sentence": "Gracias por tu ayuda.",
        "notes": "Forma básica de agradecimiento.",
        "audio_url": "https://example.com/audio/gracias.mp3",
        "is_due_review": True,
    },
    {
        "item_type": Item.ItemType.WORD,
        "spanish_text": "casa",
        "german_text": "Haus",
        "example_sentence": "Mi casa es pequeña.",
        "notes": "Sustantivo neutro: das Haus.",
        "audio_url": "https://example.com/audio/casa.mp3",
        "is_due_review": False,
    },
    {
        "item_type": Item.ItemType.PHRASE,
        "spanish_text": "¿Dónde está la estación?",
        "german_text": "Wo ist der Bahnhof?",
        "example_sentence": "¿Dónde está la estación de tren?",
        "notes": "Pregunta útil para viajar.",
        "audio_url": "https://example.com/audio/estacion.mp3",
        "is_due_review": True,
    },
    {
        "item_type": Item.ItemType.PHRASE,
        "spanish_text": "Me llamo Ana",
        "german_text": "Ich heiße Ana",
        "example_sentence": "Hola, me llamo Ana.",
        "notes": "Presentación personal.",
        "audio_url": "https://example.com/audio/me-llamo-ana.mp3",
        "is_due_review": True,
    },
    {
        "item_type": Item.ItemType.PHRASE,
        "spanish_text": "Quisiera un café",
        "german_text": "Ich möchte einen Kaffee",
        "example_sentence": "En el bar: quisiera un café.",
        "notes": "Expresión educada para pedir.",
        "audio_url": "https://example.com/audio/cafe.mp3",
        "is_due_review": False,
    },
    {
        "item_type": Item.ItemType.PHRASE,
        "spanish_text": "No entiendo",
        "german_text": "Ich verstehe nicht",
        "example_sentence": "Perdón, no entiendo.",
        "notes": "Frase útil cuando no comprendes.",
        "audio_url": "https://example.com/audio/no-entiendo.mp3",
        "is_due_review": False,
    },
]


class Command(BaseCommand):
    help = "Load seed items for prototype"

    def handle(self, *args: object, **options: object) -> None:
        if Item.objects.exists():
            self.stdout.write(self.style.WARNING("Items already exist; skipping seed."))
            return

        now = timezone.now()
        for seed_item in SEED_ITEMS:
            item = Item.objects.create(
                item_type=seed_item["item_type"],
                spanish_text=seed_item["spanish_text"],
                german_text=seed_item["german_text"],
                example_sentence=seed_item["example_sentence"],
                notes=seed_item["notes"],
                audio_url=seed_item["audio_url"],
            )
            is_due_review = seed_item["is_due_review"]
            if is_due_review:
                item.repetition_count_es_to_de = 1
                item.interval_days_es_to_de = 1
                item.last_reviewed_at_es_to_de = now - timedelta(days=2)
                item.due_at_es_to_de = now - timedelta(hours=1)

                item.repetition_count_de_to_es = 1
                item.interval_days_de_to_es = 1
                item.last_reviewed_at_de_to_es = now - timedelta(days=2)
                item.due_at_de_to_es = now - timedelta(minutes=30)
                item.save(
                    update_fields=[
                        "repetition_count_es_to_de",
                        "interval_days_es_to_de",
                        "last_reviewed_at_es_to_de",
                        "due_at_es_to_de",
                        "repetition_count_de_to_es",
                        "interval_days_de_to_es",
                        "last_reviewed_at_de_to_es",
                        "due_at_de_to_es",
                        "updated_at",
                    ]
                )

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SEED_ITEMS)} items."))
