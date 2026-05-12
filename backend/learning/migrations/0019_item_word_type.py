from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0018_remove_conversationfingerprint"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="word_type",
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
