from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0044_useraiusagelimit_weekly_elevenlabs_music_seconds"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="phrase_grammar_catalog_version",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
