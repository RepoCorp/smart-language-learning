from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Item",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_type", models.CharField(choices=[("word", "Word"), ("phrase", "Phrase")], max_length=10)),
                ("spanish_text", models.CharField(max_length=255)),
                ("german_text", models.CharField(max_length=255)),
                ("example_sentence", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                ("audio_url", models.URLField(blank=True)),
                ("repetition_count", models.PositiveIntegerField(default=0)),
                ("interval_days", models.PositiveIntegerField(default=1)),
                ("last_reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("due_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        )
    ]
