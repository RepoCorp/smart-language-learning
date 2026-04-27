from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0017_multi_user_support"),
    ]

    operations = [
        migrations.DeleteModel(
            name="ConversationFingerprint",
        ),
    ]
