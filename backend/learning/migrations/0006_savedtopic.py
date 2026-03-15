from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0005_excludedwordsuggestion_add_german_pair_unique"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedTopic",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("topic", models.CharField(max_length=120, unique=True)),
                ("used_count", models.PositiveIntegerField(default=1)),
                ("last_used_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
