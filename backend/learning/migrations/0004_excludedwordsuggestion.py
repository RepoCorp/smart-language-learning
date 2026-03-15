from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0003_phrase_directional_backfill"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExcludedWordSuggestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("spanish_text", models.CharField(max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
