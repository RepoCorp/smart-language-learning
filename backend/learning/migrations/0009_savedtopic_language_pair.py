from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0008_conversationfingerprint"),
    ]

    operations = [
        migrations.AlterField(
            model_name="savedtopic",
            name="topic",
            field=models.CharField(max_length=120),
        ),
        migrations.AddField(
            model_name="savedtopic",
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
            model_name="savedtopic",
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
        migrations.AddConstraint(
            model_name="savedtopic",
            constraint=models.UniqueConstraint(
                fields=("topic", "source_language", "target_language"),
                name="learning_savedtopic_topic_langpair_uniq",
            ),
        ),
    ]
