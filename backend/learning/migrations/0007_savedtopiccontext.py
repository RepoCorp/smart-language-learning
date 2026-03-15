from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0006_savedtopic"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedTopicContext",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("context", models.CharField(max_length=400)),
                ("used_count", models.PositiveIntegerField(default=1)),
                ("last_used_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("topic", models.ForeignKey(on_delete=models.CASCADE, related_name="contexts", to="learning.savedtopic")),
            ],
        ),
        migrations.AddConstraint(
            model_name="savedtopiccontext",
            constraint=models.UniqueConstraint(
                fields=("topic", "context"),
                name="learning_savedtopiccontext_topic_context_uniq",
            ),
        ),
    ]
