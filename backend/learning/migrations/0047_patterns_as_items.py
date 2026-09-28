from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import migrations, models
from django.utils import timezone


def migrate_patterns(apps, schema_editor):
    Item = apps.get_model("learning", "Item")
    Progress = apps.get_model("learning", "WordFormationProgress")
    Preferences = apps.get_model("learning", "UserTimezonePreference")
    database = schema_editor.connection.alias
    zones = dict(Preferences.objects.using(database).values_list("user_id", "timezone"))
    now = timezone.now()
    for progress in Progress.objects.using(database).iterator():
        _, kind, affix = progress.pattern_key.split("_", 2)
        affix = {"able": "able_ible", "tion_sion": "tion_sion", "ize_ise": "ize_ise"}.get(affix, affix)
        label = " / ".join(f"{part}-" if kind == "prefix" else f"-{part}" for part in affix.split("_"))
        values = {
            "spanish_text": "Patrón de formación de palabras" if progress.source_language == "spanish" else "Word-building pattern",
            "german_text": label,
            "review_count_es_to_de": progress.review_count,
            "repetition_count_es_to_de": progress.repetition_count,
            "interval_days_es_to_de": progress.interval_days,
            "last_reviewed_at_es_to_de": progress.last_reviewed_at,
            "due_at_es_to_de": progress.due_at,
        }
        if progress.last_reviewed_at:
            zone = ZoneInfo(zones.get(progress.user_id) or "UTC")
            day = now.astimezone(zone).date() + timedelta(days=1)
            if day == progress.due_at.astimezone(zone).date():
                day += timedelta(days=1)
            values.update(last_reviewed_at_de_to_es=now, due_at_de_to_es=datetime.combine(day, time.min, tzinfo=zone))
        Item.objects.using(database).create(
            user_id=progress.user_id, item_type="pattern", pattern_key=progress.pattern_key,
            source_language=progress.source_language, target_language=progress.target_language, **values,
        )


class Migration(migrations.Migration):
    dependencies = [("learning", "0046_word_formation_progress")]
    operations = [
        migrations.AddField("item", "pattern_key", models.CharField(max_length=80, blank=True, default="")),
        migrations.AddField("item", "review_count_es_to_de", models.PositiveIntegerField(default=0)),
        migrations.AddField("item", "review_count_de_to_es", models.PositiveIntegerField(default=0)),
        migrations.AlterField("item", "item_type", models.CharField(max_length=10, choices=[("word", "Word"), ("phrase", "Phrase"), ("pattern", "Pattern")])),
        migrations.AddConstraint("item", models.UniqueConstraint(
            fields=("user", "source_language", "target_language", "pattern_key"),
            condition=models.Q(item_type="pattern"), name="unique_user_pattern_item",
        )),
        migrations.RunPython(migrate_patterns),
        migrations.DeleteModel("WordFormationProgress"),
    ]
