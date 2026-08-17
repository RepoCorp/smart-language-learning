from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0038_useraiusagelimit_daily_realtime_sessions"),
    ]

    operations = [
        migrations.RenameField(model_name="useraiusagelimit", old_name="daily_text_requests", new_name="weekly_text_requests"),
        migrations.RenameField(model_name="useraiusagelimit", old_name="daily_image_requests", new_name="weekly_image_requests"),
        migrations.RenameField(model_name="useraiusagelimit", old_name="daily_audio_characters", new_name="weekly_audio_characters"),
        migrations.RenameField(model_name="useraiusagelimit", old_name="daily_realtime_sessions", new_name="weekly_realtime_sessions"),
    ]
