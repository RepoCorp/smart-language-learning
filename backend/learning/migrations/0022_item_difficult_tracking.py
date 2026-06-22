from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0021_dialogturn_audio_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="difficult_marked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="item",
            name="is_difficult",
            field=models.BooleanField(default=False),
        ),
    ]
