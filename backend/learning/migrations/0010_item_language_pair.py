from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0009_savedtopic_language_pair"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="source_language",
            field=models.CharField(
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
        migrations.AddField(
            model_name="item",
            name="target_language",
            field=models.CharField(
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
    ]
