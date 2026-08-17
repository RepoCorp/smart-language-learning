from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0040_simplify_ai_usage_limits"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="useraiusagelimit",
            name="weekly_realtime_sessions",
        ),
        migrations.AddField(
            model_name="useraiusagelimit",
            name="weekly_realtime_minutes",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
