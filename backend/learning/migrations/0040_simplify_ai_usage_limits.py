from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0039_rename_ai_usage_limits_weekly"),
    ]

    operations = [
        migrations.RemoveField(model_name="useraiusagelimit", name="weekly_text_requests"),
        migrations.RemoveField(model_name="useraiusagelimit", name="weekly_image_requests"),
        migrations.RemoveField(model_name="useraiusagelimit", name="weekly_audio_characters"),
        migrations.AddField(
            model_name="useraiusagelimit",
            name="weekly_generation_credits",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="dailyaiusage",
            name="quota_credits",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
