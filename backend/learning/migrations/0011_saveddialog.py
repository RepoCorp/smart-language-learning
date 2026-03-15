from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0010_item_language_pair"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedDialog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("topic", models.CharField(max_length=120)),
                ("context", models.CharField(blank=True, max_length=400)),
                (
                    "source_language",
                    models.CharField(
                        choices=[
                            ("spanish", "Spanish"),
                            ("english", "English"),
                            ("german", "German"),
                            ("french", "French"),
                            ("italian", "Italian"),
                            ("portuguese", "Portuguese"),
                        ],
                        default="spanish",
                        max_length=20,
                    ),
                ),
                (
                    "target_language",
                    models.CharField(
                        choices=[
                            ("spanish", "Spanish"),
                            ("english", "English"),
                            ("german", "German"),
                            ("french", "French"),
                            ("italian", "Italian"),
                            ("portuguese", "Portuguese"),
                        ],
                        default="german",
                        max_length=20,
                    ),
                ),
                ("turns", models.JSONField(blank=True, default=list)),
                ("audio_url", models.URLField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]
