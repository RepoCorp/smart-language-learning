from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0020_delete_excludedwordsuggestion"),
    ]

    operations = [
        migrations.AddField(
            model_name="dialogturn",
            name="audio_url",
            field=models.URLField(blank=True, default=""),
        ),
    ]
