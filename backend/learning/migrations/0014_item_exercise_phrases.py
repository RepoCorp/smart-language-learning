from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0013_item_is_learned"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="exercise_phrases",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
