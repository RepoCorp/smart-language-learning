from django.db import migrations, models


def backfill_word_directional_progress(apps, schema_editor):
    Item = apps.get_model("learning", "Item")
    for item in Item.objects.filter(item_type="word"):
        item.repetition_count_es_to_de = item.repetition_count
        item.interval_days_es_to_de = item.interval_days
        item.last_reviewed_at_es_to_de = item.last_reviewed_at
        item.due_at_es_to_de = item.due_at

        item.repetition_count_de_to_es = item.repetition_count
        item.interval_days_de_to_es = item.interval_days
        item.last_reviewed_at_de_to_es = item.last_reviewed_at
        item.due_at_de_to_es = item.due_at
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
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="due_at_de_to_es",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="item",
            name="due_at_es_to_de",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="item",
            name="interval_days_de_to_es",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="item",
            name="interval_days_es_to_de",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="item",
            name="last_reviewed_at_de_to_es",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="item",
            name="last_reviewed_at_es_to_de",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="item",
            name="repetition_count_de_to_es",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="item",
            name="repetition_count_es_to_de",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(backfill_word_directional_progress, migrations.RunPython.noop),
    ]
